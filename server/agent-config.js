const fs = require('fs');
const path = require('path');
const os = require('os');

const IS_WIN = process.platform === 'win32';
const DEFAULT_AGENT = (process.env.AHUB_AGENT || 'claude').toLowerCase();
const PROXY_ENV_KEYS = [
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy',
];

const AGENTS = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    envVar: 'CLAUDE_BIN',
    command: IS_WIN ? 'claude.cmd' : 'claude',
    windowsCandidates: [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude'),
      'claude.cmd',
      'claude',
    ],
    unixCandidates: [
      process.env.CLAUDE_BIN,
      '/root/.nvm/versions/node/v24.14.0/bin/claude',
      'claude',
    ],
    buildArgs({ resumeSessionId }) {
      const args = [];
      if (process.env.IS_SANDBOX === '1') args.push('--dangerously-skip-permissions');
      if (resumeSessionId) args.push('--resume', resumeSessionId);
      return args;
    },
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    envVar: 'CODEX_BIN',
    command: IS_WIN ? 'codex.cmd' : 'codex',
    windowsCandidates: [
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'codex.cmd'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'codex'),
      'codex.cmd',
      'codex',
    ],
    unixCandidates: [
      process.env.CODEX_BIN,
      'codex',
    ],
    buildArgs({ cwd, resumeSessionId }) {
      const common = [
        '--cd', cwd,
        '--no-alt-screen',
        '-c', `shell_environment_policy.exclude=${JSON.stringify(PROXY_ENV_KEYS)}`,
      ];
      if (process.env.IS_SANDBOX === '1') common.push('--dangerously-bypass-approvals-and-sandbox');
      if (resumeSessionId) return ['resume', ...common, resumeSessionId];
      return common;
    },
  },
};

function normalizeAgent(agent) {
  const id = (agent || DEFAULT_AGENT || 'claude').toLowerCase();
  return AGENTS[id] ? id : 'claude';
}

function commandExists(command) {
  if (!command || command.includes(path.sep)) return false;
  const pathDirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const names = IS_WIN && !/\.(cmd|exe|bat)$/i.test(command)
    ? [`${command}.cmd`, `${command}.exe`, `${command}.bat`, command]
    : [command];
  return pathDirs.some(dir => names.some(name => {
    try { fs.accessSync(path.join(dir, name), fs.constants.X_OK); return true; } catch (_) { return false; }
  }));
}

function findAgentBin(agentId) {
  const cfg = AGENTS[normalizeAgent(agentId)];
  const fromEnv = process.env[cfg.envVar];
  if (fromEnv) return fromEnv;

  const candidates = IS_WIN ? cfg.windowsCandidates : cfg.unixCandidates;
  for (const c of candidates) {
    if (!c) continue;
    if (!c.includes(path.sep)) {
      if (commandExists(c)) return c;
      continue;
    }
    try { fs.accessSync(c, fs.constants.X_OK); return c; } catch (_) {}
  }
  return cfg.command;
}

function getAgentConfig(agent) {
  return AGENTS[normalizeAgent(agent)];
}

function withoutProxyEnv(env = {}) {
  const clean = { ...env };
  for (const key of PROXY_ENV_KEYS) delete clean[key];
  return clean;
}

function getAgentProxyEnv(agent) {
  const agentId = normalizeAgent(agent);
  const prefix = agentId.toUpperCase();
  const proxy = process.env[`${prefix}_PROXY`] || '';
  if (!proxy) return {};

  const noProxy = process.env[`${prefix}_NO_PROXY`] || process.env.AGENT_NO_PROXY || 'localhost,127.0.0.1,::1';
  return {
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    ALL_PROXY: proxy,
    http_proxy: proxy,
    https_proxy: proxy,
    all_proxy: proxy,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  };
}

function buildAgentEnv(agent, baseEnv = process.env, clientEnv = {}) {
  return {
    ...withoutProxyEnv(baseEnv),
    ...withoutProxyEnv(clientEnv),
    ...getAgentProxyEnv(agent),
  };
}

module.exports = {
  AGENTS,
  PROXY_ENV_KEYS,
  DEFAULT_AGENT: normalizeAgent(DEFAULT_AGENT),
  normalizeAgent,
  findAgentBin,
  getAgentConfig,
  withoutProxyEnv,
  getAgentProxyEnv,
  buildAgentEnv,
};

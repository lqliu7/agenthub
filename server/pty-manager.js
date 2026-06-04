const pty = require('node-pty');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { normalizeAgent, findAgentBin, getAgentConfig, buildAgentEnv } = require('./agent-config');

const IS_WIN = process.platform === 'win32';
const MAX_SESSIONS = 20;
const SCROLLBACK_LIMIT = 500 * 1024; // 500KB

const AHUB_DIR    = path.join(os.homedir(), '.agenthub');
const LOG_DIR    = path.join(AHUB_DIR, 'logs');
const SOCK_DIR   = IS_WIN ? '\\\\.\\pipe\\ahub' : path.join(AHUB_DIR, 'sockets');
const META_FILE  = path.join(AHUB_DIR, 'sessions.json');

if (!IS_WIN) {
  for (const d of [LOG_DIR, path.join(AHUB_DIR, 'sockets')]) fs.mkdirSync(d, { recursive: true });
} else {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 启动时清除所有旧 log 和 socket 文件（Unix only，Windows pipe 自动清理）
try {
  for (const f of fs.readdirSync(LOG_DIR)) fs.unlinkSync(path.join(LOG_DIR, f));
  if (!IS_WIN) {
    const sockDir = path.join(AHUB_DIR, 'sockets');
    for (const f of fs.readdirSync(sockDir)) fs.unlinkSync(path.join(sockDir, f));
  }
} catch (_) {}

// 获取 socket/pipe 路径
function getSocketPath(sessionId) {
  if (IS_WIN) return `\\\\.\\pipe\\ahub-${sessionId}`;
  return path.join(AHUB_DIR, 'sockets', `${sessionId}.sock`);
}

function expandHome(input) {
  if (!input || input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) return path.join(os.homedir(), input.slice(2));
  return input;
}

/**
 * sessions: Map<sessionId, {
 *   name, workingDir,
 *   ptyProcess | null,
 *   clients: Set<Client>,   // 所有订阅者（WS 或 Unix socket）
 *   buffer,                 // in-memory scrollback
 *   logPath, logStream,
 *   socketPath, socketServer,
 *   exitCode | null,
 *   createdAt, lastActiveAt,
 * }>
 *
 * Client interface: { send(data: string), sendJSON(obj), close(), type: 'ws'|'unix' }
 */
const sessions = new Map();
const wsToSession = new Map(); // wsId → { sessionId, client }
const allWS = new Map();       // wsId → ws  (所有已连接的 WS，无论是否 attach 了 session)
const shellByWS = new Map();   // wsId → ephemeral shell PTY, not persisted

// ── Client wrappers ───────────────────────────────────────────────────────────

function wsClient(ws) {
  return {
    type: 'ws',
    id: uuidv4(),
    cols: 80, rows: 24,   // 该客户端上报的终端尺寸
    send(data)    { try { if (ws.readyState === 1) ws.send(data); } catch (_) {} },
    sendJSON(obj) { try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (_) {} },
    close()       { try { ws.close(); } catch (_) {} },
    _ws: ws,
  };
}

function unixClient(socket) {
  return {
    type: 'unix',
    id: uuidv4(),
    cols: 80, rows: 24,   // 该客户端上报的终端尺寸（通过 OOB RESIZE 帧更新）
    send(data)    { try { if (!socket.destroyed) socket.write(data); } catch (_) {} },
    sendJSON(_)   {},
    close()       { try { socket.destroy(); } catch (_) {} },
    _socket: socket,
  };
}

// ── Broadcast helpers ─────────────────────────────────────────────────────────

function broadcastData(session, data) {
  for (const c of session.clients) c.send(data);
}

function broadcastJSON(session, obj) {
  for (const c of session.clients) c.sendJSON(obj);
}

function broadcastSessionList() {
  const list = JSON.stringify({ type: 'session_list', sessions: getSessionList() });
  // Send to ALL connected WS clients (not just those attached to a session)
  for (const [, ws] of allWS) {
    try { if (ws.readyState === 1) ws.send(list); } catch (_) {}
  }
}

function registerWS(wsId, ws)   { allWS.set(wsId, ws); }
function unregisterWS(wsId)     { allWS.delete(wsId); }

// ── Meta persistence ──────────────────────────────────────────────────────────

function saveMeta() {
  const data = [];
  for (const [id, s] of sessions) {
    data.push({
      sessionId: id, name: s.name, workingDir: s.workingDir, agent: s.agent || 'claude',
      alive: s.exitCode === null && !!s.ptyProcess,
      exitCode: s.exitCode, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt,
      logPath: s.logPath, socketPath: s.socketPath,
    });
  }
  try { fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2)); } catch (_) {}
}

function restoreDeadSessions() {
  // 每次启动清除所有历史 session（不恢复）
  try { fs.writeFileSync(META_FILE, '[]'); } catch (_) {}
}
restoreDeadSessions();

// ── Unix socket server per session ────────────────────────────────────────────

function startSocketServer(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const sockPath = getSocketPath(sessionId);
  if (!IS_WIN) { try { fs.unlinkSync(sockPath); } catch (_) {} }

  const server = net.createServer(socket => {
    // Send scrollback on connect
    if (session.buffer) socket.write(session.buffer);

    const client = unixClient(socket);
    session.clients.add(client);

    let inBuf = '';
    socket.on('data', buf => {
      inBuf += buf.toString('binary');
      // Parse out-of-band resize frames: \x00RESIZE:<cols>:<rows>\n
      let processed;
      do {
        processed = false;
        const nullIdx = inBuf.indexOf('\x00');
        if (nullIdx !== -1) {
          // pass everything before \x00 as PTY input
          if (nullIdx > 0 && session.ptyProcess) {
            session.ptyProcess.write(Buffer.from(inBuf.slice(0, nullIdx), 'binary').toString());
          }
          const rest = inBuf.slice(nullIdx + 1);
          const nlIdx = rest.indexOf('\n');
          if (nlIdx !== -1) {
            const frame = rest.slice(0, nlIdx);
            inBuf = rest.slice(nlIdx + 1);
            if (frame.startsWith('RESIZE:')) {
              const parts = frame.slice(7).split(':');
              const cols = parseInt(parts[0], 10);
              const rows = parseInt(parts[1], 10);
              if (cols > 0 && rows > 0) {
                // 更新该 unix client 记录的尺寸
                client.cols = cols;
                client.rows = rows;
                if (session.ptyProcess) {
                  try { session.ptyProcess.resize(cols, rows); } catch (_) {}
                }
              }
            }
            processed = true;
          } else {
            // incomplete frame, wait for more data
            inBuf = '\x00' + rest;
          }
        } else {
          if (inBuf && session.ptyProcess) {
            // 输入时 resize 到该 unix client 的尺寸
            try { session.ptyProcess.resize(client.cols || 80, client.rows || 24); } catch (_) {}
            session.ptyProcess.write(Buffer.from(inBuf, 'binary').toString());
            session.lastActiveAt = Date.now();
          }
          inBuf = '';
        }
      } while (processed && inBuf.length > 0);
    });

    socket.on('close', () => session.clients.delete(client));
    socket.on('error', () => session.clients.delete(client));
  });

  server.listen(sockPath, () => {
    if (!IS_WIN) { try { fs.chmodSync(sockPath, 0o600); } catch (_) {} }
  });
  server.on('error', err => console.error(`Socket server [${sessionId}]:`, err.message));

  session.socketPath  = sockPath;
  session.socketServer = server;
  saveMeta();
}

// ── Create session ────────────────────────────────────────────────────────────

function createSession(ws, wsId, { workingDir, resumeSessionId, name, agent, cols = 80, rows = 24, env: clientEnv = {} }) {
  // 防重复：同一个 wsId 已有 session，直接复用
  if (wsToSession.has(wsId)) {
    const existing = wsToSession.get(wsId);
    const existingSession = sessions.get(existing.sessionId);
    if (existingSession && existingSession.exitCode === null && existingSession.ptyProcess) {
      try { ws.send(JSON.stringify({ type: 'session_id', sessionId: existing.sessionId, name: existingSession.name })); } catch (_) {}
      return;
    }
    wsToSession.delete(wsId);
  }

  const cwd = (workingDir && workingDir.trim()) ? expandHome(workingDir.trim())
    : (IS_WIN ? process.env.USERPROFILE || 'C:\\' : process.env.HOME || '/tmp');
  const agentId = normalizeAgent(agent);
  const agentCfg = getAgentConfig(agentId);

  // 全局防重复：同 agent + cwd + resumeSessionId 已有活跃 session → 直接 attach
  for (const [existingId, s] of sessions) {
    if (
      s.exitCode === null &&
      s.ptyProcess &&
      (s.agent || 'claude') === agentId &&
      s.workingDir === cwd &&
      (s.resumeSessionId || '') === (resumeSessionId || '')
    ) {
      // Attach to existing session instead of spawning a new one
      attachSession(ws, wsId, existingId);
      return;
    }
  }

  const alive = [...sessions.values()].filter(s => s.exitCode === null && s.ptyProcess).length;
  if (alive >= MAX_SESSIONS) {
    try { ws.send(JSON.stringify({ type: 'error', message: `Max sessions reached (${MAX_SESSIONS} alive). Kill or delete existing sessions first.` })); } catch (_) {}
    return;
  }
  // Default name: <basename(cwd)>
  const baseName    = path.basename(cwd) || 'root';
  const sessionName = (name && name.trim()) ? name.trim() : baseName;
  const sessionId   = uuidv4();
  const logPath     = path.join(LOG_DIR, `${sessionId}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  // 防止 write-after-end 等 stream 错误未处理导致进程崩溃
  logStream.on('error', () => {});

  const args = agentCfg.buildArgs({ cwd, resumeSessionId });
  const agentBin = findAgentBin(agentId);

  // Windows: node-pty 用 ConPTY，直接 spawn CLI
  // 需要设置 useConpty: true，且不传 TERM（Windows 不需要）
  const agentEnv = buildAgentEnv(agentId, process.env, clientEnv);
  const spawnOpts = IS_WIN
    ? {
        useConpty: true,
        cols, rows, cwd,
        env: { ...agentEnv, CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL: '1' },
      }
    : {
        name: 'xterm-256color', cols, rows, cwd,
        env: {
          ...agentEnv,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL: '1',
        },
      };

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(agentBin, args, spawnOpts);
  } catch (err) {
    try { ws.send(JSON.stringify({ type: 'error', message: `Failed to spawn ${agentCfg.label}: ${err.message}` })); } catch (_) {}
    logStream.end();
    return;
  }

  const client = wsClient(ws);
  const session = {
    name: sessionName, workingDir: cwd, agent: agentId,
    resumeSessionId: resumeSessionId || '',
    ptyProcess, clients: new Set([client]),
    buffer: '', logPath, logStream,
    socketPath: null, socketServer: null,
    exitCode: null,
    createdAt: Date.now(), lastActiveAt: Date.now(),
  };
  sessions.set(sessionId, session);
  wsToSession.set(wsId, { sessionId, client });

  // Start Unix socket server
  startSocketServer(sessionId);

  client.sendJSON({ type: 'session_id', sessionId, name: sessionName });
  broadcastSessionList();
  saveMeta();

  ptyProcess.onData(data => {
    session.buffer += data;
    if (session.buffer.length > SCROLLBACK_LIMIT)
      session.buffer = session.buffer.slice(session.buffer.length - SCROLLBACK_LIMIT);
    // 通过 session.logStream 访问，避免闭包捕获旧 stream（rotate 后会更新）
    try { if (session.logStream && !session.logStream.destroyed) session.logStream.write(data); } catch (_) {}
    rotateLogIfNeeded(sessionId);
    session.lastActiveAt = Date.now();
    broadcastData(session, data);
  });

  ptyProcess.onExit(({ exitCode }) => {
    session.exitCode   = exitCode;
    session.ptyProcess = null;
    session.lastActiveAt = Date.now();
    try { if (session.logStream) session.logStream.end(); } catch (_) {}
    // 主动关闭所有已连接的 unix socket 客户端
    // （socketServer.close() 只停止接受新连接，不会关闭已有连接）
    for (const client of session.clients) {
      if (client.type === 'unix') {
        try { client._socket.destroy(); } catch (_) {}
      }
    }
    try { if (session.socketServer) session.socketServer.close(); } catch (_) {}
    broadcastJSON(session, { type: 'exit', exitCode });
    // 退出后 5s 自动删除（给客户端时间显示退出消息）
    setTimeout(() => {
      sessions.delete(sessionId);
      saveMeta();
      broadcastSessionList();
    }, 5000);
  });
}

// ── Attach ────────────────────────────────────────────────────────────────────

function attachSession(ws, wsId, sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', message: 'Session not found' })); } catch (_) {}
    return false;
  }

  const client = wsClient(ws);

  // Remove old client for this wsId if any
  const prev = wsToSession.get(wsId);
  if (prev) {
    const prevSession = sessions.get(prev.sessionId);
    if (prevSession) prevSession.clients.delete(prev.client);
  }

  session.clients.add(client);
  wsToSession.set(wsId, { sessionId, client });

  // Replay scrollback
  if (session.buffer) {
    client.sendJSON({ type: 'replay_start' });
    client.send(session.buffer);
    client.sendJSON({ type: 'replay_end' });
  }
  client.sendJSON({
    type: 'session_id', sessionId, name: session.name,
    alive: session.exitCode === null && !!session.ptyProcess,
  });
  if (session.exitCode !== null) {
    client.sendJSON({ type: 'exit', exitCode: session.exitCode });
  }
  return true;
}

// ── Message handler ───────────────────────────────────────────────────────────

function resolveShellCwd(input) {
  const fallback = path.parse(os.homedir()).root;
  const cwd = expandHome(input || fallback);
  try {
    const resolved = path.resolve(cwd);
    if (fs.statSync(resolved).isDirectory()) return resolved;
  } catch (_) {}
  return fallback;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (_) {
    return false;
  }
}

function findExecutable(command) {
  if (!command) return '';
  const expanded = expandHome(command);
  if (expanded.includes('/') || expanded.includes('\\')) {
    return isExecutable(expanded) ? expanded : '';
  }
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, expanded);
    if (isExecutable(candidate)) return candidate;
  }
  return '';
}

function selectShellBin() {
  if (IS_WIN) return process.env.ComSpec || 'cmd.exe';
  const candidates = [
    process.env.AHUB_SHELL,
    process.env.AHUB_SHELL,
    'zsh',
    'fish',
    'bash',
    process.env.SHELL,
    'sh',
    '/bin/sh',
  ];
  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    const found = findExecutable(candidate);
    if (found) return found;
  }
  return '/bin/sh';
}

function destroyShell(wsId) {
  const shell = shellByWS.get(wsId);
  if (!shell) return;
  shellByWS.delete(wsId);
  try { if (shell.ptyProcess) shell.ptyProcess.kill(); } catch (_) {}
}

function createShell(ws, wsId, { cwd, cols = 80, rows = 24, env: clientEnv = {} }) {
  destroyShell(wsId);
  const shellCwd = resolveShellCwd(cwd);
  const shellBin = selectShellBin();
  const shellEnv = {
    ...process.env,
    ...clientEnv,
    SHELL: IS_WIN ? process.env.ComSpec : shellBin,
    TERM: IS_WIN ? undefined : 'xterm-256color',
    COLORTERM: IS_WIN ? undefined : 'truecolor',
    TERM_PROGRAM: IS_WIN ? undefined : 'AgentHub',
  };
  for (const key of Object.keys(shellEnv)) {
    if (shellEnv[key] === undefined) delete shellEnv[key];
  }

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(shellBin, [], IS_WIN
      ? { useConpty: true, cols, rows, cwd: shellCwd, env: shellEnv }
      : { name: 'xterm-256color', cols, rows, cwd: shellCwd, env: shellEnv });
  } catch (err) {
    try { ws.send(JSON.stringify({ type: 'shell_error', message: err.message })); } catch (_) {}
    return;
  }

  const shell = { ptyProcess, cols, rows, cwd: shellCwd };
  shellByWS.set(wsId, shell);
  try { ws.send(JSON.stringify({ type: 'shell_ready', cwd: shellCwd })); } catch (_) {}

  ptyProcess.onData(data => {
    try { if (ws.readyState === 1) ws.send(data); } catch (_) {}
  });
  ptyProcess.onExit(({ exitCode }) => {
    shellByWS.delete(wsId);
    try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'shell_exit', exitCode })); } catch (_) {}
  });
}

function handleMessage(ws, wsId, raw) {
  // 输入时自动将 PTY resize 到该 client 的尺寸（谁在输入就按谁的窗口渲染）
  function resizeToClient(client, sess) {
    if (!sess || !sess.ptyProcess || !client) return;
    try { sess.ptyProcess.resize(client.cols || 80, client.rows || 24); } catch (_) {}
  }

  let msg;
  try { msg = JSON.parse(raw); } catch (_) {
    msg = null;
  }

  // 如果解析失败，或解析结果不是带 type 字段的对象（例如 "1" 被 JSON.parse 解析为数字 1）
  // 则视为原始 PTY 输入（raw string）
  if (!msg || typeof msg !== 'object' || !msg.type) {
    const shell = shellByWS.get(wsId);
    if (shell && shell.ptyProcess) {
      try { shell.ptyProcess.resize(shell.cols || 80, shell.rows || 24); } catch (_) {}
      shell.ptyProcess.write(raw);
      return;
    }

    // Raw string → PTY input
    const entry = wsToSession.get(wsId);
    const session = entry && sessions.get(entry.sessionId);
    if (session && session.ptyProcess) {
      resizeToClient(entry?.client, session);
      session.ptyProcess.write(raw);
      session.lastActiveAt = Date.now();
    }
    return;
  }

  const entry   = wsToSession.get(wsId);
  const session = entry && sessions.get(entry.sessionId);

  switch (msg.type) {
    case 'shell_start':
      createShell(ws, wsId, msg);
      break;

    case 'shell_resize': {
      const shell = shellByWS.get(wsId);
      if (shell && shell.ptyProcess) {
        shell.cols = msg.cols || 80;
        shell.rows = msg.rows || 24;
        try { shell.ptyProcess.resize(shell.cols, shell.rows); } catch (_) {}
      }
      break;
    }

    case 'shell_input': {
      const shell = shellByWS.get(wsId);
      if (shell && shell.ptyProcess && typeof msg.data === 'string') {
        try { shell.ptyProcess.resize(shell.cols || 80, shell.rows || 24); } catch (_) {}
        shell.ptyProcess.write(msg.data);
      }
      break;
    }

    case 'shell_kill':
      destroyShell(wsId);
      try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'shell_exit', exitCode: null })); } catch (_) {}
      break;

    case 'start':
      createSession(ws, wsId, msg);
      break;

    case 'attach':
      attachSession(ws, wsId, msg.sessionId);
      break;

    case 'resize':
      if (entry) { entry.client.cols = msg.cols || 80; entry.client.rows = msg.rows || 24; }
      if (session && session.ptyProcess)
        session.ptyProcess.resize(msg.cols || 80, msg.rows || 24);
      break;

    case 'kill': {
      // 支持两种方式：msg.sessionId 直接指定，或使用当前绑定的 session
      const killId = msg.sessionId || entry?.sessionId;
      const killSession = killId && sessions.get(killId);
      if (killSession && killSession.ptyProcess) {
        try { killSession.ptyProcess.kill(); } catch (_) {}
      }
      break;
    }

    case 'delete':
      if (msg.sessionId) {
        const s = sessions.get(msg.sessionId);
        if (s) {
          // Kill if still alive
          if (s.ptyProcess) { try { s.ptyProcess.kill(); } catch (_) {} }
          if (s.logStream)  { try { s.logStream.end(); }  catch (_) {} }
          if (s.socketServer) { try { s.socketServer.close(); } catch (_) {} }
          sessions.delete(msg.sessionId);
          saveMeta();
          broadcastSessionList();
        }
      }
      break;

    case 'rename':
      if (msg.sessionId && msg.name) {
        const s = sessions.get(msg.sessionId);
        if (s) { s.name = msg.name; saveMeta(); broadcastSessionList(); }
      }
      break;

    case 'input':
      if (session && session.ptyProcess && msg.data) {
        resizeToClient(entry?.client, session);
        session.ptyProcess.write(msg.data);
        session.lastActiveAt = Date.now();
      }
      break;

    case 'list':
      try { if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'session_list', sessions: getSessionList() })); } catch (_) {}
      break;
  }
}

// ── Close WS ─────────────────────────────────────────────────────────────────

function closeWS(wsId) {
  destroyShell(wsId);
  const entry = wsToSession.get(wsId);
  if (entry) {
    const session = sessions.get(entry.sessionId);
    if (session) session.clients.delete(entry.client);
  }
  wsToSession.delete(wsId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSessionList() {
  return Array.from(sessions.entries()).map(([id, s]) => ({
    sessionId: id, name: s.name, workingDir: s.workingDir, agent: s.agent || 'claude',
    alive: s.exitCode === null && !!s.ptyProcess,
    exitCode: s.exitCode,
    createdAt: s.createdAt, lastActiveAt: s.lastActiveAt,
    logPath: s.logPath, socketPath: s.socketPath,
    clientCount: s.clients.size,
  })).sort((a, b) => b.createdAt - a.createdAt);
}

function listSessions() { return getSessionList(); }

const LOG_MAX_LINES = 9000;
// 每写入多少字节检查一次行数（避免频繁 stat）
const LOG_CHECK_INTERVAL = 64 * 1024; // 64KB

// 追踪每个 session 上次 rotate 时的字节偏移
const logCheckCounters = new Map(); // sessionId → bytes since last check

function rotateLogIfNeeded(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.logPath) return;

  const counter = (logCheckCounters.get(sessionId) || 0) + 1024; // approximate
  logCheckCounters.set(sessionId, counter);
  if (counter < LOG_CHECK_INTERVAL) return;
  logCheckCounters.set(sessionId, 0);

  try {
    const content = fs.readFileSync(session.logPath, 'utf8');
    const lines = content.split('\n');
    if (lines.length <= LOG_MAX_LINES) return;
    // 保留最后 9000 行
    const trimmed = lines.slice(lines.length - LOG_MAX_LINES).join('\n');
    // 关闭旧 stream，重写文件，重新打开
    try { session.logStream.end(); } catch (_) {}
    fs.writeFileSync(session.logPath, trimmed, 'utf8');
    const newStream = fs.createWriteStream(session.logPath, { flags: 'a' });
    newStream.on('error', () => {});
    session.logStream = newStream;
  } catch (_) {}
}

function readLog(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.logPath) return null;
  try {
    const content = fs.readFileSync(session.logPath, 'utf8');
    const lines = content.split('\n');
    if (lines.length <= LOG_MAX_LINES) return content;
    return lines.slice(lines.length - LOG_MAX_LINES).join('\n');
  } catch (_) { return null; }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function cleanup() {
  for (const [, s] of sessions) {
    try { if (s.ptyProcess) s.ptyProcess.kill(); } catch (_) {}
    try { if (s.logStream)  s.logStream.end(); }  catch (_) {}
    try { if (s.socketServer) s.socketServer.close(); } catch (_) {}
  }
}

process.on('exit', cleanup);
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });

module.exports = { handleMessage, closeWS, listSessions, readLog, registerWS, unregisterWS };

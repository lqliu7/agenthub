const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

const RC_USER = process.env.RC_USER || 'admin';
const RC_PASS = process.env.RC_PASS || 'changeme';
const AUTH_FILE = path.join(os.homedir(), '.agenthub', 'auth.json');
const SCRYPT_KEYLEN = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

// 内存 token 池，value = { exp, local }
const tokens = new Map();
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30天

function genToken() { return crypto.randomBytes(32).toString('hex'); }

function createToken(local = false) {
  const tok = genToken();
  tokens.set(tok, { exp: Date.now() + TOKEN_TTL, local });
  return tok;
}

function validateToken(tok) {
  if (!tok) return false;
  const meta = tokens.get(tok);
  if (!meta) return false;
  const exp = typeof meta === 'number' ? meta : meta.exp;
  if (Date.now() > exp) { tokens.delete(tok); return false; }
  return true;
}

function invalidateWebTokens() {
  for (const [tok, meta] of tokens.entries()) {
    if (typeof meta === 'number' || !meta.local) tokens.delete(tok);
  }
}

function publicError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function readAuthOverride() {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    if (!data || data.version !== 1 || !data.passwordHash || !data.salt) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS).toString('hex');
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(a || '', 'hex');
  const right = Buffer.from(b || '', 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyPassword(password) {
  const override = readAuthOverride();
  if (!override) return password === RC_PASS;
  const computed = hashPassword(password || '', override.salt);
  return timingSafeEqualHex(computed, override.passwordHash);
}

function effectiveUsername() {
  return readAuthOverride()?.username || RC_USER;
}

function validateCredentials(username, password) {
  return username === effectiveUsername() && verifyPassword(password);
}

function validateNewPassword(password) {
  if (typeof password !== 'string') throw publicError('New password is required');
  if (password.length < 8) throw publicError('New password must be at least 8 characters');
  if (password.length > 256) throw publicError('New password is too long');
}

function writeAuthOverride(record) {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  const tmp = `${AUTH_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, AUTH_FILE);
  try { fs.chmodSync(AUTH_FILE, 0o600); } catch (_) {}
}

function changePassword(currentPassword, newPassword) {
  if (!verifyPassword(currentPassword || '')) {
    throw publicError('Current password is incorrect', 403);
  }
  validateNewPassword(newPassword);
  const salt = crypto.randomBytes(16).toString('hex');
  writeAuthOverride({
    version: 1,
    username: effectiveUsername(),
    passwordHash: hashPassword(newPassword, salt),
    salt,
    algorithm: 'scrypt',
    params: SCRYPT_OPTIONS,
    updatedAt: new Date().toISOString(),
  });
  invalidateWebTokens();
}

// ── 本地令牌：服务启动时生成，写入 ~/.agenthub/local.token ─────────────────────
// ahub-tui 等本地工具直接读这个文件，无需账号密码
const LOCAL_TOKEN_FILE = path.join(os.homedir(), '.agenthub', 'local.token');

function initLocalToken() {
  const tok = genToken();
  tokens.set(tok, { exp: Date.now() + 365 * 24 * 60 * 60 * 1000, local: true }); // 1年有效
  // 写入文件延迟到 proxy 确认端口监听成功后（由 proxy.js 调用 writeLocalToken）
  // 避免 watchdog 重试期间多个进程竞争写入不同 token
  return tok;
}

// 启动时立即生成本地 token
const LOCAL_TOKEN = initLocalToken();

// 注意：local.token 由 ahub-server stop 脚本负责清理
// 这里不在 exit 时删除，避免 watchdog 重启时短暂消失导致 ahub-tui 读到无效 token

// POST /api/login → { token }
function loginHandler(req, res) {
  const { username, password } = req.body || {};
  if (validateCredentials(username, password)) {
    res.json({ token: createToken() });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
}

function changePasswordHandler(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  try {
    changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 400).json({ error: e.message || 'Bad request' });
  }
}

// HTTP 中间件：跳过 /api/login，其余验证 Bearer token
function httpAuth(req, res, next) {
  if (req.path === '/api/login') return next();
  const auth = req.headers['authorization'] || '';
  const tok = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  if (validateToken(tok)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// WS upgrade 验证：?token=xxx
function wsAuth(req) {
  const url = new URL(req.url, 'http://localhost');
  const tok = url.searchParams.get('token');
  return validateToken(tok);
}

module.exports = {
  httpAuth,
  wsAuth,
  loginHandler,
  changePasswordHandler,
  validateCredentials,
  changePassword,
  invalidateWebTokens,
  validateTokenExported: validateToken,
  createTokenExported: createToken,
  LOCAL_TOKEN_FILE,
  LOCAL_TOKEN,
  AUTH_FILE,
  writeLocalToken: () => {
    try {
      fs.mkdirSync(path.dirname(LOCAL_TOKEN_FILE), { recursive: true });
      fs.writeFileSync(LOCAL_TOKEN_FILE, LOCAL_TOKEN, { mode: 0o600 });
    } catch (_) {}
  },
};

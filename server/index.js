const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { httpAuth, wsAuth, loginHandler, changePasswordHandler } = require('./auth');
const { getProjects, getSessions, readSession } = require('./history');
const { handleMessage, closeWS, listSessions, readLog, registerWS, unregisterWS } = require('./pty-manager');
const { listDir, readFilePreview, statFile, createDirectory, writeUploadedFile, readDownloadFile } = require('./fs-handler');
const { getSettingsHandler, saveSettingsHandler } = require('./web-settings');

const PORT = parseInt(process.env.PORT || 3000);

// ── 单实例锁：同一机器只允许运行一个 agenthub 服务 ─────────────────────────────────
const AHUB_DIR  = path.join(os.homedir(), '.agenthub');
const LOCK_FILE = path.join(AHUB_DIR, 'server.lock');
fs.mkdirSync(AHUB_DIR, { recursive: true });

// 写入锁文件（含 pid 和端口），启动时检测已有实例
try {
  const existing = fs.existsSync(LOCK_FILE)
    ? JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
    : null;

  if (existing) {
    // 检查进程是否仍在运行
    let alive = false;
    try { process.kill(existing.pid, 0); alive = true; } catch (_) {}
    if (alive) {
      console.error(
        `\n  ✗ AgentHub 已在运行 (pid ${existing.pid}, port ${existing.port})\n` +
        `    如需重启，先运行: kill ${existing.pid}\n`
      );
      process.exit(1);
    }
    // 旧进程已死，清除锁
    fs.unlinkSync(LOCK_FILE);
  }
} catch (_) {}

// 写入当前锁
fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, port: PORT, startedAt: Date.now() }));

// 进程退出时删除锁
function removeLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}
process.on('exit',   removeLock);
process.on('SIGTERM', () => { removeLock(); process.exit(0); });
process.on('SIGINT',  () => { removeLock(); process.exit(0); });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// ── Static (no auth) ──────────────────────────────────────────────────────────
const distDir = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distDir));

// ── API ───────────────────────────────────────────────────────────────────────
app.use(express.json());
app.post('/api/login', loginHandler);

// ── 文档接口（无需 auth，供帮助页读取）────────────────────────────────────────
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const ALLOWED_DOCS = ['usage.md', 'installation.md', 'api.md', 'architecture.md', 'development.md'];
app.use('/docs/assets', express.static(path.join(DOCS_DIR, 'assets')));
app.get('/docs/:name', (req, res) => {
  const name = req.params.name;
  if (!ALLOWED_DOCS.includes(name)) return res.status(404).json({ error: 'Not found' });
  const p = path.join(DOCS_DIR, name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
  res.type('text/plain; charset=utf-8').sendFile(p);
});
app.get('/docs', (req, res) => {
  res.json(ALLOWED_DOCS.map(f => ({ name: f, title: f.replace('.md', '') })));
});

app.use(httpAuth);

// ── 图片上传（存到 ~/.agenthub/uploads/，返回服务器路径供 claude 使用）──────────
const UPLOAD_DIR = path.join(AHUB_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.post('/api/upload', (req, res) => {
  const contentType = req.headers['content-type'] || '';
  // 支持两种方式：multipart/form-data 和 application/octet-stream
  const ext = (req.headers['x-filename'] || 'image.png')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .match(/\.[a-zA-Z0-9]+$/)?.[0] || '.png';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      fs.writeFileSync(filepath, Buffer.concat(chunks));
      res.json({ path: filepath, filename });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  req.on('error', e => res.status(500).json({ error: e.message }));
});

app.get('/api/projects',               (req, res) => { try { res.json(getProjects(req.query.agent)); }                     catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/sessions/:projectId',    (req, res) => { try { res.json(getSessions(req.params.projectId, req.query.agent)); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/session/:sessionId',     (req, res) => { try { res.json(readSession(req.params.sessionId, req.query.agent)); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get('/api/active-sessions',        (req, res) => res.json(listSessions()));
app.get('/api/session-log/:sessionId', (req, res) => {
  const log = readLog(req.params.sessionId);
  if (log === null) return res.status(404).json({ error: 'Not found' });
  res.type('text/plain').send(log);
});

app.post('/api/change-password', changePasswordHandler);
app.get('/api/settings', getSettingsHandler);
app.post('/api/settings', saveSettingsHandler);

// ── 文件系统 API ───────────────────────────────────────────────────────────────
app.get('/api/fs/list', (req, res) => {
  try {
    const result = listDir(req.query.path || '/', req.query.hidden === 'true');
    res.json(result);
  } catch (e) {
    res.status(e.message.startsWith('Access denied') ? 403 : 400).json({ error: e.message });
  }
});

app.get('/api/fs/read', (req, res) => {
  try {
    const maxBytes = parseInt(req.query.maxBytes) || 102400;
    const result = readFilePreview(req.query.path || '', maxBytes);
    res.json(result);
  } catch (e) {
    res.status(e.message.startsWith('Access denied') ? 403 : 400).json({ error: e.message });
  }
});

app.get('/api/fs/stat', (req, res) => {
  try {
    res.json(statFile(req.query.path || ''));
  } catch (e) {
    res.status(e.message.startsWith('Access denied') ? 403 : 400).json({ error: e.message });
  }
});

app.post('/api/fs/mkdir', (req, res) => {
  try {
    const body = req.body || {};
    res.json(createDirectory(body.path || req.query.path || '/', body.name || req.query.name || ''));
  } catch (e) {
    res.status(e.message.startsWith('Access denied') ? 403 : 400).json({ error: e.message });
  }
});

app.post('/api/fs/upload', (req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const result = writeUploadedFile(
        req.query.path || '/',
        req.headers['x-filename'] || 'upload.bin',
        Buffer.concat(chunks)
      );
      res.json(result);
    } catch (e) {
      res.status(e.message.startsWith('Access denied') ? 403 : 400).json({ error: e.message });
    }
  });
  req.on('error', e => res.status(500).json({ error: e.message }));
});

app.get('/api/fs/download', (req, res) => {
  try {
    const file = readDownloadFile(req.query.path || '');
    res.setHeader('content-type', 'application/octet-stream');
    res.setHeader('content-length', file.size);
    res.setHeader('content-disposition', `attachment; filename="${file.name.replace(/"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.end(file.content);
  } catch (e) {
    res.status(e.message.startsWith('Access denied') ? 403 : 400).json({ error: e.message });
  }
});


// 未匹配的 /api/* 返回 404
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const p = path.join(distDir, 'index.html');
  fs.existsSync(p) ? res.sendFile(p) : res.status(404).send('Frontend not built.');
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
server.on('upgrade', (req, socket, head) => {
  if (!wsAuth(req)) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  const wsId = uuidv4();
  registerWS(wsId, ws);
  // Send current session list immediately
  ws.send(JSON.stringify({ type: 'session_list', sessions: listSessions() }));
  ws.on('message', data => handleMessage(ws, wsId, data.toString()));
  ws.on('close',   ()   => { closeWS(wsId); unregisterWS(wsId); });
  ws.on('error',   err  => { console.error(`WS [${wsId}]:`, err.message); closeWS(wsId); unregisterWS(wsId); });
});

server.listen(PORT, () => {
  console.log(`AgentHub  http://0.0.0.0:${PORT}`);
  console.log(`Auth: RC_USER=${process.env.RC_USER || 'admin'}`);
});

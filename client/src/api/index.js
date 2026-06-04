const BASE = '';

function getToken() { return localStorage.getItem('ahub_token') || ''; }
function setToken(tok) { localStorage.setItem('ahub_token', tok); }
function clearToken() { localStorage.removeItem('ahub_token'); }

export function saveUsername(user) { localStorage.setItem('ahub_user', user); }
export function getSavedUsername() { return localStorage.getItem('ahub_user') || ''; }

function authHeader() {
  const tok = getToken();
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

// 401 回调：token 失效时通知 App 跳回登录页
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

function handleUnauthorized() {
  clearToken();
  if (_onUnauthorized) _onUnauthorized();
}

async function throwApiError(res) {
  let message = `HTTP ${res.status}`;
  try {
    const data = await res.clone().json();
    if (data?.error) message = data.error;
  } catch (_) {}
  throw new Error(message);
}

export async function login(username, password) {
  const res = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const { token } = await res.json();
  setToken(token);
  saveUsername(username);
}

export function logout() { clearToken(); }
export function isLoggedIn() { return !!getToken(); }

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...authHeader(), ...(opts.headers || {}) },
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  if (!res.ok) await throwApiError(res);
  return res.json();
}

async function apiFetchText(path) {
  const res = await fetch(BASE + path, { headers: authHeader() });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  if (!res.ok) await throwApiError(res);
  return res.text();
}

async function apiFetchBlob(path) {
  const res = await fetch(BASE + path, { headers: authHeader() });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  if (!res.ok) await throwApiError(res);
  return {
    blob: await res.blob(),
    filename: getDownloadFilename(res.headers.get('content-disposition')),
  };
}

function getDownloadFilename(disposition) {
  if (!disposition) return '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try { return decodeURIComponent(encoded[1]); } catch (_) {}
  }
  const plain = disposition.match(/filename="([^"]+)"/i);
  return plain?.[1] || '';
}

async function uploadFile(path, file) {
  const res = await fetch(BASE + `/api/fs/upload?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: {
      ...authHeader(),
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
    },
    body: await file.arrayBuffer(),
  });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  if (!res.ok) await throwApiError(res);
  return res.json();
}

export const api = {
  changePassword:     (currentPassword, newPassword) => apiFetch('/api/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  }),
  getSettings:        () => apiFetch('/api/settings'),
  saveSettings:       (settings) => apiFetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  }),
  getProjects:        (agent = 'claude') => apiFetch(`/api/projects?agent=${encodeURIComponent(agent)}`),
  getSessions:        (projectId, agent = 'claude') => apiFetch(`/api/sessions/${encodeURIComponent(projectId)}?agent=${encodeURIComponent(agent)}`),
  getSession:         (sessionId, agent = 'claude') => apiFetch(`/api/session/${encodeURIComponent(sessionId)}?agent=${encodeURIComponent(agent)}`),
  getActiveSessions:  ()           => apiFetch('/api/active-sessions'),
  getSessionLog:      (sessionId, bytes = 50000) => apiFetchText(`/api/session-log/${encodeURIComponent(sessionId)}?bytes=${bytes}`),
  fs: {
    list:  (path, hidden = false) => apiFetch(`/api/fs/list?path=${encodeURIComponent(path)}&hidden=${hidden}`),
    read:  (path, maxBytes = 102400) => apiFetch(`/api/fs/read?path=${encodeURIComponent(path)}&maxBytes=${maxBytes}`),
    stat:  (path) => apiFetch(`/api/fs/stat?path=${encodeURIComponent(path)}`),
    mkdir: (path, name) => apiFetch('/api/fs/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, name }),
    }),
    upload: uploadFile,
    download: (path) => apiFetchBlob(`/api/fs/download?path=${encodeURIComponent(path)}`),
  },
};

export function createWS() {
  const tok = getToken();
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${proto}//${location.host}/ws?token=${encodeURIComponent(tok)}`);
}

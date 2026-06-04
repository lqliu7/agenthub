const fs   = require('fs');
const os   = require('os');
const path = require('path');

const SETTINGS_FILE = path.join(os.homedir(), '.agenthub', 'web-settings.json');

const DEFAULTS = {
  uiStyle: 'studio',
  colorTheme: 'aurora',
  iconStyle: 'sharp',
  topbarHeight: 44,

  fontSize: 13,
  fontFamily: 'jetbrains',
  lineHeight: 1.3,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  symbolBar: true,

  reconnectDelay: 1000,
  maxReconnectDelay: 15000,
  wsKeepAlive: true,

  fileBrowserDefaultPath: '/',
  shellDefaultCwd: '/',
  newConversationDefaultDir: '~',

  username: '',
  language: 'zh',
};

const STRING_LIMITS = {
  uiStyle: 32,
  colorTheme: 64,
  iconStyle: 32,
  fontFamily: 64,
  cursorStyle: 32,
  fileBrowserDefaultPath: 2048,
  shellDefaultCwd: 2048,
  newConversationDefaultDir: 2048,
  username: 128,
  language: 16,
};

const NUMBER_LIMITS = {
  topbarHeight: [32, 96],
  fontSize: [8, 24],
  lineHeight: [1, 2],
  scrollback: [500, 50000],
  reconnectDelay: [500, 10000],
  maxReconnectDelay: [5000, 60000],
};

const BOOLEAN_KEYS = new Set(['cursorBlink', 'symbolBar', 'wsKeepAlive']);

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeString(value, fallback, maxLen) {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLen);
}

function sanitizeSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const result = { ...DEFAULTS };

  for (const [key, limit] of Object.entries(STRING_LIMITS)) {
    result[key] = sanitizeString(source[key], DEFAULTS[key], limit);
  }

  for (const [key, [min, max]] of Object.entries(NUMBER_LIMITS)) {
    result[key] = clampNumber(source[key], DEFAULTS[key], min, max);
  }

  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }

  return result;
}

function readRecord() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (!data || data.version !== 1 || typeof data.settings !== 'object') return null;
    return data;
  } catch (_) {
    return null;
  }
}

function getWebSettings() {
  const record = readRecord();
  return {
    persisted: Boolean(record),
    updatedAt: record?.updatedAt || '',
    settings: sanitizeSettings(record?.settings),
  };
}

function writeRecord(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  const record = {
    version: 1,
    settings: sanitizeSettings(settings),
    updatedAt: new Date().toISOString(),
  };
  const tmp = `${SETTINGS_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, SETTINGS_FILE);
  try { fs.chmodSync(SETTINGS_FILE, 0o600); } catch (_) {}
  return record;
}

function saveWebSettings(settings) {
  const record = writeRecord(settings);
  return {
    persisted: true,
    updatedAt: record.updatedAt,
    settings: record.settings,
  };
}

function getSettingsHandler(req, res) {
  res.json(getWebSettings());
}

function saveSettingsHandler(req, res) {
  try {
    res.json(saveWebSettings(req.body?.settings || req.body || {}));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to save settings' });
  }
}

module.exports = {
  SETTINGS_FILE,
  DEFAULTS,
  sanitizeSettings,
  getWebSettings,
  saveWebSettings,
  getSettingsHandler,
  saveSettingsHandler,
};

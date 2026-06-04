<template>
  <div class="terminal-wrap" ref="wrapRef"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
    @click="focusTerm">
    <div class="term-container" ref="termRef"
      :class="{ 'drag-over': dragOver }"></div>

    <span v-if="lastUploadPath" class="img-path-hint" :title="lastUploadPath">
      <AppIcon name="check" /> {{ shortPath(lastUploadPath) }}
    </span>

    <SymbolBar
      v-if="settings.symbolBar"
      class="terminal-shortcuts"
      :currentLine="currentLine"
      :mode="symbolMode"
      @input="$emit('input', $event)"
    >
      <template v-if="symbolMode !== 'shell'" #prefix>
        <label
          class="img-upload-btn"
          :class="{ uploading }"
          :title="uploading ? '上传中...' : '上传图片或文件'"
          @click.stop
        >
          <input type="file" accept="image/*,*/*" multiple style="display:none"
            @change="onFileSelect" :disabled="uploading" />
          <AppIcon v-if="!uploading" name="upload" />
          <AppIcon v-else name="spinner" spin />
        </label>
      </template>
    </SymbolBar>
    <Teleport to="body">
      <div v-if="ctxMenu.show" class="ctx-overlay"
        @click="ctxMenu.show = false"
        @contextmenu.prevent="ctxMenu.show = false">
        <div class="ctx-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
          <button class="ctx-item" @click="ctxCopy"><AppIcon name="copy" class="ctx-icon" /> Copy <span class="ctx-kbd">Ctrl+Shift+C</span></button>
          <!-- Paste：点击后聚焦隐藏 input，让用户用 Ctrl+V 粘贴 -->
          <button class="ctx-item" @click="ctxPasteClick"><AppIcon name="paste" class="ctx-icon" /> Paste <span class="ctx-kbd">Ctrl+Shift+V</span></button>
          <div class="ctx-divider"></div>
          <button class="ctx-item" @click="ctxSelectAll"><AppIcon name="select-all" class="ctx-icon" /> Select All</button>
          <button class="ctx-item" @click="ctxClear"><AppIcon name="clear" class="ctx-icon" /> Clear</button>
        </div>
      </div>
      <!-- 隐藏 input 用于接收系统粘贴事件 -->
      <input ref="pasteInputRef" class="paste-trap" type="text"
        @paste="onTrapPaste"
        @blur="onTrapBlur"
        @keydown="onTrapKeydown" />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import SymbolBar from './SymbolBar.vue';
import AppIcon from './AppIcon.vue';
import { THEMES } from '../themes.js';
import { settings, FONT_FAMILIES } from '../settings.js';

const props = defineProps({
  theme: { type: String, default: 'cyber' },
  symbolMode: { type: String, default: 'auto' },
});
const emit = defineEmits(['input', 'resize', 'paste']);

const termRef = ref(null);
const wrapRef = ref(null);
const pasteInputRef = ref(null);
const ctxMenu = reactive({ show: false, x: 0, y: 0 });
const currentLine = ref('');

// ── 图片/文件上传 ─────────────────────────────────────────────────────────────
const uploading = ref(false);
const dragOver  = ref(false);
const lastUploadPath = ref('');

// 始终把焦点还给 xterm 的内部 textarea
function focusTerm() {
  const ta = termRef.value?.querySelector('.xterm-helper-textarea');
  if (ta) ta.focus();
}

function shortPath(p) {
  return p.split('/').slice(-2).join('/');
}

async function uploadFile(file) {
  if (!file) return;
  uploading.value = true;
  lastUploadPath.value = '';
  try {
    const buf = await file.arrayBuffer();
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('ahub_token') || ''}`,
        'Content-Type': 'application/octet-stream',
        'X-Filename': file.name,
      },
      body: buf,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    const { path: filePath } = await res.json();
    lastUploadPath.value = filePath;
    emit('input', filePath + ' ');
  } catch (e) {
    console.error('Upload error:', e);
  } finally {
    uploading.value = false;
    // 上传完成后立即把焦点还给终端
    nextTick(() => focusTerm());
  }
}

async function onFileSelect(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  for (const f of files) await uploadFile(f);
}

function onDrop(e) {
  dragOver.value = false;
  const files = Array.from(e.dataTransfer.files || []);
  files.forEach(uploadFile);
}

function onTerminalPaste(e) {
  const items = Array.from(e.clipboardData?.items || []);
  const imageItem = items.find(i => i.type.startsWith('image/'));
  if (imageItem) {
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) uploadFile(file);
  }
}
let awaitingPaste = false;

let term, fitAddon, resizeObserver, resizeTimer;
let lastW = 0, lastH = 0;

// ── 自动锁底 + 上划暂停更新 ──────────────────────────────────────────────────
let userScrolled = false;       // 用户是否主动上划
let scrollResumeTimer = null;   // 停止滑动后恢复锁底的计时器
let userScrollIntentUntil = 0;   // 只有用户输入触发的滚动才暂停锁底
let autoScrollUntil = 0;         // 程序写入触发的滚动不应暂停锁底
const pendingWrites = [];        // 用户上划时缓存的输出
let boundViewport = null;

// 检测用户是否滑到底部附近（20px 内认为在底部）
function isNearBottom() {
  if (!term) return true;
  const vp = term.element?.querySelector('.xterm-viewport');
  if (!vp) return true;
  return vp.scrollHeight - vp.scrollTop - vp.clientHeight < 20;
}

function onViewportScroll() {
  if (isNearBottom()) {
    // 回到底部 → 恢复自动跟随，冲刷缓存
    userScrolled = false;
    clearTimeout(scrollResumeTimer);
    flushPending();
  } else if (Date.now() < autoScrollUntil) {
    return;
  } else if (Date.now() < userScrollIntentUntil) {
    // 上划 → 暂停自动更新
    userScrolled = true;
  }
}

function markUserScrollIntent() {
  userScrollIntentUntil = Date.now() + 800;
}

function bindViewport(vp) {
  if (!vp || boundViewport === vp) return;
  unbindViewport();
  boundViewport = vp;
  vp.addEventListener('scroll', onViewportScroll, { passive: true });
  vp.addEventListener('wheel', markUserScrollIntent, { passive: true });
  vp.addEventListener('touchstart', markUserScrollIntent, { passive: true });
  vp.addEventListener('pointerdown', markUserScrollIntent, { passive: true });
}

function unbindViewport() {
  if (!boundViewport) return;
  boundViewport.removeEventListener('scroll', onViewportScroll);
  boundViewport.removeEventListener('wheel', markUserScrollIntent);
  boundViewport.removeEventListener('touchstart', markUserScrollIntent);
  boundViewport.removeEventListener('pointerdown', markUserScrollIntent);
  boundViewport = null;
}

function scrollToBottomSoon() {
  autoScrollUntil = Date.now() + 500;
  clearTimeout(scrollResumeTimer);
  scrollResumeTimer = setTimeout(() => {
    term?.scrollToBottom();
    requestAnimationFrame(() => term?.scrollToBottom());
  }, 16);
}

function flushPending() {
  if (pendingWrites.length === 0) return;
  const batch = pendingWrites.splice(0);
  let remaining = batch.length;
  batch.forEach(d => term?.write(d, () => {
    remaining -= 1;
    if (remaining === 0) scrollToBottomSoon();
  }));
}

// 对外暴露的 write：上划时缓存，否则直接写并锁底
function smartWrite(data) {
  if (userScrolled) {
    // 超出上限（跟 scrollback 一致）时丢弃最老的，保留最新
    pendingWrites.push(data);
    const max = settings.scrollback || 5000;
    if (pendingWrites.length > max) pendingWrites.shift();
  } else {
    // xterm write is async; scroll after render so mobile Codex output stays pinned.
    term?.write(data, scrollToBottomSoon);
  }
}

onMounted(() => {
  const td = THEMES[props.theme] || THEMES.cyber;
  const fontDef = FONT_FAMILIES.find(f => f.id === settings.fontFamily) || FONT_FAMILIES[0];

  term = new Terminal({
    theme:       td.term,
    fontFamily:  fontDef.value,
    fontSize:    settings.fontSize,
    lineHeight:  settings.lineHeight,
    cursorBlink: settings.cursorBlink,
    cursorStyle: settings.cursorStyle,
    scrollback:  settings.scrollback,
    smoothScrollDuration: 80,   // 丝滑滚动 80ms
    allowProposedApi: true,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());
  term.open(termRef.value);

  if (wrapRef.value) wrapRef.value.style.background = td.bg;

  // terminal open 后立即聚焦，确保键盘输入直接进 xterm
  nextTick(() => focusTerm());

  // 监听 viewport scroll 检测用户是否上划
  // xterm 渲染后 viewport 元素才存在，用 MutationObserver 等它出现
  const vpObserver = new MutationObserver(() => {
    const vp = term.element?.querySelector('.xterm-viewport');
    if (vp) {
      bindViewport(vp);
      vpObserver.disconnect();
    }
  });
  vpObserver.observe(termRef.value, { childList: true, subtree: true });
  // 如果已经存在直接绑定
  const vp0 = termRef.value?.querySelector('.xterm-viewport');
  if (vp0) {
    bindViewport(vp0);
    vpObserver.disconnect();
  }

  term.onData(data => {
    emit('input', data);
    // currentLine 统一由 App.vue 的 onTermInput 通过 trackInput() 更新
    // 这里不再重复处理，避免双重追踪
  });

  // ── 复制：Ctrl+Shift+C 或右键 Copy ──────────────────────────────────────
  term.attachCustomKeyEventHandler(e => {
    if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
      const sel = term.getSelection();
      if (sel) copyText(sel);
      return false;
    }
    if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
      doPaste();
      return false;
    }
    return true;
  });

  // ── 粘贴：监听原生 paste 事件（Ctrl+V / 手机长按粘贴） ──────────────────
  // onTerminalPaste 先检查是否是图片，如果是则拦截上传；否则 onNativePaste 处理文字
  termRef.value.addEventListener('paste', onTerminalPaste);
  termRef.value.addEventListener('paste', onNativePaste);

  termRef.value.addEventListener('contextmenu', onContextMenu);

  watch(() => props.theme, t => {
    const theme = THEMES[t] || THEMES.cyber;
    term.options.theme = theme.term;
    if (wrapRef.value) wrapRef.value.style.background = theme.bg;
  });

  // 实时响应 settings 变化
  watch(() => settings.fontSize,    v => { if (term) term.options.fontSize    = v; fitAddon?.fit(); });
  watch(() => settings.lineHeight,   v => { if (term) term.options.lineHeight  = v; fitAddon?.fit(); });
  watch(() => settings.cursorBlink,  v => { if (term) term.options.cursorBlink = v; });
  watch(() => settings.cursorStyle,  v => { if (term) term.options.cursorStyle = v; });
  watch(() => settings.fontFamily,   v => {
    const f = FONT_FAMILIES.find(f => f.id === v) || FONT_FAMILIES[0];
    if (term) term.options.fontFamily = f.value;
    fitAddon?.fit();
  });

  resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      if (width === lastW && height === lastH) continue;
      lastW = width; lastH = height;
      if (width > 0 && height > 0) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          fitAddon.fit();
          emit('resize', { cols: term.cols, rows: term.rows });
          if (!userScrolled) scrollToBottomSoon();
        }, 80);
      }
    }
  });
  resizeObserver.observe(wrapRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  clearTimeout(resizeTimer);
  unbindViewport();
  termRef.value?.removeEventListener('contextmenu', onContextMenu);
  termRef.value?.removeEventListener('paste', onNativePaste);
  termRef.value?.removeEventListener('paste', onTerminalPaste);
  term?.dispose();
});

function write(data) { smartWrite(data); }
function fit() {
  fitAddon?.fit();
  if (!userScrolled) scrollToBottomSoon();
}
function scrollToBottom() {
  userScrolled = false;
  flushPending();
  term?.scrollToBottom();
}

// 供外部（SymbolBar 通过 App）同步更新行追踪，保持与键盘输入相同的逻辑
function trackInput(data) {
  if (data === '\r' || data === '\n' || data === '\x03' || data === '\x04') {
    currentLine.value = '';
  } else if (data === '\x7f' || data === '\b') {
    currentLine.value = currentLine.value.slice(0, -1);
  } else if (data.length === 1 && (data >= ' ' || data === '\t' || data === '!')) {
    currentLine.value += data;
  }
}

function getCols() { return term?.cols ?? 80; }
function getRows() { return term?.rows ?? 24; }
defineExpose({ write, fit, scrollToBottom, trackInput, getCols, getRows });

// ── 复制工具函数（兼容 HTTP 非安全上下文） ───────────────────────────────────
function copyText(text) {
  if (!text) return;
  // 优先用 Clipboard API（HTTPS / localhost）
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  // 降级：创建 textarea，execCommand('copy')
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
}

// ── 粘贴：优先 Clipboard API，失败则提示 ─────────────────────────────────────
function doPaste() {
  if (navigator.clipboard?.readText) {
    navigator.clipboard.readText()
      .then(text => { if (text) emit('paste', text); })
      .catch(() => {
        // HTTP 下无权限，用户需要用右键菜单或 Ctrl+Shift+V 触发原生粘贴
      });
  }
}

// 原生 paste 事件（Ctrl+V、手机长按粘贴、浏览器粘贴按钮）
function onNativePaste(e) {
  e.preventDefault();
  const text = e.clipboardData?.getData('text');
  if (text) emit('paste', text);
}

function onContextMenu(e) {
  e.preventDefault();
  ctxMenu.x = Math.min(e.clientX, window.innerWidth - 168);
  ctxMenu.y = Math.min(e.clientY, window.innerHeight - 148);
  ctxMenu.show = true;
}
function ctxCopy() {
  ctxMenu.show = false;
  const sel = term?.getSelection();
  copyText(sel);
}
function ctxPasteClick() {
  ctxMenu.show = false;
  // 先尝试 Clipboard API
  if (navigator.clipboard?.readText) {
    navigator.clipboard.readText()
      .then(text => { if (text) emit('paste', text); })
      .catch(() => {
        // 降级：聚焦隐藏 input，等用户 Ctrl+V
        awaitingPaste = true;
        nextTick(() => pasteInputRef.value?.focus());
      });
  } else {
    awaitingPaste = true;
    nextTick(() => pasteInputRef.value?.focus());
  }
}
function onTrapPaste(e) {
  if (!awaitingPaste) return;
  awaitingPaste = false;
  const text = e.clipboardData?.getData('text');
  if (text) emit('paste', text);
  e.preventDefault();
  nextTick(() => focusTerm());
}
function onTrapBlur() {
  awaitingPaste = false;
  // 焦点离开 paste-trap 时立即还给 xterm
  nextTick(() => focusTerm());
}
// paste-trap 收到非粘贴按键时（用户直接打字），把焦点和输入转发给 xterm
function onTrapKeydown(e) {
  if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return; // 允许 Ctrl+V 完成粘贴
  // 其他任何键：把输入转发给 PTY，焦点归还 xterm
  awaitingPaste = false;
  pasteInputRef.value.value = '';
  e.preventDefault();
  // 将这次按键作为 PTY 输入发送
  if (e.key.length === 1) emit('input', e.key);
  nextTick(() => focusTerm());
}
function ctxSelectAll() { ctxMenu.show = false; term?.selectAll(); }
function ctxClear()     { ctxMenu.show = false; term?.clear(); }
</script>

<style scoped>
.terminal-wrap {
  position: relative;
  display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden;
}
.term-container {
  flex: 1; min-height: 0; overflow: hidden; padding: 5px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 14%, transparent), transparent 120px),
    var(--bg);
}
.term-container.drag-over {
  outline: 2px dashed color-mix(in srgb, var(--neon) 75%, transparent);
  outline-offset: -4px;
  background: color-mix(in srgb, var(--neon) 5%, var(--bg));
}

.img-upload-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: var(--symbol-button-height, 30px);
  min-height: var(--symbol-button-height, 30px);
  min-width: 42px;
  background: color-mix(in srgb, var(--neon) 8%, var(--panel2));
  border: 1px solid color-mix(in srgb, var(--neon) 24%, transparent);
  border-radius: var(--radius-sm);
  color: var(--neon);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  transition: background .12s, border-color .12s, transform .12s, opacity .12s;
  user-select: none;
  line-height: 1; overflow: visible; --app-icon-size: 14px;
  flex: 0 0 42px;
}
.img-upload-btn:hover { background: color-mix(in srgb, var(--neon) 15%, transparent); border-color: var(--border-strong); transform: translateY(-1px); }
.img-upload-btn.uploading { opacity: .6; cursor: default; }
.img-path-hint {
  position: absolute;
  left: 10px;
  bottom: 43px;
  z-index: 5;
  display: inline-flex; align-items: center; gap: 5px;
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--neon);
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--neon) 28%, transparent);
  border-radius: var(--radius-sm);
  padding: 5px 8px;
  box-shadow: 0 8px 22px color-mix(in srgb, #000000 28%, transparent);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: min(260px, calc(100vw - 20px));
  pointer-events: none;
  --app-icon-size: 12px;
}
@media (max-width: 700px) {
  .terminal-shortcuts {
    display: flex;
  }
  .img-upload-btn {
    width: 100%;
    min-width: 0;
    flex: 1 1 auto;
    height: var(--symbol-button-height, 29px);
    min-height: var(--symbol-button-height, 29px);
  }
  .img-path-hint {
    bottom: 78px;
  }
}

@media (min-width: 701px) {
  .terminal-shortcuts {
    display: none;
  }
  .img-path-hint {
    bottom: 10px;
  }
}
</style>

<style>
.ctx-overlay { position: fixed; inset: 0; z-index: 9999; }
.ctx-menu {
  position: fixed; background: var(--panel); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 4px; min-width: 200px;
  box-shadow: var(--shadow), 0 0 16px var(--glow); z-index: 10000;
}
.ctx-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  background: none; border: none; cursor: pointer; color: var(--text);
  font-family: 'JetBrains Mono', monospace; font-size: 12px;
  padding: 8px 10px; border-radius: var(--radius-sm); text-align: left; transition: background .1s;
}
.ctx-item:hover { background: color-mix(in srgb, var(--neon) 10%, transparent); }
.ctx-icon {
  color: var(--neon); font-size: 13px; width: 16px; text-align: center; flex-shrink: 0;
  line-height: 1; overflow: visible; --app-icon-size: 13px;
}
.ctx-kbd  { margin-left: auto; color: var(--muted); font-size: 10px; }
.ctx-divider { height: 1px; background: var(--hairline); margin: 3px 6px; }
.paste-trap {
  position: fixed; top: -9999px; left: -9999px;
  width: 1px; height: 1px; opacity: 0; pointer-events: none;
}
</style>

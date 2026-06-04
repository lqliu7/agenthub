<template>
  <div class="sh-root">
    <Terminal
      ref="terminalRef"
      class="sh-terminal"
      :theme="theme"
      symbol-mode="shell"
      @input="onInput"
      @resize="onResize"
      @paste="onPaste"
    />
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import Terminal from './Terminal.vue';
import { createWS } from '../api/index.js';

const props = defineProps({
  theme: { type: String, default: 'cyber' },
  initialCwd: { type: String, default: '/' },
});
const terminalRef = ref(null);
const status = ref('connecting');
const cwd = ref(props.initialCwd || '/');
let ws = null;
let closing = false;
let wsRun = 0;
let readyTimer = null;

function start() {
  const run = ++wsRun;
  cleanup(false);
  closing = false;
  status.value = 'connecting';
  const socket = createWS();
  ws = socket;

  socket.onopen = () => {
    if (run !== wsRun) return;
    nextTick(() => {
      if (run !== wsRun || socket.readyState !== WebSocket.OPEN) return;
      terminalRef.value?.fit();
      socket.send(JSON.stringify({
        type: 'shell_start',
        cwd: cwd.value || '/',
        cols: terminalRef.value?.getCols?.() ?? 80,
        rows: terminalRef.value?.getRows?.() ?? 24,
      }));
      readyTimer = setTimeout(() => {
        if (run !== wsRun || status.value !== 'connecting') return;
        status.value = 'error';
        terminalRef.value?.write('\r\n\x1b[31m[shell not ready; run agenthub restart after updating]\x1b[0m\r\n');
      }, 3000);
    });
  };

  socket.onmessage = (evt) => {
    if (run !== wsRun) return;
    const data = evt.data;
    try {
      const msg = JSON.parse(data);
      if (!msg?.type) throw 0;
      if (msg.type === 'session_list') return;
      if (msg.type === 'shell_ready') {
        clearTimeout(readyTimer);
        status.value = 'connected';
        cwd.value = msg.cwd || cwd.value;
        return;
      }
      if (msg.type === 'shell_error') {
        clearTimeout(readyTimer);
        status.value = 'error';
        terminalRef.value?.write(`\r\n\x1b[31m[shell error: ${msg.message}]\x1b[0m\r\n`);
        return;
      }
      if (msg.type === 'shell_exit') {
        clearTimeout(readyTimer);
        status.value = 'closed';
        terminalRef.value?.write(`\r\n\x1b[33m[shell exited]\x1b[0m\r\n`);
        return;
      }
    } catch (_) {}
    terminalRef.value?.write(data);
  };

  socket.onclose = () => {
    clearTimeout(readyTimer);
    if (run !== wsRun || closing) return;
    status.value = 'closed';
    terminalRef.value?.write('\r\n\x1b[33m[shell disconnected]\x1b[0m\r\n');
  };
  socket.onerror = () => {};
}

function cleanup(kill = true) {
  closing = true;
  clearTimeout(readyTimer);
  if (ws && ws.readyState === WebSocket.OPEN && kill) {
    try { ws.send(JSON.stringify({ type: 'shell_kill' })); } catch (_) {}
  }
  try { ws?.close(); } catch (_) {}
  ws = null;
}

function sendInput(data) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'shell_input', data }));
  }
}

function onInput(data) {
  sendInput(data);
  terminalRef.value?.trackInput?.(data);
}

function onResize({ cols, rows }) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'shell_resize', cols, rows }));
  }
}

function onPaste(text) {
  sendInput(text);
}

onMounted(start);
onBeforeUnmount(() => cleanup(true));
</script>

<style scoped>
.sh-root {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  background: transparent;
}
.sh-terminal {
  flex: 1; min-height: 0;
}
</style>

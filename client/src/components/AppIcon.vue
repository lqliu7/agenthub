<template>
  <svg
    class="app-icon"
    :class="[`app-icon--${name}`, { 'app-icon--spin': spin }]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="label ? 'false' : 'true'"
    :aria-label="label || undefined"
    :role="label ? 'img' : undefined"
    focusable="false"
    overflow="visible"
  >
    <template v-for="(iconNode, i) in iconNodes" :key="i">
      <path v-if="iconNode.tag === 'path'" v-bind="iconNode.attrs" />
      <line v-else-if="iconNode.tag === 'line'" v-bind="iconNode.attrs" />
      <polyline v-else-if="iconNode.tag === 'polyline'" v-bind="iconNode.attrs" />
      <polygon v-else-if="iconNode.tag === 'polygon'" v-bind="iconNode.attrs" />
      <circle v-else-if="iconNode.tag === 'circle'" v-bind="iconNode.attrs" />
      <rect v-else-if="iconNode.tag === 'rect'" v-bind="iconNode.attrs" />
    </template>
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { settings } from '../settings.js';

const props = defineProps({
  name: { type: String, required: true },
  spin: { type: Boolean, default: false },
  label: { type: String, default: '' },
  variant: { type: String, default: '' },
});

const node = (tag, attrs) => ({ tag, attrs });
const fill = (attrs = {}) => ({ fill: 'currentColor', stroke: 'none', ...attrs });
const tint = (attrs = {}) => ({ fill: 'currentColor', stroke: 'none', opacity: 0.14, ...attrs });
const STYLES = new Set(['line', 'round', 'sharp', 'bold', 'duo', 'mono']);

const currentStyle = computed(() => {
  const style = props.variant || settings.iconStyle || 'sharp';
  return STYLES.has(style) ? style : 'line';
});

const iconNodes = computed(() => iconFor(props.name, currentStyle.value));

function iconFor(name, style) {
  if (style === 'line') return lineIcon(name);
  switch (name) {
    case 'home': return homeIcon(style);
    case 'terminal': return terminalIcon(style);
    case 'folder': return folderIcon(style);
    case 'folder-plus': return [...folderIcon(style), ...plusMark(style, 12, 15.8, 2)];
    case 'file': return fileIcon(style, 'file');
    case 'log': return fileIcon(style, 'log');
    case 'empty': return fileIcon(style, 'empty');
    case 'settings': return settingsIcon(style);
    case 'help': return helpIcon(style);
    case 'plus': return plusIcon(style);
    case 'minus': return minusIcon(style);
    case 'close': return closeIcon(style);
    case 'check': return checkIcon(style);
    case 'trash': return trashIcon(style);
    case 'stop': return stopIcon(style);
    case 'copy': return copyIcon(style);
    case 'paste': return pasteIcon(style);
    case 'select-all': return selectAllIcon(style);
    case 'clear': return clearIcon(style);
    case 'download': return transferIcon(style, 'download');
    case 'upload': return transferIcon(style, 'upload');
    case 'parent': return parentIcon(style);
    case 'fullscreen': return fullscreenIcon(style);
    case 'chevron': return chevronIcon(style);
    case 'users': return usersIcon(style);
    case 'spinner': return spinnerIcon(style);
    case 'refresh': return refreshIcon(style);
    case 'play': return playIcon(style);
    case 'image': return imageIcon(style);
    case 'status-live': return statusIcon(style, true);
    case 'status-dead': return statusIcon(style, false);
    case 'menu': return menuIcon(style);
    default: return fileIcon(style, 'file');
  }
}

function lineIcon(name) {
  switch (name) {
    case 'home':
      return [
        node('path', { d: 'M4.5 10.6 12 4.6l7.5 6' }),
        node('path', { d: 'M6.5 10.4V20h13V10.4' }),
        node('path', { d: 'M10 20v-5.5h4V20' }),
      ];
    case 'terminal':
      return [
        node('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2.2 }),
        node('path', { d: 'm7.5 9 3 3-3 3' }),
        node('path', { d: 'M13.5 15h4' }),
      ];
    case 'folder':
      return [
        node('path', { d: 'M3.5 7.5h6l1.8 2H20a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z' }),
        node('path', { d: 'M3 10h18' }),
      ];
    case 'folder-plus':
      return [...lineIcon('folder'), ...plusMark('line', 12, 15.3, 2.1)];
    case 'file':
      return [
        node('path', { d: 'M7 3.5h6.2L18 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z' }),
        node('path', { d: 'M13 4v5h5' }),
      ];
    case 'log':
      return [...lineIcon('file'), ...fileLines(9, 12.5)];
    case 'empty':
      return [...lineIcon('file'), node('path', { d: 'M9.2 15h5.6', opacity: 0.55 })];
    case 'settings':
      return [
        node('line', { x1: 4, y1: 7, x2: 7.8, y2: 7 }),
        node('line', { x1: 11.2, y1: 7, x2: 20, y2: 7 }),
        node('line', { x1: 4, y1: 12, x2: 13.2, y2: 12 }),
        node('line', { x1: 16.8, y1: 12, x2: 20, y2: 12 }),
        node('line', { x1: 4, y1: 17, x2: 9.2, y2: 17 }),
        node('line', { x1: 12.8, y1: 17, x2: 20, y2: 17 }),
        node('circle', { cx: 9.5, cy: 7, r: 1.7 }),
        node('circle', { cx: 15, cy: 12, r: 1.7 }),
        node('circle', { cx: 11, cy: 17, r: 1.7 }),
      ];
    case 'help':
      return [
        node('circle', { cx: 12, cy: 12, r: 9 }),
        node('path', { d: 'M9.8 9.4a2.3 2.3 0 0 1 4.4.8c0 1.9-2.2 2.1-2.2 4' }),
        node('circle', { cx: 12, cy: 17.2, r: 0.45, fill: 'currentColor', stroke: 'none' }),
      ];
    case 'plus': return plusMark('line', 12, 12, 7);
    case 'minus': return [node('path', { d: 'M5 12h14' })];
    case 'close': return [node('path', { d: 'M6 6l12 12' }), node('path', { d: 'M18 6 6 18' })];
    case 'check': return [node('path', { d: 'm5 12.5 4.4 4.3L19 7.2' })];
    case 'trash':
      return [
        node('path', { d: 'M5 7h14' }),
        node('path', { d: 'M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7' }),
        node('path', { d: 'M7 7l.8 14h8.4L17 7' }),
        node('path', { d: 'M10 11v6' }),
        node('path', { d: 'M14 11v6' }),
      ];
    case 'stop':
      return [node('rect', { x: 7, y: 7, width: 10, height: 10, rx: 1.5, fill: 'currentColor', opacity: 0.16 }), node('rect', { x: 7, y: 7, width: 10, height: 10, rx: 1.5 })];
    case 'copy':
      return [node('rect', { x: 8, y: 8, width: 11, height: 13, rx: 1.8 }), node('path', { d: 'M6 16H5.8A1.8 1.8 0 0 1 4 14.2V5.8A1.8 1.8 0 0 1 5.8 4h8.4A1.8 1.8 0 0 1 16 5.8V6' })];
    case 'paste':
      return [node('path', { d: 'M9 5h6' }), node('path', { d: 'M10 3.5h4A1.5 1.5 0 0 1 15.5 5v1A1.5 1.5 0 0 1 14 7.5h-4A1.5 1.5 0 0 1 8.5 6V5A1.5 1.5 0 0 1 10 3.5Z' }), node('path', { d: 'M7 6H5.8A1.8 1.8 0 0 0 4 7.8v12.4A1.8 1.8 0 0 0 5.8 22h12.4a1.8 1.8 0 0 0 1.8-1.8V7.8A1.8 1.8 0 0 0 18.2 6H17' })];
    case 'select-all': return [node('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, 'stroke-dasharray': '3 3' }), node('rect', { x: 8, y: 8, width: 8, height: 8, rx: 1.2 })];
    case 'clear': return [node('circle', { cx: 12, cy: 12, r: 9 }), node('path', { d: 'M8 16 16 8' })];
    case 'download': return [node('path', { d: 'M12 4v10' }), node('path', { d: 'm8 10 4 4 4-4' }), node('path', { d: 'M5 19h14' })];
    case 'upload': return [node('path', { d: 'M12 20V10' }), node('path', { d: 'm8 14 4-4 4 4' }), node('path', { d: 'M5 5h14' })];
    case 'parent': return [node('path', { d: 'M19 19H8a3 3 0 0 1-3-3V6' }), node('path', { d: 'm9 10-4-4-4 4' })];
    case 'fullscreen': return [node('path', { d: 'M5 9V5h4' }), node('path', { d: 'M15 5h4v4' }), node('path', { d: 'M19 15v4h-4' }), node('path', { d: 'M9 19H5v-4' })];
    case 'chevron': return [node('path', { d: 'm7 9 5 5 5-5' })];
    case 'users':
      return [node('circle', { cx: 9, cy: 8, r: 3 }), node('path', { d: 'M3.5 19a5.5 5.5 0 0 1 11 0' }), node('path', { d: 'M15.5 10.5a2.6 2.6 0 0 0 0-5' }), node('path', { d: 'M17 14.2a4.6 4.6 0 0 1 3.5 4.8' })];
    case 'spinner': return [node('path', { d: 'M21 12a9 9 0 0 1-9 9' }), node('path', { d: 'M3 12a9 9 0 0 1 9-9' })];
    case 'refresh': return [node('path', { d: 'M20 6v5h-5' }), node('path', { d: 'M4 18v-5h5' }), node('path', { d: 'M18.2 10a6.5 6.5 0 0 0-11.1-3.1L4 10' }), node('path', { d: 'M5.8 14a6.5 6.5 0 0 0 11.1 3.1L20 14' })];
    case 'play': return [node('polygon', { points: '8 5 19 12 8 19', fill: 'currentColor', stroke: 'none' })];
    case 'image': return [node('rect', { x: 4, y: 5, width: 16, height: 14, rx: 2 }), node('circle', { cx: 9, cy: 10, r: 1.4 }), node('path', { d: 'm5.5 17 4.2-4.3 3 3 1.9-1.9 3.9 4.2' })];
    case 'status-live': return [node('circle', { cx: 12, cy: 12, r: 6, fill: 'currentColor', stroke: 'none' })];
    case 'status-dead': return [node('circle', { cx: 12, cy: 12, r: 6 }), node('path', { d: 'M8.5 8.5 15.5 15.5' })];
    case 'menu': return [node('path', { d: 'M5 7h14' }), node('path', { d: 'M5 12h14' }), node('path', { d: 'M5 17h14' })];
    default:
      return lineIcon('file');
  }
}

function homeIcon(style) {
  if (style === 'round') return [node('path', { d: 'M4.3 11.1 12 4.7l7.7 6.4' }), node('rect', { x: 6.4, y: 10.4, width: 11.2, height: 10, rx: 2.2 }), node('path', { d: 'M10 20.4v-5.3a2 2 0 0 1 4 0v5.3' })];
  if (style === 'sharp') return [node('polygon', { points: '3.5 11 12 4 20.5 11', ...tint() }), node('path', { d: 'M4 11h2v9h12v-9h2' }), node('path', { d: 'M9.5 20v-6h5v6' })];
  if (style === 'bold') return [node('path', { d: 'M12 3.8 21 11h-2v9.2H5V11H3l9-7.2Z', ...fill({ opacity: 0.9 }) }), node('rect', { x: 10, y: 14, width: 4, height: 6.2, rx: 0.7, fill: 'var(--bg)', stroke: 'none', opacity: 0.55 })];
  if (style === 'duo') return [node('path', { d: 'M5.2 10.9 12 5l6.8 5.9' }), node('rect', { x: 6.7, y: 10.2, width: 10.6, height: 9.8, rx: 1.6, ...tint({ opacity: 0.2 }) }), node('path', { d: 'M9.7 20v-5.2h4.6V20' })];
  return [node('polyline', { points: '4 11 12 5 20 11' }), node('rect', { x: 7, y: 11, width: 10, height: 9, rx: 0.4 }), node('path', { d: 'M10.5 20v-5h3v5' })];
}

function terminalIcon(style) {
  if (style === 'round') return [node('rect', { x: 3.2, y: 4.8, width: 17.6, height: 14.4, rx: 3.2 }), node('path', { d: 'm7.4 9.4 2.7 2.6-2.7 2.6' }), node('path', { d: 'M13.4 14.7h4.1' })];
  if (style === 'sharp') return [node('path', { d: 'M3.5 5.5h17v13h-17Z' }), node('path', { d: 'M8 9l3.1 3L8 15' }), node('path', { d: 'M13.5 15h4.2' })];
  if (style === 'bold') return [node('rect', { x: 3.2, y: 5, width: 17.6, height: 14, rx: 2, ...fill({ opacity: 0.18 }) }), node('path', { d: 'm7.4 9.2 3.1 2.8-3.1 2.8' }), node('rect', { x: 13.2, y: 14.1, width: 4.7, height: 1.8, rx: 0.6, ...fill({ opacity: 0.9 }) })];
  if (style === 'duo') return [node('rect', { x: 3.4, y: 5, width: 17.2, height: 14, rx: 2.4 }), node('path', { d: 'M3.4 8.6h17.2', opacity: 0.75 }), node('circle', { cx: 6.6, cy: 7.1, r: 0.55, ...fill({ opacity: 0.75 }) }), node('path', { d: 'm7.5 10.1 2.6 2.4-2.6 2.4' }), node('path', { d: 'M13.4 15.1h4' })];
  return [node('path', { d: 'M4 6h16v12H4Z' }), node('path', { d: 'm8 9.5 2.6 2.5L8 14.5' }), node('path', { d: 'M13.3 15h4' })];
}

function folderIcon(style) {
  if (style === 'round') return [node('path', { d: 'M3.2 8.7A2.2 2.2 0 0 1 5.4 6.5h4.3l2 2h6.9a2.2 2.2 0 0 1 2.2 2.2v6.6a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2Z' }), node('path', { d: 'M3.5 10.2h17' })];
  if (style === 'sharp') return [node('polygon', { points: '3 7 9.8 7 11.8 9.2 21 9.2 21 19.5 3 19.5', ...tint() }), node('path', { d: 'M3 7h6.8l2 2.2H21v10.3H3Z' }), node('path', { d: 'M3 10h18' })];
  if (style === 'bold') return [node('path', { d: 'M3.2 8a2 2 0 0 1 2-2h4.5l2 2.2H19a2 2 0 0 1 2 2v7.3a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2Z', ...fill({ opacity: 0.18 }) }), node('path', { d: 'M3.2 10.3h17.6' })];
  if (style === 'duo') return [node('path', { d: 'M3.2 8.2h6.4l2 2h9.2v7.3a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2Z' }), node('path', { d: 'M4.2 6.5h5.7l2 2H20', opacity: 0.7 }), node('path', { d: 'M3.4 10.3h17.2', opacity: 0.55 })];
  return [node('path', { d: 'M3.5 8h6l2 2H20v9H3.5Z' }), node('path', { d: 'M3.5 10h17' })];
}

function fileIcon(style, kind) {
  const extras = kind === 'log' ? logLines(style) : kind === 'empty' ? emptyMark(style) : [];
  if (style === 'round') return [node('path', { d: 'M7.2 3.5h5.7L18.5 9v11a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z' }), node('path', { d: 'M12.7 3.8v5.4h5.4' }), ...extras];
  if (style === 'sharp') return [node('polygon', { points: '6 3.5 13 3.5 18.5 9 18.5 21 6 21', ...tint() }), node('path', { d: 'M6 3.5h7l5.5 5.5v12H6Z' }), node('path', { d: 'M13 3.8V9h5.2' }), ...extras];
  if (style === 'bold') return [node('path', { d: 'M6.2 3.5h7.2L18.8 9v11a1.6 1.6 0 0 1-1.6 1.6H6.2Z', ...fill({ opacity: 0.16 }) }), node('path', { d: 'M13.2 4v5.3h5.1' }), ...extras];
  if (style === 'duo') return [node('path', { d: 'M6.2 3.5h7L18.5 8.8V20a1.6 1.6 0 0 1-1.6 1.6H6.2Z' }), node('path', { d: 'M13 4v5h5', opacity: 0.7 }), ...extras];
  return [node('path', { d: 'M6.5 4h7l4 4v17h-11Z' }), node('path', { d: 'M13.5 4v4h4' }), ...extras];
}

function settingsIcon(style) {
  if (style === 'round') return [node('path', { d: 'M5 7h6' }), node('path', { d: 'M15 7h4' }), node('circle', { cx: 13, cy: 7, r: 2 }), node('path', { d: 'M5 12h3' }), node('path', { d: 'M12 12h7' }), node('circle', { cx: 10, cy: 12, r: 2 }), node('path', { d: 'M5 17h8' }), node('path', { d: 'M17 17h2' }), node('circle', { cx: 15, cy: 17, r: 2 })];
  if (style === 'sharp') return [node('path', { d: 'M4 6h20' }), node('path', { d: 'M4 12h20' }), node('path', { d: 'M4 18h20' }), node('rect', { x: 8, y: 4.5, width: 3, height: 3 }), node('rect', { x: 14, y: 10.5, width: 3, height: 3 }), node('rect', { x: 11, y: 16.5, width: 3, height: 3 })];
  if (style === 'bold') return [node('path', { d: 'M4 7h5M14 7h6M4 12h9M18 12h2M4 17h4M13 17h7' }), node('circle', { cx: 11.5, cy: 7, r: 2, ...fill({ opacity: 0.85 }) }), node('circle', { cx: 15.5, cy: 12, r: 2, ...fill({ opacity: 0.85 }) }), node('circle', { cx: 10.5, cy: 17, r: 2, ...fill({ opacity: 0.85 }) })];
  if (style === 'duo') return [node('rect', { x: 4, y: 5, width: 16, height: 14, rx: 2, ...tint({ opacity: 0.12 }) }), ...lineIcon('settings')];
  return [node('path', { d: 'M7 5v14' }), node('path', { d: 'M12 5v14' }), node('path', { d: 'M17 5v14' }), node('circle', { cx: 7, cy: 9, r: 1.6 }), node('circle', { cx: 12, cy: 15, r: 1.6 }), node('circle', { cx: 17, cy: 11, r: 1.6 })];
}

function helpIcon(style) {
  if (style === 'round') return [node('circle', { cx: 12, cy: 12, r: 8.8 }), node('path', { d: 'M9.4 9.4a2.7 2.7 0 0 1 5.2 1c0 2-2.4 2.1-2.4 4.1' }), node('circle', { cx: 12.2, cy: 17.4, r: 0.6, ...fill() })];
  if (style === 'sharp') return [node('polygon', { points: '12 3.5 20.5 8 20.5 16 12 20.5 3.5 16 3.5 8' }), node('path', { d: 'M9.5 9.5c.4-1.5 1.4-2.2 3-2.1 1.7.1 2.6 1.1 2.6 2.5 0 1.8-2.3 2.1-2.7 3.8' }), node('path', { d: 'M12 17h.1' })];
  if (style === 'bold') return [node('circle', { cx: 12, cy: 12, r: 8.5, ...fill({ opacity: 0.16 }) }), node('path', { d: 'M9.6 9.5a2.5 2.5 0 0 1 4.9.8c0 1.9-2.2 2.1-2.2 4' }), node('circle', { cx: 12, cy: 17.2, r: 0.75, ...fill({ opacity: 0.9 }) })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8.7 }), node('circle', { cx: 12, cy: 12, r: 5.8, ...tint({ opacity: 0.14 }) }), node('path', { d: 'M9.8 9.5a2.3 2.3 0 0 1 4.4.8c0 1.9-2.2 2.1-2.2 4' }), node('circle', { cx: 12, cy: 17.2, r: 0.5, ...fill({ opacity: 0.85 }) })];
  return [node('path', { d: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z' }), node('path', { d: 'M10 9.5c.3-1 1-1.5 2.2-1.5 1.3 0 2 .8 2 1.9 0 1.7-2.2 1.8-2.2 3.8' }), node('path', { d: 'M12 17h.1' })];
}

function plusIcon(style) {
  if (style === 'bold') return [node('rect', { x: 10.8, y: 5, width: 2.4, height: 14, rx: 0.7, ...fill() }), node('rect', { x: 5, y: 10.8, width: 14, height: 2.4, rx: 0.7, ...fill() })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.14 }) }), ...plusMark(style, 12, 12, 6)];
  if (style === 'sharp') return [node('path', { d: 'M12 4v16' }), node('path', { d: 'M4 12h16' })];
  if (style === 'mono') return [node('path', { d: 'M12 6v12M6 12h12' })];
  return plusMark(style, 12, 12, 7);
}

function minusIcon(style) {
  if (style === 'bold') return [node('rect', { x: 5, y: 10.8, width: 14, height: 2.4, rx: 0.8, ...fill() })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.14 }) }), node('path', { d: 'M6.5 12h11' })];
  return [node('path', { d: style === 'sharp' ? 'M4 12h16' : 'M5 12h14' })];
}

function closeIcon(style) {
  if (style === 'bold') return [node('path', { d: 'M7.1 5.7 12 10.6l4.9-4.9 1.4 1.4-4.9 4.9 4.9 4.9-1.4 1.4-4.9-4.9-4.9 4.9-1.4-1.4 4.9-4.9-4.9-4.9Z', ...fill() })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.14 }) }), node('path', { d: 'M7.3 7.3 16.7 16.7' }), node('path', { d: 'M16.7 7.3 7.3 16.7' })];
  if (style === 'sharp') return [node('path', { d: 'M5 5l14 14' }), node('path', { d: 'M19 5 5 19' })];
  return [node('path', { d: 'M6.5 6.5 17.5 17.5' }), node('path', { d: 'M17.5 6.5 6.5 17.5' })];
}

function checkIcon(style) {
  if (style === 'bold') return [node('path', { d: 'm9.2 16.5-4-4 1.6-1.6 2.4 2.4 7-7 1.6 1.6Z', ...fill() })];
  if (style === 'sharp') return [node('path', { d: 'M4.5 12.5 9 17 19.5 6.5' })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.14 }) }), node('path', { d: 'm6.2 12.4 3.6 3.6 8-8.4' })];
  return [node('path', { d: 'm5.2 12.4 4.1 4.1 9.4-9.4' })];
}

function trashIcon(style) {
  if (style === 'bold') return [node('path', { d: 'M6.8 7.8h10.4l-.7 13H7.5Z', ...fill({ opacity: 0.16 }) }), node('path', { d: 'M5 7.5h14M9 7.5V5h6v2.5M10 11v6M14 11v6' })];
  if (style === 'sharp') return [node('path', { d: 'M5 7h14' }), node('path', { d: 'M8 7h8l-.8 14H8.8Z' }), node('path', { d: 'M9.5 7V4.5h5V7' }), node('path', { d: 'M10.5 11v6M14 11v6' })];
  if (style === 'duo') return [node('path', { d: 'M7.5 8h9l-.6 12.5H8.1Z', ...tint({ opacity: 0.16 }) }), ...lineIcon('trash')];
  return [node('path', { d: 'M5.5 7.5h13' }), node('path', { d: 'M8 7.5 8.8 20h6.4L16 7.5' }), node('path', { d: 'M9.5 7.5V5h5v2.5' }), node('path', { d: 'M10.5 11v6M13.5 11v6' })];
}

function stopIcon(style) {
  if (style === 'bold') return [node('rect', { x: 7, y: 7, width: 10, height: 10, rx: style === 'round' ? 3 : 1, ...fill({ opacity: 0.85 }) })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.14 }) }), node('rect', { x: 7.5, y: 7.5, width: 9, height: 9, rx: 1.2 })];
  return [node('rect', { x: 7, y: 7, width: 10, height: 10, rx: style === 'round' ? 2.4 : 0.6 })];
}

function copyIcon(style) {
  if (style === 'bold') return [node('rect', { x: 8, y: 8, width: 11, height: 13, rx: 1.5, ...fill({ opacity: 0.16 }) }), node('path', { d: 'M8 17H5V4h11v4M8 8h11v13H8Z' })];
  if (style === 'sharp') return [node('path', { d: 'M8 8h11v13H8Z' }), node('path', { d: 'M5 16H4V4h12v2' })];
  if (style === 'duo') return [node('rect', { x: 8.2, y: 8.2, width: 10.8, height: 12.6, rx: 1.7, ...tint({ opacity: 0.14 }) }), ...lineIcon('copy')];
  return [node('rect', { x: 8, y: 8, width: 11, height: 13, rx: style === 'round' ? 2.4 : 0.8 }), node('path', { d: 'M5.5 16H4.8A1.8 1.8 0 0 1 3 14.2V5.8A1.8 1.8 0 0 1 4.8 4h8.4A1.8 1.8 0 0 1 15 5.8V6' })];
}

function pasteIcon(style) {
  if (style === 'bold') return [node('path', { d: 'M8.2 6H5.8A1.8 1.8 0 0 0 4 7.8v12.4A1.8 1.8 0 0 0 5.8 22h12.4a1.8 1.8 0 0 0 1.8-1.8V7.8A1.8 1.8 0 0 0 17.8 6H15.8', ...tint({ opacity: 0.16 }) }), ...lineIcon('paste')];
  if (style === 'sharp') return [node('path', { d: 'M8 6H4v16h16V6h-4' }), node('path', { d: 'M9 4h6v3H9Z' })];
  if (style === 'duo') return [node('rect', { x: 4, y: 6, width: 16, height: 16, rx: 2, ...tint({ opacity: 0.13 }) }), ...lineIcon('paste')];
  return lineIcon('paste');
}

function selectAllIcon(style) {
  if (style === 'sharp') return [node('path', { d: 'M4 4h16v16H4Z', 'stroke-dasharray': '2.5 2.5' }), node('path', { d: 'M8 8h8v8H8Z' })];
  if (style === 'bold') return [node('rect', { x: 8, y: 8, width: 8, height: 8, rx: 1, ...fill({ opacity: 0.18 }) }), node('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, 'stroke-dasharray': '3 3' })];
  if (style === 'duo') return [node('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2, ...tint({ opacity: 0.1 }) }), ...lineIcon('select-all')];
  return lineIcon('select-all');
}

function clearIcon(style) {
  if (style === 'bold') return [node('circle', { cx: 12, cy: 12, r: 8.5, ...fill({ opacity: 0.15 }) }), node('path', { d: 'M8 16 16 8' })];
  if (style === 'sharp') return [node('path', { d: 'M4 4h16v16H4Z' }), node('path', { d: 'M8 16 16 8' })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8.5, ...tint({ opacity: 0.12 }) }), node('circle', { cx: 12, cy: 12, r: 8.5 }), node('path', { d: 'M8 16 16 8' })];
  return [node(style === 'mono' ? 'rect' : 'circle', style === 'mono' ? { x: 5, y: 5, width: 14, height: 14, rx: 1 } : { cx: 12, cy: 12, r: 8.5 }), node('path', { d: 'M8 16 16 8' })];
}

function transferIcon(style, direction) {
  const isUpload = direction === 'upload';
  if (style === 'bold') return [node('path', { d: isUpload ? 'M11 19V9h2v10Z' : 'M11 4v10h2V4Z', ...fill() }), node('path', { d: isUpload ? 'm7.2 13.2 4.8-4.8 4.8 4.8-1.5 1.5L12 11.4l-3.3 3.3Z' : 'm7.2 10.8 4.8 4.8 4.8-4.8-1.5-1.5L12 12.6 8.7 9.3Z', ...fill() }), node('path', { d: isUpload ? 'M5 5h14' : 'M5 19h14' })];
  if (style === 'duo') return [node('rect', { x: 5, y: 5, width: 14, height: 14, rx: 2, ...tint({ opacity: 0.11 }) }), ...lineIcon(direction)];
  if (style === 'sharp') return [node('path', { d: isUpload ? 'M12 20V8' : 'M12 4v12' }), node('path', { d: isUpload ? 'M7.5 12.5 12 8l4.5 4.5' : 'M7.5 11.5 12 16l4.5-4.5' }), node('path', { d: isUpload ? 'M5 5h14' : 'M5 20h14' })];
  return lineIcon(direction);
}

function parentIcon(style) {
  if (style === 'sharp') return [node('path', { d: 'M20 20H8V7' }), node('path', { d: 'M4 11V5h6' })];
  if (style === 'bold') return [node('path', { d: 'M19 19H8a3 3 0 0 1-3-3V6' }), node('path', { d: 'm5 6 4 4M5 6l-4 4' })];
  if (style === 'duo') return [node('path', { d: 'M19 19H8a3 3 0 0 1-3-3V6' }), node('path', { d: 'M5 6h6v6', ...tint({ opacity: 0.16 }) }), node('path', { d: 'm9 10-4-4-4 4' })];
  return lineIcon('parent');
}

function fullscreenIcon(style) {
  if (style === 'sharp') return [node('path', { d: 'M4 10V4h6' }), node('path', { d: 'M14 4h6v6' }), node('path', { d: 'M20 14v6h-6' }), node('path', { d: 'M10 20H4v-6' })];
  if (style === 'bold') return [node('path', { d: 'M5 5h6v2H7v4H5ZM13 5h6v6h-2V7h-4ZM17 13h2v6h-6v-2h4ZM5 13h2v4h4v2H5Z', ...fill() })];
  if (style === 'duo') return [node('rect', { x: 5, y: 5, width: 14, height: 14, rx: 2, ...tint({ opacity: 0.1 }) }), ...lineIcon('fullscreen')];
  return lineIcon('fullscreen');
}

function chevronIcon(style) {
  if (style === 'bold') return [node('path', { d: 'm6.8 8.5 5.2 5.2 5.2-5.2 1.4 1.4L12 16.5 5.4 9.9Z', ...fill() })];
  if (style === 'sharp') return [node('polyline', { points: '6 8 12 14 18 8' })];
  return [node('path', { d: 'm7 9 5 5 5-5' })];
}

function usersIcon(style) {
  if (style === 'bold') return [node('circle', { cx: 9, cy: 8, r: 3, ...fill({ opacity: 0.17 }) }), node('path', { d: 'M3.5 19a5.5 5.5 0 0 1 11 0' }), node('circle', { cx: 16.5, cy: 8.4, r: 2.4 }), node('path', { d: 'M16.5 14.2a4.4 4.4 0 0 1 4 4.4' })];
  if (style === 'sharp') return [node('circle', { cx: 9, cy: 8, r: 3 }), node('path', { d: 'M3 20v-1a6 6 0 0 1 12 0v1' }), node('circle', { cx: 16.5, cy: 8.5, r: 2.5 }), node('path', { d: 'M16.5 14a4.8 4.8 0 0 1 4.5 5' })];
  if (style === 'duo') return [node('circle', { cx: 9, cy: 8, r: 3, ...tint({ opacity: 0.13 }) }), ...lineIcon('users')];
  return lineIcon('users');
}

function spinnerIcon(style) {
  if (style === 'sharp') return [node('path', { d: 'M12 3v4' }), node('path', { d: 'M21 12h-4' }), node('path', { d: 'M12 21v-4' }), node('path', { d: 'M3 12h4' })];
  if (style === 'bold') return [node('path', { d: 'M12 3a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6Z', ...fill({ opacity: 0.9 }) }), node('path', { d: 'M12 21a9 9 0 0 1-9-9h3a6 6 0 0 0 6 6Z', ...fill({ opacity: 0.45 }) })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, opacity: 0.28 }), node('path', { d: 'M20 12a8 8 0 0 1-8 8' })];
  return lineIcon('spinner');
}

function refreshIcon(style) {
  if (style === 'sharp') return [node('path', { d: 'M20 5v6h-6' }), node('path', { d: 'M4 19v-6h6' }), node('path', { d: 'M18.4 10a6.8 6.8 0 0 0-11.5-3L4 10' }), node('path', { d: 'M5.6 14a6.8 6.8 0 0 0 11.5 3L20 14' })];
  if (style === 'bold') return [node('path', { d: 'M20 6v5h-5' }), node('path', { d: 'M18.1 10a6.4 6.4 0 0 0-11-3.1L4 10' }), node('path', { d: 'M4 18v-5h5' }), node('path', { d: 'M5.9 14a6.4 6.4 0 0 0 11 3.1L20 14' })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.1 }) }), ...lineIcon('refresh')];
  return lineIcon('refresh');
}

function playIcon(style) {
  if (style === 'sharp') return [node('polygon', { points: '8 4 20 12 8 20', ...fill({ opacity: 0.9 }) })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.12 }) }), node('polygon', { points: '9 6.5 18 12 9 17.5', ...fill({ opacity: 0.9 }) })];
  return [node('polygon', { points: '8 5 19 12 8 19', ...fill({ opacity: style === 'mono' ? 0.8 : 1 }) })];
}

function imageIcon(style) {
  if (style === 'bold') return [node('rect', { x: 4, y: 5, width: 16, height: 14, rx: 2, ...fill({ opacity: 0.14 }) }), node('circle', { cx: 9, cy: 10, r: 1.4 }), node('path', { d: 'm5.5 17 4.2-4.3 3 3 1.9-1.9 3.9 4.2' })];
  if (style === 'sharp') return [node('path', { d: 'M4 5h16v14H4Z' }), node('circle', { cx: 9, cy: 10, r: 1.4 }), node('path', { d: 'm5.5 17 4-4 3 3 2-2 4 4' })];
  if (style === 'duo') return [node('rect', { x: 4, y: 5, width: 16, height: 14, rx: 2, ...tint({ opacity: 0.13 }) }), ...lineIcon('image')];
  return lineIcon('image');
}

function statusIcon(style, live) {
  if (live) {
    if (style === 'sharp') return [node('polygon', { points: '12 5 18 8.5 18 15.5 12 19 6 15.5 6 8.5', ...fill({ opacity: 0.9 }) })];
    if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 8, ...tint({ opacity: 0.12 }) }), node('circle', { cx: 12, cy: 12, r: 4.8, ...fill({ opacity: 0.9 }) })];
    return [node('circle', { cx: 12, cy: 12, r: style === 'mono' ? 4.5 : 6, ...fill({ opacity: 0.9 }) })];
  }
  if (style === 'sharp') return [node('polygon', { points: '12 5 18 8.5 18 15.5 12 19 6 15.5 6 8.5' }), node('path', { d: 'M8.5 8.5 15.5 15.5' })];
  if (style === 'duo') return [node('circle', { cx: 12, cy: 12, r: 6, ...tint({ opacity: 0.12 }) }), node('circle', { cx: 12, cy: 12, r: 6 }), node('path', { d: 'M8.5 8.5 15.5 15.5' })];
  return lineIcon('status-dead');
}

function menuIcon(style) {
  if (style === 'bold') return [node('rect', { x: 5, y: 6.2, width: 14, height: 1.9, rx: 0.8, ...fill() }), node('rect', { x: 5, y: 11.1, width: 14, height: 1.9, rx: 0.8, ...fill() }), node('rect', { x: 5, y: 16, width: 14, height: 1.9, rx: 0.8, ...fill() })];
  if (style === 'sharp') return [node('path', { d: 'M4 7h16M4 12h16M4 17h16' })];
  if (style === 'duo') return [node('rect', { x: 4, y: 5, width: 16, height: 14, rx: 2, ...tint({ opacity: 0.1 }) }), node('path', { d: 'M7 8h10M7 12h10M7 16h10' })];
  return lineIcon('menu');
}

function plusMark(style, cx, cy, size) {
  if (style === 'bold') {
    return [
      node('rect', { x: cx - 0.8, y: cy - size, width: 1.6, height: size * 2, rx: 0.4, ...fill() }),
      node('rect', { x: cx - size, y: cy - 0.8, width: size * 2, height: 1.6, rx: 0.4, ...fill() }),
    ];
  }
  return [
    node('path', { d: `M${cx} ${cy - size}v${size * 2}` }),
    node('path', { d: `M${cx - size} ${cy}h${size * 2}` }),
  ];
}

function fileLines(x, y) {
  return [
    node('path', { d: `M${x} ${y}h6` }),
    node('path', { d: `M${x} ${y + 3}h6` }),
    node('path', { d: `M${x} ${y + 6}h3.5` }),
  ];
}

function logLines(style) {
  if (style === 'bold') return [node('rect', { x: 8.8, y: 12.2, width: 6.6, height: 1.3, rx: 0.4, ...fill({ opacity: 0.8 }) }), node('rect', { x: 8.8, y: 15.2, width: 6.6, height: 1.3, rx: 0.4, ...fill({ opacity: 0.8 }) }), node('rect', { x: 8.8, y: 18.2, width: 3.8, height: 1.3, rx: 0.4, ...fill({ opacity: 0.8 }) })];
  return fileLines(9, 12.5);
}

function emptyMark(style) {
  if (style === 'bold') return [node('rect', { x: 9.2, y: 14.2, width: 5.6, height: 1.5, rx: 0.5, ...fill({ opacity: 0.55 }) })];
  if (style === 'sharp') return [node('path', { d: 'M9 15h6' })];
  return [node('path', { d: 'M9.2 15h5.6', opacity: 0.55 })];
}
</script>

<style scoped>
.app-icon {
  display: inline-block;
  width: var(--app-icon-size, 1em);
  height: var(--app-icon-size, 1em);
  min-width: var(--app-icon-size, 1em);
  min-height: var(--app-icon-size, 1em);
  color: currentColor;
  flex: 0 0 auto;
  line-height: 1;
  vertical-align: -0.125em;
  overflow: visible;
  pointer-events: none;
  shape-rendering: geometricPrecision;
  filter: var(--app-icon-filter, none);
}

.app-icon :where(path, line, polyline, polygon, circle, rect) {
  vector-effect: non-scaling-stroke;
  stroke-width: var(--app-icon-stroke, 1.9);
  stroke-linecap: var(--app-icon-cap, round);
  stroke-linejoin: var(--app-icon-join, round);
  opacity: var(--app-icon-opacity, 1);
}

[data-icon-style="round"] .app-icon {
  --app-icon-stroke: 2;
  --app-icon-cap: round;
  --app-icon-join: round;
}

[data-icon-style="sharp"] .app-icon {
  --app-icon-stroke: 1.75;
  --app-icon-cap: square;
  --app-icon-join: miter;
}

[data-icon-style="bold"] .app-icon {
  --app-icon-stroke: 2.35;
}

[data-icon-style="duo"] .app-icon {
  --app-icon-stroke: 1.95;
  --app-icon-filter: drop-shadow(0 0 5px color-mix(in srgb, var(--neon) 32%, transparent));
}

[data-icon-style="duo"] .app-icon :where(path:nth-child(even), line:nth-child(even), polyline:nth-child(even), rect:nth-child(even), circle:nth-child(even), polygon:nth-child(even)) {
  color: var(--neon2);
  opacity: .82;
}

[data-icon-style="mono"] .app-icon {
  --app-icon-stroke: 1.7;
  --app-icon-opacity: .86;
  --app-icon-filter: none;
}

.app-icon--empty {
  opacity: 0.85;
}

.app-icon--spin {
  animation: app-icon-spin 0.9s linear infinite;
  transform-origin: 50% 50%;
}

@keyframes app-icon-spin {
  to { transform: rotate(360deg); }
}
</style>

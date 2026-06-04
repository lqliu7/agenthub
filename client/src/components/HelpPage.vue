<template>
  <div class="help-root">
    <div v-if="navOpen" class="help-scrim" @click="navOpen = false"></div>

    <div class="help-sidebar" :class="{ open: navOpen }">
      <div class="help-sidebar-head">
        <div class="help-sidebar-title">{{ uiText.title }}</div>
        <button class="help-sidebar-close" type="button" @click="navOpen = false">
          <AppIcon name="close" />
        </button>
      </div>
      <button
        v-for="doc in docs" :key="doc.name"
        class="help-nav-item"
        :class="{ active: current === doc.name }"
        @click="loadDoc(doc.name)"
      >
        <span>{{ doc.label[activeLanguage] }}</span>
        <AppIcon v-if="current === doc.name" name="chevron" class="help-nav-mark" />
      </button>
    </div>

    <div class="help-main">
      <div class="help-toolbar">
        <button class="help-mobile-nav" type="button" @click="navOpen = true">
          <AppIcon name="menu" />
          <span>{{ uiText.sections }}</span>
        </button>
        <div class="help-current">{{ currentDoc.label[activeLanguage] }}</div>
        <div class="help-lang-toggle" role="group" :aria-label="uiText.language">
          <button
            type="button"
            :class="{ active: activeLanguage === 'zh' }"
            @click="settings.language = 'zh'"
          >中文</button>
          <button
            type="button"
            :class="{ active: activeLanguage === 'en' }"
            @click="settings.language = 'en'"
          >English</button>
        </div>
      </div>

      <div class="help-content" ref="contentRef">
        <div v-if="loading" class="help-status">{{ uiText.loading }}</div>
        <div v-else-if="error" class="help-status help-error">{{ error }}</div>
        <div v-else class="help-md" v-html="rendered"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { marked } from 'marked';
import { settings } from '../settings.js';
import AppIcon from './AppIcon.vue';

const docs = [
  { name: 'usage.md',        label: { zh: '使用手册', en: 'Usage' } },
  { name: 'installation.md', label: { zh: '安装指南', en: 'Installation' } },
  { name: 'api.md',          label: { zh: 'API 文档', en: 'API' } },
  { name: 'architecture.md', label: { zh: '架构说明', en: 'Architecture' } },
  { name: 'development.md',  label: { zh: '开发指南', en: 'Development' } },
];

const current = ref('usage.md');
const rawMarkdown = ref('');
const loading = ref(false);
const error = ref('');
const navOpen = ref(false);
const contentRef = ref(null);

marked.setOptions({ breaks: true, gfm: true });

const activeLanguage = computed(() => settings.language === 'en' ? 'en' : 'zh');
const currentDoc = computed(() => docs.find(doc => doc.name === current.value) || docs[0]);
const uiText = computed(() => activeLanguage.value === 'en'
  ? {
      title: 'Help',
      sections: 'Sections',
      language: 'Language',
      loading: 'Loading...',
      failed: 'Failed to load',
    }
  : {
      title: '帮助文档',
      sections: '章节',
      language: '语言',
      loading: '加载中...',
      failed: '加载失败',
    });

const localizedMarkdown = computed(() =>
  extractLocalizedMarkdown(rawMarkdown.value, activeLanguage.value, currentDoc.value.label[activeLanguage.value])
);
const rendered = computed(() => marked.parse(rewriteDocAssetUrls(localizedMarkdown.value)));

function extractLocalizedMarkdown(text, lang, title) {
  if (!text) return '';
  const zhMatch = text.match(/^##\s+中文\s*$/m);
  const enMatch = text.match(/^##\s+English\s*$/m);
  if (!zhMatch || !enMatch) return text;

  const zhStart = zhMatch.index + zhMatch[0].length;
  const enStart = enMatch.index + enMatch[0].length;
  const body = lang === 'en'
    ? text.slice(enStart)
    : text.slice(zhStart, enMatch.index);

  return `# ${title}\n\n${body.trim()}\n`;
}

function rewriteDocAssetUrls(markdown) {
  return markdown
    .replace(/src=(["'])\.?\/?assets\//g, 'src=$1/docs/assets/')
    .replace(/]\(\.?\/?assets\//g, '](/docs/assets/');
}

async function loadDoc(name) {
  current.value = name;
  navOpen.value = false;
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`/docs/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawMarkdown.value = await res.text();
    if (contentRef.value) contentRef.value.scrollTop = 0;
  } catch (e) {
    error.value = `${uiText.value.failed}: ${e.message}`;
  } finally {
    loading.value = false;
  }
}

watch(activeLanguage, () => {
  if (contentRef.value) contentRef.value.scrollTop = 0;
});

onMounted(() => loadDoc('usage.md'));
</script>

<style scoped>
.help-root {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

/* ── 侧边栏 ─────────────────────────────── */
.help-sidebar {
  width: 168px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--panel) 78%, transparent);
  border-right: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  padding: 13px 0;
  overflow-y: auto;
  z-index: 3;
}
.help-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px 10px 12px;
}
.help-sidebar-title {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--muted);
  min-width: 0;
}
.help-sidebar-close {
  display: none;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--panel2) 84%, transparent);
  color: var(--muted);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  --app-icon-size: 14px;
}
.help-nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--muted);
  padding: 8px 12px;
  transition: background .12s, color .12s, border-color .12s;
  border-left: 2px solid transparent;
}
.help-nav-item:hover { color: var(--text); background: color-mix(in srgb, var(--neon) 5%, transparent); }
.help-nav-item.active { color: var(--neon); border-left-color: var(--neon); background: color-mix(in srgb, var(--neon) 8%, transparent); }
.help-nav-mark {
  transform: rotate(-90deg);
  --app-icon-size: 12px;
}

.help-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.help-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 9px 18px;
  border-bottom: 1px solid var(--hairline);
  background: color-mix(in srgb, var(--panel) 62%, transparent);
}
.help-mobile-nav {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 32px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--neon) 7%, var(--panel2));
  color: var(--text);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  cursor: pointer;
  --app-icon-size: 14px;
}
.help-current {
  flex: 1;
  min-width: 0;
  color: var(--text);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.help-lang-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(72px, 1fr));
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--panel2) 80%, transparent);
}
.help-lang-toggle button {
  min-height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.help-lang-toggle button.active {
  color: var(--neon);
  background: color-mix(in srgb, var(--neon) 13%, transparent);
}

/* ── 内容区 ─────────────────────────────── */
.help-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 26px 30px 40px;
  scrollbar-width: thin;
  scrollbar-color: var(--muted) transparent;
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 16%, transparent), transparent 160px);
}
.help-status {
  color: var(--muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 20px 0;
}
.help-error { color: var(--danger); }

@media (max-width: 720px) {
  .help-root {
    display: block;
  }
  .help-sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(280px, 78vw);
    max-height: none;
    border-right: 1px solid var(--border);
    border-bottom: none;
    box-shadow: 18px 0 42px color-mix(in srgb, #000000 34%, transparent);
    transform: translateX(-104%);
    transition: transform .18s ease;
  }
  .help-sidebar.open {
    transform: translateX(0);
  }
  .help-sidebar-close {
    display: inline-flex;
  }
  .help-scrim {
    position: absolute;
    inset: 0;
    z-index: 2;
    background: color-mix(in srgb, #000000 42%, transparent);
    backdrop-filter: blur(2px);
  }
  .help-main {
    height: 100%;
  }
  .help-toolbar {
    padding: 8px 12px;
  }
  .help-mobile-nav {
    display: inline-flex;
  }
  .help-content {
    padding: 20px 18px 32px;
  }
  .help-lang-toggle {
    grid-template-columns: repeat(2, minmax(58px, 1fr));
  }
  .help-lang-toggle button {
    font-size: 10px;
  }
  .help-current {
    display: none;
  }
}
</style>

<!-- Markdown 渲染样式：全局（不 scoped） -->
<style>
.help-md {
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.7;
  max-width: 880px;
}
.help-md h1 {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 22px;
  font-weight: 800;
  color: var(--neon);
  border-bottom: 1px solid var(--hairline);
  padding-bottom: 10px;
  margin: 0 0 20px;
}
.help-md h2 {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  margin: 28px 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--hairline);
}
.help-md h3 {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 14px;
  font-weight: 700;
  color: var(--neon2);
  margin: 20px 0 8px;
}
.help-md p { margin: 0 0 12px; }
.help-md ul, .help-md ol {
  margin: 0 0 12px;
  padding-left: 20px;
}
.help-md li { margin: 4px 0; }
.help-md code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  background: color-mix(in srgb, var(--neon) 8%, var(--panel));
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  color: var(--neon);
}
.help-md pre {
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  overflow-x: auto;
  margin: 0 0 14px;
}
.help-md pre code {
  background: none;
  border: none;
  padding: 0;
  color: var(--text);
  font-size: 12px;
  line-height: 1.6;
}
.help-md blockquote {
  border-left: 3px solid var(--neon);
  margin: 0 0 14px;
  padding: 6px 14px;
  background: color-mix(in srgb, var(--neon) 5%, transparent);
  color: var(--muted);
  border-radius: 0 6px 6px 0;
}
.help-md table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 14px;
  font-size: 12px;
}
.help-md th {
  background: var(--panel);
  color: var(--neon);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 700;
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--border);
}
.help-md td {
  padding: 7px 12px;
  border: 1px solid var(--border);
  color: var(--text);
}
.help-md tr:nth-child(even) td { background: color-mix(in srgb, var(--panel) 60%, transparent); }
.help-md a { color: var(--neon2); text-decoration: none; }
.help-md a:hover { text-decoration: underline; }
.help-md img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--panel) 72%, transparent);
  box-shadow: 0 12px 28px color-mix(in srgb, #000000 22%, transparent);
}
.help-md td img {
  margin: 4px auto;
}
.help-md hr {
  border: none;
  border-top: 1px solid var(--hairline);
  margin: 20px 0;
}

@media (max-width: 720px) {
  .help-md table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
  .help-md th,
  .help-md td {
    min-width: 180px;
  }
}
</style>

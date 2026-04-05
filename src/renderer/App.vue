<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRepoStore } from './stores/repo';
import { useAuthStore } from './stores/auth';
import LoginPanel from './components/LoginPanel.vue';
import FileTree from './components/FileTree.vue';
import MarkdownEditor from './components/MarkdownEditor.vue';
import Settings from './components/Settings.vue';
import ConflictResolver from './components/ConflictResolver.vue';
import HistoryDialog from './components/HistoryDialog.vue';
import { createTranslator } from './i18n';

const repo = useRepoStore();
const auth = useAuthStore();

const loading = ref(true);
const bootError = ref('');
const settingsOpen = ref(false);
const conflictOpen = ref(false);
const conflictPayload = ref(null);
const historyOpen = ref(false);
const historyEntries = ref([]);
const historyPreview = ref('');
const historyFilePath = ref('');
const templateCards = computed(() => [
  {
    key: 'tplProduct',
    file: 'product-brief.md',
    content: `# 产品需求

## 背景
- 

## 目标
- 

## 核心功能
- 功能 1
- 功能 2

## 风险
- 
`
  },
  {
    key: 'tplMeeting',
    file: 'meeting-notes.md',
    content: `# 会议纪要

## 会议主题
- 

## 参会人员
- 

## 关键结论
- 

## 待办事项
- [ ] 
`
  },
  {
    key: 'tplRelease',
    file: 'release-checklist.md',
    content: `# 发布清单

## 发布信息
- 版本号：
- 发布时间：

## 检查项
- [ ] 功能验证
- [ ] 回归测试
- [ ] 回滚方案
`
  },
  {
    key: 'tplVendor',
    file: 'vendor-adaptation.md',
    content: `# 厂商适配记录

## 厂商信息
- 厂商：
- 设备/系统：

## 兼容性表现
- 

## 差异说明
- 

## 后续行动
- [ ] 
`
  }
]);

const firstRun = computed(() => !repo.settings.firstRunCompleted && !auth.isLoggedIn && repo.mode === 'local');
const t = computed(() => createTranslator(repo.settings.language || 'zh-CN'));

watch(
  () => repo.settings.backgroundTheme,
  (value) => {
    document.documentElement.dataset.theme = value || 'paper-dawn';
  },
  { immediate: true }
);

onMounted(async () => {
  try {
    if (!window.gitNoteApi) {
      throw new Error(t.value('startupPreload'));
    }
    const state = await repo.bootstrap();
    auth.setAuth(state.auth);
    document.documentElement.dataset.theme = state.settings.backgroundTheme || 'paper-dawn';
    window.gitNoteApi.onConflictOpen((payload) => {
      conflictPayload.value = payload;
      conflictOpen.value = true;
    });
    window.gitNoteApi.onSyncStatus((payload) => {
      repo.syncStatus = payload.ok
        ? `${t.value('lastSync')} ${new Date(payload.at).toLocaleTimeString()}`
        : `${t.value('syncFailed')}: ${payload.error}`;
    });
  } catch (error) {
    bootError.value = error?.message || String(error);
  } finally {
    loading.value = false;
  }
});

async function loginWithGithub() {
  loading.value = true;
  try {
    const state = await window.gitNoteApi.startOAuth();
    auth.setAuth(state.auth);
    repo.tree = state.tree;
    repo.mode = state.settings.mode;
    repo.settings = state.settings;
  } finally {
    loading.value = false;
  }
}

async function useLocalOnly() {
  await repo.saveSettings({ firstRunCompleted: true, mode: 'local' });
}

async function handleCreate(parentPath, type) {
  const defaultName = type === 'directory' ? 'new-folder' : 'new-note.md';
  const name = window.prompt(type === 'directory' ? t.value('folderName') : t.value('fileName'), defaultName);
  if (!name) {
    return;
  }
  await repo.createEntry(parentPath, name, type);
}

async function createTemplateNote(card) {
  await repo.createEntry('', `${Date.now()}-${card.file}`, 'file', card.content);
}

async function openHistory(node) {
  if (node.type !== 'file' || !auth.isLoggedIn) {
    return;
  }
  historyFilePath.value = node.path;
  historyEntries.value = await window.gitNoteApi.getHistory({ filePath: node.path });
  historyPreview.value = '';
  historyOpen.value = true;
}

async function previewHistory(entry) {
  const result = await window.gitNoteApi.getHistoryContent({
    filePath: historyFilePath.value,
    sha: entry.sha
  });
  historyPreview.value = result.content;
}

async function restoreHistory(entry) {
  const result = await window.gitNoteApi.getHistoryContent({
    filePath: historyFilePath.value,
    sha: entry.sha
  });
  await window.gitNoteApi.restoreHistory({
    filePath: historyFilePath.value,
    content: result.content
  });
  await repo.openFile(historyFilePath.value);
  historyOpen.value = false;
}

async function chooseDirectory() {
  const selected = await window.gitNoteApi.chooseDirectory();
  if (selected) {
    await repo.saveSettings({ repoRoot: selected });
  }
}

async function logout() {
  const state = await window.gitNoteApi.logout();
  auth.setAuth(state.auth);
  repo.tree = state.tree;
  repo.settings = state.settings;
  repo.mode = state.settings.mode;
  settingsOpen.value = false;
}
</script>

<template>
  <div v-if="loading" class="loading">{{ t('loading') }}</div>
  <main v-else-if="bootError" class="welcome">
    <section class="boot-error">
      <h1>{{ t('startupFailed') }}</h1>
      <p>{{ bootError }}</p>
    </section>
  </main>
  <main v-else-if="firstRun" class="welcome">
    <LoginPanel :t="t" @github-login="loginWithGithub" @local-only="useLocalOnly" />
  </main>
  <main v-else class="shell">
    <aside class="sidebar">
      <div class="sidebar-top">
        <div>
          <p class="label">{{ repo.mode === 'remote' ? t('githubSync') : t('localMode') }}</p>
          <h2>{{ t('notes') }}</h2>
        </div>
        <button class="ghost" @click="settingsOpen = true">{{ t('settings') }}</button>
      </div>
      <div class="sidebar-actions">
        <button class="accent" @click="handleCreate('', 'file')">{{ t('newNote') }}</button>
        <button @click="handleCreate('', 'directory')">{{ t('newFolder') }}</button>
        <button v-if="auth.isLoggedIn" @click="repo.syncNow()">{{ t('syncNow') }}</button>
        <button v-else @click="loginWithGithub">{{ t('loginAndSync') }}</button>
      </div>
      <section class="templates">
        <p class="label">{{ t('templates') }}</p>
        <div class="template-grid">
          <button
            v-for="card in templateCards"
            :key="card.key"
            class="template-card"
            @click="createTemplateNote(card)"
          >
            {{ t(card.key) }}
          </button>
        </div>
      </section>
      <FileTree
        :nodes="repo.tree"
        :selected="repo.selectedFile"
        @open="repo.openFile"
        @create="handleCreate"
        @rename="(path, newName) => repo.renameEntry(path, newName)"
        @delete="repo.deleteEntry"
        @history="openHistory"
      />
    </aside>
    <section class="editor-area">
      <header class="editor-header">
        <div>
          <h1>{{ repo.selectedFile || t('selectOrCreate') }}</h1>
          <p>{{ repo.syncStatus }}</p>
        </div>
        <div class="user-box" v-if="auth.isLoggedIn">
          <img :src="auth.user?.avatarUrl" alt="" />
          <span>{{ auth.user?.login }}</span>
        </div>
      </header>
      <MarkdownEditor
        v-if="repo.selectedFile"
        :model-value="repo.content"
        @update:model-value="repo.saveCurrentDebounced"
      />
      <div v-else class="empty-state">
        <p>{{ t('empty') }}</p>
      </div>
    </section>
  </main>

  <Settings
    :open="settingsOpen"
    :t="t"
    :settings="repo.settings"
    :auth="{ isLoggedIn: auth.isLoggedIn, user: auth.user }"
    @close="settingsOpen = false"
    @save="async (draft) => { await repo.saveSettings(draft); settingsOpen = false; }"
    @choose-directory="chooseDirectory"
    @logout="logout"
  />

  <ConflictResolver
    :open="conflictOpen"
    :t="t"
    :payload="conflictPayload"
    @close="conflictOpen = false"
    @resolve="async (payload) => { await window.gitNoteApi.resolveConflict(payload); conflictOpen = false; }"
  />

  <HistoryDialog
    :open="historyOpen"
    :t="t"
    :entries="historyEntries"
    @close="historyOpen = false"
    @preview="previewHistory"
    @restore="restoreHistory"
  >
    <template #default>
      <pre class="history-preview">{{ historyPreview }}</pre>
    </template>
  </HistoryDialog>
</template>

<style scoped>
.loading,
.welcome {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 40px;
}

.boot-error {
  max-width: 720px;
  display: grid;
  gap: 12px;
  padding: 32px;
  border-radius: 24px;
  background: var(--panel-strong);
  box-shadow: var(--shadow);
}

.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 18px;
  padding: 18px;
}

.sidebar,
.editor-area {
  min-height: calc(100vh - 36px);
  background: var(--panel);
  backdrop-filter: blur(18px);
  border: 1px solid var(--line);
  border-radius: 28px;
  box-shadow: var(--shadow);
}

.sidebar {
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  gap: 16px;
  padding: 18px;
}

.sidebar-top,
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--accent);
  font-size: 12px;
}

.sidebar h2,
.editor-header h1 {
  margin: 0;
}

.sidebar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.templates {
  display: grid;
  gap: 10px;
}

.template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.template-card {
  min-height: 68px;
  text-align: left;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 235, 214, 0.85));
}

button {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 10px 16px;
  background: #fffdf8;
  cursor: pointer;
}

.accent,
.ghost {
  border: none;
}

.accent {
  background: var(--accent);
  color: white;
}

.ghost {
  background: rgba(178, 74, 29, 0.08);
  color: var(--accent);
}

.editor-area {
  display: grid;
  grid-template-rows: auto 1fr;
  padding: 18px;
  gap: 14px;
}

.user-box {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-box img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}

.empty-state,
.history-preview {
  display: grid;
  place-items: center;
  min-height: 100%;
  color: var(--muted);
  white-space: pre-wrap;
}
</style>

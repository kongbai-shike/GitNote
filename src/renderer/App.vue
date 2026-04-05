<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRepoStore } from './stores/repo';
import { useAuthStore } from './stores/auth';
import { createTranslator } from './i18n';
import LoginPanel from './components/LoginPanel.vue';
import RepoManager from './components/RepoManager.vue';
import FileTree from './components/FileTree.vue';
import MarkdownEditor from './components/MarkdownEditor.vue';
import Settings from './components/Settings.vue';
import ConflictResolver from './components/ConflictResolver.vue';
import HistoryDialog from './components/HistoryDialog.vue';

const repo = useRepoStore();
const auth = useAuthStore();

const loading = ref(true);
const bootError = ref('');
const settingsOpen = ref(false);
const repoManagerOpen = ref(false);
const conflictOpen = ref(false);
const conflictPayload = ref(null);
const historyOpen = ref(false);
const historyEntries = ref([]);
const historyPreview = ref('');
const historyFilePath = ref('');

const t = computed(() => createTranslator(repo.settings.language || 'zh-CN'));
const firstRun = computed(() => !repo.settings.firstRunCompleted && !auth.isLoggedIn && repo.mode === 'local');

const templateCards = computed(() => [
  {
    key: 'tplProduct',
    file: 'product-brief.md',
    content: `# Product Brief

## Background
- 

## Goals
- 

## Core Features
- Feature 1
- Feature 2

## Risks
- 
`
  },
  {
    key: 'tplMeeting',
    file: 'meeting-notes.md',
    content: `# Meeting Notes

## Topic
- 

## Participants
- 

## Key Decisions
- 

## Action Items
- [ ] 
`
  },
  {
    key: 'tplRelease',
    file: 'release-checklist.md',
    content: `# Release Checklist

## Release Info
- Version:
- Time:

## Checks
- [ ] Functional verification
- [ ] Regression test
- [ ] Rollback plan
`
  },
  {
    key: 'tplVendor',
    file: 'vendor-adaptation.md',
    content: `# Vendor Adaptation

## Vendor Info
- Vendor:
- Device/System:

## Compatibility Notes
- 

## Differences
- 

## Next Actions
- [ ] 
`
  }
]);

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
    await repo.bootstrap();
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
  if (node.type !== 'file' || !auth.isLoggedIn || !repo.currentRepo) {
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
    await repo.saveSettings({
      globalSettings: {
        baseStoragePath: selected
      }
    });
  }
}

async function saveSettings(draft) {
  await repo.saveSettings({
    language: draft.language,
    backgroundTheme: draft.backgroundTheme,
    globalSettings: {
      baseStoragePath: draft.repoRoot
    }
  });

  if (repo.currentRepo?.id) {
    const state = await window.gitNoteApi.updateRepo({
      repoId: repo.currentRepo.id,
      updates: {
        syncIntervalMinutes: draft.syncIntervalMinutes
      }
    });
    repo.repos = state.repos || repo.repos;
    repo.currentRepoId = state.currentRepoId || repo.currentRepoId;
    repo.currentRepo = state.repo || repo.currentRepo;
  } else {
    repo.globalSettings.defaultSyncInterval = draft.syncIntervalMinutes;
  }

  settingsOpen.value = false;
}

async function logout() {
  const state = await window.gitNoteApi.logout();
  auth.setAuth(state.auth);
  repo.tree = state.tree || [];
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
          <h2>{{ repo.currentRepo?.name || t('notes') }}</h2>
        </div>
        <button class="ghost" @click="settingsOpen = true">{{ t('settings') }}</button>
        <button v-if="repo.mode === 'remote' && repo.currentRepo" class="ghost small" @click="repoManagerOpen = true" :title="repo.currentRepo?.name">
          {{ repo.currentRepo?.name?.slice(0, 12) || 'Repo' }}
        </button>
      </div>

      <div class="sidebar-actions">
        <button class="accent" @click="handleCreate('', 'file')">{{ t('newNote') }}</button>
        <button @click="handleCreate('', 'directory')">{{ t('newFolder') }}</button>
        <button v-if="auth.isLoggedIn && repo.currentRepo" @click="repo.syncNow()">{{ t('syncNow') }}</button>
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
    :settings="{
      ...repo.settings,
      syncIntervalMinutes: repo.currentRepo?.syncIntervalMinutes || repo.globalSettings.defaultSyncInterval,
      repoRoot: repo.globalSettings.baseStoragePath
    }"
    :auth="{ isLoggedIn: auth.isLoggedIn, user: auth.user }"
    @close="settingsOpen = false"
    @save="saveSettings"
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

  <RepoManager
    :open="repoManagerOpen"
    :repos="repo.repos"
    :t="t"
    @close="repoManagerOpen = false"
    @remove="repo.removeRepo"
  />
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
  grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
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
  grid-template-rows: auto auto auto auto 1fr;
  gap: 16px;
  padding: 18px;
  overflow: hidden;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  padding: 16px;
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
  min-width: 0;
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

:deep(.tree) {
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

@media (max-width: 1100px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar,
  .editor-area {
    min-height: auto;
  }
}

@media (max-width: 720px) {
  .shell {
    padding: 10px;
    gap: 10px;
  }

  .sidebar,
  .editor-area {
    border-radius: 20px;
    padding: 14px;
  }

  .sidebar-actions,
  .template-grid {
    grid-template-columns: 1fr;
  }

  .sidebar-top,
  .editor-header {
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
  }
}
</style>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CircleUserRound, Command, FolderTree, Moon, MonitorCog, PanelLeftClose, PanelLeftOpen, RefreshCw, Save, Search, Settings2, Sun } from 'lucide-vue-next';
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
const loading = ref(true), bootError = ref(''), actionError = ref('');
const settingsOpen = ref(false), repoManagerOpen = ref(false), conflictOpen = ref(false), conflictPayload = ref(null);
const historyOpen = ref(false), historyEntries = ref([]), historyPreview = ref(''), historyFilePath = ref('');
const purgeDialogOpen = ref(false), purgeTargetPath = ref('');
const createDialogOpen = ref(false), createType = ref('file'), createParentPath = ref(''), createName = ref(''), createExtension = ref('.md');
const searchQuery = ref(''), commandQuery = ref(''), openTabs = ref([]), sidebarCollapsed = ref(false), sidebarPane = ref('explorer');
const saveMessage = ref(''), syncTone = ref(''), syncDetail = ref(''), syncSummary = ref(''), syncExpanded = ref(false), toastVisible = ref(false);
const commandPaletteOpen = ref(false), searchInput = ref(null), commandInput = ref(null), manualSyncInFlight = ref(false);
const textExtensions = ['.md', '.txt', '.json', '.js', '.ts', '.html', '.css', '.xml', '.yml', '.yaml', '.csv'];
const markdownExtensions = new Set(['.md']);
let toastTimer = null;
let mediaQuery = null;

const t = computed(() => createTranslator(repo.settings.language || 'zh-CN'));
const firstRun = computed(() => !repo.settings.firstRunCompleted && !auth.isLoggedIn && repo.mode === 'local');
const filteredTree = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return repo.tree;
  const walk = (nodes) => nodes.map((n) => n.type === 'directory'
    ? (() => { const children = walk(n.children || []); return n.name.toLowerCase().includes(q) || children.length ? { ...n, children } : null; })()
    : (n.name.toLowerCase().includes(q) ? n : null)).filter(Boolean);
  return walk(repo.tree);
});
const commandItems = computed(() => {
  const items = [
    { id: 'new-file', label: t.value('commandNewFile'), run: () => openCreateDialog('', 'file') },
    { id: 'new-folder', label: t.value('commandNewFolder'), run: () => openCreateDialog('', 'directory') },
    { id: 'settings', label: t.value('commandOpenSettings'), run: () => { settingsOpen.value = true; } },
    { id: 'focus-search', label: t.value('commandFocusSearch'), run: focusSearch }
  ];
  if (auth.isLoggedIn && repo.currentRepo) items.splice(2, 0,
    { id: 'sync-now', label: t.value('commandSyncNow'), run: syncNowWithFeedback },
    { id: 'pull-now', label: t.value('commandPullNow'), run: pullNowWithFeedback }
  );
  return items;
});
const filteredCommands = computed(() => {
  const q = commandQuery.value.trim().toLowerCase();
  return q ? commandItems.value.filter((i) => i.label.toLowerCase().includes(q)) : commandItems.value;
});
const selectedFileName = computed(() => repo.selectedFile?.split('/').pop() || t.value('selectOrCreate'));
const selectedFileDirectory = computed(() => repo.selectedFile?.includes('/') ? repo.selectedFile.split('/').slice(0, -1).join('/') : (repo.currentRepo?.name || repo.root || ''));
const contentStats = computed(() => {
  const c = repo.content || '';
  return { characters: c.length, words: c.trim() ? c.trim().split(/\s+/).length : 0 };
});
const editorLanguageLabel = computed(() => markdownExtensions.has(repo.selectedMeta.extension) ? t.value('markdown') : t.value('plainText'));
const workspaceStatus = computed(() => saveMessage.value === t.value('saveInProgress') ? t.value('statusEditing') : (repo.mode !== 'remote' || !auth.isLoggedIn || !repo.currentRepo ? t.value('statusLocalOnly') : saveMessage.value === t.value('saveDone') ? t.value('statusSyncReady') : t.value('statusSaved')));
const themeMode = computed(() => repo.settings.themeMode || 'system');
const themeIcon = computed(() => themeMode.value === 'light' ? Sun : themeMode.value === 'dark' ? Moon : MonitorCog);
const sidebarTitle = computed(() => ({
  explorer: t.value('explorer'),
  search: t.value('searchNotes'),
  recent: t.value('recentNotes')
}[sidebarPane.value] || t.value('explorer')));

function applyThemeMode(mode) {
  const root = document.documentElement;
  if (!mediaQuery) mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const resolved = mode === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : mode;
  root.dataset.uiTheme = resolved;
}

watch(() => repo.settings.backgroundTheme, (v) => { document.documentElement.dataset.theme = v || 'paper-dawn'; }, { immediate: true });
watch(() => repo.settings.themeMode, (v) => applyThemeMode(v || 'system'), { immediate: true });

onMounted(async () => {
  try {
    if (!window.gitNoteApi) throw new Error(t.value('startupPreload'));
    const state = await repo.bootstrap();
    auth.setAuth(state.auth);
    applyThemeMode(state.settings.themeMode || 'system');
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => applyThemeMode(repo.settings.themeMode || 'system'));
    window.gitNoteApi.onConflictOpen((payload) => { conflictPayload.value = payload; conflictOpen.value = true; });
    window.gitNoteApi.onSyncStatus((payload) => {
      if (manualSyncInFlight.value) return;
      showToast({
        tone: payload.ok ? 'success' : 'error',
        summary: payload.ok ? `${t.value('syncCompleted')} ${new Date(payload.at).toLocaleTimeString()}` : summarizeSyncError(payload.error || ''),
        detail: payload.ok ? '' : (payload.error || ''),
        persistent: !payload.ok
      });
    });
  } catch (e) { bootError.value = e?.message || String(e); } finally { loading.value = false; }
  window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  clearTimeout(toastTimer);
  mediaQuery?.removeEventListener?.('change', () => applyThemeMode(repo.settings.themeMode || 'system'));
});

async function loginWithGithub() {
  loading.value = true;
  try {
    actionError.value = ''; saveMessage.value = '';
    const state = await window.gitNoteApi.startOAuth();
    auth.setAuth(state.auth);
    const bootstrapped = await repo.bootstrap();
    if (bootstrapped.currentRepo?.name) saveMessage.value = `${t.value('connectedRepo')} ${bootstrapped.currentRepo.name}`;
  } catch (e) { actionError.value = e?.message || String(e); } finally { loading.value = false; }
}
async function useLocalOnly() { actionError.value = ''; await repo.saveSettings({ firstRunCompleted: true, mode: 'local' }); }
function cycleThemeMode() { const next = themeMode.value === 'light' ? 'dark' : themeMode.value === 'dark' ? 'system' : 'light'; saveSettings({ ...repo.settings, syncIntervalMinutes: repo.currentRepo?.syncIntervalMinutes || repo.globalSettings.defaultSyncInterval, repoRoot: repo.globalSettings.baseStoragePath, themeMode: next }); }
function focusSearch() { sidebarPane.value = 'search'; nextTick(() => { searchInput.value?.focus(); searchInput.value?.select?.(); }); }
function openCreateDialog(parentPath, type) { createParentPath.value = parentPath; createType.value = type; createExtension.value = '.md'; createName.value = type === 'directory' ? 'new-folder' : 'new-note'; createDialogOpen.value = true; }
function requestPurge(targetPath) { purgeTargetPath.value = targetPath; purgeDialogOpen.value = true; }
async function confirmPurge() { if (!purgeTargetPath.value) return purgeDialogOpen.value = false; await repo.purgeEntry(purgeTargetPath.value); if (repo.selectedFile === purgeTargetPath.value) closeTab(repo.selectedFile); purgeDialogOpen.value = false; purgeTargetPath.value = ''; }
function openCommandPalette() { commandPaletteOpen.value = true; commandQuery.value = ''; nextTick(() => commandInput.value?.focus()); }
function executeCommand(item) { if (!item) return; commandPaletteOpen.value = false; item.run(); }
async function confirmCreate() {
  const raw = createName.value.trim();
  const name = createType.value === 'directory' ? raw : `${raw}${createExtension.value}`;
  if (!name) return actionError.value = createType.value === 'directory' ? t.value('folderName') : t.value('fileName');
  actionError.value = '';
  await repo.createEntry(createParentPath.value, name, createType.value);
  createDialogOpen.value = false; createName.value = '';
}
async function openExternally() { if (!repo.selectedFile) return; const result = await window.gitNoteApi.openExternalFile({ filePath: repo.selectedFile }); if (!result.ok && result.error) actionError.value = result.error; }
async function handleOpenFile(filePath) { await repo.openFile(filePath); const i = openTabs.value.findIndex((t) => t.path === filePath); const tab = { path: filePath, name: filePath.split('/').pop() }; if (i >= 0) openTabs.value.splice(i, 1); openTabs.value.push(tab); }
function closeTab(filePath) { const i = openTabs.value.findIndex((t) => t.path === filePath); if (i < 0) return; const active = repo.selectedFile === filePath; openTabs.value.splice(i, 1); if (!active) return; const next = openTabs.value[i - 1] || openTabs.value[i] || null; if (next) return void handleOpenFile(next.path); repo.selectedFile = ''; repo.content = ''; repo.selectedMeta = { editable: true, binary: false, extension: '.md' }; }
function handleEditorInput(v) { repo.content = v; saveMessage.value = t.value('saveInProgress'); repo.saveCurrentDebounced(v); }
async function saveNow() { if (!repo.selectedFile || !repo.selectedMeta.editable) return; await repo.saveCurrent(repo.content); saveMessage.value = t.value('saveDone'); }
async function syncNowWithFeedback() {
  actionError.value = ''; manualSyncInFlight.value = true; showToast({ summary: t.value('syncInProgress'), persistent: true });
  try {
    const result = await repo.syncNow();
    if (result?.skipped) showToast({ summary: t.value('noChanges') });
    else if (result?.pushed) showToast({ tone: 'success', summary: `${t.value('syncCompleted')} ${new Date().toLocaleTimeString()}` });
    else showToast({ tone: 'error', summary: t.value('syncFailed'), persistent: true });
  } catch (e) {
    const m = normalizeSyncError(e?.message || String(e));
    showToast({ tone: 'error', summary: summarizeSyncError(m), detail: m, persistent: true });
    actionError.value = '';
  } finally { manualSyncInFlight.value = false; }
}
async function pullNowWithFeedback() {
  actionError.value = '';
  showToast({ summary: t.value('pullInProgress'), persistent: true });
  try {
    await repo.pullNow();
    showToast({ tone: 'success', summary: `${t.value('pullCompleted')} ${new Date().toLocaleTimeString()}` });
  } catch (e) {
    const m = normalizeSyncError(e?.message || String(e));
    showToast({ tone: 'error', summary: `${t.value('pullFailed')}: ${m.split('\n')[0]}`, detail: m, persistent: true });
  }
}
function normalizeSyncError(m) { return m.replace(/^Error invoking remote method 'sync:now':\s*/i, '').trim(); }
function summarizeSyncError(m) { const n = normalizeSyncError(m); if (/Failed to connect to github\.com port 443|Could not connect to server/i.test(n)) return `${t.value('syncFailed')}: ${t.value('networkConnectFailed')}`; if (/Committed locally, but push to GitHub failed|Local commits exist but push failed/i.test(n)) return `${t.value('syncFailed')}: ${t.value('localCommitPending')}`; return `${t.value('syncFailed')}: ${n.split('\n')[0]}`; }
function showToast({ tone = '', summary = '', detail = '', persistent = false }) { syncTone.value = tone; syncSummary.value = summary; syncDetail.value = detail; syncExpanded.value = false; toastVisible.value = Boolean(summary); clearTimeout(toastTimer); if (!persistent && summary) toastTimer = setTimeout(() => { toastVisible.value = false; }, 3200); }
function isEditorFocused() {
  const active = document.activeElement;
  if (!active) return false;
  return Boolean(active.closest('.editor')) || active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' && active.closest('.md-editor');
}
async function openHistory(node) { if (node.type !== 'file' || !auth.isLoggedIn || !repo.currentRepo) return; historyFilePath.value = node.path; historyEntries.value = await window.gitNoteApi.getHistory({ filePath: node.path }); historyPreview.value = ''; historyOpen.value = true; }
async function previewHistory(entry) { const r = await window.gitNoteApi.getHistoryContent({ filePath: historyFilePath.value, sha: entry.sha }); historyPreview.value = r.content; }
async function restoreHistory(entry) { const r = await window.gitNoteApi.getHistoryContent({ filePath: historyFilePath.value, sha: entry.sha }); await window.gitNoteApi.restoreHistory({ filePath: historyFilePath.value, content: r.content }); await handleOpenFile(historyFilePath.value); historyOpen.value = false; }
async function chooseDirectory() { const selected = await window.gitNoteApi.chooseDirectory(); if (selected) await repo.saveSettings({ globalSettings: { baseStoragePath: selected } }); }
async function saveSettings(draft) {
  await repo.saveSettings({ language: draft.language, backgroundTheme: draft.backgroundTheme, themeMode: draft.themeMode, globalSettings: { baseStoragePath: draft.repoRoot } });
  if (repo.currentRepo?.id) {
    const state = await window.gitNoteApi.updateRepo({ repoId: repo.currentRepo.id, updates: { syncIntervalMinutes: draft.syncIntervalMinutes } });
    repo.repos = state.repos || repo.repos; repo.currentRepoId = state.currentRepoId || repo.currentRepoId; repo.currentRepo = state.repo || repo.currentRepo;
  } else repo.globalSettings.defaultSyncInterval = draft.syncIntervalMinutes;
  settingsOpen.value = false;
}
async function logout() { const state = await window.gitNoteApi.logout(); auth.setAuth(state.auth); repo.tree = state.tree || []; repo.settings = state.settings; repo.mode = state.settings.mode; repo.selectedFile = ''; repo.content = ''; openTabs.value = []; settingsOpen.value = false; }
async function handleGlobalKeydown(event) {
  const meta = event.ctrlKey || event.metaKey;
  if (!meta) return;
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (isEditorFocused()) {
      await saveNow();
    } else if (auth.isLoggedIn && repo.currentRepo) {
      await syncNowWithFeedback();
    } else {
      await saveNow();
    }
    return;
  }
  if (event.key.toLowerCase() === 'n') { event.preventDefault(); openCreateDialog('', 'file'); return; }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); focusSearch(); return; }
  if (event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); openCommandPalette(); }
}
</script>

<template>
  <div v-if="loading" class="loading">{{ t('loading') }}</div>
  <main v-else-if="bootError" class="welcome"><section class="boot-error"><h1>{{ t('startupFailed') }}</h1><p>{{ bootError }}</p></section></main>
  <main v-else-if="firstRun" class="welcome"><LoginPanel :t="t" @github-login="loginWithGithub" @local-only="useLocalOnly" /></main>
  <main v-else :class="['shell', { collapsed: sidebarCollapsed }]">
    <aside class="activitybar">
      <div class="activitybar-top">
        <button class="activity-btn" :class="{ active: sidebarPane === 'explorer' }" :title="t('explorer')" @click="sidebarPane = 'explorer'">
          <FolderTree :size="18" />
        </button>
        <button class="activity-btn" :class="{ active: sidebarPane === 'search' }" :title="t('searchNotes')" @click="focusSearch">
          <Search :size="18" />
        </button>
        <button class="activity-btn" :class="{ active: sidebarPane === 'recent' }" :title="t('recentNotes')" @click="sidebarPane = 'recent'">
          <RefreshCw :size="18" />
        </button>
        <button class="activity-btn" :title="t('commandPalette')" @click="openCommandPalette">
          <Command :size="18" />
        </button>
        <button class="activity-btn" :title="t('switchTheme')" @click="cycleThemeMode">
          <component :is="themeIcon" :size="18" />
        </button>
      </div>
      <div class="activitybar-bottom">
        <button
          v-if="auth.isLoggedIn"
          class="activity-btn"
          :title="auth.user?.login || t('repoManager')"
          @click="repoManagerOpen = true"
        >
          <img v-if="auth.user?.avatarUrl" :src="auth.user.avatarUrl" alt="" class="activity-avatar" />
          <CircleUserRound v-else :size="18" />
        </button>
        <button class="activity-btn" :title="t('settings')" @click="settingsOpen = true">
          <Settings2 :size="18" />
        </button>
      </div>
    </aside>

    <aside class="sidebar">
      <div class="topbar">
        <div class="top-left-controls">
          <button
            class="icon-btn flat-icon"
            :title="sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <component :is="sidebarCollapsed ? PanelLeftOpen : PanelLeftClose" :size="18" />
          </button>
        </div>
        <div class="top-actions">
          <span class="sidebar-caption">{{ sidebarTitle }}</span>
        </div>
      </div>

      <template v-if="sidebarPane === 'explorer'">
      <div class="block actions-card">
        <button class="action-btn primary" @click="openCreateDialog('', 'file')"><FolderTree :size="16" /><span v-if="!sidebarCollapsed">{{ t('newNote') }}</span></button>
        <button class="action-btn" @click="openCreateDialog('', 'directory')"><FolderTree :size="16" /><span v-if="!sidebarCollapsed">{{ t('newFolder') }}</span></button>
      </div>

      <div class="block search-pane">
        <p class="label">{{ t('searchNotes') }}</p>
        <div class="search-box"><Search :size="16" /><input id="note-search" ref="searchInput" v-model="searchQuery" type="text" :placeholder="t('searchPlaceholder')" /></div>
      </div>

      <div class="block tree-block">
        <div v-if="!sidebarCollapsed" class="head"><p class="label">{{ t('explorer') }}</p><span v-if="searchQuery.trim() && filteredTree.length === 0" class="muted">{{ t('searchEmpty') }}</span></div>
        <FileTree :nodes="filteredTree" :selected="repo.selectedFile" :force-expand="Boolean(searchQuery.trim())" :search-query="searchQuery" :t="t" @open="handleOpenFile" @create="openCreateDialog" @rename="(path, newName) => repo.renameEntry(path, newName)" @delete="repo.deleteEntry" @restore="repo.restoreEntry" @purge="requestPurge" @history="openHistory" />
      </div>
      </template>

      <template v-else-if="sidebarPane === 'search'">
      <div class="block search-pane">
        <p v-if="!sidebarCollapsed" class="label">{{ t('searchNotes') }}</p>
        <div class="search-box"><Search :size="16" /><input id="note-search" ref="searchInput" v-model="searchQuery" type="text" :placeholder="t('searchPlaceholder')" /></div>
      </div>
      <div class="block tree-block search-results">
        <div v-if="!sidebarCollapsed" class="head"><p class="label">{{ t('searchNotes') }}</p><span v-if="searchQuery.trim() && filteredTree.length === 0" class="muted">{{ t('searchEmpty') }}</span></div>
        <FileTree :nodes="filteredTree" :selected="repo.selectedFile" :force-expand="Boolean(searchQuery.trim())" :search-query="searchQuery" :t="t" @open="handleOpenFile" @create="openCreateDialog" @rename="(path, newName) => repo.renameEntry(path, newName)" @delete="repo.deleteEntry" @restore="repo.restoreEntry" @purge="requestPurge" @history="openHistory" />
      </div>
      </template>

      <div v-else-if="!sidebarCollapsed" class="block recent">
        <div class="head"><p class="label">{{ t('recentNotes') }}</p></div>
        <button v-for="item in repo.recentNotes" :key="item.path" class="recent-item" @click="handleOpenFile(item.path)"><span>{{ item.name }}</span><small>{{ item.path }}</small></button>
        <p v-if="!repo.recentNotes.length" class="muted">{{ t('empty') }}</p>
      </div>
    </aside>

    <section class="workspace">
      <div class="workspace-topbar">
        <div class="workspace-title"><Command :size="16" /><span>{{ t('workspaceTabs') }}</span></div>
        <div class="workspace-tools">
          <button class="icon-btn" :title="t('commandPalette')" @click="openCommandPalette"><Command :size="16" /></button>
          <button v-if="repo.mode === 'remote' && repo.currentRepo" class="icon-btn" :title="t('repoManager')" @click="repoManagerOpen = true"><FolderTree :size="16" /></button>
        </div>
      </div>
      <div class="tabs"><div v-if="openTabs.length" class="tab-list"><button v-for="tab in openTabs" :key="tab.path" :class="['tab', { active: repo.selectedFile === tab.path }]" @click="handleOpenFile(tab.path)"><span>{{ tab.name }}</span><span class="x" @click.stop="closeTab(tab.path)">×</span></button></div><div v-else class="tab empty">{{ t('noTabOpen') }}</div></div>
      <div class="main">
        <header class="header"><div><h1>{{ selectedFileName }}</h1><p>{{ selectedFileDirectory || t('workspaceHint') }}</p></div><div class="header-actions"><button v-if="repo.selectedFile && repo.selectedMeta.editable" class="save-btn" @click="saveNow"><Save :size="16" />{{ t('save') }}</button><div v-if="repo.selectedFile && !repo.selectedMeta.editable" class="row"><span class="chip">{{ t('fileType') }} {{ repo.selectedMeta.extension || '' }}</span><button class="icon-btn" @click="openExternally">{{ t('openExternal') }}</button></div><div class="user" v-if="auth.isLoggedIn"><img :src="auth.user?.avatarUrl" alt="" /><span>{{ auth.user?.login }}</span></div></div></header>
        <div class="editor"><MarkdownEditor v-if="repo.selectedFile && repo.selectedMeta.editable && markdownExtensions.has(repo.selectedMeta.extension)" :model-value="repo.content" @update:model-value="handleEditorInput" /><textarea v-else-if="repo.selectedFile && repo.selectedMeta.editable" v-model="repo.content" class="plain" @input="handleEditorInput($event.target.value)" /><div v-else-if="repo.selectedFile" class="empty"><p>{{ t('externalOnly') }}</p><button class="icon-btn" @click="openExternally">{{ t('openExternal') }}</button></div><div v-else class="empty"><p>{{ t('empty') }}</p><p>{{ t('supportedFormats') }}</p></div></div>
        <footer class="status"><div class="status-left"><span class="pill">{{ workspaceStatus }}</span><span>{{ saveMessage || t('statusSaved') }}</span></div><div class="status-right"><span>{{ editorLanguageLabel }}</span><span>{{ t('characters') }} {{ contentStats.characters }}</span><span>{{ t('words') }} {{ contentStats.words }}</span></div></footer>
      </div>
    </section>
  </main>

  <Settings :open="settingsOpen" :t="t" :settings="{ ...repo.settings, syncIntervalMinutes: repo.currentRepo?.syncIntervalMinutes || repo.globalSettings.defaultSyncInterval, repoRoot: repo.globalSettings.baseStoragePath }" :auth="{ isLoggedIn: auth.isLoggedIn, user: auth.user }" @close="settingsOpen = false" @save="saveSettings" @choose-directory="chooseDirectory" @logout="logout" />
  <ConflictResolver :open="conflictOpen" :t="t" :payload="conflictPayload" @close="conflictOpen = false" @resolve="async (payload) => { await window.gitNoteApi.resolveConflict(payload); conflictOpen = false; }" />
  <HistoryDialog :open="historyOpen" :t="t" :entries="historyEntries" @close="historyOpen = false" @preview="previewHistory" @restore="restoreHistory"><template #default><pre class="history-preview">{{ historyPreview }}</pre></template></HistoryDialog>
  <RepoManager :open="repoManagerOpen" :repos="repo.repos" :t="t" @close="repoManagerOpen = false" @remove="repo.removeRepo" />
  <div v-if="createDialogOpen" class="overlay" @click.self="createDialogOpen = false"><section class="dialog"><h3>{{ createType === 'directory' ? t('newFolder') : t('newNote') }}</h3><input v-model="createName" type="text" :placeholder="createType === 'directory' ? t('folderName') : t('fileName')" @keyup.enter="confirmCreate" /><select v-if="createType === 'file'" v-model="createExtension"><option v-for="extension in textExtensions" :key="extension" :value="extension">{{ extension }}</option></select><div class="dialog-actions"><button class="ghost-btn" @click="createDialogOpen = false">{{ t('cancel') }}</button><button class="save-btn" @click="confirmCreate"><Save :size="16" />{{ t('save') }}</button></div></section></div>
  <div v-if="commandPaletteOpen" class="overlay" @click.self="commandPaletteOpen = false"><section class="dialog"><h3>{{ t('commandPalette') }}</h3><div class="search-box"><Search :size="16" /><input ref="commandInput" v-model="commandQuery" type="text" :placeholder="t('commandPlaceholder')" /></div><div v-if="filteredCommands.length" class="cmds"><button v-for="item in filteredCommands" :key="item.id" class="cmd" @click="executeCommand(item)">{{ item.label }}</button></div><p v-else class="muted">{{ t('commandEmpty') }}</p></section></div>
  <div v-if="actionError || toastVisible" class="toasts"><div v-if="actionError" class="toast err"><p>{{ actionError }}</p></div><div v-if="toastVisible && syncSummary" :class="['toast', syncTone === 'error' ? 'err' : syncTone === 'success' ? 'ok' : 'mid']"><p>{{ syncSummary }}</p><button v-if="syncTone === 'error' && syncDetail" class="detail" @click="syncExpanded = !syncExpanded">{{ syncExpanded ? t('hideDetails') : t('errorDetails') }}</button><pre v-if="syncTone === 'error' && syncDetail && syncExpanded">{{ syncDetail }}</pre></div></div>
  <div v-if="purgeDialogOpen" class="overlay" @click.self="purgeDialogOpen = false"><section class="dialog"><h3>{{ t('purgeTitle') }}</h3><p>{{ t('purgeConfirm') }}</p><p class="path">{{ purgeTargetPath }}</p><div class="dialog-actions"><button class="ghost-btn" @click="purgeDialogOpen = false">{{ t('cancel') }}</button><button class="danger-btn" @click="confirmPurge">{{ t('purge') }}</button></div></section></div>
</template>

<style scoped>
.loading,.welcome{min-height:100vh;display:grid;place-items:center;padding:40px}
.boot-error{max-width:720px;display:grid;gap:12px;padding:32px;border-radius:var(--radius-xl);background:var(--panel-strong);border:1px solid var(--line);box-shadow:var(--shadow-panel)}
.shell{min-height:100vh;display:grid;grid-template-columns:52px 288px minmax(0,1fr);gap:0;padding:0;transition:grid-template-columns var(--transition-fast);background:var(--bg)}
.shell.collapsed{grid-template-columns:52px 88px minmax(0,1fr)}
.activitybar,.sidebar,.workspace{min-height:100vh}
.activitybar{display:grid;grid-template-rows:1fr auto;background:color-mix(in srgb,var(--panel) 92%,#0f172a);border-right:1px solid var(--line)}
.activitybar-top,.activitybar-bottom{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 6px}
.activitybar-bottom{justify-content:flex-end;padding-bottom:12px}
.activity-btn{display:grid;place-items:center;width:40px;height:40px;border:none;border-radius:10px;background:transparent;color:var(--muted);transition:background var(--transition-fast),color var(--transition-fast),transform var(--transition-fast)}
.activity-btn.active{position:relative;color:var(--text)}
.activity-btn.active::before{content:'';position:absolute;left:-6px;top:8px;bottom:8px;width:2px;border-radius:999px;background:var(--accent)}
.activity-btn:hover,.activity-btn.active{background:color-mix(in srgb,var(--accent-soft) 72%,transparent)}
.activity-avatar{width:20px;height:20px;border-radius:50%;object-fit:cover}

.sidebar,.workspace{overflow:hidden}
.sidebar{display:flex;flex-direction:column;background:var(--panel);border-right:1px solid var(--line)}
.top,.topbar,.top-actions,.top-left-controls,.workspace-topbar,.workspace-tools,.header,.header-actions,.status,.status-left,.status-right,.dialog-actions,.search-box{display:flex;align-items:center;gap:12px}
.top,.workspace-topbar,.header,.status,.topbar{justify-content:space-between}
.topbar{height:40px;padding:0 10px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--panel-strong) 88%,transparent)}
.top-left-controls{gap:6px}
.sidebar-caption{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.repo-copy h2,.header h1{margin:0}
.label{margin:0 0 6px;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);font-size:11px;font-weight:700}
.path,.muted,.recent-item small,.header p,.status,.workspace-title{color:var(--muted)}
.path{margin:0;font-size:12px;line-height:1.45;word-break:break-all}

.block{padding:10px 14px;border-bottom:1px solid var(--line);min-height:0}
.actions-card{display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px}
.action-btn,.icon-btn,.save-btn,.ghost-btn,.danger-btn,.cmd,.recent-item{display:inline-flex;align-items:center;gap:10px;border:none}
.action-btn{justify-content:flex-start;align-self:flex-start;flex:0 0 auto;height:34px;min-width:0;padding:0 12px;border-radius:8px;background:transparent;color:var(--button-muted-text);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--line) 86%,transparent);font-size:13px;font-weight:600;line-height:1}
.action-btn.primary,.save-btn{background:var(--accent);color:white;box-shadow:none}
.icon-btn,.ghost-btn{padding:9px 11px;border-radius:10px;background:transparent;color:var(--button-muted-text);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--line) 86%,transparent)}
.flat-icon{padding:8px;border-radius:8px;background:transparent;color:var(--muted);box-shadow:none}
.flat-icon:hover,.icon-btn:hover,.ghost-btn:hover,.action-btn:hover,.save-btn:hover,.danger-btn:hover,.cmd:hover,.recent-item:hover{background:color-mix(in srgb,var(--accent-soft) 68%,transparent);color:var(--text)}
.action-btn.primary:hover,.save-btn:hover{background:color-mix(in srgb,var(--accent) 88%,black);color:white}
.danger-btn{padding:11px 16px;border-radius:999px;background:color-mix(in srgb,var(--error-bg) 84%,var(--panel-strong));color:var(--error-text)}

.search-box{padding:0 12px;border-radius:10px;background:var(--field-bg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--line) 86%,transparent)}
.search-box input{width:100%;border:none;padding:9px 0;background:transparent;color:var(--field-text);outline:none}
.tree-block{display:grid;grid-template-rows:auto minmax(0,1fr);flex:1 1 auto;min-height:0}
.tree-block :deep(.tree){margin-inline:-8px}
.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.recent,.search-pane,.search-results{display:grid;gap:8px}
.search-results{flex:1 1 auto;min-height:0}
.recent{align-content:start}
.recent-item{display:grid;gap:4px;text-align:left;border-radius:10px;padding:10px 12px;background:transparent;color:var(--button-text)}
.recent-item:hover{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent-soft) 40%,var(--line))}

.workspace{display:grid;grid-template-rows:40px 40px minmax(0,1fr);background:var(--bg-elevated)}
.workspace-topbar{padding:0 14px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--panel-strong) 84%,transparent)}
.workspace-title{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.tabs{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--panel-strong) 96%,transparent);overflow:auto hidden}
.tab-list{display:flex;min-width:max-content}
.tab{display:flex;align-items:center;gap:10px;height:40px;padding:0 14px;border:none;border-right:1px solid var(--line);border-radius:0;background:transparent;box-shadow:none;color:var(--muted)}
.tab.active{background:var(--panel);color:var(--text);box-shadow:inset 0 1px 0 var(--accent)}
.tab.empty{height:40px;display:inline-flex;align-items:center;padding:0 14px;color:var(--muted)}
.tab span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.x{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:6px;color:var(--muted)}
.x:hover{background:var(--accent-soft);color:var(--text)}

.main{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) 32px;background:var(--panel)}
.header{padding:14px 18px 12px;border-bottom:1px solid var(--line)}
.header p{margin:6px 0 0;font-size:13px}
.user{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:999px;background:var(--button-muted-bg)}
.user img{width:30px;height:30px;border-radius:50%}
.chip{padding:7px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent-strong);font-size:12px}
.editor{min-height:0;background:var(--panel)}
.plain{width:100%;height:100%;resize:none;border:none;padding:20px;background:transparent;line-height:1.7;color:var(--field-text);outline:none}
.empty,.history-preview{display:grid;place-items:center;min-height:100%;color:var(--muted);white-space:pre-wrap;padding:32px;text-align:center}
.status{padding:0 14px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--panel-strong) 96%,transparent);font-size:12px}
.pill{padding:4px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent-strong)}

.overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(2,6,23,.48);backdrop-filter:blur(10px);z-index:80}
.dialog{width:min(460px,calc(100vw - 24px));display:grid;gap:14px;padding:22px;border-radius:var(--radius-lg);background:var(--panel-strong);border:1px solid var(--line);box-shadow:var(--shadow-panel)}
.dialog input,.dialog select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--field-bg);color:var(--field-text)}
.cmds{display:grid;gap:8px;overflow:auto}
.cmd{justify-content:flex-start;text-align:left;border-radius:12px;padding:12px 14px;background:var(--button-muted-bg);color:var(--button-muted-text)}

.toasts{position:fixed;top:18px;right:18px;z-index:90;display:grid;gap:10px;width:min(420px,calc(100vw - 24px))}
.toast{display:grid;gap:8px;padding:12px 14px;border-radius:16px;border:1px solid var(--line);box-shadow:var(--shadow-soft);backdrop-filter:blur(16px)}
.toast p,.toast pre{margin:0}
.ok{background:color-mix(in srgb,var(--success-bg) 76%,var(--panel-strong));color:var(--success-text)}
.err{background:color-mix(in srgb,var(--error-bg) 78%,var(--panel-strong));color:var(--error-text)}
.mid{background:color-mix(in srgb,var(--panel-strong) 92%,transparent);color:var(--text)}
.detail{justify-self:start;padding:6px 12px;border-radius:999px;background:transparent;border:1px solid currentColor;color:inherit}

:deep(.tree){min-height:0;overflow:auto;padding-right:2px}
:deep(.md-editor){background:transparent}

.shell.collapsed .head,.shell.collapsed .recent,.shell.collapsed .search-pane .label,.shell.collapsed .sidebar-caption{display:none}
.shell.collapsed .block{padding-inline:10px}
.shell.collapsed .actions-card{display:grid;grid-template-columns:1fr}
.shell.collapsed .action-btn{justify-content:center;padding-inline:0}
.shell.collapsed .action-btn span,.shell.collapsed .topbar .top-actions,.shell.collapsed .search-box input,.shell.collapsed .label,.shell.collapsed .recent-item small,.shell.collapsed .recent-item span{display:none}
.shell.collapsed .search-box{justify-content:center;padding-inline:0;height:40px}
.shell.collapsed .tree-block :deep(.tree){margin-inline:0}

@media (max-width:1080px){
  .shell{grid-template-columns:52px 248px minmax(0,1fr)}
  .shell.collapsed{grid-template-columns:52px 76px minmax(0,1fr)}
}
@media (max-width:720px){
  .shell{grid-template-columns:52px minmax(0,1fr)}
  .shell.collapsed{grid-template-columns:52px minmax(0,1fr)}
  .sidebar{display:none}
  .workspace{grid-column:2}
  .header,.workspace-topbar,.status{flex-direction:column;align-items:flex-start}
  .status-right{flex-wrap:wrap}
}
</style>

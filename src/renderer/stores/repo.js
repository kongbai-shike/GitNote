import { defineStore } from 'pinia';
import { debounce } from 'lodash-es';

const debouncedSave = debounce(async (store, content) => {
  await store.saveCurrent(content);
}, 1000);

export const useRepoStore = defineStore('repo', {
  state: () => ({
    repos: [],
    currentRepoId: '',
    currentRepo: null,
    tree: [],
    selectedFile: '',
    content: '',
    mode: 'local',
    root: '',
    syncStatus: '',
    settings: {
      firstRunCompleted: false,
      language: 'zh-CN',
      backgroundTheme: 'paper-dawn'
    },
    globalSettings: {
      defaultSyncInterval: 2,
      baseStoragePath: ''
    }
  }),
  actions: {
    async bootstrap() {
      const state = await window.gitNoteApi.bootstrap();
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = state.currentRepo || null;
      this.tree = state.tree;
      this.mode = state.settings.mode;
      this.root = state.root;
      this.settings = state.settings;
      this.globalSettings = state.globalSettings || this.globalSettings;
      return state;
    },
    async refreshTree() {
      this.tree = await window.gitNoteApi.listTree();
    },
    async openFile(filePath) {
      this.selectedFile = filePath;
      const result = await window.gitNoteApi.readFile({ filePath });
      this.content = result.content;
    },
    async saveCurrent(content) {
      if (!this.selectedFile) {
        return;
      }
      this.content = content;
      await window.gitNoteApi.writeFile({ filePath: this.selectedFile, content });
      await this.refreshTree();
    },
    saveCurrentDebounced(content) {
      debouncedSave(this, content);
    },
    async createEntry(parentPath, name, type, content = '') {
      this.tree = await window.gitNoteApi.createEntry({ parentPath, name, type, content });
    },
    async renameEntry(oldPath, newName) {
      this.tree = await window.gitNoteApi.renameEntry({ oldPath, newName });
    },
    async deleteEntry(targetPath) {
      this.tree = await window.gitNoteApi.deleteEntry({ targetPath });
    },
    async syncNow() {
      const result = await window.gitNoteApi.syncNow();
      this.syncStatus = result.skipped ? 'No changes to sync.' : 'Sync completed.';
    },
    async addRepo(payload) {
      const state = await window.gitNoteApi.addRepo(payload);
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = state.currentRepo || null;
      this.tree = state.tree || [];
      this.root = state.root || '';
    },
    async switchRepo(repoId) {
      const state = await window.gitNoteApi.switchRepo({ repoId });
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = state.currentRepo || null;
      this.tree = state.tree || [];
      this.root = state.root || '';
      this.selectedFile = '';
      this.content = '';
    },
    async removeRepo(repoId) {
      const state = await window.gitNoteApi.removeRepo({ repoId });
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = this.repos.find((repo) => repo.id === this.currentRepoId) || null;
      await this.refreshTree();
    },
    async saveSettings(payload) {
      const state = await window.gitNoteApi.saveSettings(payload);
      this.settings = state.settings || this.settings;
      this.globalSettings = state.globalSettings || this.globalSettings;
      this.currentRepo = state.currentRepo || this.currentRepo;
      this.mode = this.settings.mode;
      document.documentElement.dataset.theme = this.settings.backgroundTheme || 'paper-dawn';
    }
  }
});

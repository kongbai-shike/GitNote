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
    recentNotes: [],
    tree: [],
    selectedFile: '',
    content: '',
    selectedMeta: {
      editable: true,
      binary: false,
      extension: '.md'
    },
    mode: 'local',
    root: '',
    syncStatus: '',
    settings: {
      firstRunCompleted: false,
      language: 'zh-CN',
      backgroundTheme: 'paper-dawn',
      themeMode: 'system'
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
      this.recentNotes = state.recentNotes || [];
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
      this.recentNotes = result.recentNotes || this.recentNotes;
      this.selectedMeta = {
        editable: result.editable !== false,
        binary: Boolean(result.binary),
        extension: result.extension || ''
      };
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
    async restoreEntry(targetPath) {
      this.tree = await window.gitNoteApi.restoreEntry({ targetPath });
    },
    async purgeEntry(targetPath) {
      this.tree = await window.gitNoteApi.purgeEntry({ targetPath });
    },
    async syncNow() {
      this.syncStatus = 'syncing';
      try {
        const result = await window.gitNoteApi.syncNow();
        this.syncStatus = result.skipped ? 'no_changes' : 'success';
        return result;
      } catch (error) {
        this.syncStatus = `error:${error?.message || String(error)}`;
        throw error;
      }
    },
    async pullNow() {
      this.syncStatus = 'pulling';
      try {
        const result = await window.gitNoteApi.pullNow();
        await this.refreshTree();
        if (this.selectedFile) {
          const stillExists = await window.gitNoteApi.readFile({ filePath: this.selectedFile }).catch(() => null);
          if (stillExists) {
            this.content = stillExists.content;
            this.recentNotes = stillExists.recentNotes || this.recentNotes;
            this.selectedMeta = {
              editable: stillExists.editable !== false,
              binary: Boolean(stillExists.binary),
              extension: stillExists.extension || ''
            };
          } else {
            this.selectedFile = '';
            this.content = '';
          }
        }
        this.syncStatus = 'pull_success';
        return result;
      } catch (error) {
        this.syncStatus = `error:${error?.message || String(error)}`;
        throw error;
      }
    },
    async addRepo(payload) {
      const state = await window.gitNoteApi.addRepo(payload);
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = state.currentRepo || null;
      this.recentNotes = state.recentNotes || [];
      this.tree = state.tree || [];
      this.root = state.root || '';
    },
    async switchRepo(repoId) {
      const state = await window.gitNoteApi.switchRepo({ repoId });
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = state.currentRepo || null;
      this.recentNotes = state.recentNotes || [];
      this.tree = state.tree || [];
      this.root = state.root || '';
      this.selectedFile = '';
      this.content = '';
      this.selectedMeta = {
        editable: true,
        binary: false,
        extension: '.md'
      };
    },
    async removeRepo(repoId) {
      const state = await window.gitNoteApi.removeRepo({ repoId });
      this.repos = state.repos || [];
      this.currentRepoId = state.currentRepoId || '';
      this.currentRepo = this.repos.find((repo) => repo.id === this.currentRepoId) || null;
      this.recentNotes = state.recentNotes || [];
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

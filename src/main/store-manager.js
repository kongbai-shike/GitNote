import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';
import Store from 'electron-store';
import {
  DEFAULT_SYNC_INTERVAL_MINUTES,
  DOMAIN_LOCAL,
  DOMAIN_REMOTE
} from '../shared/constants.js';

export class StoreManager {
  constructor() {
    this.store = new Store({
      name: 'gitnote-config',
      clearInvalidConfig: true,
      encryptionKey: 'gitnote-demo-encryption-key'
    });
  }

  ensureBaseLayout() {
    const userData = app.getPath('userData');
    const localRoot = path.join(userData, 'local_notes');
    const reposRoot = this.getGlobalSettings().baseStoragePath || path.join(userData, 'GitNote', 'repos');
    fs.mkdirSync(localRoot, { recursive: true });
    fs.mkdirSync(reposRoot, { recursive: true });
    return { localRoot, reposRoot };
  }

  getSettings() {
    return {
      mode: this.store.get('settings.mode', DOMAIN_LOCAL),
      firstRunCompleted: this.store.get('settings.firstRunCompleted', false),
      language: this.store.get('settings.language', 'zh-CN'),
      backgroundTheme: this.store.get('settings.backgroundTheme', 'paper-dawn')
    };
  }

  saveSettings(partial) {
    const current = this.getSettings();
    const next = { ...current, ...partial };
    this.store.set('settings', next);
    return next;
  }

  getGlobalSettings() {
    return {
      defaultSyncInterval: this.store.get('globalSettings.defaultSyncInterval', DEFAULT_SYNC_INTERVAL_MINUTES),
      baseStoragePath: this.store.get('globalSettings.baseStoragePath', path.join(app.getPath('userData'), 'GitNote', 'repos'))
    };
  }

  saveGlobalSettings(partial) {
    const current = this.getGlobalSettings();
    const next = { ...current, ...partial };
    this.store.set('globalSettings', next);
    return next;
  }

  getAuth() {
    return this.store.get('auth', {
      isLoggedIn: false,
      token: '',
      user: null
    });
  }

  saveAuth(auth) {
    this.store.set('auth', auth);
    return auth;
  }

  clearAuth() {
    this.store.delete('auth');
    this.saveSettings({ mode: DOMAIN_LOCAL });
  }

  getRepos() {
    return this.store.get('repos', []);
  }

  getCurrentRepoId() {
    return this.store.get('currentRepoId', '');
  }

  getCurrentRepo() {
    const currentRepoId = this.getCurrentRepoId();
    return this.getRepos().find((repo) => repo.id === currentRepoId) || null;
  }

  addRepo(repo) {
    const existing = this.getRepos().find(
      (item) => item.owner === repo.owner && item.name === repo.name
    );
    if (existing) {
      return this.updateRepo(existing.id, repo);
    }

    const repos = this.getRepos();
    const created = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...repo
    };
    this.store.set('repos', [...repos, created]);
    return created;
  }

  updateRepo(repoId, updates) {
    const repos = this.getRepos().map((repo) => (repo.id === repoId ? { ...repo, ...updates } : repo));
    this.store.set('repos', repos);
    return repos.find((repo) => repo.id === repoId) || null;
  }

  removeRepo(repoId) {
    const repos = this.getRepos().filter((repo) => repo.id !== repoId);
    this.store.set('repos', repos);
    if (this.getCurrentRepoId() === repoId) {
      this.store.set('currentRepoId', repos[0]?.id || '');
    }
    return repos;
  }

  setCurrentRepoId(repoId) {
    this.store.set('currentRepoId', repoId);
    return this.getCurrentRepo();
  }

  getRootForMode(mode) {
    const { localRoot } = this.ensureBaseLayout();
    if (mode === DOMAIN_REMOTE) {
      return this.getCurrentRepo()?.localPath || '';
    }
    return localRoot;
  }

  getModeRoot() {
    return this.getRootForMode(this.getSettings().mode);
  }
}

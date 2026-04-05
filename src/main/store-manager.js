import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import Store from 'electron-store';
import {
  DEFAULT_REPO_NAME,
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
    const remoteRoot = this.getSettings().repoRoot || path.join(userData, 'GitNote', 'repo');
    fs.mkdirSync(localRoot, { recursive: true });
    fs.mkdirSync(path.dirname(remoteRoot), { recursive: true });
    return { localRoot, remoteRoot };
  }

  getSettings() {
    return {
      syncIntervalMinutes: this.store.get('settings.syncIntervalMinutes', DEFAULT_SYNC_INTERVAL_MINUTES),
      repoRoot: this.store.get('settings.repoRoot', path.join(app.getPath('userData'), 'GitNote', 'repo')),
      mode: this.store.get('settings.mode', DOMAIN_LOCAL),
      firstRunCompleted: this.store.get('settings.firstRunCompleted', false),
      repoName: this.store.get('settings.repoName', DEFAULT_REPO_NAME),
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

  getRootForMode(mode) {
    const { localRoot, remoteRoot } = this.ensureBaseLayout();
    return mode === DOMAIN_REMOTE ? remoteRoot : localRoot;
  }

  getModeRoot() {
    return this.getRootForMode(this.getSettings().mode);
  }
}

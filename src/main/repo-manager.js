import fs from 'node:fs';
import path from 'node:path';

function sanitizeName(value = '') {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim();
}

export class RepoManager {
  constructor({ storeManager, gitHandler }) {
    this.storeManager = storeManager;
    this.gitHandler = gitHandler;
  }

  getRepos() {
    return this.storeManager.getRepos();
  }

  getCurrentRepo() {
    return this.storeManager.getCurrentRepo();
  }

  async addRepo({ token, repoName, owner, localDirName, autoSync = true, syncIntervalMinutes }) {
    if (!repoName) {
      throw new Error('repoName is required.');
    }
    const baseStoragePath = this.storeManager.getGlobalSettings().baseStoragePath;
    const folderName = sanitizeName(localDirName || repoName);
    const localPath = path.join(baseStoragePath, folderName);

    fs.mkdirSync(baseStoragePath, { recursive: true });

    // owner is optional; ensureRepo defaults to authenticated user if not provided
    const ensured = await this.gitHandler.ensureRepo({
      token,
      owner,
      repoName,
      repoPath: localPath,
      createIfMissing: true
    });

    const resolvedOwner = owner || ensured.user?.login;
    const repoEntry = this.storeManager.addRepo({
      name: repoName,
      owner: resolvedOwner,
      remoteUrl: `https://github.com/${resolvedOwner}/${repoName}.git`,
      localPath,
      autoSync,
      syncIntervalMinutes: syncIntervalMinutes || this.storeManager.getGlobalSettings().defaultSyncInterval
    });

    this.storeManager.setCurrentRepoId(repoEntry.id);

    return {
      repo: repoEntry,
      user: ensured.user
    };
  }

  switchRepo(repoId) {
    return this.storeManager.setCurrentRepoId(repoId);
  }

  updateRepo(repoId, updates) {
    return this.storeManager.updateRepo(repoId, updates);
  }

  removeRepo(repoId) {
    const current = this.storeManager.getCurrentRepo();
    if (current?.id === repoId && this.storeManager.getRepos().length <= 1) {
      throw new Error('The synced GitNote repository cannot be removed while it is the only connected repository.');
    }
    return this.storeManager.removeRepo(repoId);
  }
}

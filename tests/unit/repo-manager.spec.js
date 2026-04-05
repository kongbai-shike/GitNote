import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepoManager } from '../../src/main/repo-manager.js';

describe('RepoManager', () => {
  let storeManager;
  let gitHandler;
  let repoManager;

  beforeEach(() => {
    storeManager = {
      getGlobalSettings: vi.fn(() => ({
        baseStoragePath: 'D:/GitNote/repos',
        defaultSyncInterval: 2
      })),
      addRepo: vi.fn((repo) => ({ id: 'repo-1', ...repo })),
      setCurrentRepoId: vi.fn(() => ({ id: 'repo-1' })),
      updateRepo: vi.fn((repoId, updates) => ({ id: repoId, ...updates })),
      removeRepo: vi.fn(() => []),
      getRepos: vi.fn(() => []),
      getCurrentRepo: vi.fn(() => null)
    };

    gitHandler = {
      ensureRepo: vi.fn(() => Promise.resolve({ user: { login: 'tester' } }))
    };

    repoManager = new RepoManager({ storeManager, gitHandler });
  });

  it('adds a repo and sets it as current', async () => {
    const result = await repoManager.addRepo({
      token: 'token',
      repoName: 'GitNote',
      owner: 'kongbai-shike',
      localDirName: 'GitNote',
      autoSync: true
    });

    expect(gitHandler.ensureRepo).toHaveBeenCalled();
    expect(storeManager.addRepo).toHaveBeenCalled();
    expect(storeManager.setCurrentRepoId).toHaveBeenCalledWith('repo-1');
    expect(result.repo.name).toBe('GitNote');
  });

  it('switches repo by id', () => {
    repoManager.switchRepo('repo-2');
    expect(storeManager.setCurrentRepoId).toHaveBeenCalledWith('repo-2');
  });

  it('removes repo by id', () => {
    repoManager.removeRepo('repo-2');
    expect(storeManager.removeRepo).toHaveBeenCalledWith('repo-2');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHandler } from '../../src/main/git-handler.js';

const mockGit = {
  add: vi.fn(),
  status: vi.fn(),
  commit: vi.fn(),
  push: vi.fn()
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit)
}));

describe('GitHandler', () => {
  let handler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new GitHandler({
      storeManager: {
        getRootForMode: () => 'D:/tmp/repo'
      },
      onConflict: vi.fn()
    });
  });

  it('skips commit when there are no changed files', async () => {
    mockGit.status.mockResolvedValue({ files: [] });

    const result = await handler.commitAndPush('D:/tmp/repo', 'test');

    expect(mockGit.add).toHaveBeenCalledWith('-A');
    expect(mockGit.commit).not.toHaveBeenCalled();
    expect(result.skipped).toBe(true);
  });

  it('commits and pushes when files changed', async () => {
    mockGit.status.mockResolvedValue({ files: [{ path: 'a.md' }] });
    mockGit.push.mockResolvedValue({});

    const result = await handler.commitAndPush('D:/tmp/repo', 'test');

    expect(mockGit.commit).toHaveBeenCalledWith('test');
    expect(mockGit.push).toHaveBeenCalledWith('origin');
    expect(result.pushed).toBe(true);
  });
});

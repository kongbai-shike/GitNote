import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { DEFAULT_REPO_NAME } from '../shared/constants.js';

export class GitHandler {
  constructor({ storeManager, onConflict }) {
    this.storeManager = storeManager;
    this.onConflict = onConflict;
  }

  createOctokit(token) {
    return new Octokit({ auth: token });
  }

  getGit(repoPath) {
    return simpleGit({ baseDir: repoPath, binary: 'git' });
  }

  async ensureRepo({ token, owner, repoName = DEFAULT_REPO_NAME, repoPath, createIfMissing = false }) {
    const octokit = this.createOctokit(token);
    const { data: user } = await octokit.users.getAuthenticated();
    const repoOwner = owner || user.login;

    try {
      await octokit.repos.get({
        owner: repoOwner,
        repo: repoName
      });
    } catch (error) {
      if (error.status !== 404 || !createIfMissing || repoOwner !== user.login) {
        throw error;
      }

      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: true,
        auto_init: true,
        description: 'GitNote synced notes'
      });
    }

    const repoRoot = repoPath;
    fs.mkdirSync(path.dirname(repoRoot), { recursive: true });

    if (!fs.existsSync(repoRoot) || !fs.existsSync(path.join(repoRoot, '.git'))) {
      if (fs.existsSync(repoRoot)) {
        fs.rmSync(repoRoot, { recursive: true, force: true });
      }
      await simpleGit().clone(`https://${token}@github.com/${repoOwner}/${repoName}.git`, repoRoot);
    }

    const git = this.getGit(repoRoot);
    await git.addConfig('user.name', user.login);
    await git.addConfig('user.email', `${user.id}+${user.login}@users.noreply.github.com`);
    await git.pull('origin', 'main', { '--rebase': 'true' }).catch(() => git.pull('origin', 'master', { '--rebase': 'true' }));

    return {
      user,
      repoName,
      repoRoot
    };
  }

  async pullLatest(repoPath) {
    const git = this.getGit(repoPath);
    try {
      return await git.pull('origin', 'main', { '--rebase': 'true' });
    } catch (error) {
      try {
        return await git.pull('origin', 'master', { '--rebase': 'true' });
      } catch (rebaseError) {
        const conflict = await this.collectConflictContents(repoPath);
        const choice = await this.onConflict(conflict);
        if (!choice) {
          throw rebaseError;
        }
        return this.applyConflictChoice(choice, repoPath);
      }
    }
  }

  async collectConflictContents(repoPath) {
    const git = this.getGit(repoPath);
    const status = await git.status();
    const conflicted = status.conflicted[0];
    if (!conflicted) {
      return null;
    }
    const absolute = path.join(repoPath, conflicted);
    const local = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    let remote = '';
    try {
      remote = await git.show([`origin/main:${conflicted}`]);
    } catch {
      remote = await git.show([`origin/master:${conflicted}`]).catch(() => '');
    }
    return { filePath: conflicted, local, remote };
  }

  async applyConflictChoice({ strategy, filePath, content }, repoPath) {
    const git = this.getGit(repoPath);
    const absolute = path.join(repoPath, filePath);

    if (strategy === 'remote') {
      const remoteContent = await git.show([`origin/main:${filePath}`]).catch(() => git.show([`origin/master:${filePath}`]));
      fs.writeFileSync(absolute, remoteContent, 'utf8');
    } else if (strategy === 'manual') {
      fs.writeFileSync(absolute, content, 'utf8');
    }

    await git.add(filePath);
    await git.rebase(['--continue']).catch(async () => {
      await git.rebase(['--abort']);
      await git.reset(['--hard', 'origin/main']).catch(() => git.reset(['--hard', 'origin/master']));
    });

    return { resolved: true };
  }

  async commitAndPush(repoPath, message = `Auto sync at ${new Date().toISOString()}`) {
    const git = this.getGit(repoPath);
    await git.add('-A');
    const status = await git.status();
    if (!status.files.length) {
      if (status.ahead > 0) {
        try {
          await git.push('origin');
          return { pushed: true, committed: false, aheadBeforePush: status.ahead };
        } catch (error) {
          throw new Error(`Local commits exist but push failed: ${error.message}`);
        }
      }
      return { skipped: true, reason: 'No changes' };
    }

    await git.commit(message);

    try {
      await git.push('origin');
      return { pushed: true, committed: true };
    } catch (error) {
      try {
        await this.pullLatest(repoPath);
        await git.push('origin');
        return { pushed: true, committed: true, recovered: true };
      } catch (pushError) {
        throw new Error(`Committed locally, but push to GitHub failed: ${pushError.message || error.message}`);
      }
    }
  }

  async getFileHistory({ token, owner, repo, filePath }) {
    const octokit = this.createOctokit(token);
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      path: filePath,
      per_page: 30
    });
    return data.map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || commit.author?.login || 'unknown',
      date: commit.commit.author?.date
    }));
  }

  async getFileContentAtCommit({ token, owner, repo, filePath, sha }) {
    const octokit = this.createOctokit(token);
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: sha
    });
    return {
      content: Buffer.from(data.content, 'base64').toString('utf8')
    };
  }
}

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

  getRepoRoot() {
    return this.storeManager.getRootForMode('remote');
  }

  getGit() {
    return simpleGit({ baseDir: this.getRepoRoot(), binary: 'git' });
  }

  async ensureRepo({ token, repoName = DEFAULT_REPO_NAME }) {
    const octokit = this.createOctokit(token);
    const { data: user } = await octokit.users.getAuthenticated();

    try {
      await octokit.repos.get({
        owner: user.login,
        repo: repoName
      });
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: true,
        auto_init: true,
        description: 'GitNote synced notes'
      });
    }

    const repoRoot = this.getRepoRoot();
    fs.mkdirSync(path.dirname(repoRoot), { recursive: true });

    if (!fs.existsSync(repoRoot) || !fs.existsSync(path.join(repoRoot, '.git'))) {
      if (fs.existsSync(repoRoot)) {
        fs.rmSync(repoRoot, { recursive: true, force: true });
      }
      await simpleGit().clone(`https://${token}@github.com/${user.login}/${repoName}.git`, repoRoot);
    }

    const git = this.getGit();
    await git.addConfig('user.name', user.login);
    await git.addConfig('user.email', `${user.id}+${user.login}@users.noreply.github.com`);
    await git.pull('origin', 'main', { '--rebase': 'true' }).catch(() => git.pull('origin', 'master', { '--rebase': 'true' }));

    return {
      user,
      repoName,
      repoRoot
    };
  }

  async pullLatest() {
    const git = this.getGit();
    try {
      return await git.pull('origin', 'main', { '--rebase': 'true' });
    } catch (error) {
      try {
        return await git.pull('origin', 'master', { '--rebase': 'true' });
      } catch (rebaseError) {
        const conflict = await this.collectConflictContents();
        const choice = await this.onConflict(conflict);
        if (!choice) {
          throw rebaseError;
        }
        return this.applyConflictChoice(choice);
      }
    }
  }

  async collectConflictContents() {
    const git = this.getGit();
    const status = await git.status();
    const conflicted = status.conflicted[0];
    if (!conflicted) {
      return null;
    }
    const absolute = path.join(this.getRepoRoot(), conflicted);
    const local = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    let remote = '';
    try {
      remote = await git.show([`origin/main:${conflicted}`]);
    } catch {
      remote = await git.show([`origin/master:${conflicted}`]).catch(() => '');
    }
    return { filePath: conflicted, local, remote };
  }

  async applyConflictChoice({ strategy, filePath, content }) {
    const git = this.getGit();
    const absolute = path.join(this.getRepoRoot(), filePath);

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

  async commitAndPush(message = `Auto sync at ${new Date().toISOString()}`) {
    const git = this.getGit();
    await git.add('-A');
    const status = await git.status();
    if (!status.files.length) {
      return { skipped: true, reason: 'No changes' };
    }

    await git.commit(message);

    try {
      await git.push('origin');
      return { pushed: true };
    } catch {
      await this.pullLatest();
      await git.push('origin');
      return { pushed: true, recovered: true };
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

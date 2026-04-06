import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { StoreManager } from './store-manager.js';
import { startGithubOAuth } from './oauth.js';
import { GitHandler } from './git-handler.js';
import { RepoManager } from './repo-manager.js';
import {
  BINARY_DOCUMENT_EXTENSIONS,
  EDITABLE_TEXT_EXTENSIONS,
  IPC_CHANNELS,
  DOMAIN_LOCAL,
  DOMAIN_REMOTE,
  SUPPORTED_FILE_EXTENSIONS
} from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storeManager = new StoreManager();
storeManager.ensureBaseLayout();

let mainWindow;
let syncTimer;
let pendingConflictResolver = null;

const gitHandler = new GitHandler({
  storeManager,
  onConflict: async (payload) => {
    if (!mainWindow || !payload) {
      return null;
    }
    return new Promise((resolve) => {
      pendingConflictResolver = resolve;
      mainWindow.webContents.send('conflict:open', payload);
    });
  }
});
const repoManager = new RepoManager({ storeManager, gitHandler });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 860,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.resolve(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../../dist/index.html'));
  }
}

function currentRoot() {
  return storeManager.getModeRoot();
}

function currentRepo() {
  return storeManager.getCurrentRepo();
}

function getExtension(filePath = '') {
  return path.extname(filePath).toLowerCase();
}

function isSupportedFile(filePath = '') {
  return SUPPORTED_FILE_EXTENSIONS.includes(getExtension(filePath));
}

function isEditableTextFile(filePath = '') {
  return EDITABLE_TEXT_EXTENSIONS.includes(getExtension(filePath));
}

function isBinaryDocument(filePath = '') {
  return BINARY_DOCUMENT_EXTENSIONS.includes(getExtension(filePath));
}

function listTree(rootDir, current = '') {
  const absolute = path.join(rootDir, current);
  const entries = fs.existsSync(absolute) ? fs.readdirSync(absolute, { withFileTypes: true }) : [];
  return entries
    .filter((entry) => !entry.name.startsWith('.git'))
    .filter((entry) => entry.isDirectory() || isSupportedFile(entry.name))
    .map((entry) => {
      const relativePath = path.join(current, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: relativePath,
          type: 'directory',
          trashed: relativePath.startsWith('.trash/'),
          children: listTree(rootDir, path.join(current, entry.name))
        };
      }
      return {
        name: entry.name,
        path: relativePath,
        type: 'file',
        extension: getExtension(entry.name),
        editable: isEditableTextFile(entry.name),
        binary: isBinaryDocument(entry.name),
        trashed: relativePath.startsWith('.trash/')
      };
    });
}

function ensureAssetsDir(forFile) {
  const noteDir = path.dirname(path.join(currentRoot(), forFile));
  const assetsDir = path.join(noteDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  return assetsDir;
}

function ensureTrashDir() {
  const trashDir = path.join(currentRoot(), '.trash');
  fs.mkdirSync(trashDir, { recursive: true });
  return trashDir;
}

function uniqueTrashName(relativePath) {
  const normalized = relativePath.replace(/[\\/]/g, '__');
  return `${Date.now()}__${normalized}`;
}

function decodeTrashName(fileName) {
  const markerIndex = fileName.indexOf('__');
  if (markerIndex === -1) {
    return fileName;
  }
  return fileName.slice(markerIndex + 2).replace(/__/g, '/');
}

function scheduleSync() {
  clearInterval(syncTimer);
  const repo = currentRepo();
  if (storeManager.getSettings().mode !== DOMAIN_REMOTE || !repo?.autoSync) {
    return;
  }
  const intervalMs = (repo.syncIntervalMinutes || storeManager.getGlobalSettings().defaultSyncInterval) * 60 * 1000;
  syncTimer = setInterval(async () => {
    try {
      await gitHandler.commitAndPush(repo.localPath);
      mainWindow?.webContents.send('sync:status', { ok: true, at: Date.now() });
    } catch (error) {
      mainWindow?.webContents.send('sync:status', { ok: false, error: error.message });
    }
  }, intervalMs);
}

async function bootstrapState() {
  const settings = storeManager.getSettings();
  const globalSettings = storeManager.getGlobalSettings();
  const auth = storeManager.getAuth();
  const root = currentRoot();
  if (root) {
    fs.mkdirSync(root, { recursive: true });
  }
  scheduleSync();
  return {
    settings,
    globalSettings,
    auth,
    repos: storeManager.getRepos(),
    currentRepoId: storeManager.getCurrentRepoId(),
    currentRepo: currentRepo(),
    recentNotes: storeManager.getRecentNotes(),
    tree: root ? listTree(root) : [],
    root: root || ''
  };
}

ipcMain.handle(IPC_CHANNELS.BOOTSTRAP, async () => bootstrapState());
ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => storeManager.getSettings());

ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, payload) => {
  const { globalSettings, ...settingsPayload } = payload || {};
  const settings = storeManager.saveSettings(settingsPayload);
  if (globalSettings) {
    storeManager.saveGlobalSettings(globalSettings);
  }
  storeManager.ensureBaseLayout();
  scheduleSync();
  return {
    settings,
    globalSettings: storeManager.getGlobalSettings(),
    currentRepo: currentRepo()
  };
});

ipcMain.handle(IPC_CHANNELS.START_OAUTH, async () => {
  const token = await startGithubOAuth();
  const octokitUser = await gitHandler.createOctokit(token).users.getAuthenticated();
  const user = {
    login: octokitUser.data.login,
    avatarUrl: octokitUser.data.avatar_url,
    id: octokitUser.data.id
  };

  storeManager.saveAuth({
    isLoggedIn: true,
    token,
    user
  });
  storeManager.saveSettings({ mode: DOMAIN_REMOTE, firstRunCompleted: true });

  // Unified repo: auto-create gitnote-notes-${user.login} if not exists
  const unifiedRepoName = `gitnote-notes-${user.login}`;
  await repoManager.addRepo({
    token,
    repoName: unifiedRepoName,
    localDirName: unifiedRepoName,
    autoSync: true
  });

  scheduleSync();
  return bootstrapState();
});

ipcMain.handle(IPC_CHANNELS.LIST_REPOS, async () => ({
  repos: storeManager.getRepos(),
  currentRepoId: storeManager.getCurrentRepoId()
}));

ipcMain.handle(IPC_CHANNELS.ADD_REPO, async (_event, payload) => {
  const auth = storeManager.getAuth();
  if (!auth.isLoggedIn) {
    throw new Error('Please log in before connecting the synced GitNote repository.');
  }
  await repoManager.addRepo({
    token: auth.token,
    ...payload
  });
  scheduleSync();
  return bootstrapState();
});

ipcMain.handle(IPC_CHANNELS.UPDATE_REPO, async (_event, { repoId, updates }) => {
  const repo = repoManager.updateRepo(repoId, updates);
  scheduleSync();
  return { repo, repos: storeManager.getRepos(), currentRepoId: storeManager.getCurrentRepoId() };
});

ipcMain.handle(IPC_CHANNELS.REMOVE_REPO, async (_event, { repoId }) => {
  const repos = repoManager.removeRepo(repoId);
  scheduleSync();
  return { repos, currentRepoId: storeManager.getCurrentRepoId() };
});

ipcMain.handle(IPC_CHANNELS.SWITCH_REPO, async (_event, { repoId }) => {
  repoManager.switchRepo(repoId);
  scheduleSync();
  return bootstrapState();
});

ipcMain.handle(IPC_CHANNELS.EXPORT_LOCAL_TO_GITHUB, async () => {
  const auth = storeManager.getAuth();
  if (!auth.isLoggedIn) {
    throw new Error('Please log in before exporting local notes.');
  }

  const localRoot = storeManager.getRootForMode(DOMAIN_LOCAL);
  const remoteRoot = currentRepo()?.localPath;
  if (!remoteRoot) {
    throw new Error('Please log in first so GitNote can prepare your private sync repository.');
  }
  fs.cpSync(localRoot, remoteRoot, { recursive: true, force: true });
  await gitHandler.commitAndPush(remoteRoot, 'Export local notes to GitHub');
  storeManager.saveSettings({ mode: DOMAIN_REMOTE });
  scheduleSync();
  return bootstrapState();
});

ipcMain.handle(IPC_CHANNELS.LOGOUT, async () => {
  storeManager.clearAuth();
  scheduleSync();
  return bootstrapState();
});

ipcMain.handle(IPC_CHANNELS.LIST_TREE, async () => listTree(currentRoot()));

ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_event, { filePath }) => {
  const absolute = path.join(currentRoot(), filePath);
  const editable = isEditableTextFile(filePath);
  const recentNotes = storeManager.touchRecentNote(filePath);
  return {
    content: editable && fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '',
    editable,
    binary: isBinaryDocument(filePath),
    extension: getExtension(filePath),
    recentNotes
  };
});

ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, { filePath, content }) => {
  if (!isEditableTextFile(filePath)) {
    throw new Error('This file type is not editable inside GitNote.');
  }
  const absolute = path.join(currentRoot(), filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content, 'utf8');
  return { ok: true };
});

ipcMain.handle(IPC_CHANNELS.CREATE_ENTRY, async (_event, { parentPath = '', name, type, content }) => {
  const absolute = path.join(currentRoot(), parentPath, name);
  if (type === 'directory') {
    fs.mkdirSync(absolute, { recursive: true });
  } else {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    const initialContent = isEditableTextFile(name) ? content || '' : '';
    fs.writeFileSync(absolute, initialContent, 'utf8');
  }
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.RENAME_ENTRY, async (_event, { oldPath, newName }) => {
  const oldAbsolute = path.join(currentRoot(), oldPath);
  const newAbsolute = path.join(path.dirname(oldAbsolute), newName);
  fs.renameSync(oldAbsolute, newAbsolute);
  const newRelativePath = path.relative(currentRoot(), newAbsolute).replace(/\\/g, '/');
  storeManager.renameRecentNote(oldPath, newRelativePath);
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.DELETE_ENTRY, async (_event, { targetPath }) => {
  storeManager.removeRecentNote(targetPath);
  const source = path.join(currentRoot(), targetPath);
  if (!fs.existsSync(source)) {
    return listTree(currentRoot());
  }
  const trashDir = ensureTrashDir();
  fs.renameSync(source, path.join(trashDir, uniqueTrashName(targetPath)));
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.RESTORE_ENTRY, async (_event, { targetPath }) => {
  const source = path.join(currentRoot(), targetPath);
  if (!fs.existsSync(source)) {
    throw new Error('Trash item does not exist.');
  }
  const destinationRelative = decodeTrashName(path.basename(targetPath));
  const destination = path.join(currentRoot(), destinationRelative);
  if (fs.existsSync(destination)) {
    throw new Error('Original path already exists. Rename or remove it before restoring.');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.PURGE_ENTRY, async (_event, { targetPath }) => {
  const source = path.join(currentRoot(), targetPath);
  if (!fs.existsSync(source)) {
    return listTree(currentRoot());
  }
  fs.rmSync(source, { recursive: true, force: true });
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL_FILE, async (_event, { filePath }) => {
  const absolute = path.join(currentRoot(), filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error('File does not exist.');
  }
  const result = await shell.openPath(absolute);
  return { ok: !result, error: result || '' };
});

ipcMain.handle(IPC_CHANNELS.PASTE_IMAGE, async (_event, { filePath, fileName, buffer }) => {
  const assetsDir = ensureAssetsDir(filePath);
  const targetName = fileName || `image-${Date.now()}.png`;
  fs.writeFileSync(path.join(assetsDir, targetName), Buffer.from(buffer));
  return { markdown: `![](assets/${targetName})` };
});

ipcMain.handle(IPC_CHANNELS.SYNC_NOW, async () => {
  const repo = currentRepo();
  if (!repo) {
    throw new Error('No repository selected.');
  }
  return gitHandler.commitAndPush(repo.localPath, 'Manual sync from GitNote');
});

ipcMain.handle(IPC_CHANNELS.PULL_NOW, async () => {
  const repo = currentRepo();
  if (!repo) {
    throw new Error('No repository selected.');
  }
  await gitHandler.pullLatest(repo.localPath);
  return { ok: true };
});

ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async (_event, { filePath }) => {
  const auth = storeManager.getAuth();
  const repo = currentRepo();
  if (!repo) {
    return [];
  }
  return gitHandler.getFileHistory({
    token: auth.token,
    owner: repo.owner,
    repo: repo.name,
    filePath
  });
});

ipcMain.handle(IPC_CHANNELS.GET_HISTORY_CONTENT, async (_event, payload) => {
  const auth = storeManager.getAuth();
  const repo = currentRepo();
  if (!repo) {
    throw new Error('No repository selected.');
  }
  return gitHandler.getFileContentAtCommit({
    token: auth.token,
    owner: repo.owner,
    repo: repo.name,
    ...payload
  });
});

ipcMain.handle(IPC_CHANNELS.RESTORE_HISTORY, async (_event, { filePath, content }) => {
  fs.writeFileSync(path.join(currentRoot(), filePath), content, 'utf8');
  await gitHandler.commitAndPush(currentRepo().localPath, `Restore ${filePath} from history`);
  return { ok: true };
});

ipcMain.handle(IPC_CHANNELS.RESOLVE_CONFLICT, async (_event, payload) => {
  if (pendingConflictResolver) {
    pendingConflictResolver(payload);
    pendingConflictResolver = null;
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle(IPC_CHANNELS.CHOOSE_DIRECTORY, async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0] || null;
});

app.whenReady().then(async () => {
  createWindow();
  if (storeManager.getSettings().mode === DOMAIN_REMOTE && storeManager.getAuth().isLoggedIn && currentRepo()?.localPath) {
    try {
      await gitHandler.pullLatest(currentRepo().localPath);
    } catch {
      // Keep app usable even if startup sync fails.
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

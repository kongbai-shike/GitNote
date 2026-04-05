import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { StoreManager } from './store-manager.js';
import { startGithubOAuth } from './oauth.js';
import { GitHandler } from './git-handler.js';
import { IPC_CHANNELS, DOMAIN_LOCAL, DOMAIN_REMOTE } from '../shared/constants.js';

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
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
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function currentRoot() {
  return storeManager.getModeRoot();
}

function listTree(rootDir, current = '') {
  const absolute = path.join(rootDir, current);
  const entries = fs.existsSync(absolute) ? fs.readdirSync(absolute, { withFileTypes: true }) : [];
  return entries
    .filter((entry) => !entry.name.startsWith('.git'))
    .filter((entry) => entry.isDirectory() || entry.name.endsWith('.md'))
    .map((entry) => {
      const relativePath = path.join(current, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: listTree(rootDir, path.join(current, entry.name))
        };
      }
      return {
        name: entry.name,
        path: relativePath,
        type: 'file'
      };
    });
}

function ensureAssetsDir(forFile) {
  const noteDir = path.dirname(path.join(currentRoot(), forFile));
  const assetsDir = path.join(noteDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  return assetsDir;
}

function scheduleSync() {
  clearInterval(syncTimer);
  if (storeManager.getSettings().mode !== DOMAIN_REMOTE) {
    return;
  }
  const intervalMs = storeManager.getSettings().syncIntervalMinutes * 60 * 1000;
  syncTimer = setInterval(async () => {
    try {
      await gitHandler.commitAndPush();
      mainWindow?.webContents.send('sync:status', { ok: true, at: Date.now() });
    } catch (error) {
      mainWindow?.webContents.send('sync:status', { ok: false, error: error.message });
    }
  }, intervalMs);
}

async function bootstrapState() {
  const settings = storeManager.getSettings();
  const auth = storeManager.getAuth();
  const root = currentRoot();
  fs.mkdirSync(root, { recursive: true });
  scheduleSync();
  return {
    settings,
    auth,
    tree: listTree(root),
    root
  };
}

ipcMain.handle(IPC_CHANNELS.BOOTSTRAP, async () => bootstrapState());
ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => storeManager.getSettings());

ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, payload) => {
  const settings = storeManager.saveSettings(payload);
  storeManager.ensureBaseLayout();
  scheduleSync();
  return settings;
});

ipcMain.handle(IPC_CHANNELS.START_OAUTH, async () => {
  const token = await startGithubOAuth();
  const repoName = storeManager.getSettings().repoName;
  const ensured = await gitHandler.ensureRepo({ token, repoName });

  storeManager.saveAuth({
    isLoggedIn: true,
    token,
    user: {
      login: ensured.user.login,
      avatarUrl: ensured.user.avatar_url,
      id: ensured.user.id
    }
  });
  storeManager.saveSettings({ mode: DOMAIN_REMOTE, firstRunCompleted: true, repoName });
  scheduleSync();
  return bootstrapState();
});

ipcMain.handle(IPC_CHANNELS.EXPORT_LOCAL_TO_GITHUB, async () => {
  const auth = storeManager.getAuth();
  if (!auth.isLoggedIn) {
    throw new Error('Please log in before exporting local notes.');
  }

  const localRoot = storeManager.getRootForMode(DOMAIN_LOCAL);
  const remoteRoot = storeManager.getRootForMode(DOMAIN_REMOTE);
  fs.cpSync(localRoot, remoteRoot, { recursive: true, force: true });
  await gitHandler.commitAndPush('Export local notes to GitHub');
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
  return { content: fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '' };
});

ipcMain.handle(IPC_CHANNELS.WRITE_FILE, async (_event, { filePath, content }) => {
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
    fs.writeFileSync(absolute, content || '# New Note\n', 'utf8');
  }
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.RENAME_ENTRY, async (_event, { oldPath, newName }) => {
  const oldAbsolute = path.join(currentRoot(), oldPath);
  const newAbsolute = path.join(path.dirname(oldAbsolute), newName);
  fs.renameSync(oldAbsolute, newAbsolute);
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.DELETE_ENTRY, async (_event, { targetPath }) => {
  fs.rmSync(path.join(currentRoot(), targetPath), { recursive: true, force: true });
  return listTree(currentRoot());
});

ipcMain.handle(IPC_CHANNELS.PASTE_IMAGE, async (_event, { filePath, fileName, buffer }) => {
  const assetsDir = ensureAssetsDir(filePath);
  const targetName = fileName || `image-${Date.now()}.png`;
  fs.writeFileSync(path.join(assetsDir, targetName), Buffer.from(buffer));
  return { markdown: `![](assets/${targetName})` };
});

ipcMain.handle(IPC_CHANNELS.SYNC_NOW, async () => gitHandler.commitAndPush('Manual sync from GitNote'));

ipcMain.handle(IPC_CHANNELS.GET_HISTORY, async (_event, { filePath }) => {
  const auth = storeManager.getAuth();
  const repoName = storeManager.getSettings().repoName;
  return gitHandler.getFileHistory({
    token: auth.token,
    owner: auth.user.login,
    repo: repoName,
    filePath
  });
});

ipcMain.handle(IPC_CHANNELS.GET_HISTORY_CONTENT, async (_event, payload) => {
  const auth = storeManager.getAuth();
  const repoName = storeManager.getSettings().repoName;
  return gitHandler.getFileContentAtCommit({
    token: auth.token,
    owner: auth.user.login,
    repo: repoName,
    ...payload
  });
});

ipcMain.handle(IPC_CHANNELS.RESTORE_HISTORY, async (_event, { filePath, content }) => {
  fs.writeFileSync(path.join(currentRoot(), filePath), content, 'utf8');
  await gitHandler.commitAndPush(`Restore ${filePath} from history`);
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
  if (storeManager.getSettings().mode === DOMAIN_REMOTE && storeManager.getAuth().isLoggedIn) {
    try {
      await gitHandler.pullLatest();
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

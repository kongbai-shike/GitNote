import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants.js';

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('gitNoteApi', {
  bootstrap: () => invoke(IPC_CHANNELS.BOOTSTRAP),
  startOAuth: () => invoke(IPC_CHANNELS.START_OAUTH),
  logout: () => invoke(IPC_CHANNELS.LOGOUT),
  exportLocalToGithub: () => invoke(IPC_CHANNELS.EXPORT_LOCAL_TO_GITHUB),
  getSettings: () => invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (payload) => invoke(IPC_CHANNELS.SAVE_SETTINGS, payload),
  listTree: () => invoke(IPC_CHANNELS.LIST_TREE),
  readFile: (payload) => invoke(IPC_CHANNELS.READ_FILE, payload),
  writeFile: (payload) => invoke(IPC_CHANNELS.WRITE_FILE, payload),
  createEntry: (payload) => invoke(IPC_CHANNELS.CREATE_ENTRY, payload),
  renameEntry: (payload) => invoke(IPC_CHANNELS.RENAME_ENTRY, payload),
  deleteEntry: (payload) => invoke(IPC_CHANNELS.DELETE_ENTRY, payload),
  pasteImage: (payload) => invoke(IPC_CHANNELS.PASTE_IMAGE, payload),
  syncNow: () => invoke(IPC_CHANNELS.SYNC_NOW),
  getHistory: (payload) => invoke(IPC_CHANNELS.GET_HISTORY, payload),
  getHistoryContent: (payload) => invoke(IPC_CHANNELS.GET_HISTORY_CONTENT, payload),
  restoreHistory: (payload) => invoke(IPC_CHANNELS.RESTORE_HISTORY, payload),
  resolveConflict: (payload) => invoke(IPC_CHANNELS.RESOLVE_CONFLICT, payload),
  chooseDirectory: () => invoke(IPC_CHANNELS.CHOOSE_DIRECTORY),
  onConflictOpen: (handler) => ipcRenderer.on('conflict:open', (_event, payload) => handler(payload)),
  onSyncStatus: (handler) => ipcRenderer.on('sync:status', (_event, payload) => handler(payload))
});

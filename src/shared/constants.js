export const APP_NAME = 'GitNote';
export const DEFAULT_REPO_NAME = 'GitNote';
export const DEFAULT_SYNC_INTERVAL_MINUTES = 2;
export const DEFAULT_CALLBACK_URL = 'http://127.0.0.1:3000/callback';

export const EDITABLE_TEXT_EXTENSIONS = [
  '.md',
  '.txt',
  '.json',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.html',
  '.css',
  '.scss',
  '.less',
  '.xml',
  '.yml',
  '.yaml',
  '.csv',
  '.log'
];

export const BINARY_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp'
];

export const SUPPORTED_FILE_EXTENSIONS = [
  ...EDITABLE_TEXT_EXTENSIONS,
  ...BINARY_DOCUMENT_EXTENSIONS
];

export const IPC_CHANNELS = {
  BOOTSTRAP: 'app:bootstrap',
  START_OAUTH: 'auth:start-oauth',
  LOGOUT: 'auth:logout',
  EXPORT_LOCAL_TO_GITHUB: 'auth:export-local-to-github',
  LIST_REPOS: 'repos:list',
  ADD_REPO: 'repos:add',
  UPDATE_REPO: 'repos:update',
  REMOVE_REPO: 'repos:remove',
  SWITCH_REPO: 'repos:switch',
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',
  LIST_TREE: 'notes:list-tree',
  READ_FILE: 'notes:read-file',
  WRITE_FILE: 'notes:write-file',
  CREATE_ENTRY: 'notes:create-entry',
  RENAME_ENTRY: 'notes:rename-entry',
  DELETE_ENTRY: 'notes:delete-entry',
  RESTORE_ENTRY: 'notes:restore-entry',
  PURGE_ENTRY: 'notes:purge-entry',
  OPEN_EXTERNAL_FILE: 'notes:open-external-file',
  PASTE_IMAGE: 'notes:paste-image',
  SYNC_NOW: 'sync:now',
  PULL_NOW: 'sync:pull-now',
  GET_HISTORY: 'history:get',
  GET_HISTORY_CONTENT: 'history:get-content',
  RESTORE_HISTORY: 'history:restore',
  RESOLVE_CONFLICT: 'conflict:resolve',
  CHOOSE_DIRECTORY: 'dialog:choose-directory'
};

export const DOMAIN_LOCAL = 'local';
export const DOMAIN_REMOTE = 'remote';

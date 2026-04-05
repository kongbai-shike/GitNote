export const APP_NAME = 'GitNote';
export const DEFAULT_REPO_NAME = 'GitNote';
export const DEFAULT_SYNC_INTERVAL_MINUTES = 2;
export const DEFAULT_CALLBACK_URL = 'http://127.0.0.1:3000/callback';

export const IPC_CHANNELS = {
  BOOTSTRAP: 'app:bootstrap',
  START_OAUTH: 'auth:start-oauth',
  LOGOUT: 'auth:logout',
  EXPORT_LOCAL_TO_GITHUB: 'auth:export-local-to-github',
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',
  LIST_TREE: 'notes:list-tree',
  READ_FILE: 'notes:read-file',
  WRITE_FILE: 'notes:write-file',
  CREATE_ENTRY: 'notes:create-entry',
  RENAME_ENTRY: 'notes:rename-entry',
  DELETE_ENTRY: 'notes:delete-entry',
  PASTE_IMAGE: 'notes:paste-image',
  SYNC_NOW: 'sync:now',
  GET_HISTORY: 'history:get',
  GET_HISTORY_CONTENT: 'history:get-content',
  RESTORE_HISTORY: 'history:restore',
  RESOLVE_CONFLICT: 'conflict:resolve',
  CHOOSE_DIRECTORY: 'dialog:choose-directory'
};

export const DOMAIN_LOCAL = 'local';
export const DOMAIN_REMOTE = 'remote';

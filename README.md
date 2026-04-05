# GitNote

GitNote is an Electron desktop note app for Markdown files with two separate storage domains:

- Local mode: notes are stored under Electron `userData/local_notes/` and never sync.
- GitHub mode: the app authenticates with GitHub OAuth, creates or reuses a private `GitNote` repo, clones it locally, edits real `.md` files, and syncs with git.

## Tech Stack

- Electron
- Vue 3 + Vite
- Pinia
- `md-editor-v3`
- `simple-git`
- `@octokit/rest`
- `axios`
- `electron-store`
- `electron-builder`

## Environment Requirements

- Node.js `>= 18`
- npm `>= 9`
- Git installed and available in `PATH`
- Windows 10 or 11 for packaging `.exe`

## How To Register GitHub OAuth App

1. Open GitHub `Settings -> Developer settings -> OAuth Apps -> New OAuth App`.
2. Fill the OAuth app fields with:
   - Application name: `GitNote Dev`
   - Homepage URL: `http://127.0.0.1:3000`
   - Authorization callback URL: `http://127.0.0.1:3000/callback`
3. Create the app.
4. Copy the `Client ID` and generate a `Client Secret`.
5. Open [src/main/oauth.js](/d:/html/Git_Note/src/main/oauth.js) and replace:
   - `REPLACE_WITH_GITHUB_CLIENT_ID`
   - `REPLACE_WITH_GITHUB_CLIENT_SECRET`

The callback URL in GitHub must match the value used in [src/shared/constants.js](/d:/html/Git_Note/src/shared/constants.js).

## Install Dependencies

```bash
npm install
```

## Run Development Mode

```bash
npm run dev
```

## Build Windows Executable

```bash
npm run dist
```

Generated artifacts are written to `release/`.

## First Use

1. Launch the app.
2. On first run, choose:
   - `使用 GitHub 登录`
   - `仅本地使用`
3. In local mode, notes are saved under the local notes directory and stay offline.
4. In GitHub mode:
   - complete OAuth in the Electron popup
   - GitNote creates or reuses the private `GitNote` repository
   - the repo is cloned into the configured repo root
   - startup runs `git pull`
5. Create, rename, delete, and edit `.md` files from the app UI.
6. Edits save to disk with a 1 second debounce.
7. Sync runs automatically at the configured interval, default `2` minutes.

## Storage Layout

- Local domain: `%APPDATA%/<Your App>/local_notes`
- Git repo working copy: `%APPDATA%/<Your App>/GitNote/repo` by default
- Assets: `assets/` folder next to note directories

The local domain and synced domain are intentionally separate so logout does not overwrite local-only notes.

## Main Features

### First-run onboarding

The renderer shows a welcome panel for GitHub login or local-only use until `firstRunCompleted` is stored.

### OAuth flow

- The main process opens a GitHub auth window.
- A temporary local HTTP listener catches the `code` at `http://127.0.0.1:3000/callback`.
- The main process exchanges `code` for `access_token` with `axios`.
- The token is stored in `electron-store` with encryption enabled.

### Repository handling

- The app checks whether the authenticated user already owns `GitNote`.
- If missing, it creates a private repo with `@octokit/rest`.
- The repo is cloned locally with `simple-git`.
- Git username/email are configured in the cloned working tree.

### File tree and editor

- The left panel shows directories and `.md` files recursively.
- Context actions support create file, create folder, rename, and delete.
- The right panel uses `md-editor-v3` for Markdown editing and preview.

### Auto sync

Auto sync in GitHub mode follows this sequence:

1. `git add -A`
2. `git commit -m "Auto sync at ..."`
3. `git push`

If `push` fails, the app attempts `git pull --rebase`. If rebase conflicts, the renderer opens a resolver dialog for local, remote, or manual content selection.

### Version history

- History is fetched from GitHub commits API for the selected file.
- Commit content preview is loaded from the repository contents API.
- Restore writes the selected version locally, then creates a new sync commit.

### Local mode export

The IPC surface includes `exportLocalToGithub`, so you can move local-only notes into the GitHub repo after login. The current renderer wiring is focused on the core flow, but the backend path is already present.

## Tests

Run unit tests:

```bash
npm run test:unit
```

Run integration placeholder tests:

```bash
npm run test:integration
```

The unit suite covers the `commitAndPush` behavior in [src/main/git-handler.js](/d:/html/Git_Note/src/main/git-handler.js). The integration test is a scaffold because full Electron OAuth and git network automation needs a controlled test environment.

## Project Files

```text
Git_Note/
├── package.json
├── electron.vite.config.js
├── src/
│   ├── main/
│   │   ├── index.js
│   │   ├── preload.js
│   │   ├── oauth.js
│   │   ├── git-handler.js
│   │   └── store-manager.js
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── components/
│   │   │   ├── FileTree.vue
│   │   │   ├── MarkdownEditor.vue
│   │   │   ├── Settings.vue
│   │   │   ├── LoginPanel.vue
│   │   │   ├── ConflictResolver.vue
│   │   │   └── HistoryDialog.vue
│   │   ├── stores/
│   │   │   ├── repo.js
│   │   │   └── auth.js
│   │   └── assets/
│   │       └── base.css
│   └── shared/
│       └── constants.js
├── resources/
├── tests/
│   ├── unit/
│   │   └── git-handler.spec.js
│   └── integration/
│       └── full-flow.spec.js
└── README.md
```

## User Guide

1. Register the OAuth app in GitHub.
2. Fill the client credentials in [src/main/oauth.js](/d:/html/Git_Note/src/main/oauth.js).
3. Run `npm install`.
4. Run `npm run dev` and verify login or local mode.
5. When ready, run `npm run dist` to generate the installer or portable `.exe`.

## Notes

- A custom icon file is not bundled here. If you need branded packaging output, place `icon.ico` under `resources/` and add the `win.icon` field back into [package.json](/d:/html/Git_Note/package.json).
- The conflict dialog is intentionally compact, not a full line-by-line merge editor.
- Native clipboard image paste can be expanded further, but the main-process asset persistence endpoint is already included.

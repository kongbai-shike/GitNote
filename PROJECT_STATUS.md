# GitNote 项目当前状态

> 生成时间：2026-04-05
> 项目路径：D:\html\Git_Note

---

## 一、项目概述

GitNote 是一个基于 Electron + Vue 3 的桌面 Markdown 笔记工具，核心特性：

- GitHub OAuth 登录
- 单私有仓库自动同步方案（统一仓库：`gitnote-notes-${用户名}`）
- 本地笔记模式（无需登录）
- 自动 sync（commit + push）
- 冲突可视化解决
- 文件历史版本
- Markdown 编辑器（实时预览）
- 文件树管理

---

## 二、技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 35.x |
| 前端框架 | Vue 3 + Vite + Pinia |
| Markdown 编辑器 | md-editor-v3 |
| Git 操作 | simple-git |
| GitHub API | @octokit/rest + axios |
| 本地存储 | electron-store |
| 打包工具 | electron-builder |

---

## 三、已完成的代码改动（本次增量）

### 3.1 统一私有仓库方案（核心）

**设计原则**：用户登录后，自动在 GitHub 创建/复用名为 `gitnote-notes-${用户名}` 的私有仓库，所有笔记统一存放在这个仓库中。

#### `src/main/index.js`
```js
// START_OAUTH 处理器
const token = await startGithubOAuth();
const octokitUser = await gitHandler.createOctokit(token).users.getAuthenticated();
const user = { login: octokitUser.data.login, ... };

storeManager.saveAuth({ isLoggedIn: true, token, user });
storeManager.saveSettings({ mode: DOMAIN_REMOTE, firstRunCompleted: true });

// 核心：自动创建/复用统一仓库
const unifiedRepoName = `gitnote-notes-${user.login}`;
await repoManager.addRepo({
  token,
  repoName: unifiedRepoName,
  localDirName: unifiedRepoName,
  autoSync: true
});
scheduleSync();
return bootstrapState();
```

#### `src/main/repo-manager.js`
- `addRepo()` 接口从 `repoInput`（任意 URL 解析）改为 `repoName`（直接仓库名）
- `owner` 参数可选，默认使用当前登录用户
- 移除了 `parseRepoInput()` 函数

```js
async addRepo({ token, repoName, owner, localDirName, autoSync = true, syncIntervalMinutes }) {
  // owner 不传则默认用 gitHandler.ensureRepo 返回的 user.login
  const ensured = await this.gitHandler.ensureRepo({ token, owner, repoName, repoPath: localPath, createIfMissing: true });
  const resolvedOwner = owner || ensured.user?.login;
  // ...
}
```

#### `src/renderer/App.vue`
- `loginWithGithub()`：登录后正确调用 `repo.bootstrap()` 更新状态
- 移除 `RepoSelector` 组件（单仓库无需切换器）
- 侧边栏顶部增加一个小按钮显示当前仓库名，点击打开 RepoManager

#### `src/renderer/components/RepoManager.vue`
- 移除"添加仓库"表单（仓库由系统自动创建）
- 保留仓库信息展示和"移除仓库"功能

#### `src/renderer/i18n.js`
- 新增 `repoManager`、`remove` 翻译键

#### `tests/unit/repo-manager.spec.js`
- 测试更新为 `repoName` + `owner` 参数

---

## 四、构建和测试

### 通过的命令
```bash
npm run build        # ✅ 通过
npm run test:unit   # ✅ 5 tests passed
npm run test:integration  # ✅ 1 test passed
```

### `npm run dist` 状态
- ✅ `release/win-unpacked/GitNote.exe`（192MB）已生成，可正常运行
- ⚠️ NSIS 安装程序打包失败，原因是 `winCodeSign` 工具无法从 GitHub 下载（网络超时）

```
⨯ Get "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
   dial tcp 20.205.243.166:443: connection timed out
```

**已生成的 exe 路径**：`D:\html\Git_Note\release\win-unpacked\GitNote.exe`

---

## 五、项目文件结构（关键文件）

```
D:\html\Git_Note\
├── src/
│   ├── main/
│   │   ├── index.js          # 主进程，IPC handlers，START_OAUTH 逻辑
│   │   ├── repo-manager.js   # 仓库管理，addRepo() 接口
│   │   ├── git-handler.js    # Git 操作（clone/pull/push/commit）
│   │   ├── store-manager.js   # electron-store 封装
│   │   ├── oauth.js          # GitHub OAuth（需填入 CLIENT_ID/SECRET）
│   │   └── preload.js        # contextBridge API 暴露
│   ├── renderer/
│   │   ├── App.vue           # 主界面（已移除 RepoSelector）
│   │   ├── stores/repo.js    # Pinia 状态
│   │   ├── stores/auth.js    # 认证状态
│   │   ├── components/
│   │   │   ├── RepoManager.vue  # 仓库信息/移除（无添加表单）
│   │   │   ├── LoginPanel.vue
│   │   │   ├── FileTree.vue
│   │   │   ├── MarkdownEditor.vue
│   │   │   ├── Settings.vue
│   │   │   ├── ConflictResolver.vue
│   │   │   └── HistoryDialog.vue
│   │   └── i18n.js
│   └── shared/constants.js
├── tests/
│   ├── unit/
│   │   ├── repo-manager.spec.js
│   │   └── git-handler.spec.js
│   └── integration/full-flow.spec.js
├── release/win-unpacked/GitNote.exe   # ✅ 可直接运行
├── package.json
├── electron.vite.config.js
└── README.md
```

---

## 六、OAuth 配置（必须配置才能使用 GitHub 登录）

**文件**：`src/main/oauth.js`

```js
const CLIENT_ID = 'REPLACE_WITH_GITHUB_CLIENT_ID';
const CLIENT_SECRET = 'REPLACE_WITH_GITHUB_CLIENT_SECRET';
```

### 配置步骤：
1. 打开 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. 填写：
   - Homepage URL: `http://127.0.0.1:3000`
   - Callback URL: `http://127.0.0.1:3000/callback`
3. 将生成的 Client ID 和 Client Secret 填入 `oauth.js`

---

## 七、后续工作清单

### 必须（如果网络仍有问题）
- [ ] 在网络畅通环境下重新运行 `npm run dist`，生成 NSIS 安装程序
- [ ] 或手动将 `release/win-unpacked/` 目录打包成分发

### 可选（功能增强）
- [ ] 添加自定义应用图标（替换默认 Electron 图标）
- [ ] 完善 README 中的截图和详细使用说明
- [ ] 考虑增加从本地已有的 .md 文件导入功能

---

## 八、给接手 AI 的提示

1. **不要重建项目**：所有代码已完整，直接在现有代码上继续修改
2. **单仓库方案是核心**：登录后自动创建 `gitnote-notes-${username}`，不要改回多仓库管理
3. **网络问题是环境问题**：代码本身没问题，`npm run build` 和 `npm run test` 都已通过
4. **OAuth 凭证是必须的**：运行前需要填写 `oauth.js` 中的 CLIENT_ID 和 CLIENT_SECRET
5. **直接可运行的 exe 已有**：`release/win-unpacked/GitNote.exe`

---

## 九、完整使用流程

1. 配置 `src/main/oauth.js` 中的 GitHub OAuth 凭证
2. 运行 `npm run dev` 开发模式（或 `npm run dist` 打包）
3. 启动后选择"使用 GitHub 登录"
4. 自动创建 `gitnote-notes-${用户名}` 私有仓库并克隆到本地
5. 直接进入笔记编辑界面，无需手动配置仓库

markdown
# GitNote 项目完整生成提示词

> 复制以下全部内容，发送给支持代码生成的大模型（如 ChatGPT-4、Claude 等），即可获得一个完整的、可直接打包成 exe 的桌面笔记工具项目。

---

## 角色设定

你是一位资深的全栈桌面应用开发者，精通 Electron、Vue 3、Node.js、GitHub OAuth 2.0 以及 `simple-git`。你需要实现一个名为 **GitNote** 的笔记工具，具体需求如下。请输出**完整的项目源代码**，包括所有配置文件、组件、主进程代码、渲染进程代码、打包配置和详细的 README。用户最终执行 `npm run dist` 即可生成 Windows 可执行文件（`.exe`）。

---

## 项目核心需求

1. **登录机制**  
   使用 GitHub OAuth 应用进行登录。应用内有一个“登录”按钮，点击后弹出 GitHub 授权页面（使用 Electron 的 `BrowserWindow` 加载 `https://github.com/login/oauth/authorize`），用户授权后应用获取 `code`，然后通过后端（主进程）向 GitHub 换取 `access_token`。之后所有对 GitHub 仓库的操作都使用该 token。

2. **未登录状态**  
   如果用户未登录，笔记只能保存在**本地**（应用内部的文件系统，例如 `userData/local_notes`），不同步到云端。用户仍可以创建、编辑、删除笔记，但这些操作只影响本地。

3. **已登录状态**  
   - 用户登录成功后，应用自动在用户的 GitHub 账户下创建一个名为 `GitNote` 的私有仓库（如果已存在则直接使用）。  
   - 应用将该仓库克隆到本地某个目录（如 `~/GitNote/repo`）。  
   - 左侧文件树显示该仓库中的所有 `.md` 文件（支持子文件夹）。  
   - 右侧 Markdown 编辑器（支持实时预览、语法高亮）。  
   - **自动同步**：每次编辑后防抖保存到本地文件，并启动一个定时器（默认每 2 分钟）执行 `git add .`、`git commit`、`git push`。同时启动时自动 `git pull`。  
   - 冲突处理：当远程有更新且本地也有未推送的提交时，自动尝试 `git pull --rebase`，若失败则弹出对话框让用户选择保留本地或远程版本。

4. **离线支持**  
   即使登录后，应用也完全离线可用（只是同步需要网络）。所有笔记在本地都有完整副本。

5. **退出登录**  
   用户可退出登录，此时应用切换到本地模式，不再与 GitHub 交互。本地模式下的笔记和登录后的笔记是**分开存储**的（两个不同的数据域）。

6. **打包**  
   使用 `electron-builder` 打包成 Windows 可执行文件（`nsis` 或 `portable`），要求图标、应用名称等完整。

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron (最新稳定版) |
| 前端框架 | Vue 3 + Vite + Pinia |
| Markdown 编辑器 | `md-editor-v3` 或 `v-md-editor` |
| Git 操作 | `simple-git` |
| GitHub OAuth | `axios` + `@octokit/rest` |
| 本地存储（未登录） | `electron-store` + 文件系统 |
| 打包工具 | `electron-builder` |

---

## 详细功能要求

### 1. 首次启动向导
- 用户第一次运行应用时，显示欢迎界面，提示可以选择“使用 GitHub 登录”或“仅本地使用”。
- 如果选择本地使用，直接进入本地笔记模式。

### 2. OAuth 流程
- 需要提前在 GitHub 注册一个 OAuth App：`Homepage URL` 和 `Authorization callback URL` 都填 `http://localhost`（或 `http://127.0.0.1`）。
- 在代码中预留位置让开发者填入自己的 `client_id` 和 `client_secret`（例如在 `src/main/oauth.js` 中）。
- 主进程创建隐藏的 `BrowserWindow` 加载授权 URL，监听 `will-navigate` 或 `redirect` 事件，从重定向 URL 中提取 `code`，然后调用 GitHub API 换取 `access_token`。

### 3. 仓库操作
- 登录成功后，使用 `@octokit/rest` 检查用户是否已有 `GitNote` 仓库，如果没有则创建（私有）。
- 使用 `simple-git` 克隆该仓库到本地指定路径（可配置）。

### 4. 文件树组件
- 使用递归组件展示文件夹和文件。
- 支持右键菜单：新建文件（`.md`）、新建文件夹、重命名、删除。这些操作都会在本地文件系统上执行，并自动 commit + push（登录状态下）。

### 5. Markdown 编辑器
- 支持实时预览、代码高亮、工具栏。
- 支持粘贴图片：图片保存到仓库的 `assets` 文件夹（相对于笔记文件的路径），并插入 `![](assets/xxx.png)`。如果未登录，则保存到本地笔记文件夹的 `assets` 子目录。

### 6. 自动同步（仅登录状态）
- 全局定时器（间隔可在设置中调整，默认 2 分钟）执行：`git add -A` → `git commit -m "auto sync"` → `git push`。
- 如果 push 失败（因为有新提交），则先 `git pull --rebase`，若 rebase 有冲突则调用冲突解决窗口。

### 7. 冲突解决窗口
- 弹出一个新窗口，显示两个面板（本地版本和远程版本），支持逐行选择或整体覆盖。

### 8. 版本历史（登录状态）
- 右键某个文件 → “历史版本”，调用 GitHub API 获取该文件的 commit 列表，展示在一个对话框中。点击某个 commit 可以查看该版本的内容，并支持“恢复到该版本”（生成一个新的 commit 覆盖当前文件）。

### 9. 设置界面
- 可修改自动同步间隔（分钟）、本地仓库存储根目录。
- 显示当前登录用户（头像、用户名），并提供“退出登录”按钮。

### 10. 本地模式
- 笔记数据存储在 `userData/local_notes/` 下，文件结构模仿 Git 仓库（文件夹、`.md` 文件、`assets` 文件夹）。
- 没有 Git 操作，也没有同步功能。
- 本地模式下也可以“导出到 GitHub”：把当前所有本地笔记推送到新建的 `GitNote` 仓库并切换到登录状态。

---

## 项目文件结构

请生成以下完整的文件树及每个文件的内容：
GitNote/
├── package.json
├── electron.vite.config.js # 或 vite.config.js + electron main 入口
├── src/
│ ├── main/
│ │ ├── index.js # Electron 主进程入口
│ │ ├── preload.js # 预加载脚本，暴露安全的 API
│ │ ├── oauth.js # GitHub OAuth 流程
│ │ ├── git-handler.js # 封装所有 Git 操作
│ │ └── store-manager.js # 管理 electron-store + 本地笔记模式
│ ├── renderer/
│ │ ├── index.html
│ │ ├── main.js # Vue 入口
│ │ ├── App.vue
│ │ ├── components/
│ │ │ ├── FileTree.vue
│ │ │ ├── MarkdownEditor.vue
│ │ │ ├── Settings.vue
│ │ │ ├── LoginPanel.vue
│ │ │ ├── ConflictResolver.vue
│ │ │ └── HistoryDialog.vue
│ │ ├── stores/
│ │ │ ├── repo.js # Pinia store（仓库/本地笔记状态）
│ │ │ └── auth.js # Pinia store（登录状态、用户信息）
│ │ └── assets/
│ └── shared/
│ └── constants.js
├── resources/ # 图标等资源
├── tests/
│ ├── unit/
│ │ └── git-handler.spec.js
│ └── integration/
│ └── full-flow.spec.js
└── README.md

text

---

## 输出要求

1. **完整性**：所有代码必须完整、可直接复制保存。
2. **README 内容**：
   - 如何注册 GitHub OAuth App，获取 `client_id` 和 `client_secret`，以及如何填入代码。
   - 开发环境要求（Node.js >= 18）。
   - 安装依赖、运行开发模式、打包成 exe 的完整命令。
   - 首次使用时的操作步骤。
3. **打包配置**：确保 `electron-builder` 配置正确，能生成 Windows 安装程序（NSIS）或便携版。
4. **测试**：单元测试至少覆盖 `git-handler.js` 的 commit/push 方法（使用 mock）。集成测试可选，但需提供示例。

---

## 特别注意事项

- **OAuth 回调**：由于 Electron 没有固定域名，使用 `http://localhost` 作为回调地址。主进程应拦截导航事件，从 URL 中提取 `code`，不要使用 `urn:ietf:oauth:2.0:oob`。
- **Token 存储**：使用 `electron-store` 加密存储 token（可配合 `encryptionKey`）。
- **本地模式存储**：笔记文件放在 `app.getPath('userData')/local_notes` 下，保证用户数据独立。
- **退出登录时**：清除存储的 token，关闭 Git 定时器，清空当前文件树，切换到本地笔记模式。
- **跨平台兼容**：代码应同时兼容 Windows、macOS、Linux（路径处理使用 `path.join` 和 `app.getPath`）。

---

## 开始生成

请按照上述所有要求，输出完整的项目代码和文档。确保最终用户能够通过 `npm install` 和 `npm run dist` 生成可运行的 `.exe` 文件。
现在这个文档就是纯 Markdown 格式了，你可以直接保存为 .md 文件，然后复制全部内容发送给 AI 模型。


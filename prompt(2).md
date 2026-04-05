markdown
# GitNote 完整版 – 多仓库笔记工具生成提示词

> 复制以下全部内容，发送给支持代码生成的大模型，即可获得一个完整的、可直接打包成 exe 的桌面笔记工具，支持多 GitHub 仓库管理、笔记编辑、自动同步、冲突解决、版本历史等全部功能。

---

## 角色设定

你是一位资深的全栈桌面应用开发者，精通 Electron、Vue 3、Node.js、GitHub OAuth 2.0 以及 `simple-git`。你需要实现一个名为 **GitNote** 的笔记工具，其核心定位是：**一个基于 Git 仓库的笔记管理工具，用户可以管理多个 GitHub 仓库（每个仓库独立存储笔记），并随时切换当前工作仓库**。

请输出**完整的项目源代码**，包括所有配置文件、组件、主进程代码、渲染进程代码、打包配置和详细的 README。用户最终执行 `npm run dist` 即可生成 Windows 可执行文件（`.exe`）。

---

## 项目核心需求（保留原有笔记功能 + 新增多仓库管理）

### 原有功能（必须完整保留）
1. **GitHub OAuth 登录** – 使用 GitHub OAuth 进行身份认证，获取 token，后续所有仓库操作基于该 token。
2. **本地模式（未登录）** – 未登录时，笔记只保存在本地 `userData/local_notes` 下，不同步云端。
3. **自动同步** – 登录后，对当前激活的仓库自动执行 commit + push（定时 + 编辑后防抖），启动时 pull。
4. **冲突处理** – 提供可视化冲突解决窗口（本地 vs 远程，行级选择）。
5. **版本历史** – 通过 GitHub API 查看任意文件的历史版本，支持恢复。
6. **Markdown 编辑器** – 支持实时预览、语法高亮、粘贴图片自动保存到 `assets/`。
7. **文件树** – 显示当前仓库的目录结构，支持新建/重命名/删除文件/文件夹。
8. **设置界面** – 可修改同步间隔、本地存储路径、退出登录等。

### 新增功能：多仓库管理（核心）
9. **仓库列表管理**：
   - 用户可以添加多个 GitHub 仓库（通过输入仓库 URL 或 `用户名/仓库名` 格式）。
   - 每个仓库独立配置：本地克隆路径（可自定义）、自动同步开关、同步间隔（可独立覆盖全局设置）。
   - 支持删除仓库（仅从应用中移除配置，不删除本地文件和 GitHub 远程仓库）。
   - 支持“重新克隆”或“修复路径”功能。
10. **仓库切换**：
    - 应用界面有一个仓库选择器（下拉菜单或侧边栏顶部），列出所有已添加的仓库。
    - 切换仓库时，文件树和编辑器内容立即切换到对应仓库的笔记。
    - 切换仓库不影响其他仓库的后台同步定时器（每个仓库独立定时器或统一定时器但只对当前激活仓库操作？建议：只对当前激活仓库执行自动同步，但每个仓库可以独立配置是否开启同步）。
11. **首次登录后的行为**：
    - 用户登录成功后，不再强制创建 `GitNote` 仓库，而是显示一个空的仓库列表，并提示“添加仓库”。
    - 用户可以点击“添加仓库”按钮，输入一个 GitHub 仓库地址（可以是已有仓库，也可以新建）。如果仓库不存在且用户有权限，则自动创建私有仓库并克隆到本地。
12. **仓库导入/导出**：
    - 支持从本地文件夹导入为仓库（如果该文件夹已是一个 Git 仓库，则直接关联；否则初始化为 Git 仓库并推送到远程）。
    - 支持将当前仓库的配置导出为 JSON 文件，方便备份或迁移。

### 界面调整
- 侧边栏顶部增加一个仓库选择下拉框（显示仓库名称/路径），旁边有“+”按钮用于添加仓库。
- 设置界面中增加“仓库管理”选项卡，显示仓库列表、编辑、删除、修改本地路径等。

---

## 技术栈（不变）

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron (最新稳定版) |
| 前端框架 | Vue 3 + Vite + Pinia |
| Markdown 编辑器 | `md-editor-v3` 或 `v-md-editor` |
| Git 操作 | `simple-git` |
| GitHub OAuth | `axios` + `@octokit/rest` |
| 本地存储（配置） | `electron-store` |
| 打包工具 | `electron-builder` |

---

## 项目文件结构（新增/修改部分）
```
在原有结构基础上，增加或修改以下文件：
GitNote/
├── src/
│ ├── main/
│ │ ├── repo-manager.js # 新增：多仓库管理（添加、删除、切换、克隆等）
│ │ ├── git-handler.js # 修改：接受仓库路径作为参数，不再依赖单一全局路径
│ │ └── store-manager.js # 修改：存储仓库列表、当前激活仓库ID
│ ├── renderer/
│ │ ├── components/
│ │ │ ├── RepoSelector.vue # 新增：仓库选择下拉框
│ │ │ ├── RepoManager.vue # 新增：仓库管理对话框（添加、编辑、删除）
│ │ │ ├── FileTree.vue # 修改：基于当前仓库路径展示文件
│ │ │ └── Settings.vue # 修改：增加仓库管理选项卡
│ │ └── stores/
│ │ ├── repo.js # 修改：增加 currentRepoId, repos 数组等状态
│ │ └── auth.js # 不变
├── tests/
│ ├── unit/
│ │ └── repo-manager.spec.js # 新增：单元测试

text

其他文件（`index.js`, `preload.js`, `oauth.js`, `App.vue`, `MarkdownEditor.vue`, `ConflictResolver.vue`, `HistoryDialog.vue` 等）需要相应调整以支持多仓库。

---

## 详细功能实现要求

### 1. 数据结构（存储）
使用 `electron-store` 存储以下配置：
```json
{
  "githubToken": "encrypted_token",
  "currentRepoId": "repo_uuid_1",
  "repos": [
    {
      "id": "repo_uuid_1",
      "name": "我的笔记",
      "remoteUrl": "https://github.com/username/MyNotes.git",
      "localPath": "D:/GitNote/repos/MyNotes",
      "autoSync": true,
      "syncIntervalMinutes": 2,
      "createdAt": "2026-04-05T10:00:00Z"
    }
  ],
  "globalSettings": {
    "defaultSyncInterval": 2,
    "baseStoragePath": "D:/GitNote/repos"
  }
}
2. 添加仓库流程
用户点击“添加仓库” → 弹出对话框，输入：

仓库 URL（支持 HTTPS 或 SSH，或者 用户名/仓库名 格式）

可选：本地存放子目录名（默认使用仓库名）

是否自动同步（默认开启）

点击确认后：

检查 token 权限（需要 repo 作用域）

如果远程仓库不存在，调用 GitHub API 创建私有仓库

使用 simple-git 克隆到 localPath

将仓库配置保存到 repos 数组，并设为当前仓库

3. 切换仓库
用户从下拉框选择另一个仓库 → 更新 currentRepoId

前端 Pinia store 中的 currentRepo 改变 → 重新加载文件树，清空编辑器内容

同时，后台同步定时器需要重置：清除旧仓库的定时器，根据新仓库的 autoSync 设置启动新定时器（如果开启）

4. Git 操作改造
原有的 git-handler.js 中所有函数（commit, push, pull, clone, status 等）都需要增加一个参数 repoPath，以便对指定仓库执行操作。

5. 仓库删除
从配置中移除仓库条目

不删除本地文件夹（提示用户手动删除）

如果删除的是当前仓库，自动切换到第一个仓库（或显示空状态，提示添加仓库）

6. 界面布局建议
左侧边栏顶部：[仓库: 我的笔记 ▼] [+]

点击 [+] 打开仓库管理对话框

左侧边栏其余部分：文件树

右侧：Markdown 编辑器

顶部菜单栏或底部状态栏显示当前仓库的同步状态（上次同步时间、是否同步中）

输出要求
完整性：所有代码必须完整、可直接复制保存。

README 内容：

如何注册 GitHub OAuth App 并填入 client_id / client_secret。

开发环境要求（Node.js >= 18）。

安装依赖、运行开发模式、打包成 exe 的完整命令。

首次使用时的操作步骤（登录 → 添加仓库 → 开始写笔记）。

打包配置：electron-builder 配置生成 Windows 安装程序（NSIS）或便携版。

测试：提供单元测试示例（至少覆盖仓库添加、切换、删除的逻辑）。

特别注意事项
多仓库并发同步：建议只对当前激活的仓库进行自动同步（节省资源），但每个仓库可以独立配置是否允许后台同步。更高级的实现可以允许多仓库同时同步，但复杂度较高，本版本只要求当前仓库自动同步。

路径兼容性：Windows 路径使用 \\ 或 path.join，确保跨平台。

OAuth 回调：仍然使用 http://localhost 拦截方式。

Token 作用域：需要 repo 和 user 权限（用于获取用户信息、创建仓库）。

开始生成
请按照上述所有要求，输出完整的项目代码和文档。确保最终用户能够通过 npm install 和 npm run dist 生成可运行的 .exe 文件，并能够添加多个 GitHub 仓库、切换仓库、正常写笔记和同步。

text

---

你可以将上面的提示词复制并发送给 AI，它将会生成一个完整的、支持多仓库管理的 GitNote 项目。生成后，按照 README 配置 OAuth 并打包即可。

如果你希望我直接在你现有的 `d:\html\Git_Note` 基础上增量修改（添加多仓库功能），也可以告诉我，我会输出需要修改/新增的文件代码。

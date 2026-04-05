# 角色设定
你是一位经验丰富的全栈开发者，擅长 Electron、Vue 3、Node.js 和 Git 操作。你需要按照下面的需求，**完整实现一个可运行的桌面笔记工具**，并交付所有源代码、配置文件和详细的运行/打包说明。你的输出必须是一个完整的、解压即用的项目文件夹结构，用户无需额外编写任何代码即可运行。

# 项目名称
GitNote – 基于 GitHub 仓库的智能笔记工具

# 项目描述
开发一个跨平台（Windows / macOS / Linux）桌面应用，核心功能：
- 用户通过 GitHub Personal Access Token 授权，关联一个 GitHub 仓库（可以是已有仓库或新建仓库）。
- 应用自动将该仓库克隆到本地指定目录（如 `~/GitNote/repos/仓库名`）。
- 左侧显示仓库中的文件树（仅显示 `.md` 和 `.txt` 文件，支持嵌套文件夹）。
- 右侧是一个 Markdown 编辑器（支持实时预览、语法高亮）。
- 编辑笔记后，**自动保存到本地文件**（防抖 1 秒），并且**定时自动 commit + push 到 GitHub**（默认每 3 分钟一次，可配置）。
- 启动应用时自动 `git pull` 拉取最新内容。
- 当远程和本地同时修改同一文件导致冲突时，弹出简单选择框（“使用本地版本”、“使用远程版本”或“手动合并”），手动合并时提供左右对比视图。
- 支持查看任意笔记的版本历史（调用 GitHub API 获取该文件的 commit 列表，并支持预览历史内容）。
- 支持在笔记中粘贴/拖入图片，图片自动保存到仓库的 `assets` 文件夹，并插入相对路径 `![](assets/图片名.png)`。
- 所有 Git 操作对用户完全透明，用户不需要了解 `git add/commit/push/pull` 命令。

# 技术栈要求
- **前端框架**：Vue 3 (Composition API) + Vite
- **桌面框架**：Electron (使用 `electron-builder` 打包)
- **Git 操作**：`simple-git` 库
- **Markdown 编辑器**：`md-editor-v3` 或 `v-md-editor`，支持实时预览
- **文件树**：自定义 Vue 组件，递归展示目录结构
- **配置存储**：`electron-store`（保存 token、仓库列表、自动同步间隔等）
- **GitHub API 调用**：`@octokit/rest`（用于获取文件的 commit 历史）
- **图片处理**：`electron` 原生剪贴板读取 + `fs` 写入文件

# 项目结构要求
请生成以下完整的目录结构及每个文件的内容：

```
GitNote/
├── package.json
├── electron.vite.config.js          # 或 vite.config.js + electron main 入口
├── src/
│   ├── main/                         # Electron 主进程
│   │   ├── index.js
│   │   ├── preload.js
│   │   └── git-handler.js            # 封装所有 Git 操作
│   ├── renderer/                     # Vue 前端
│   │   ├── index.html
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── components/
│   │   │   ├── FileTree.vue
│   │   │   ├── MarkdownEditor.vue
│   │   │   ├── Settings.vue
│   │   │   └── ConflictResolver.vue
│   │   ├── stores/                   # Pinia 状态管理
│   │   │   └── repo.js
│   │   └── assets/
│   └── shared/                       # 主进程和渲染进程共享的常量/工具
├── resources/                        # 应用图标等
├── tests/                            # 单元测试和集成测试
│   ├── unit/
│   └── integration/
└── README.md                         # 包含完整的运行、打包、配置说明
```

# 功能实现细节要求
1. **首次启动引导**：让用户输入 GitHub Token、仓库地址（格式 `用户名/仓库名` 或完整 URL），以及本地存储路径。如果仓库不存在，则自动创建（通过 GitHub API）。
2. **文件树**：支持右键菜单新建文件/文件夹、重命名、删除。所有变更自动 commit + push。
3. **自动同步逻辑**：
   - 本地文件修改后，防抖保存（更新本地文件）。
   - 定时器执行：`git add -A` → `git commit -m "Auto sync at {时间}"` → `git push`。
   - 如果 push 失败（远程有新提交），则先 `git pull --rebase`，若 rebase 失败则进入冲突处理。
4. **冲突处理**：弹出独立窗口，显示左右两栏 diff（本地版本 vs 远程版本），用户选择保留哪一方的行，或整体替换。
5. **版本历史**：右键点击文件 → “历史版本”，调用 GitHub API 获取该文件的 commits，展示列表，点击某个 commit 可显示该版本的内容（通过 raw 链接或 API），并提供“恢复到此版本”按钮（生成新的 commit 覆盖当前文件）。
6. **图片粘贴**：监听编辑器粘贴事件，如果剪贴板中有图片，则弹窗让用户输入文件名（或自动生成时间戳文件名），保存到当前笔记所在目录的相对路径 `../assets/` 或 `assets/`（与笔记同级），然后插入 `![](assets/文件名.png)`。
7. **设置界面**：可修改自动同步间隔（分钟）、本地仓库存储根目录、切换 GitHub 账号/仓库。

# 测试要求
- 提供单元测试示例（至少测试 `git-handler.js` 中的 commit 和 push 方法，使用 mock）。
- 提供集成测试示例（使用 Spectron 或 Playwright 测试主流程：克隆仓库、编辑文件、自动同步）。
- 测试命令：`npm run test:unit` 和 `npm run test:integration`。

# 交付物清单
请依次输出以下内容，每个文件的内容用代码块包裹并标注文件路径：

1. `package.json`（包含所有依赖和脚本）
2. Electron 主进程入口 `src/main/index.js`
3. 预加载脚本 `src/main/preload.js`
4. Git 操作封装 `src/main/git-handler.js`
5. Vue 渲染进程入口 `src/renderer/main.js` 和 `index.html`
6. 根组件 `src/renderer/App.vue`
7. 主要组件：`FileTree.vue`、`MarkdownEditor.vue`、`Settings.vue`、`ConflictResolver.vue`
8. Pinia store `src/renderer/stores/repo.js`
9. 配置文件 `electron.vite.config.js`（或 `vite.config.js` + 额外 electron 入口配置）
10. 单元测试文件 `tests/unit/git-handler.spec.js`
11. 集成测试文件 `tests/integration/full-flow.spec.js`
12. `README.md`（包含：环境要求、安装依赖、开发运行、打包命令、首次配置步骤）

# 输出格式要求
- 所有代码必须是完整的、可以直接复制保存的。
- 确保所有依赖版本是最新的稳定版（在 `package.json` 中写明）。
- 提供清晰的注释，尤其是在 Git 操作和冲突处理部分。
- 最后，请额外给出一个“用户使用说明”小节，解释最终用户如何获取 Token、如何配置仓库。

# 开始执行
现在，请按照上述所有要求，输出完整的项目代码和文档。
# GitNote

GitNote 是一个基于 Electron + Vue 3 的桌面 Markdown 笔记工具，支持：

- 本地离线笔记
- GitHub OAuth 登录
- 登录后自动创建或复用单一私有同步仓库
- Markdown 编辑与预览
- 文件树管理
- 自动同步、历史版本、冲突处理

当前产品方向已经收敛为：

- 每个 GitHub 用户只使用一个同步仓库
- 登录后自动检查并创建统一仓库
- 仓库名固定为 `gitnote-notes-${GitHub 用户名}`

这样其他人下载项目后，不需要理解多仓库管理，直接按说明配置自己的 GitHub OAuth 即可运行。

## 技术栈

- Electron
- Vue 3
- Vite
- Pinia
- md-editor-v3
- simple-git
- axios
- @octokit/rest
- electron-store
- electron-builder

## 环境要求

- Node.js `>= 18`
- npm `>= 9`
- 本机已安装 Git，并且 `git` 在 `PATH` 中可用
- Windows 环境下可打包 `.exe`

## 项目目录

关键文件如下：

- [package.json](/d:/html/Git_Note/package.json)
- [electron.vite.config.js](/d:/html/Git_Note/electron.vite.config.js)
- [index.js](/d:/html/Git_Note/src/main/index.js)
- [oauth.js](/d:/html/Git_Note/src/main/oauth.js)
- [git-handler.js](/d:/html/Git_Note/src/main/git-handler.js)
- [store-manager.js](/d:/html/Git_Note/src/main/store-manager.js)
- [App.vue](/d:/html/Git_Note/src/renderer/App.vue)

## GitHub OAuth 配置说明

不要把真实的 `Client Secret` 直接提交到仓库。

GitNote 现在支持两种配置方式：

1. 开发模式：使用项目根目录的 `.env`
2. 打包后的 exe：使用程序同目录下的 `gitnote.oauth.json`

### 1. 创建 GitHub OAuth App

打开：

`GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App`

建议填写：

- Application name: `GitNote`
- Homepage URL: `http://127.0.0.1:3000`
- Authorization callback URL: `http://127.0.0.1:3000/callback`

注意：

- 回调地址必须和 [constants.js](/d:/html/Git_Note/src/shared/constants.js) 中的 `DEFAULT_CALLBACK_URL` 保持一致
- 当前项目默认使用 `http://127.0.0.1:3000/callback`

创建后会得到：

- `Client ID`
- `Client Secret`

## 开发模式使用教程

### 第一步：安装依赖

```bash
npm install
```

### 第二步：创建本地配置

复制示例文件：

```bash
copy .env.example .env
```

然后编辑项目根目录下的 `.env`：

```env
GITNOTE_GITHUB_CLIENT_ID=你的_GitHub_Client_ID
GITNOTE_GITHUB_CLIENT_SECRET=你的_GitHub_Client_Secret
```

说明：

- `.env` 已被 `.gitignore` 忽略，不会被提交到远程仓库
- 其他开发者下载项目后，也只需要各自创建自己的 `.env`

### 第三步：启动开发模式

```bash
npm run dev
```

## 打包后的 exe 使用教程

如果你已经拿到了打包好的 `GitNote.exe`，不需要 Node.js 也可以运行，但仍然需要先配置 OAuth。

### 第一步：找到 exe 所在目录

例如：

`release/win-unpacked/`

### 第二步：复制示例配置文件

将 [gitnote.oauth.example.json](/d:/html/Git_Note/gitnote.oauth.example.json) 复制并重命名为：

`gitnote.oauth.json`

把它放到 `GitNote.exe` 同目录。

内容改成：

```json
{
  "clientId": "你的_GitHub_Client_ID",
  "clientSecret": "你的_GitHub_Client_Secret"
}
```

### 第三步：运行 exe

直接双击：

`GitNote.exe`

说明：

- `gitnote.oauth.json` 已被 `.gitignore` 忽略，不会被提交
- 这适合别人下载源码后自行打包，或者直接拿到你的 `win-unpacked` 版本后运行

## 首次使用流程

### 仅本地使用

1. 启动应用
2. 点击“仅本地使用”
3. 创建、编辑、删除本地 Markdown 笔记
4. 所有数据保存在 Electron 的本地用户目录中

### 使用 GitHub 同步

1. 启动应用
2. 点击“使用 GitHub 登录”
3. 浏览器授权 GitHub OAuth
4. 应用自动检查当前账号下是否已有：

`gitnote-notes-${你的 GitHub 用户名}`

5. 如果没有，则自动创建为私有仓库
6. 如果已经存在，则直接复用
7. 仓库会被自动克隆到本地
8. 后续笔记编辑会按设定自动同步

## 运行命令

### 开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 单元测试

```bash
npm run test:unit
```

### 打包 Windows 可执行文件

```bash
npm run dist
```

打包产物位于：

- `release/`
- `release/win-unpacked/`

## 当前同步逻辑

登录后，GitNote 使用统一私有仓库同步笔记：

1. `git add -A`
2. `git commit`
3. `git push`

如果远端有新提交导致 push 失败：

1. 自动执行 `git pull --rebase`
2. 如果有冲突，则弹出冲突处理界面

## 本地模式与同步模式

### 本地模式

- 数据保存在本地目录
- 不依赖 GitHub
- 可完全离线使用

### GitHub 同步模式

- 登录后自动接管统一私有仓库
- 所有笔记保存到该仓库工作目录
- 支持手动同步和自动同步

## 安全说明

这个项目是 Electron 客户端应用。

因此需要明确一点：

- 不要把真实 `Client Secret` 写死进源码再提交到 GitHub
- 不要把真实 `.env` 或 `gitnote.oauth.json` 上传到仓库
- 每个使用者都应该使用自己的 GitHub OAuth App 配置

仓库中已经忽略了以下文件：

- `.env`
- `gitnote.oauth.json`
- `prompt*.md`

## 测试状态

当前已覆盖的测试文件：

- [git-handler.spec.js](/d:/html/Git_Note/tests/unit/git-handler.spec.js)
- [repo-manager.spec.js](/d:/html/Git_Note/tests/unit/repo-manager.spec.js)

运行：

```bash
npm run test:unit
```

## 已知说明

- 如果网络无法访问 GitHub，OAuth、clone、push、打包下载依赖都可能失败
- `npm run dist` 在网络不稳定时，`electron-builder` 可能卡在下载签名工具
- 如果只想直接运行，优先使用 `release/win-unpacked/GitNote.exe`

## 对其他开发者的建议

如果你准备把这个项目上传到 Git 仓库，推荐保持以下规则：

1. 只提交 `.env.example` 和 `gitnote.oauth.example.json`
2. 不要提交真实 `.env`
3. 不要提交真实 `gitnote.oauth.json`
4. 不要把 OAuth 密钥硬编码到 [oauth.js](/d:/html/Git_Note/src/main/oauth.js)

这样其他人下载下来后，按照本 README 配置即可直接运行。 

# 主进程模块（src/main）

## 入口 `src/main/index.ts`

启动顺序与关键副作用：

1. `app.setName('Codev Studio')`；
2. **Wayland/fcitx5 IME flags**（Linux）：`UseOzonePlatform`、`ozone-platform-hint=auto`、
   `enable-wayland-ime`、`wayland-text-input-version=3`，并兜底 `GTK_IM_MODULE=fcitx`。
   **必须在任何 BrowserWindow 创建之前**，新增此类开关放这里；用户也可在
   `~/.config/electron-flags.conf` 覆盖；
3. `nativeTheme.themeSource = 'dark'`（原生 UI 暗色）；
4. **single-instance lock**：`requestSingleInstanceLock()`；`second-instance` 里
   `--new-window` → `createWindow()`，否则聚焦已有窗口；
5. 全局错误钩子：`uncaughtException` / `unhandledRejection` /
   `render-process-gone`（崩溃弹窗选 Reload/Quit）/ `child-process-gone`；
6. `createWindow()`：`titleBarStyle: 'hiddenInset'`、`backgroundColor: '#09090b'`、
   preload 路径、`setWindowOpenHandler`/`will-navigate` 只放行 http(s) 到外部浏览器、
   注册 `handleBeforeInput`（**Ctrl+Alt+1..9 切项目**，`switch-project-N`）；
7. `whenReady`：清理孤儿 PTY、压缩统计、权限 handler（仅放行 media）、建窗、装原生菜单、
   初始化自动更新（打包版 5 秒后检查）；
8. 退出清理（`window-all-closed` / `before-quit`）：`killAll()`、停 watcher、
   flush activity/token-usage。

窗口集合：`windows: Set<BrowserWindow>`；`activeWebContents()` 返回聚焦窗口（无聚焦取最后创建的）。

## 原生菜单 vs React 菜单栏

- `buildMenu()` 构建**完整原生菜单**，仅用于**快捷键（accelerators）和 Alt 临时显示**；
  `hideNativeMenuBar()`（`ipc/ui.ts`）让它在所有窗口 auto-hide；
- 实际 UI 是 React 的 `MenuBar.tsx`（继承应用主题），动作经 `menu:trigger` 分发。
  详见 [windows-menu.md](../modules/windows-menu.md)。

## ipc/ 处理器（每域一文件，配套 .test.ts）

`projects` `filesystem` `terminal` `clipboard` `git` `codev-config` `codev-explain`
`codev-sessions` `skills` `mcp` `updater` `activity` `token-usage` `dev-servers`
`ts-project` `ui`。统一用 `safe-handle.ts` 包裹。

## services/（无 UI 逻辑）

| 服务 | 职责 |
| --- | --- |
| `pty-manager` | node-pty 生命周期；`killAll` / `killOrphanedPtys`（进程退出后清理残留 PTY，注意 procps-ng 4.x 兼容） |
| `terminal-scrollback` | 终端输出滚动缓冲，上限 4 MB 防爆内存 |
| `git-service` | 执行 git 命令、解析输出（status/diff/log…） |
| `git-fetch-service` | 定时 fetch（`registerFetch`），暂停/恢复 |
| `git-refs-watcher` | 监听 refs 变化，变更时推 `git:refs-changed` |
| `file-watcher` | chokidar 监听目录树，推 `fs:tree-changed` / `fs:file-changed` |
| `fs-scan-utils` | 目录树扫描（读 .gitignore、大小上限、并发控制） |
| `clipboard-watcher` | 剪贴板图片监听，推 `clipboard:image` |
| `auto-updater` | electron-updater 封装；**404 必须广播 `not-available`**（否则渲染进程卡 "Checking…"） |
| `activity-service` | 活跃度聚合 + 压缩/flush |
| `token-usage-service` | token 统计 + 压缩/flush |
| `transcript-usage-service` | 从 Codev transcript 读 token 用量 |
| `dev-server-scanner` | 扫本地监听端口 |
| `ts-project-scanner` | 扫 TS 项目文件哈希喂给 Monaco worker |
| `project-roots` | 项目根路径解析 |
| `language-map` | 扩展名 → 语言 |
| `window-broadcast` | 多窗口事件广播工具 |

## 测试约定

- 每域 `.test.ts` 用 `ipc-test-utils.ts` 模拟 ipcMain，直接调 handler 逻辑；
- 服务测试覆盖边界：PTY 生命周期、git 输出解析、滚动缓冲截断、更新 404 等。

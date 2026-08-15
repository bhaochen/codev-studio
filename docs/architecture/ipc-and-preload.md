# IPC 与 preload

## 总原则

渲染进程**永远不直接**碰 `ipcRenderer`/`ipcMain`，一切通过 preload 里
`window.api` 的类型化对象（`src/preload/index.ts`）。改接口 = 改三处：

1. `src/main/ipc/<domain>.ts` 用 `safeHandle('<domain>:<action>', handler)` 注册；
2. `src/preload/index.ts` 在 `api.<domain>` 下加类型化方法；
3. 渲染进程调用 `window.api.<domain>.<method>()`。

## 通道清单（按域）

| 域 | 主要通道 | 说明 |
| --- | --- | --- |
| `projects` | `list` `listArchived` `add` `remove` `unarchive` `deleteArchived` `reorder` | 项目 CRUD + 排序 |
| `codev` | `home-path` `scan-files` `read-file` `write-file` `delete-file` `explain-diff` | 读写项目文件、AI 解释 diff |
| `codev-sessions` | `list` | Codev CLI 会话历史 |
| `fs` | `read-tree` `read-file` `write-file` `delete-file` `create-file` `create-folder` `rename` `duplicate` `search` `show-in-folder` `open-folder` `pick-folder` `copy-path` `watch` `unwatch` | 文件系统 + 目录树监听（`fs:tree-changed`、`fs:file-changed` 事件） |
| `terminal` | `create` `write` `resize` `kill` `has` `paste-image` `paste-clipboard-image`（`terminal:data`、`terminal:exit` 事件） | PTY 终端 |
| `clipboard` | `current-image` `write-text` `read-text`（`clipboard:image` 事件） | 剪贴板 + 图片监听 |
| `git` | `status` `commits` `branches` `checkout` `commit-all` `commit-paths` `pull` `push` `rebase-remote` `diff-numstat` `file-at-head` `revert-file` `conflicts` `first-changed-line` `commits-since` `user-email` `language-tally` `ignore-path` `gitignore-list` `register-fetch` `watch-refs` 等（`git:refs-changed`、`git:drift` 事件） | 全部 git 操作 |
| `codev-config` | 读取/写入 Codev 配置 | |
| `codev-explain` | `explain-diff` 相关 | |
| `skills` | `search` `top` `list` `install` `uninstall`（`skills:output` 事件） | 技能市场 |
| `mcp` | `list` `upsert` `remove` `set-enabled` `login` `logout` `status` | MCP 服务器管理 |
| `activity` | `record` `sessions` `all-sessions` | 活跃度统计 |
| `token-usage` | `record` `reset-tab` `context` `daily` `events` | token 用量 |
| `dev-servers` | `list` `kill` `open` | 本地开发服务器扫描 |
| `tsproject` | `scan` | TS 项目扫描（喂给 Monaco worker） |
| `updater` | `check` `install` `get-status`（`updater:status` 事件） | 自动更新 |
| `ui` | `menu-bar-visible` `set-menu-bar-visible` | 菜单栏可见性设置 |
| `menu` | `trigger` | 菜单动作统一入口（见下） |

## 菜单动作管线（重点）

自定义 React 菜单栏（`src/renderer/components/layout/MenuBar.tsx`）和原生菜单
（`src/main/index.ts` 的 `buildMenu()`）都不直接执行逻辑，只发动作字符串：

```
菜单项 action 字符串
   │
   ├─ "native:*" ──→ menu:trigger → 主进程 handleNativeAction（wc.undo()、wc.reload()、setZoomLevel…）
   │
   └─ 其他 ──→ menu:trigger → 主进程向聚焦窗口 webContents.send('menu:action', action)
                          → 渲染进程 App.tsx onMenuAction switch 分发
```

- `native:*` 角色清单在 `src/main/ipc/ui.ts` 的 `handleNativeAction`：undo / redo / cut /
  copy / paste / select-all / reload / force-reload / devtools / zoom-in / zoom-out /
  zoom-reset / fullscreen / minimize / maximize / quit / check-updates。
- 渲染进程侧动作在 `App.tsx` 的 `onMenuAction`：new-project、save-file、center-tab-*、
  toggle-variant、open-palette、git-pull-rebase、terminal-tab-*、switch-project-1..9 等。
- 追加菜单动作 = 往 `buildMenu()`/`MENUS` 加一项 + 在 `App.tsx` 加 case（native 的加
  `handleNativeAction` case）。

## 新增 IPC 的完整步骤

1. 在 `src/main/ipc/<domain>.ts`（或新文件）用 `safeHandle` 注册通道，逻辑放到
   `services/` 便于测试；
2. `src/preload/index.ts` 在 `api` 下加方法（`ipcRenderer.invoke`），事件用
   `ipcRenderer.on` 包成返回退订函数的 `onXxx(callback)`；
3. 渲染进程调用；若涉及菜单，走菜单管线；
4. 补测试（主进程 handler 用 `src/main/ipc/ipc-test-utils.ts`）。

# 总体架构

## 进程结构

Electron 标准三进程模型，electron-vite 管理三份构建：

```
src/
├── main/          # 主进程（Node）→ 编译产物 out/main/index.js
│   ├── index.ts   # 入口：生命周期、窗口、菜单、启动/退出清理
│   ├── ipc/       # ipcMain.handle 处理器，按功能域一个文件 + 对应 .test.ts
│   ├── services/  # 无 UI 的服务：PTY、git、文件监听、token 统计、自动更新等
│   └── models/    # 主进程类型
├── preload/       # 预加载脚本 → out/preload/index.js
│   └── index.ts   # contextBridge 暴露 window.api（IPC 唯一出口）
└── renderer/      # React 渲染进程 → out/renderer/
    ├── components/  # 按功能分目录：terminal/ editor/ git/ settings/ layout/ …
    ├── stores/      # zustand stores（+ 测试）
    ├── services/    # monaco-project-loader、annotation-runner、tour-runner
    ├── config/      # 静态注册表：主题、终端主题、LLM provider、权限预设等
    ├── lib/         # 纯函数工具（终端文本、会话、权限、声音等）
    ├── hooks/       # useDiffEditorModels、useQueueRunner、useTokenVelocity 等
    ├── models/      # 渲染进程类型
    ├── styles/themes/  # 34 个主题 CSS
    └── types/       # 第三方补丁类型（如 mammoth.d.ts）
```

路径别名：主进程用 `@main/*`；渲染进程用 `@/*`（tsconfig 只声明 `@/*`，
`@main/*` 在 electron.vite.config.ts 中给 main 构建声明）。

## 数据流

```
渲染进程组件/store
      │  window.api.<domain>.<method>(args)          ← preload 的类型化方法
      ▼
src/preload/index.ts   (contextBridge.exposeInMainWorld('api', api))
      │  ipcRenderer.invoke(channel, args)
      ▼
src/main/ipc/<domain>.ts   (ipcMain.handle，统一经 safeHandle 包裹)
      │
      ▼
src/main/services/*.ts     (真正干活：pty、git、文件、统计…)
      │
      ▼ 需要推送回渲染进程时
src/main/ipc/<domain>.ts   webContents.send / window-broadcast
      │  ipcRenderer.on(channel, handler)  ← preload 里注册为 onXxx(callback)
      ▼
渲染进程组件/store 订阅
```

- 所有 `ipcMain.handle` 必须经过 `safeHandle`（`src/main/ipc/safe-handle.ts`），
  统一 catch 并打印 `[ipc:<channel>]` 日志后再 rethrow。
- 通道命名：`<domain>:<action>`（如 `fs:read-tree`、`git:status`、`terminal:create`）。
- 事件推送用 `webContents.send` 或 `window-broadcast`（多窗口广播）。

## 状态管理

渲染进程用 zustand，按领域一个 store（见
[state-and-stores.md](state-and-stores.md)）。全局动作（菜单、快捷键）最终收敛到
`src/renderer/App.tsx` 的 `onMenuAction` switch 分发。

## 启动顺序（主进程）

见 [modules/main-process.md](../modules/main-process.md)。

## 测试

- vitest，53 个测试文件、650 个测试，主要覆盖主进程 ipc/services 与渲染进程 stores/lib。
- 运行：`npm test`（CI 前先跑 `npx tsc --noEmit -p tsconfig.json`）。

## 构建与发布

见 [modules/updates-releases.md](../modules/updates-releases.md)。

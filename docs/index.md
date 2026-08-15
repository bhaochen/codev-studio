# Codev Studio — 项目文档

> 本文档面向 AI/LLM 读者，目标是让模型在几分钟内建立项目的准确心智模型，
> 并在动手改代码前知道该读哪些文件、遵守哪些约定。
> 所有路径均为仓库根目录的相对路径。

## 项目速览

- **是什么**：Electron 桌面应用「Codev Studio」，一个 vibe coding 环境 —— 终端（运行 Codev CLI）、
  Monaco 编辑器、Git 面板整合在同一个窗口里。
- **远端仓库**：`github.com/bhaochen/codev-studio`（默认分支 `main`）。
- **技术栈**：Electron 34 · React 18 · TypeScript 5.7 · electron-vite 3 · zustand 5 ·
  tailwindcss 4 · node-pty · xterm 5 · Monaco · vitest 4。
- **打包**：electron-builder 26，Linux 产出 AppImage + deb，GitHub Releases 自动更新。

## 文档地图

| 路径 | 内容 |
| --- | --- |
| [architecture/overview.md](architecture/overview.md) | 总体架构、目录布局、数据流、约定（先读这个） |
| [architecture/ipc-and-preload.md](architecture/ipc-and-preload.md) | IPC 通道清单、菜单动作管线、如何新增 IPC |
| [architecture/theming.md](architecture/theming.md) | 34 个主题的覆盖机制、选 zinc 类的规则、custom 主题 |
| [architecture/state-and-stores.md](architecture/state-and-stores.md) | zustand stores 清单、动作分发中枢 |
| [modules/main-process.md](modules/main-process.md) | 主进程生命周期、ipc/ 与 services/ 模块清单 |
| [modules/terminal.md](modules/terminal.md) | 终端子系统：node-pty、codev vs shell 终端 |
| [modules/git.md](modules/git.md) | Git 子系统：服务、自动刷新、drift |
| [modules/editor.md](modules/editor.md) | 编辑器：Monaco、markdown 预览、diff/Explain |
| [modules/windows-menu.md](modules/windows-menu.md) | 多窗口、菜单栏（React + 原生混合）、Arch 桌面启动器 |
| [modules/updates-releases.md](modules/updates-releases.md) | 自动更新、打包发布流程、文件名陷阱 |
| [devlog/](../devlog/) | 开发日志（按日期持续追加） |

## 给 LLM 的关键约定（违反会踩坑）

1. **路径别名**：`@main/*` → `src/main/*`（主进程）；`@/*` → `src/renderer/*`（渲染进程）。
   tsconfig 只有 `@/*`，`@main/*` 由 electron.vite.config.ts 提供。
2. **IPC 是唯一的进程桥梁**：渲染进程不能直接 import 主进程代码，一切通过
   `window.api`（preload 暴露）。新增通道要改三处：`src/main/ipc/*.ts` handler →
   `src/preload/index.ts` 类型化方法 → 渲染进程调用。见 [ipc-and-preload.md](architecture/ipc-and-preload.md)。
3. **UI 颜色必须用主题覆盖过的 zinc 类**：不是所有 `bg-zinc-*` 都被 34 个主题覆盖。
   安全选择：`bg-zinc-800`、`text-zinc-200`、`border-zinc-800`。不确定先查
   [theming.md](architecture/theming.md)。
4. **Linux/Wayland 特定代码在 `src/main/index.ts` 顶部**，`app` 就绪前设置
   （IME flags、`nativeTheme.themeSource`），新增此类配置要放在 `createWindow()` 之前。
5. **菜单动作管线**：菜单项只写字符串 action，经 `menu:trigger`（主进程）→
   `menu:action`（渲染进程）→ `App.tsx` 的 `onMenuAction` switch 分发。
   原生角色（undo/copy/reload…）用 `native:*` 前缀，主进程 `handleNativeAction` 处理。
6. **自动更新**：`latest-linux.yml` 里 AppImage 的 url 是**连字符**文件名
   `Codev-Studio-x.y.z.AppImage`，gh release 上传必须用同名无空格副本，否则更新 404。
7. **测试**：vitest，650 个测试分布在 `src/**/*.test.ts`。改动后跑 `npm test` 和
   `npx tsc --noEmit -p tsconfig.json`。

## 维护约定（给未来的写作者）

- **持续记录**：每个开发会话的产出在 `devlog/` 新建/追加一个 `YYYY-MM-DD-<主题>.md`，
  记录动机、关键决策、踩过的坑、验证方式。模板见现有条目。
- **文档即真相源**：改架构、加 IPC、动主题机制时，同步更新对应文档，不要只写 devlog。
- **保持精炼**：文档是给 LLM 的上下文，追求「读完就能改代码」，不写营销式描述。
- 测试、构建、发布、版本号等工程信息在 [modules/updates-releases.md](modules/updates-releases.md)。

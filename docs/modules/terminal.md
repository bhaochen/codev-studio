# 终端子系统

## 组件栈

- **主进程**：node-pty 创建 PTY，`src/main/services/pty-manager.ts` 管理生命周期
  （create/write/resize/kill），退出时 `killAll()` + `killOrphanedPtys()` 清理。
- **渲染进程**：xterm.js（`@xterm/xterm` + fit/search/unicode11/web-links 插件），
  `components/terminal/`。
- 传输：`terminal:create`（返回后建立 tabId 关联）、`terminal:data` 事件推送输出、
  `terminal:write` 回传输入、`terminal:exit` 通知进程退出。

## 两种终端

| 类型 | 判定 | 用途 |
| --- | --- | --- |
| **Codev 终端** | tab 带 `initialCommand`（启动命令，来自 `layout-store.getLlmStartupCommand()`） | 运行 Codev/Codex CLI 的 LLM 会话 |
| **Shell 终端** | 无 initialCommand | 普通 shell |

区分很重要：`git-commit`、`clear-context`、`restart-codev` 等菜单动作只对
Codev 终端生效（`App.tsx` 里 `activeLlmTab` 优先查找）。

## 状态与渲染

- `terminal-store`：`tabs[]`、`activeTabPerProject`；每项目一组 tab；
  `createTab(projectId, cwd, initialCommand?)`。
- 终端输出经 `lib/terminal-text.ts` / `lib/terminal-output-tidy.ts` 清理（ANSI 过滤、
  输出美化），`terminal-scrollback` 限制缓冲 4 MB。
- 快捷键 `Ctrl+Shift+]` / `Ctrl+Shift+[` 切换同项目 tab；`Ctrl+Shift+C/V` 复制/粘贴。

## 特殊能力

- **粘贴图片**：`terminal:paste-image` / `paste-clipboard-image`，把剪贴板/文件图片
  转成终端 iTerm2 inline 序列；剪贴板图片轮询由 `clipboard-store` + 主进程
  `clipboard-watcher` 协作。
- **IME**：Linux Wayland 上靠启动 flags（见 main-process.md）启用 fcitx5 组合输入；
  曾修复过 IME 组合期双输入（commit 1b4ea0a）。

## 用户偏好（重要）

用户对终端**渲染质感敏感**：字体栈优先 Nerd Font（`config` 中的终端字体配置）、
行距紧凑、prompt 样式要贴近系统终端。改终端渲染前先读
`lib/terminal-text.ts` 与终端字体相关配置，改完视觉验证。

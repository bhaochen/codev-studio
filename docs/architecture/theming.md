# 主题系统

## 文件结构

`src/renderer/styles/themes/` 下 34 个 CSS 文件：

- 16 个主题 × dark/light：`github` `material` `dracula` `nord` `monokai` `gruvbox`
  `synthwave` `cyberpunk` `tokyo-night` `catppuccin` `onedark-pro` `afternoon`
  `pastel` `tropical` `rainbow` `psychedelic`；
- `custom-dark.css` / `custom-light.css`：用户自绘主题（用 `--ct-*` CSS 变量）；
- `light-fallback.css`：浅色兜底。

## 覆盖机制

主题**不换 class，只覆盖 Tailwind 颜色类**。每个主题文件形如：

```css
:root.github-dark .bg-zinc-800 { background-color: #1f2429; }
:root.github-dark .text-zinc-200 { color: #d0d7de; }
```

渲染进程在 `App.tsx` 里把 `documentElement` 的 class 设为
`${themeName}-${variant}`（如 `github-dark`），Tailwind 的 zinc 类即被覆盖。
所以**代码里继续用 `bg-zinc-800`、`text-zinc-200` 这类类名，颜色自动跟随主题**。

## 选 zinc 类的铁律（踩过坑）

- 不是所有 `bg-zinc-*` 都被全部主题覆盖。**已确认安全**（全部主题覆盖）：
  `bg-zinc-800`、`bg-zinc-900`、`bg-zinc-900/80`、`text-zinc-200`、`text-zinc-300`、
  `text-zinc-500`、`border-zinc-800`。
- **`bg-zinc-700`（作为非 hover 的普通背景）没有被主题覆盖** —— UpdateBanner 曾用
  `bg-zinc-700 text-white` 导致深色主题下与底下的 `bg-zinc-800` 不同色，后改为
  `bg-zinc-800 text-zinc-200` 修复（commit 29fdf24）。
- 新增 UI 颜色前先 `grep` 某个主题文件确认该类被覆盖；hover 态（`hover:bg-zinc-800`）
  不算数，普通态也要能过。
- 强调色 / 高亮用 `useAccent()`（`src/renderer/components/settings/SettingsControls.tsx`），
  跟随当前主题的 accent 色。

## custom 主题

用户自绘主题写死 `--ct-*` 变量（`--ct-bg-primary`、`--ct-text-1`、`--ct-border-1` 等），
`App.tsx` 的 `applyCustomVars()` 把它们注入 `#ct-vars` style 标签，custom 主题 CSS
用 `var(--ct-*)` 引用。用户编辑实时生效（theme-store 的 customDark/customLight）。

## 终端主题

- 终端（xterm）不走 CSS 覆盖：`config/terminal-theme-registry.ts` 定义 16 个主题的
  终端配色，`TerminalInstance` 的 `applyThemeToAll()` 在主题切换时应用到所有终端。
- 主题注册表：`config/theme-registry.ts`（UI 主题元数据）。
- 编辑器（Monaco）：`config/monaco-theme-registry.ts`。

## 原生 UI

`src/main/index.ts` 顶部 `nativeTheme.themeSource = 'dark'`：强制原生控件（菜单、
上下文菜单）用暗色，与应用 zinc 暗色主题一致。必须在 `createWindow()` 前设置。

## 组件内应用主题的范例

`MenuBar.tsx` 与 `UpdateBanner.tsx` 只使用被全主题覆盖的 zinc 类 + `useAccent()`，
不引入任何主题分支 —— 新 UI 组件照此模式写。

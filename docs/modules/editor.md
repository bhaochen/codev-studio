# 编辑器子系统

## Monaco 编辑器

- `@monaco-editor/react`；`components/editor/` 下 Editor 组件 + `MonacoAnchor`（挂载点）。
- **项目加载**：`services/monaco-project-loader.ts` 把项目文件喂进 Monaco 的 TS worker
  （import 解析、跳转），项目切换有缓存（README 2026-07-12 优化点）。
- **TS 项目扫描**：主进程 `ts-project:scan` 返回文件哈希，配合 `ts-project-scanner`，
  只把变化文件喂给 worker。
- `editor-store`：每项目独立编辑状态（`statePerProject`），`saveFile`、`closeFile`。
- `editor-prefs-store`：minimap、字号、Tab 大小、自动保存、format-on-save、括号配对、
  tab 拖拽排序。

## 文件树

- `filetree-store` + `fs:read-tree`（主进程 `fs-scan-utils`：读 .gitignore、大小上限、
  并发控制，兼容大仓库/submodule）。
- 变化实时推送：`fs:watch` → `fs:tree-changed` / `fs:file-changed` 事件。
- 操作：新建/删除/重命名/复制/搜索/复制路径/在文件夹中显示。

## Markdown 预览（最近加入）

- `preview-mode-store` 切换编辑/预览模式；渲染管线 `marked` + **KaTeX**（LaTeX 数学，
  commit f11c575）+ `mammoth`（docx）+ `xlsx`（表格）。

## Diff / AI Explain

- `useDiffEditorModels`（hooks）+ `diff-view-store`：Monaco diff 模型，git diff 数据
  来自 `git:diff-numstat` / `git:file-at-head`。
- **AI 解释 diff**：`codev:explain-diff`（主进程 `codev-explain.ts`），返回
  按文件/行号组织的 AI 注释，`annotation-store` 展示在 diff 上。

## 全局搜索

- `GlobalSearchPanel` + `fs:search`（支持 per-project 排除目录，`search-prefs-store`）。

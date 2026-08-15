# 状态管理与动作分发

## zustand stores（src/renderer/stores/）

| Store | 职责 | 备注 |
| --- | --- | --- |
| `project-store` | 项目列表、active 项目、dashboard/statistics/usage 页面开关 | 大量菜单动作的落点 |
| `terminal-store` | 终端 tabs（每项目一组）、active tab、LLM 终端识别 | `activeTabPerProject` |
| `editor-store` | 每个项目一个编辑状态：打开文件、active 文件、保存 | `statePerProject` |
| `editor-prefs-store` | 编辑器偏好（minimap、字号、自动保存、format-on-save 等） | |
| `filetree-store` | 目录树 per project、showIgnored per project | 与 `fs:watch` 联动 |
| `git-store` | status、commits、branches、diff 统计、drift 检测 | 大量并发去重逻辑 |
| `theme-store` | themeName、variant、customDark/customLight | `getTerminalThemeId()` |
| `layout-store` | 布局、LLM provider、startup command | `getLlmStartupCommand()` |
| `updater-store` | 更新状态机（checking/downloading/downloaded…）、dismissed | |
| `clipboard-store` | 剪贴板图片轮询展示 | |
| `annotation-store` | diff 上的 AI 注释（Explain） | |
| `diff-view-store` | diff 视图状态 | |
| `stats-store` | 统计/活跃度数据 | |
| `dev-terminal-store` | 开发服务器相关终端 | |
| `queue-store` | 任务队列 | |
| `preview-mode-store` | 编辑器 markdown 预览模式 | |
| `search-prefs-store` | 全局搜索偏好 | |
| `permission-presets-store` | MCP/权限预设 | |
| `codev-store` | Codev 配置/命令相关 | |

## 动作分发中枢：App.tsx

`src/renderer/App.tsx` 是三件事的汇聚点：

1. **菜单/快捷键动作**：`onMenuAction` effect 订阅 `menu:action`，switch 分发到各
   store（new-project、save-file、center-tab-*、git-*、terminal-tab-*、
   switch-project-N…）。新增动作在这里加 case。
2. **主题应用**：把 `${themeName}-${variant}` 设到 `<html>` class、custom 主题注入
   `--ct-*`、同步终端主题。
3. **项目激活**：activeProjectId 变化时加载目录树、注册 fs watch / git refs watch、
   把项目喂给 Monaco，卸载时反注册。

## 渲染进程内的自定义事件

组件间解耦用 `window.dispatchEvent(new CustomEvent(...))`：

- `palette:open`（{ mode: 'all' | 'files' }）—— 命令面板；
- `menu-bar-visible-changed` —— 设置页 toggle 菜单栏后通知 MenuBar 刷新。

## 页面/面板结构

- `components/layout/AppLayoutGrid.tsx`：主布局（react-resizable-panels），
  UpdateBanner / ConflictBanner / MenuBar 在 App.tsx 里叠在顶部。
- 全局页面：dashboard / statistics / usage 由 project-store 控制；
  中心标签页：editor / codev / skills / terminals 由 editor-store 控制。

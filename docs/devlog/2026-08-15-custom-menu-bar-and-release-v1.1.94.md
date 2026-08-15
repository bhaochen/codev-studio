# 2026-08-15：自定义 React 菜单栏 + 发布 v1.1.94

> devlog 模板示例。约定：动机 → 决策 → 关键代码位置 → 踩坑 → 验证。

## 动机

原生 Electron 菜单栏依赖 GTK 渲染，与应用主题（zinc 暗色 + 34 个可切换主题）
不一致。用户要求：像 UpdateBanner 一样**不靠 GTK，在代码里实现菜单栏**，并继承
应用颜色主题。之前的菜单栏可见性设置（v1.1.93，commit 29fdf24）只控制原生菜单
显隐，本次彻底换成 React 实现。

## 决策

1. **纯 React 菜单栏**：`src/renderer/components/layout/MenuBar.tsx`，六组菜单
   File/Edit/View/Terminal/Git/Window，数据驱动（`MENUS` 数组），下拉面板。
   颜色只用被全部主题覆盖的 zinc 类 + `useAccent()`（见 architecture/theming.md）。
2. **原生菜单保留做保底**：`buildMenu()` 仍然构建，但 `hideNativeMenuBar()`
   （`setAutoHideMenuBar(true)` + `setMenuBarVisibility(false)`）全部隐藏；
   快捷键 accelerators 和 Alt 临时呼出仍由它承担 —— 快捷键功能零损失。
3. **动作管线**（新 IPC `menu:trigger`）：
   - `native:*` 前缀 → 主进程 `handleNativeAction`（`src/main/ipc/ui.ts`）直接对
     webContents 执行 undo/redo/cut/copy/paste/select-all/reload/zoom/fullscreen/
     minimize/maximize/devtools/check-updates；
   - 其他 action → 主进程转发 `menu:action` 给聚焦窗口 → `App.tsx` `onMenuAction`
     switch 分发（复用全部既有逻辑）。
4. **可见性**：设置页 `MenuBarSection.tsx` toggle，默认隐藏，持久化 electron-store
   `menuBarVisible`；切换时 dispatch `menu-bar-visible-changed` 让 MenuBar 即时刷新。
   原生菜单 auto-hide 意味着 Alt 仍可临时显示。

## 关键改动

- `src/renderer/components/layout/MenuBar.tsx`（新增）
- `src/main/ipc/ui.ts`：`handleNativeAction`、`menu:trigger`、`hideNativeMenuBar`
- `src/preload/index.ts`：`menu.trigger`、`settings.menuBarVisible/setMenuBarVisible`
- `src/main/index.ts`：`hideNativeMenuBar` 接入 createWindow
- `src/renderer/App.tsx`：渲染 `<MenuBar />`（UpdateBanner 上方）
- `src/renderer/components/settings/MenuBarSection.tsx`：dispatch 事件

commit `f4c2d5c` "Add custom React menu bar that inherits the app theme"。

## 踩坑

- 菜单项颜色：hover 用 `hover:bg-zinc-800`，但**普通态**也必须用被主题覆盖的类
  （`bg-zinc-800`、`text-zinc-200`），否则自定义主题下菜单颜色错乱。
- `bg-zinc-700`（UpdateBanner 曾用）未被子主题覆盖，已统一改 `bg-zinc-800`。

## 验证

- `npx tsc --noEmit -p tsconfig.json` 通过；
- `npm test`：53 files / 650 tests 全绿；
- `npm run build:linux` 产出 AppImage + deb。

## 发布 v1.1.94

- bump 1.1.93 → 1.1.94（commit 4f84266）→ 重新 build → tag `v1.1.94` push →
  `gh release create` → 上传资产。
- **文件名陷阱**：AppImage 构建名带空格 `Codev Studio-1.1.94.AppImage`，
  gh 上传会转成点号，与 latest-linux.yml 的 url `Codev-Studio-1.1.94.AppImage`
  不匹配 → 更新 404。解决：复制无空格副本再传。流程固化在
  modules/updates-releases.md。
- release：https://github.com/bhaochen/codev-studio/releases/tag/v1.1.94

## 本日其他背景

- v1.1.93（6a798a9）：多窗口（--new-window）+ 修复更新检查卡死（404 广播
  not-available）；
- v1.1.93（29fdf24）：菜单栏可见性设置 + `nativeTheme.themeSource='dark'` +
  UpdateBanner 主题化。

## 本日早段：Arch 桌面启动器配置（v1.1.93 多窗口的配套）

让应用在 fuzzel 启动器里显示并可启动、带"新空窗口"动作：

1. `npm run build:linux` 打包 → 产物 `dist/linux-unpacked/` 与 AppImage；
2. 写 `~/.local/share/applications/codev-studio.desktop`：`Exec` 指向
   `dist/linux-unpacked/codev-studio` 并手动带上 Wayland/IME flags
   （`--enable-features=UseOzonePlatform --ozone-platform-hint=auto
   --enable-wayland-ime --wayland-text-input-version=3`）—— 这些 flags 平时由
   dev 脚本注入，直接启动二进制必须手带；
3. `Actions=new-window` + `[Desktop Action new-window]`（Exec 追加
   `--new-window`）实现"新空窗口"；主进程 single-instance lock 的
   `second-instance` 处理该参数；
4. fuzzel 的 `~/.config/fuzzel/fuzzel.ini` 加 `show-actions=yes`，动作才会
   平铺显示出来（fuzzel 的 actions 不是子菜单，是独立条目）；
5. 验证：启动器能搜到 Codev Studio，主图标启动、小图标"新空窗口"另开窗口。

完整 .desktop 内容与要点见 modules/windows-menu.md「Arch Linux 桌面启动器」。

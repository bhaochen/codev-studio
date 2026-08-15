# 窗口与菜单

## 多窗口

- **single-instance lock**：`src/main/index.ts` 顶层 `requestSingleInstanceLock()`，
  第二次启动把 argv 转发给 `second-instance`：
  - 带 `--new-window` → `createWindow()` 新开窗口（桌面 .desktop `Actions=`
    New Empty Window 用，仿 VS Code）；
  - 普通启动 → 聚焦已有窗口。
- `windows: Set<BrowserWindow>`，关闭时从集合删除；`activeWebContents()` 取聚焦窗口
  （无聚焦取最后创建的），菜单/全局动作都发给它。
- `.desktop` 文件在用户机器 `~/.local/share/applications/codev-studio.desktop`
  （fuzzel 需 `show-actions=yes` 才显示动作）。

## Arch Linux 桌面启动器（2026-08-15 实现）

目标：让应用出现在 Arch 的应用启动器（fuzzel）里并能直接启动，还要有
"新空窗口"动作（仿 VS Code）。用户机器上的完整配置：

```ini
# ~/.local/share/applications/codev-studio.desktop
[Desktop Entry]
Type=Application
Name=Codev Studio
Comment=Desktop vibe coding environment
Exec=/home/yuki/Code/Agent/codev-studio/dist/linux-unpacked/codev-studio --enable-features=UseOzonePlatform --ozone-platform-hint=auto --enable-wayland-ime --wayland-text-input-version=3
Icon=/home/yuki/Code/Agent/codev-studio/resources/icon.png
Categories=Development;
Terminal=false
StartupWMClass=Codev Studio
Actions=new-window;

[Desktop Action new-window]
Name=New Empty Window
Name[zh_CN]=新空窗口
Exec=/home/yuki/Code/Agent/codev-studio/dist/linux-unpacked/codev-studio --enable-features=UseOzonePlatform --ozone-platform-hint=auto --enable-wayland-ime --wayland-text-input-version=3 --new-window
Icon=/home/yuki/Code/Agent/codev-studio/resources/icon.png
```

要点（每一条都是踩过的坑）：

- **Exec 必须手动带 Wayland/IME flags**：`--enable-features=UseOzonePlatform
  --ozone-platform-hint=auto --enable-wayland-ime --wayland-text-input-version=3`。
  这些 flags 平时由 `npm run dev` 脚本注入（见 package.json），直接启动打包后的
  二进制不会自动带 —— 不带上则 Wayland 下 IME（fcitx5）失效。主进程
  `src/main/index.ts` 里对 Linux 也做了兜底设置（README 里 electron-flags.conf
  的说明），但命令行传入仍然是最可靠的方式。
- **Exec 指向 `dist/linux-unpacked/codev-studio`**（打包产物目录），不是安装版；
  用 AppImage 的话路径换成 `.AppImage` 文件。更新版本后该路径指向同一文件，
  .desktop 无需改。
- **`Actions=new-window` + `[Desktop Action new-window]`**：声明二级动作。
  Exec 追加 `--new-window`，主进程 `second-instance` 收到后调 `createWindow()`。
  单个动作会在启动器里显示为独立平铺项（fuzzel 需要 `show-actions=yes`，
  在 `~/.config/fuzzel/fuzzel.ini` 设置）。
- **`StartupWMClass=Codev Studio`**：Wayland 下用于窗口匹配（图标分组/聚焦）。
- **`Name[zh_CN]=新空窗口`**：本地化动作名，LC 为中文时显示中文。
- **Icon 用 `resources/icon.png`**：绝对路径，避免依赖图标主题。

## 菜单栏（React 实现 + 原生保底）

用户要求菜单栏不靠 GTK，纯代码实现并继承应用主题。现状：

- **UI**：`src/renderer/components/layout/MenuBar.tsx` 纯 React 渲染
  File/Edit/View/Terminal/Git/Window 六组菜单，下拉面板样式同应用 zinc 主题 +
  `useAccent()` 高亮。只使用被全主题覆盖的颜色类（见 theming.md）。
- **可见性**：设置页 `settings/MenuBarSection.tsx` 开关，默认**隐藏**；
  持久化在 `src/main/ipc/ui.ts` 的 electron-store（`menuBarVisible`，默认 false）。
  切换时渲染进程 dispatch `menu-bar-visible-changed` 让 MenuBar 立即刷新。
- **原生菜单保底**：`buildMenu()` 仍构建完整原生菜单用于 **accelerators（快捷键）
  和 Alt 临时呼出**；`hideNativeMenuBar()`（`setAutoHideMenuBar(true)` +
  `setMenuBarVisibility(false)`）让它在所有窗口隐藏不双份。
- **动作分发**：见 ipc-and-preload.md「菜单动作管线」。native 角色走主进程
  `handleNativeAction`，应用动作走 `menu:action` → `App.tsx`。

## 快捷键补充

- `handleBeforeInput`：`Ctrl+Alt+1..9` 切换项目（发 `switch-project-N`）。
- 大部分菜单快捷键显示在 MenuBar 的 shortcut 列，实际绑定由原生菜单 accelerators 生效。

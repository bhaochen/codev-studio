# 自动更新与发布流程

## 自动更新

- `electron-updater` + GitHub provider（`package.json` build.publish：
  owner `bhaochen`，repo `codev-studio`）。
- 渲染进程 `updater-store` 状态机：idle → checking → downloading → downloaded /
  not-available / error；`UpdateBanner.tsx` 顶部横幅展示，downloaded 可 Restart & Update。
- **坑**：检查更新遇到 404（无 release）时主进程**必须广播 `not-available`**，
  否则渲染进程永远卡在 "Checking for updates..."。已修复（commit 6a798a9），
  测试在 `services/auto-updater.test.ts`。
- 自动更新 URL：`https://github.com/bhaochen/codev-studio/releases/latest/download/latest-linux.yml`。

## 版本号与发布流程（v1.1.94 实测有效）

1. **bump**：`package.json` version → `1.1.94`，commit `Bump version to v1.1.94`，push main。
   （注意 `npm run release` 脚本 push 的是 `master` 分支，当前远端是 `main`，别用它。）
2. **构建**：`npm run build:linux`（AppImage + deb 进 `dist/`）。
3. **打 tag 推送**：`git tag v1.1.94 && git push origin v1.1.94`。
4. **建 release**：`gh release create v1.1.94 --title "Codev Studio v1.1.94" --notes "..."`。
5. **传资产**（**文件名陷阱，必须照做**）：

   ```bash
   # AppImage 构建名带空格 "Codev Studio-1.1.94.AppImage"；
   # gh 上传会把空格替换成点（Codev.Studio-...），与 latest-linux.yml 的 url
   # Codev-Studio-1.1.94.AppImage（连字符）不匹配 → 自动更新 404。
   cp "dist/Codev Studio-1.1.94.AppImage" /tmp/Codev-Studio-1.1.94.AppImage
   gh release upload v1.1.94 /tmp/Codev-Studio-1.1.94.AppImage dist/codev-studio_1.1.94_amd64.deb
   ```

6. **验证**：`gh release view v1.1.94 --json assets` 确认两个资产名字正确。

## 打包细节

- Linux target：AppImage + deb；mac：dmg + zip（arm64，notarize）；win：NSIS。
- `postinstall` 执行 `scripts/postinstall.js`（node-pty/electron 重建授权）。
- 产物直接覆盖到 `dist/`，旧版本文件可清理。

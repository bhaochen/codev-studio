# Git 子系统

## 结构

- **主进程**：`services/git-service.ts` 执行所有 git 命令并解析输出（`git.status`、
  `git.log`、`git.diff`、numstat、`first-changed-line`、`conflicts` 等），经
  `ipc/git.ts` 暴露。大仓库命令做了去重/并发控制（`git-store` 侧）。
- **自动刷新**：
  - `services/git-fetch-service.ts`：按项目定时 `git fetch`（`registerFetch` / `unregisterFetch`）；
  - `services/git-refs-watcher.ts`：监听 refs（branch/tag/HEAD）变化，变化时推
    `git:refs-changed`，渲染进程 `git-store` 重载 status/commits/diff 统计。
- **drift 检测**：`git:drift` 事件携带工作区漂移信息（本地落后远程等），
  `git-store` 订阅后提示 pull。

## 渲染进程

- `stores/git-store.ts`：status、commits、branches、diff 数据；`loadGitData` /
  `loadStatus` / `loadRangeFileCounts` 等，内部做请求去重。
- `components/git/`：Git 面板、commit 对话框、conflict 列表、diff 视图、branch 图。

## 菜单动作

`git-pull-rebase`（pull + rebase）、`git-commit`（向当前 Codev 终端发 `/commit`）在
`App.tsx` 的 `onMenuAction` 处理；commit 也可以直接调用 `git:commit-all` /
`git:commit-paths`。

## 常用 IPC

`git:status` `git:commits` `git:branches` `git:checkout` `git:commit-all`
`git:commit-paths` `git:pull` `git:push` `git:rebase-remote` `git:revert-file`
`git:diff-numstat` `git:first-changed-line` `git:conflicts` `git:user-email`
`git:language-tally` `git:ignore-path`（.gitignore 增删条目）。

## 注意

- `git:first-changed-line` 用于 diff 定位首个变更行；`language-tally` 用于统计页语言分布。
- 测试集中在 `ipc/git.test.ts` 与 `services/git-service.test.ts`。

---
name: main-unification-2026-07-09
description: 所有者裁决全仓统一进 main + 删除全部冗余分支；执行文档已签发给 Codex，完成后大量旧分支名失效
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d09762d-931c-47fa-804a-fc511da650c4
---

2026-07-09 所有者裁决：**全部合并为单一 main，删除其余所有分支**。执行者=Codex，执行文档=worktree `F:\AI Project\WXGamesLocal-button-scheduler-root-cause\docs\architecture\!!-EXECUTE-main-unification-plan-2026-07-09.md`（Phase 0 备份→1 main 快进到 pvpve→2 合入 battle 分支 10 独有提交(passability M1/auth/迁移锁)→3 真基底重冻 Slice 0→4 按 spec 切片重移植 button-scheduler(含强制修 ISSUE-009 教程钩子滥发/§6.10 计数器/§6.11 绑定)→5 合入 main→6 删分支+worktree）。

**Why**: main 落后 pvpve 472 提交的裂缝导致 Codex 在错误基底上绿地重建整晚（监控记录在 `F:\AI Project\codex-watch\`）；统一后 spec 的"现状"才为真。

**How to apply**: 完成后 [[pvpve-systems-branch]]、codex-battle、design-march-eta 等所有分支名引用全部失效 — 一切在 main。验证是否完成：`git branch` 只剩 main。若中途接手，先读 codex-watch/review-log.md 第 13 轮与 completion-report/EXECUTION-BLOCKER-REPORT。监控经验：给 Codex 的文件通道有效（它按协作规则写仲裁回执），但它只服从其会话内授权 — 跨会话指令要走 owner 名义的执行文档。

**✅ 2026-07-09 完成**：main=`e886e708`（=8b `9aab2ea0`+完成报告与资源地设计文档），origin 同步，合并后全量 2260/2260 绿。本地只剩 main。origin 留两个归档分支（`claude/nostalgic-curran-8a2b47`=某会话 13 文件 WIP 快照 395b18c5、`codex/button-scheduler-panel-root-cause`=错基底参考快照），owner 可随时删。完成报告=docs/architecture/main-unification-completion-report-2026-07-09.md。**资源地系统 spec 已入 main（docs/design/resource-node/04-spec-draft.md 为封面），实现待 owner 终审后派发 Codex（上游门 A 已解除）**。private/local 部署遥控器全程未碰，部署待 owner。

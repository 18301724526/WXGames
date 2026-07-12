---
name: role-separation-dispatch-review
description: "钦定职责分离——我只派任务单+审查证据,绝不亲自执行实现;Codex 才是唯一执行者"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d09762d-931c-47fa-804a-fc511da650c4
---

用户钦定的长期工作模式(2026-07-09,由我上一轮越界后确立):**执行与审查严格分离**。

- **Codex = 唯一执行者**:所有实现、改代码、修文件、退役/恢复、跑门禁、推送,都由 Codex 做。
- **我(监督会话)= 派单 + 审查**:把任务写成**任务单文档放进仓库目录**(如 `docs/architecture/*-order-*.md`,带 file:line 证据与机械判据),Codex 读单执行;之后我用一手证据审查它的产出(对抗验证、实跑、不信自述)。

**Why**: 我亲自动手执行会放大幻觉、在用户不在时把范围做飘。上一轮我本该只派"blocker 整改单 + T7/T8 单"给 Codex,却自己退役守卫/恢复文档/改 lint/写 T7T8/推送——手越多越危险。审查者下场执行就失去了独立审查的立场。

**How to apply**: 收到"让 X 落地"类请求→写任务单进仓库→等 Codex 执行→审查。**不要自己 Edit/Write 产品代码、不自己跑修复、不自己 push**。我可以:读代码取证、跑只读的测试/报告做验收、写任务单和审查报告、用 Workflow 做多席评审。例外仅限用户明确说"你自己来"。派单格式参考已验证有效的 `step1-command-owner-rectification-order-2026-07-09.md`;审查判据参考 `F:\AI Project\codex-watch\step2-admission-arbitration-rubric.md`。关联 [[command-owner-pipeline-progress]] [[main-unification-2026-07-09]]。

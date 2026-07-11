# 北极星 S5 验证记录(2026-07-11)

## Y1

计数口径：扫描 `frontend/js/platform` 中含 `addHitTarget` 发射器的渲染源码及其 `frontend/js/state/presenters` 动作来源，只统计可静态解析的字面 `type`；转发包装不产生类型。教程引用只统计 `frontend/js/tutorial` 中 `showHighlight('<literal>')` 与 `getCanvasTarget('<literal>')`。

计数命令原文：

```text
node scripts/generate-tutorial-hit-target-types.js --check
```

还原后输出原文：

```text
{"output":"docs/architecture/artifacts/northstar-s5-tutorial-hit-target-types.json","checked":true,"rendererFiles":150,"tutorialFiles":7,"registrationSites":204,"registeredTypes":114,"tutorialReferenceSites":39,"tutorialTypes":29,"missingTypes":0}
```

改名探针：临时将 `BuildingCanvasRenderer.js` 唯一注册点 `buildBuilding` 改为 `buildBuildingRenamedProbe`，门禁 FIRE：

```text
Tutorial hit-target types missing renderer registrations: buildBuilding
Tutorial hit-target type inventory is stale: docs/architecture/artifacts/northstar-s5-tutorial-hit-target-types.json
```

探针后已还原；生成文件 freshness check 与 `git diff --check` 均通过。

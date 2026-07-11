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

## Y2

`MODAL_TARGET_PANEL_BY_ACTION_TYPE` 补入 `assignFamousAttributePoint -> famousPersons`；该项是 Famous panel 渲染/Presenter 动作面中原 9 条表唯一漏项。测试读取 S2 规则清单，16 个 highlight type 均有显式 panel 决策，其中 `closeFamousPersonDetail`、`closeFamousPersons`、`seekFamousPerson` 需要 `famousPersons` modal 重投影，其余规则在命中前已有状态谓词或显式 prepare/ensure 动作。

三种 resolver kind：

- `hitTarget`：保留首次查询、surface 重投影、二次查询与 visual-disabled 过滤。
- `worldSiteAnchor`：每次调用重新读取 live anchor；`available=true,target=null` 时 fail-closed，不回退 stale hit target。
- `softGuideId`：集中旧 advisor id 到 action/tab/guideTask 描述；`CanvasGameApp` 只执行描述，不再按 id 分支。

DOM 遗留检查原文：

```text
DOM legacy matches: 0
```

定向测试原文：

```text
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

全程投影：使用 S2b Run 2 的完整成功 `summary.json`，通过当前 `scripts/playtest-tutorial-transcript.js` 重新生成 64 条投影，再执行：

```powershell
git diff --no-index --exit-code -- docs/architecture/artifacts/northstar-s2-tutorial-transcript.json $env:TEMP\wxgames-s5-y2-reprojected.json
```

结果：exit 0，投影与基线 diff 为空。Y1 枚举与 S3 host-surface inventory 随源码 hash 重生成；`CanvasGameApp.js` 新增 4 行 import 后，command-owner 清单的 17 个既有直接提交点仅机械同步行号 `+4`，inventory drift 回到 0。architecture smoke 最终通过。

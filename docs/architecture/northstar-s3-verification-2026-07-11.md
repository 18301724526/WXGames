# 北极星 S3 验证记录(2026-07-11)

## V1|宿主调用面枚举

生成命令:

```powershell
node scripts/generate-tutorial-host-surface-inventory.js
```

产物:`docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json`。

- 共 393 个逐调用点:`effects=124`、`waitFor=0`、`requestAction=0`、`resolveTarget=60`、`queries=193`、`next=16`。
- 扫描范围为 `frontend/js/tutorial/` 下非测试产品脚本；扫描器追踪 `host/game/canvasShell/shell/controller/renderer` 及其别名、可选链、动态属性和带宿主实参的状态适配器调用。
- 每条记录包含 `location`、`accessShape`、`category`、`note`；不合并重复方法的逐调用点。

S2b 已知洞口强制检查:

- `TutorialGuideEventRegistry.js:205` 的 `game.famousPersonsPage = 0` 被列为 `effects/write`。
- `TutorialGuideEventRegistry.js:206` 的 `game.selectedFamousPersonId = ''` 被列为 `effects/write`。
- 同文件 `famousPersonsClosed` 分支中的对应两处直写也被列出。

人工抽查 3 条:

- `TutorialGuideEventRegistry.js:205`:清单形态为 `game.famousPersonsPage`、`effects`、`write`；源码为 `game.famousPersonsPage = 0`，一致。
- `TutorialGuideFlowRegistry.js:739`:清单形态为 `host.game.state.worldExplorerState.activeMission`、`queries`、`read`；源码在 `scout-explore-active` 匹配器读取该字段，一致。
- `TutorialGuideController.js:543`:清单形态为 `host[*dynamic*]`、`effects`、`write`；源码为 `setIfChanged` 内的 `host[key] = value`，一致。

重生成零差异:

```powershell
git add -- docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json
node scripts/generate-tutorial-host-surface-inventory.js
git diff --exit-code -- docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json
```

结果:exit 0，重生成 diff 为空。

定向自验:

```powershell
node --check scripts/generate-tutorial-host-surface-inventory.js
node --test scripts/generate-tutorial-host-surface-inventory.test.js
git diff --check
```

结果:3/3 通过；动态键和 S2b 直写均有独立回归断言。

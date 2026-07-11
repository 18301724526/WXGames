# 北极星 S2 验证记录(2026-07-11)

## U1|playtest 规范转录投影

实现证据:

- `scripts/playtest-online-tutorial.js` 的默认目标为 `local`，默认地址仅为 `http://127.0.0.1:8080/` 与 `http://127.0.0.1:3000/api`；`remote` 必须显式传入 `--target=remote --game-url=... --api-base=...`。
- 排除字段白名单为独立文件 `scripts/playtest-tutorial-transcript-exclusions.json`，投影实现 `scripts/playtest-tutorial-transcript.js` 在读取报告与证据后先应用该白名单，再生成 `{stepKey, actionType, targetType, panelKey}` 序列。
- 入库样例: `docs/architecture/artifacts/northstar-s2-tutorial-transcript.json`，43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`。

受控环境:

- 后端: 本地 `backend/server.js`，`http://127.0.0.1:3211`，隔离临时 SQLite 与临时已发布配置运行包。
- 前端: 本地 `scripts/local-preview-server.js`，`http://127.0.0.1:8181`，API 代理到上述后端。
- 健康检查: `/api/health` 返回 `configSource=active-release-bundle`、`bundleReady=true`、任务定义可用；`/.wxgame-deploy-status.json` 返回 `status=ready`。
- 双跑共同参数: `PLAYTEST_STRICT_VISUAL=0`、`PLAYTEST_MAX_ACTIONS=120`、`--target=local`、显式 loopback URL、`--transcript=<run-output>`。

双跑证据:

- Run 1: `2026-07-11T09-38-40-769Z`，43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`。
- Run 2: `2026-07-11T09-40-55-855Z`，43 条，SHA-256 `B998FFD6853765A60B7E9A10AD8C0518BAE11B14162EA442CD29792EB818CDFC`。
- 空差异命令:

```powershell
git diff --no-index --exit-code -- $env:TEMP\wxgames-s2-u1-local-ready\official-transcript-run1d.json $env:TEMP\wxgames-s2-u1-local-ready\official-transcript-run2.json
```

结果: exit 0，投影 diff 为空。

定向自验:

```powershell
node --check scripts/playtest-online-tutorial.js
node --check scripts/playtest-tutorial-transcript.js
node --check scripts/local-preview-server.js
node --test scripts/playtest-tutorial-transcript.test.js
git diff --check
```

结果: 转录模块 2/2 通过，语法检查与 `git diff --check` 通过；冻结三件套零差异。

### U1 单外交接

- 两次受控运行都在同一真实行为点停止: `famousCardViewed` 下准确命中且输入盾允许 `openArmyFormation(cityId=capital, slot=1)`，但 `armyFormationEditor.open` 仍为 false，步骤未推进。该产品行为不属于 S2，本单未修改产品教程实现。
- 名人详情与关闭按钮的金色像素门槛在本地截图中低于 24；正式转录使用 `PLAYTEST_STRICT_VISUAL=0` 保留 warning 而不让视觉判据中断语义轨迹。本单未调整视觉阈值或高亮实现。

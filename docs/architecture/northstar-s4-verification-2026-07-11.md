# 北极星 S4 验证记录(2026-07-11)

## X0|host-surface 清单时点收尾

- 重生成 `docs/architecture/artifacts/northstar-s3-tutorial-host-surface.json` 后，逐调用点由 393 收缩到 205。
- 分类变化：`effects=124→47`、`waitFor=0→0`、`requestAction=0→0`、`resolveTarget=60→55`、`queries=193→87`、`next=16→16`。
- `scripts/generate-tutorial-host-surface-inventory.js --check` 会以内存重生成结果逐字节核对仓库产物；`scripts/run-architecture-smoke.js` 已将该检查设为常驻门禁。

验证命令：

```powershell
node scripts/generate-tutorial-host-surface-inventory.js --check
node --test scripts/generate-tutorial-host-surface-inventory.test.js
node scripts/run-architecture-smoke.js
```

结果：生成器检查、4 条生成器测试、architecture smoke 全部通过。

全程教程结果：`stopReason=tutorial-completed`、`finalStepName=completed`、62 个动作、64 条投影、0 verification failure、`tutorialHostContextWitness.count=0`。

投影 transcript 与仓库 64 条基线的 SHA-256 均为：

```text
16862F819B0EE78ACBD8C358CB964FC1307646BD122BA4BA6EC9C270E79D605F
```

`git diff --no-index --exit-code` 返回 0，逐字节 diff 为空；基线未重录、未修改。

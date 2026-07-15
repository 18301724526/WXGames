# T5 production-shape restore 演练证据

- 环境：WSL Ubuntu-24.04 本地隔离环境
- 表数 / 行数：18 / 5312
- fixture 双跑 checksum：`ec06259d3ba4a86ad99a900c0229be0e793751ccad4d5ffe701c81c6ed495b62`（一致）
- backup 前 checksum：`ec06259d3ba4a86ad99a900c0229be0e793751ccad4d5ffe701c81c6ed495b62`
- restore 后 checksum：`ec06259d3ba4a86ad99a900c0229be0e793751ccad4d5ffe701c81c6ed495b62`（一致）
- 隔离端口：source `45339`，restore `45365`
- 健康检查：source `status ok`，restore `status ok`
- 脱敏断言：真实敏感值、邮箱、JWT、Bearer、查询凭据泄漏数均为 `0`
- 原始产物：`tmp/m0-fixture/restore-drill/`
- 机器报告：`docs/architecture/m0/production-shape-restore-report.json`

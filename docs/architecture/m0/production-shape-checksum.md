# T5 production-shape fixture 与权威 checksum 规则

## 数据边界

- 来源：WSL `wxgame-test` SQLite 镜像，默认路径 `/root/wxgame-test/backend/civilization.db`。
- 读取方式：`query_only` + 单个只读事务快照，不停止或修改在线进程。
- fixture：只写 `tmp/m0-fixture/production-shape.fixture.json`，不进入 Git。
- 元数据与演练报告：只写 `docs/architecture/m0/`。
- `codex_db_write_probe` 是 T2 临时探针表，不属于 production shape，显式排除；`sqlite_*` 内部表也不参与。

`scripts/m0-fixture/export-production-shape.js` 会确定性替换以下内容，并递归处理 JSON 字符串：

- `playerId`、`deviceId`、用户名、邮箱、手机号、IP 等身份信息；
- token、JWT、Bearer、password、secret、credential、API key、cookie 等凭据；
- 同一敏感原值使用同一类域分离别名，保持跨表引用形状；BLOB 改写为同长度确定性字节。

导出结束前必须执行自检：原始敏感值、邮箱格式、JWT 格式、Bearer 格式、查询参数凭据的泄漏数都必须为 `0`，否则脚本退出非零。

## checksum 输入

规则版本：`m0-production-shape-checksum-v1`。

1. 表按表名 UTF-8 字节序排列；显式 index、trigger、view 的 SQL 定义也参与。
2. 每张表的建表 SQL、完整列定义、主键定义和行数参与。即使某列的值被排除，该列的结构变化仍会改变 checksum。
3. 行按 SQLite 声明主键排序；复合主键按声明顺序比较。无主键表按全部列的规范化值排序。
4. 非波动列全部参与。JSON 文本先解析，递归删除下节列出的波动键，再按对象键 UTF-8 字节序规范化；普通文本、数值、NULL、BLOB 均保留类型。
5. 规范化文档使用稳定 JSON 字节序列，末尾单个 LF，再计算 SHA-256。

任何未在排除清单中的字段都参与 checksum，包括名称中疑似时间但未明确列出的字段。

## 显式排除的波动时间字段

以下名称同时作用于表列和嵌套 JSON 键，大小写不敏感：

```text
advancedAt
appliedAt
at
builtAt
capturedAt
checkedAt
claimedAt
completedAt
completesAt
createdAt
discoveredAt
durationMs
expiredAt
expiresAt
finishedAt
firstDiscoveredAt
foughtAt
foundedAt
generatedAt
grantedAt
importedAt
issuedAt
joinedAt
lastActiveAt
lastAdvancedAt
lastAppliedAt
lastAt
lastEventAt
lastGeneratedAt
lastScoutedAt
lockedAt
migratedAt
nextAt
nextStepAt
occupiedAt
receivedAt
resolvedAt
respawnAt
revealedAt
scoutedAt
serverTime
settledAt
since
startedAt
timestamp
updatedAt
upgradedAt
woundedUntil
```

## WSL restore 演练

在仓库根目录执行：

```bash
bash scripts/m0-fixture/run-restore-drill.sh
```

脚本固定使用以下产物边界：

- `tmp/m0-fixture/`：脱敏 fixture、两个隔离数据库、备份归档、健康响应和原始日志；
- `docs/architecture/m0/production-shape-fixture-metadata.json`：表、行数、主键与排除字段；
- `docs/architecture/m0/production-shape-restore-report.json`：机器判定报告；
- `docs/architecture/m0/production-shape-restore-evidence.md`：人工复核摘要。

演练顺序为：只读导出 → 脱敏自检 → fixture checksum 双跑 → 构造 source 隔离库并用独立端口健康检查 → 现有 runtime backup → 恢复到另一数据库 → 用另一端口健康检查 → 恢复前后 checksum 对比。任一步失败都返回非零。

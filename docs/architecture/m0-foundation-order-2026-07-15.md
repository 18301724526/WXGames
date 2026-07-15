# M0 Foundation Order — writer 清单、业务不变量与发布身份（2026-07-15）

Status: **READY FOR DISPATCH（owner 派发即生效）。**
Authority: owner 指令 2026-07-15（第四轮交叉裁决 `REVISE_TO_V2_4`：M0-M1 零补丁阻塞，实现与 v2.4 修订并行）。
规范基准: `7月14日后端架构/当前实现迁移路线图-v2.3.md` §5（M0）；裁决依据 `tmp/architecture-v2.3-adversarial-final-synthesis.md` §7。
纪律: 按序执行，一任务一 commit；全部为**加法式/报告式改动 + 三个独立小修**，除 T6 明确标注外零行为变化。改动必须过 `npm test`、`npm run lint`（部署门禁会跑，勿留 stale suppression）、`node scripts/run-architecture-smoke.js`；LF 换行（仓库 `.gitattributes * -text`）。运行时验证只许 WSL 镜像/本地隔离进程（**禁打公网服务器，含 47.116.32.216**）。⚠️ 网络政策澄清（owner 2026-07-15）：禁网仅指**禁碰生产/公网测试服务器与对外发布**；**联网安装开发工具（apt/npm/官方 release 下载）允许**，缺工具直接装，不必停手。shellcheck 已双端预装：Windows `%USERPROFILE%\tools\shellcheck\shellcheck.exe`（已入用户 PATH，新 shell 生效）；WSL `shellcheck`（apt 0.9.0）。

⚠️ **部署 = 自唤醒三步，不要直接 `git push local main`**。根因：WSL2 的 VM 空闲/重启后回到 Stopped，而 `git push local`（Windows git 直连 localhost:3001）**不会唤醒 VM**，会连接被拒。必须先用一次 `wsl.exe` 调用把 VM 叫醒（systemd 会在 ~8 秒内自启 nginx+pm2，冷启动自愈，无需 `wx up`）：
```powershell
wsl -d Ubuntu-24.04 -u root -- true   # 唤醒 VM，systemd 拉起 nginx/:3001
Start-Sleep -Seconds 8                 # 等 :3001 就绪
git push local main                    # 现在才推送；输出须含 "[hook] deploying branch: main"
```
或用已装进 PowerShell profile 的便捷函数 `wxpush`（自动唤醒+轮询就绪+推送；若 shell 以 -NoProfile 启动则用上面三步）。`wx` 本身是 **WSL 内部命令**（`/usr/local/bin/wx {up|deploy|status|logs}`），Windows 侧调用需 `wsl -d Ubuntu-24.04 -u root -- wx …`。post-receive 白名单已含 main（2026-07-15 修复）。

## 已核实的当前事实（发单前核对）

- `scripts/command-owner-step1/`（scanner.js/contracts.js/anti-evasion.js）是 Step1 整改后的**真实源码扫描器**，可扩展——不要另起炉灶。
- 主持久化 = `game_states` 大 JSON 行（`backend/repositories/GameStateRepository.js:329` 硬编码列映射）；`backend/migrations/` 走 SchemaMigrationService 的 id/checksum/lock 契约，**已发布迁移 append-only**（参照 `425df020`）。
- 发布身份现状 = 仅 git commit hash；无 release_manifests 表、无签名、无信任根。
- 命令注册表 = `backend/application/commands/CommandOwnerResolver.js` 的 `COMMAND_OWNER_RULES`（40+ 命令类型，声明式数据）。

## T1 — 静态 writer inventory 扩展到全部八类写入面

交付：
- 新 `scripts/m0-writer-inventory/`（复用/包装 command-owner-step1 的扫描内核），静态扫描八类 writer：route、command、worker、admin、migration、repair script、consumer、client state writer。
- 产物双格式：`docs/architecture/m0/writer-inventory.json`（机器）+ `writer-inventory.md`（人读），含每个 writer 的 file:line 证据。
- 双向 drift 检测：源码发现但未声明 → finding；声明但源码不存在 → finding。

判据（机械）：
- 扫描器必须读源码（禁止 declaration-echo：模块 import 里必须有 fs/静态分析路径）。
- `node scripts/m0-writer-inventory/index.js --check` 退出码 0=无 drift，非 0=有 drift 且逐条打印。
- 八类每类至少有真实条目或显式声明"该类为空 + 原因"。

建议推理强度：medium。

## T2 — 运行时 writer 命中探针（三集合的第三集）

交付：
- better-sqlite3 写入层的可开关探针（环境变量 `M0_WRITER_TRACE=1` 才激活），记录（调用类别、表、命令类型）命中日志到独立文件；默认关闭，生产零行为变化。
- WSL 环境跑一遍现有 playtest smoke（带 stall-watchdog 的 harness，起进程后只等自然退出读退出码，**禁 Start-Sleep 人肉轮询**），产出运行时命中集。
- 三集合双向差报告：静态发现 / 清单声明 / 运行时命中，任意两两差集落盘 `docs/architecture/m0/writer-tri-diff.md`。

判据（机械）：
- 探针关闭时 `npm test` 全绿且无新增运行时开销路径（探针代码在 flag 短路后零分配）。
- 运行时未知 writer（命中但不在静态清单）数 = 0，或逐条列明 + 归属后续任务编号。
- 单次验证 wall-clock 超正常跑 1.5 倍即停手报告，禁继续等。

建议推理强度：high。

## T3 — 每命令业务不变量清单

交付：
- `docs/architecture/m0/command-invariants.md`：对 `COMMAND_OWNER_RULES` 全部命令类型，逐条给出 owner set、领域表、业务唯一键、expectedVersion 来源、外部副作用、最终 projection 六字段。
- 校验脚本 `scripts/m0-writer-inventory/check-invariants.js`：交叉核对注册表 vs 文档条目。

判据（机械）：
- 校验脚本：注册表有而文档缺 = fail；六字段任一为空 = fail；退出码判定。
- 付费、奖励、占领、入盟、行军、建筑完成六类路径必须每条有显式不变量语句（脚本按命令类型标签断言覆盖）。

建议推理强度：medium。

## T4 — 基线 release manifest、签名与 release_manifests 表

交付：
- `scripts/build-release-manifest.js`：产出 typed manifest（backendDigest、frontendDigest、configDigest、databaseSchemaVersion、protocolVersion、eventSchemaDigest、rulesetIds），digest 按文件排序后逐字节 sha256；本地签名（信任根密钥文件在运行目录外，路径经环境变量注入）。
- expand migration：`release_manifests` 表（append-only，含 manifest_json、manifest_digest、signature、signer_key_id、created_at），走 SchemaMigrationService 契约新增，**不得改动任何已发布迁移**。
- 验签脚本 `scripts/verify-release-manifest.js`。

判据（机械）：
- 同一 commit 双跑 build → manifest_digest 逐字节相同（确定性）。
- 验签：原文通过；篡改任意一字节 → 非 0 退出码。
- 迁移 checksum 契约测试全绿；`npm test` 全绿。

建议推理强度：high。

## T5 — production-shape fixture、权威 checksum 规则与 restore 演练基线

交付：
- `scripts/m0-fixture/export-production-shape.js`：从 WSL 库导出**脱敏** production-shape fixture（用户名/凭据/token 全部替换，保留数据形状与量级）。
- 权威 checksum 规则文档 + 实现：确定性导出顺序（表名、主键排序）后 sha256；写明哪些字段参与、哪些排除（时间戳类波动字段显式列出）。
- restore 演练脚本：隔离环境（独立 db 文件+端口）backup → restore → checksum，产出演练报告。

判据（机械）：
- fixture 内 grep 不到任何真实用户名/邮箱/token 模式（脚本自带断言）。
- 同一 fixture 双跑 checksum 一致；restore 后 checksum 与 backup 前一致。
- 演练脚本退出码判定；全程本地/WSL，产物路径写死在 tmp/ 与 docs/architecture/m0/。

建议推理强度：high。

## T6 — 实现层缺陷修复（三个独立小 commit，唯一的行为变化任务）

1. **FI-24**：`SecurityConfig.resolveJwtSecret` 的 dev-secret 回退改为显式环境名 allowlist（`development`,`test`）；未知环境（如误设的 `staging`）无 secret 一律 throw。判据：新增单测——production 缺 secret throw（既有行为回归）、allowlist 环境回退成功、未知环境 throw。
2. **FI-21**：`restore-runtime-state.sh` 调整为先处理 WAL/SHM 再落主库文件（或等效幂等顺序），任一中断点重跑收敛。判据：脚本内每步幂等（存在性检查），shellcheck 无新告警。
3. **FI-22**：`deploy.sh` hardlink 快照目录落盘后 `chmod -R a-w`（只读位缓解共享 inode 污染）。判据：快照目录内文件写入尝试失败；回滚路径先恢复写权限再用，现有部署流程演练通过（WSL）。

建议推理强度：medium。

## 退出门禁（M0 整体，对应路线图 §5）

- 未知或测试未命中的 runtime writer 数 = 0（T2 报告）。
- 付费、奖励、占领、入盟、行军、建筑完成路径全部有明确业务不变量（T3 脚本绿）。
- 基线备份可在隔离环境恢复，最终 checksum 可重复（T5 报告）。
- 全单完成后由监督者做 L1 审查 + 抽查证据原始产物；测试数字以命令原始输出为准，禁转述。

## 明确不做

- 不动 M1+ 的任何表/事务边界（receipt 同事务化是 M1 的活）。
- 不改已发布迁移、不删既有门禁、不碰教程拆除后的 append-only 残留列。
- 不在生产/公网环境跑任何探针或演练。

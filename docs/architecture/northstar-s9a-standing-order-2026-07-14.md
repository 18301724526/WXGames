# 北极星 S9a 驻场闭环任务单(2026-07-14,owner 钦定换挡)

使命:**跑通全教程,并在过程中把教程引导引擎彻底抽离游戏逻辑——游戏与引导互不耦合,谁没了谁都能正常跑。** 工作模式改为驻场闭环:执行者自己跑引导测试→哪里不通→按本单政策处置→再跑,直至 tutorialCompleted=true。监督者退居里程碑审计。

## 阶段 0|测试快车(先造车再迭代,1-2 commits)

1. **DB 检查点续跑**:harness/工装支持"跑到 step N 存 sqlite 检查点(拷贝 db 文件)→ 后续轮次拷贝检查点起后端 + PLAYTEST_RESET_ACCOUNT=0 从前沿续跑"。检查点库放 tmp/checkpoints/(不入 git)。提供起点参数或小脚本。
2. **软空转熔断**:同一动作 label + 同一教程步连续 ≥8 次无步进 → 立即退出,stopReason='soft-loop',落最后 after 快照与高亮字段。
3. (可选)行军时长测试旋钮:仅限测试环境 env/config 覆盖,禁改游戏逻辑默认值,禁影响生产路径。
判据:同一前沿的复跑时间从 500 动作级降到 ≤50 动作级;熔断有单测或演示 run。

## 阶段 1|闭环迭代(N commits,直至通关)

每轮:检查点续跑 → 熔断/停点 → 定位 → 按政策处置 → 门禁绿 → commit → 更新检查点 → 下一轮。

### 处置政策(铁律)

- **legacy 段(FlowRegistry 旧规则)一律不修,整段迁移**:按 S8 草稿(northstar-s8-coverage-draft-2026-07-12.md)对应 R 行落配置+核销,雷区图=northstar-step27-adjudication-2026-07-14.md(推进事件驱动/render 零状态写/ensure 副作用 beforeEffects 显式一次)。剩余地皮:R18-R19 若批次二未覆盖、R26-R30 首城弧、R31-R33 talent 弧、及 S2 清单其余行。
- **新引擎/配置/查询表的缺陷**:直接修(它们是终态资产),特征测试随修。
- **游戏逻辑与引导的耦合点**(游戏代码读教程状态、教程代码写游戏状态):按解耦方向处置——引导侧改走四张表/事件,游戏侧删教程感知;单向依赖也算耦合。
- **服务端教程机器**(403 门/manualAdvance/syncEra2Tutorial):本单不拆(B3' 范围),但禁止新增依赖。
- **harness 缺陷**:直接修(仪器)。
- 拿不准的行为变更:停下写入报告的"待裁决"节,继续绕行其它前沿,不擅裁。

### 纪律

- 一个连贯改动=一个 commit;每 commit 六门全绿(纯度/新鲜度/事件契约/EXPECTED_RULE_IDS/missingTypes/npm test 全量 ℹ 原文);监督者署名文档只读;禁公网(全部 127.0.0.1);禁 push;禁 spawn;类型≤6、query 表零新增(S8 预算)。
- 环境:端口 3671/8671 配方;进程善后;发布门若 500 用 scripts 里 forensics 的 publishRelease 流程重发(参考 playtest-forensics-A.js:31-44)。
- 迭代日志:tmp/standing-loop-log.md 逐轮追加(轮次/停点/处置/commit/耗时),终局报告含通关 summary 原文 + 全部 commit 清单 + 未做/待裁决清单。

## 终局判据

隔离环境全新账号(非检查点)完整一跑 tutorialCompleted=true + 全量测试与六门全绿。达成即停,等监督者审计。

# 北极星 S9a 批次一任务单:行军段 R20-R25 整段迁移(2026-07-14)

依据:S8 裁决(northstar-s8-adjudication-2026-07-13.md,十题全过)+ 56 行草稿表(northstar-s8-coverage-draft-2026-07-12.md,R20-R25 行为本批规格)+ step27 终审确认书(northstar-step27-adjudication-2026-07-14.md,雷区图)。
纪律:一任务一 commit;判据机械;codegraph-first;监督者文档只读;禁 spawn;禁公网;不跑 playtest(动态验证由验证席另单)。

## C1|orderedTargetFlow 脚本类型落地(1-2 commits)

按 S8 草稿 §3.1 语义实现并注册:依次解析多个 target,选择首个可执行 action;`noTarget -> next`;支持客户端子游标(cursorKey/initialCursor/nextCursor,本地不持久化,重入投影安全);事件匹配后**先提交子游标再做下一次投影**(终审确认书雷区:不得依赖 renderer snapshot 是否已刷新)。带 owner 已批的 `beforeEffects` 通用参数(S8 Q7)。
**判据**:类型注册表 3→4;纯度门 ALLOWED_SCRIPT_TYPES 同步登记;单测覆盖:顺序选择/子游标推进/noTarget 回退/重入幂等(计数断言);全部教程测试不回归。

## C2|effectSequence 脚本类型落地(1 commit)

按 S8 草稿 §3.1:有序执行通用 effects/resolveTarget/requestAction 再等事件或 next;effects 键**锁冻结宿主表条目**(S8 Q3:禁配置函数、禁宿主大方法旁路)。
**判据**:类型注册表 4→5(≤6 预算);纯度门登记;单测:序列执行顺序/非法 effects 键 FIRE;不回归。

## C3|R20-R25 配置迁移 + 旧规则核销(2-3 commits)

按草稿 R20-R25 行的四表参数写 TaskPanelStepScripts(或按步键归属拆新配置文件,执行者按 S5 目录约定裁量):
- R20 scout-switch-city-military-tab(ensureSurfaceThenHighlight)
- R21 scout-open-formation(ensureSurfaceThenHighlight)
- R22 scout-formation-member-or-save(orderedTargetFlow)
- R23 scout-select-world-target(effectSequence——注意:旧规则的 clearWorldMarchTarget 副作用改为本步 beforeEffects 显式声明,仅在进入本步时清一次,禁止渲染期重复清)
- R24 scout-open-world-formation-picker(orderedTargetFlow)
- R25 scout-start-world-march(orderedTargetFlow)
同 commit 核销 FlowRegistry 对应旧规则(逐规则核销清单,出自 S2 清单行号),EXPECTED_RULE_IDS/棘轮计数/hit-target 库存/事件契约产物同步登记再生成。
**判据**:核销清单逐条(删一销一);纯度门/新鲜度门/事件契约门全绿;`scout-select-world-target` 在 FlowRegistry grep=0;npm test 全量 ℹ 原文。

## C4|所需事件补齐(按需,0-1 commit)

R20-R25 行声明的 eventName 若有不在 18 事件契约表内的(对照草稿行),按 S8 Q1 裁决新增**通用**成功事件(经正规命令成功路径发布,携带 payload 契约),契约文件+产物同步更新。禁止借 tutorialStateChanged。
**判据**:契约测试;发布站点按契约校验。

## 范围外

R18-R19(入城弧)与 R26-R30(首城弧)=批次二;advanceTo 竞态不修(终审裁决);harness 收紧另单。

## 验证交接

C1-C4 完毕后停,验证席跑 T17 全程(预算 500):判据=穿过 scoutWorldPanelOpened 与出征,理想=抵达首城弧;投影 diff 按 §1-9 声明式重录基线(行为变更=旧规则退役,declared)。

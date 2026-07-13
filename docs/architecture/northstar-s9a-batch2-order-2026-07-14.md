# 北极星 S9a 批次二任务单:名人/入城弧 R14-R19 整段迁移(2026-07-14)

依据:S8 裁决 + 56 行草稿表 R14-R19 行(规格);触发:T17 实测 step24 famousCardViewed 旧引擎 enterCity 高亮软空转 460 次(tmp/verify-T17.md,run 2026-07-13T18-19-21-958Z)——按 owner"不修只拆"钦定,legacy 段冒病即整段迁移,不定位不修。
前置已就绪:orderedTargetFlow/effectSequence 类型已落地(ac03738c/2cf48042),本批为纯配置迁移+核销。
纪律:一任务一 commit;判据机械;codegraph-first;监督者文档只读;禁 spawn;禁公网;不跑 playtest。

## C1|R14-R19 配置迁移(1-2 commits)

按草稿行四表参数落配置(步键归属按 FlowRegistry 现规则的 matches 步集合逐一对齐,含 T17 暴露的 famousCardViewed 所在步):
- R14 scout-open-famous(highlightActionWait)
- R15 scout-open-famous-detail(ensureSurfaceThenHighlight,personAlias=scoutFamousPerson,禁 id 进配置)
- R16 scout-close-famous-detail(orderedTargetFlow:先 detail 后 panel 有序)
- R17(草稿行:famous 关闭/领取衔接,按行照落)
- R18 scout-enter-selected-capital(orderedTargetFlow,siteAlias=capitalSite)
- R19 scout-focus-capital(effectSequence)
雷区(终审确认书同款):推进一律事件驱动;render 零状态写;ensure 副作用经 beforeEffects 显式声明,进步时一次。

## C2|旧规则核销 + 门禁登记(1 commit,可并入 C1 末)

FlowRegistry 对应旧规则删除(逐规则核销清单,S2 清单行号);EXPECTED_RULE_IDS/棘轮计数/四产物(S2/S3/S4/S5)再生成登记。
**判据**:核销清单逐条;六门全绿(纯度/新鲜度/事件契约/rule-ids/missingTypes=0/npm test 全量 ℹ 原文);被核销规则名在 FlowRegistry grep=0。

## 范围外

R31-R33(talent 弧,链条更后)与 R26-R30(首城弧)=后续批次;advanceTo 竞态照旧不修。

## 验证交接

完毕即停;验证席 T18(预算 500)判据:穿过 famousCardViewed 与编队段,首次真实驶入批次一的行军段(选目标/开 picker/出征)。

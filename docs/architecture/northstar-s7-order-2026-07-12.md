# 北极星 S7 任务单:单链上引擎(2026-07-12)【L2】

依据:roadmap §3-S7(不变量 §1 自动继承;判决器=64 条全程基线;规则清单=northstar-s2-tutorial-rule-inventory.json)。目的:引擎核心首落地——StepScript runner + 通用脚本类型 + 一段真实规则迁移,新旧引擎按步区间分治。本步为 L2 审级。
纪律:一任务一 commit;监督者署名文档只读,单外发现写交接;冻结三件套不碰;测试数字 ℹ 行原文;检索纪律(AGENTS.md):先 codegraph explore,禁大面积 rg/通读。

## E1|query 表最小集(1 commit)
仅本段(任务领取/开面板族,以 S2 规则清单圈定)所需的 UI 谓词,每条:名字→宿主实现(经 TutorialHostContext),逐条 justify(为什么配置表达不了)+单测。**query 表是逃生舱**:能用"步键+固定 target"表达的不得入表。
**判据**:表条目数与 justify 一一对应;单测绿;条目数写进验证(S8 预算的第一笔账)。

## E2|StepScript runner 核心(1-2 commits)
新目录 `frontend/js/tutorial-engine/`(建议名,可议)——**从第一天起零游戏 import**(纯度门禁本单即上线进 smoke,不等 S9c):runner 输入=(步键, 配置, ctx),输出=表现指令;**无游标可重入投影**(§1-1:每次 refresh 从头求值当前步脚本,无内部执行位置;本阶段步键=服务端步名,键源做成可替换参数——客户端游标切换归 S9c);脚本类型本段先落 2-3 种(highlightActionWait[带有序 when→target 子句]/ensureSurfaceThenHighlight/waitEventThenNext),类型注册表带预算计数。
**判据**:纯度门禁(引擎目录零 game/shell/controller import)+合成探针 FIRE;runner 单测含**重入测试**(同一状态任意次求值同结果;中途换步键重求值即切换,无残留);类型数入验证。

## E3|本段配置(1 commit)
S2 规则清单圈定的任务领取/开面板族规则(工厂产 makeTaskClaimPairRules/makeTabOpenRule 族)逐条改写为 {步键: {脚本类型, 参数}} 配置文件;参数只含文案 key/target 名/事件名/panel 名——**零谓词零函数**(需要谓词=先回 E1 走 justify)。
**判据**:配置文件纯数据(JSON/冻结字面量,门禁式核验);对应关系表(规则 id→配置项)入验证。

## E4|分治接线+核销(1-2 commits)
该段步进入引擎路径(TutorialHostContext 判定步键归属:清单内→引擎 runner,其余→旧 FlowRegistry);删除 FlowRegistry 对应规则,**逐规则核销清单**(出自 S2 规则清单,删一销一);ctx.requestAction 允许回落遗留 host 方法(descriptor 化为置换目标,不在本单)。
**判据**:核销清单与删除 diff 一致;S2 规则清单重生成反映删减(freshness);所有权/边界/纯度门禁全绿。

## E5|L2 验证包(1 commit)
受控环境全程双跑:投影与 64 条基线**逐字节 diff 空**(引擎段与旧引擎段行为完全一致);witness==0;npm test+smoke ℹ 原文;引擎段专项:该段每步在引擎 trace 中有步级记录(0a"教程走死=配置问题"的定责基建);验证文档含"未做"清单与 L2 审查材料索引。
**判据**:如上全绿;任何投影差异→declared+§1-9 走基线重录并明示行为变更点,不得掩盖。

做完 E5 即停,等 L2 审查。范围外:不迁本段之外任何规则(S8 裁决后才有 S9a)、不动输入盾(S9b)、不切客户端游标(S9c)、不删旧引擎骨架。

# 北极星 S2b 任务单:判决器全程化(2026-07-11)

依据:roadmap §3-S2 判决器 + §1-9 基线重录协议。S2 交接的 openArmyFormation(slot=1) 阻塞使转录基线停在 famousCardViewed(43 条前缀)——S3 及以后一切"全程投影等价"判据依赖全程基线,本单为 S3 硬前置。
纪律:一任务一 commit;监督者署名文档只读;单外发现写交接;冻结三件套不碰。

## W1|根因定责(1 commit,只取证不修)
复现并定责"点击 openArmyFormation 后 armyFormationEditor.open 仍为 false、步骤不推进":产品回归(候选假设:B1' 把首军/侦察名人发放改为任务领取后,编队打开的前置——军队存在或名人在册——在引导到达该步时尚未满足;或 B2 flag 门误伤)vs harness 缺步(转录 harness 未按新链先领取 main_first_army/main_scout_officer)。
**判据**:归属结论+可复现证据入验证文档(最小复现:单测或脚本直调 ArmyFormationEditorController.open 的前置条件对比 92a81298 与 HEAD;或 harness 日志对照任务领取时序);证据必须能区分两个假设,不许"大概率"。

## W2|按定责修复(1-2 commits)
- 若产品回归:在正确一侧修(引导链/前置逻辑对齐 B1' 新现实),带特征测试钉死"该步到达时前置已满足";禁止在教程模块里加游戏状态特判来绕(违 §0a)。
- 若 harness 缺步:修 harness 步序(补任务领取动作),产品零改动。
**判据**:定向测试绿;修复侧与 W1 定责一致;若碰产品代码,变更面最小并逐文件说明。

## W3|全程基线重录(1 commit)
转录跑通全教程(last.stepKey=教程终步),受控环境双跑 diff 空,替换 43 条前缀基线(§1-9:declared 基线重录,验证文档写明新旧条目数与差异性质);顺带把 S2 交接的金色像素阈值问题评估一句(修/不修/移交,不展开)。
**判据**:新基线 entries 覆盖全链且双跑一致(SHA-256);npm test + smoke 绿;验证文档 docs/architecture/northstar-s2b-verification-2026-07-11.md 含"未做"清单。

做完 W3 即停,等审查。范围外:不做 S3 的 ctx 适配、不动 FlowRegistry 结构(除 W2 定责为产品侧且必须动时,最小面)。

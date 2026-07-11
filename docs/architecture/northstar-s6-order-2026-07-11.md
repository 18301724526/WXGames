# 北极星 S6 任务单:割接——onXxx→事件总线 + poke 退役(2026-07-11)

依据:roadmap §3-S6(不变量 §1 自动继承;判决器=64 条全程基线;事件契约=northstar-s4-tutorial-event-contracts.json)。目的:游戏侧 90 处 onXxx 直调换成 ChangeEventBus emit,33 处非冻结 refreshCurrentHighlight 手工 poke 随 ui-changed 订阅落地逐批退役。
纪律:一任务一 commit;监督者署名文档只读,单外发现写交接;冻结三件套不碰(其内 3 处 poke 为 declared 残留,不计入归零);测试数字以 ℹ tests/pass 原文为准;**检索纪律(AGENTS.md)**:先 codegraph explore,禁大面积 rg/通读,只在编辑区段读原文。

## Z1|收端接线(1 commit)
TutorialGuideEventRegistry 订阅 ChangeEventBus(事件名沿用契约 18 名,payload 按契约校验,5 个命令结果事件运载结果对象);双漏斗 ui-changed 通知接入引擎刷新(refreshCurrentHighlight 的订阅化替身)。**过渡期双通道**:onXxx 直调与总线订阅并存但**去重**(同一事件不得触发两次 handler——写去重契约测试)。
**判据**:订阅链单测+去重契约测试;全程投影与基线 diff 空;witness==0。

## Z2|割接批一:CanvasActionController(39 触点)+对应 poke(1 commit)
onXxx 直调→bus.emit(payload 按契约);该文件内非冻结 poke 删除,每删一处配特征测试(以原 file:line 命名,经漏斗驱动同一 UI 变化断言订阅路径刷新)。
**判据**:该文件 grep tutorialController?.on=0、refreshCurrentHighlight=0;逐 poke 特征测试绿;期望计数(验证文档记 33→N 实数);全程投影 diff 空。

## Z3|割接批二:CanvasGameApp(24)+app.js(9)+对应 poke(1 commit)
同 Z2 纪律。含 S2b/W2 下沉到 CanvasGameApp.openArmyFormation 的通知(改 emit 同语义,保持"单次通知"特征测试)。
**判据**:同 Z2 形制;计数续降(N→M 实数)。

## Z4|割接终批:其余文件 + 归零 + 拆双通道(1 commit)
WorldMarchActionHandler/ArmyFormationEditorController/GameCommandService/CanvasPanelActionContextAdapter/CanvasGameShell 等余量割接;非冻结 poke 归零;**拆除 Z1 的过渡双通道**(onXxx 薄包装退役或改为 emit 别名,声明处置);受控环境全程双跑。
**判据**:非 tutorial 非冻结文件 refreshCurrentHighlight=0 且 tutorialController?.onX 直调=0(完整命令+冻结豁免清单);双跑投影与基线 diff 空(SHA 原文);witness==0;npm test+smoke 绿;若任何投影差异→如实 declared+按 §1-9 基线重录走 L2。

做完 Z4 即停,等审查。范围外:不迁规则(S7)、不建 query 表(S7)、不动输入盾(S9b)、EventRegistry 内部 handler 逻辑不重写(只换订阅源)。

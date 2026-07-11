# 北极星 S4 任务单:事件总线基建(2026-07-11)

依据:roadmap §3-S4(不变量 §1 自动继承;判决器=64 条全程基线)。目的:建"游戏发事件、引导订阅"的传输层与契约,**本单不割接**(90 触点仍走 onXxx 直调,割接归 S6)。
纪律:一任务一 commit;监督者署名文档只读,单外发现写交接;冻结三件套不碰。

## X0|host-surface 清单时点收尾(1 commit,S3 交接项)
S3-V1 清单在 HEAD 已过时(V2 后教程目录宿主表面收缩)。重生成清单至当前表面,并把"重生成 diff 空"接进 run-architecture-smoke(与 U2 规则清单同款门禁);验证文档记录 393→N 的收缩数字(=适配器效果的量化)。
**判据**:regen diff 空成为常驻门禁(smoke 内);收缩前后数字入验证。

## X1|双漏斗 change-notify + 薄总线(1 commit)
ModalStore 与 StateWriter.commit 两个既有写入单点增加 change-notify;新建极薄 emit/subscribe 总线(建议落 frontend/js/state/ 或 platform/,命名自定;无第三方依赖,无通配符魔法)。**加法式**:现有任何调用方行为不变。
**判据**:总线单测(订阅/退订/多订阅者/异常订阅者不拖垮发布);双漏斗 notify 契约测试(经 ModalStore.openModal/closeModal 与 StateWriter.commit 驱动,断言通知携带变更描述);全量测试+smoke 绿;全程 playtest 投影与基线 diff 空(加法无行为)。

## X2|18 事件必备字段契约文件(1 commit)
从 TutorialGuideEventRegistry 反推 18 个事件的必备字段表,机器可读入 docs/architecture/artifacts/(生成式优先;handler 内可静态推断的字段自动提取,推不出的人工补齐并标注 manual);5 个 syncFromResult 依赖事件必须声明"运载服务端命令结果对象";**canOpenTab 明文写进契约文件的 exclusions 节**(否决式询问,不上总线,唯一 veto seam=CanvasPanelActionRunner descriptor 钩子,引用 HOOKS 现名)。
**判据**:契约文件入 repo;一条端到端断言(经总线发一个含命令结果的事件,消费者 syncFromResult 收到并完成状态同步——用真实 EventRegistry handler,不用假消费者);tabClicked→tabId、buildingAction→buildingId+action 等字段级断言抽 3 条。

做完 X2 即停,等审查。范围外:不改任何 onXxx 调用点(S6)、不动映射表(S5)、不迁规则(S7)。

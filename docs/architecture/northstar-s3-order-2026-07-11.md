# 北极星 S3 任务单:ctx 边界(2026-07-11)

依据:roadmap §3-S3(不变量 §1 自动继承;判决器=S2b 后的 64 条全程基线)。目的:给教程模块立唯一合法通道(ctx 六接口适配器)+阻塞门禁,零行为变更(以见证器与投影证明,而非口称)。
纪律:一任务一 commit;监督者署名文档只读,单外发现写交接;冻结三件套不碰;TutorialGuideArchitecture.test.js 按 §1-6 允许改写(改写处逐条说明)。

## V1|宿主调用面枚举(1 commit)
新增生成脚本(U2 风格):静态扫描 frontend/js/tutorial/ 对宿主(game./canvasShell./controller./renderer 及经 host 的间接形态)的全部实调方法/字段,产出机器可读清单入 docs/architecture/artifacts/:每条 {file:line, 调用形态, 归类: effects/waitFor/requestAction/resolveTarget/queries/next 之一, 备注}。归类即 ctx 接口设计的原始表。
**判据**:重生成 diff 空(门禁式);验证文档抽 3 条人工对账;S2b 新增的 EventRegistry famousSeekCompleted 直写必须出现在清单中(它是已知实例,漏了=扫描器有洞)。

## V2|ctx 适配器(1-2 commits)
建 TutorialHostContext(或同名)适配器:以现有 TutorialGuideController/宿主为实现,按 V1 清单把 tutorial/ 内全部宿主触点改经适配器;**保留逐调用点回退序**(三宿主镜像读的既有优先序逐点保持,收敛引用不收敛语义);内置**分歧见证器**:三源(state/game.tutorial/game.state.tutorial)不等时计数+trace(fail-open 记账,不改行为)。
**判据**:教程测试(除反特征,改写处说明)全绿;grep tutorial/ 目录宿主直访=0(唯适配器文件豁免,完整命令+豁免清单);witness 计数器可读出且注入人工分歧时确实计数(合成探针)。

## V3|阻塞门禁(1 commit)
新门禁:frontend/js/tutorial/ 禁直访 game./canvasShell.(唯适配器豁免),进 run-architecture-smoke;同 commit 扩 check-ui-runtime-field-ownership.js 扫描正则覆盖动态键/setIfChanged 间接写形态(对 TutorialGuideController.js:541 历史形态的合成探针必须 FIRE——该判据自 v1 路线图移交至此)。
**判据**:两个门禁各 1 合成探针 FIRE 后还原(证据入验证);现存代码 0 违规或白名单 declared+烧毁计划。

## V4|零行为验证(1 commit)
全程 playtest --transcript 双跑:投影与 64 条基线 diff 空(逐字节);全测试+全程 playtest 期间 witness==0(若非 0:如实申报,按 §1-9 改判行为变更走 L2,不得掩盖);npm test+smoke 绿。结果入 docs/architecture/northstar-s3-verification-2026-07-11.md,含"未做"清单。
**判据**:如上全绿+witness 证据;基线不重录(本单声称零行为)。

做完 V4 即停,等审查。范围外:不建事件总线(S4)、不动映射表(S5)、不迁移任何规则(S7)、不删任何 hook。

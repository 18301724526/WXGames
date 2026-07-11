# 北极星 S7-REFRESHLOOP 任务单:高亮刷新×渲染回边的结构性根治(2026-07-12)

依据:GLM CDP 抓栈(证据 tmp/audit-A-enterstall.md + tmp/forensics-A/hang-forensics.jsonl)——intro-enter-city-2 点击后主线程锁死在 微任务 run(TutorialHostContext:1502)→refreshCurrentHighlight→refreshLegacyHighlight→flowRegistry.refresh→renderHouseGuide→...→renderReadOnly→syncWorldMapRendererLayerMetrics;intro 永停 enter、macrotask 饿死。G2 守卫+H1 重排两次点补仍漏。本单结构性根治,禁第三次点补。
纪律:一任务一 commit;监督者署名文档只读;冻结三件套不碰;测试数字 ℹ 原文;codegraph-first;禁 spawn 子任务;**验证只准本地隔离进程(terra 已搭 harness),禁 remote/公网**。

## G0|机制定死(1 commit,只取证不修)——先廉价席已做初判,本步坐实
用 terra 隔离 harness + CDP 复现:点击后连续 3 次 Debugger.pause(间隔 100ms)抓栈,判定是 (a)尾随微任务无限重排[run@:1502 反复触发、栈深恒定~12]还是 (b)同步深递归[单栈数千帧/refresh 帧重复]。同时计数微任务 run 触发次数与 refreshCurrentHighlight 重入次数。结论+3 栈证据入验证文档。
**判据**:三栈 diff 入档;run 触发计数;(a)/(b) 二选一明确结论。

## G1|统一刷新守卫(1 commit)——堵回边
根因=渲染路径(refreshLegacyHighlight→flowRegistry.refresh→render*)回头触发刷新,而守卫只在 refreshCurrentHighlight、refreshLegacyHighlight 是守卫外的旁路入口。修:把重入守卫下沉到"所有刷新入口的公共底座",refreshLegacyHighlight 也受同一 highlightRefreshActive 守卫;渲染期间(render* 执行栈内)任何刷新调用一律 coalesce 不同步执行。
**判据**:特征测试构造"渲染路径内再次调 refresh"→断言不同步递归、不无限;既有教程测试全绿。

## G2|尾随微任务硬上限(1 commit)——断无限循环
H1 的"pending 就重排"在渲染每次回置 pending 时形成无限微任务链。修:尾随刷新每个 macrotask 回合至多执行一次(一次性 flush),渲染期间置的 pending 不得在同一同步级联内触发新一轮尾随;设硬迭代计数上限(超限记 trace+停,fail-loud 不静默)。撤销 H1(5b206ec2)若其与本修冲突,以本修为准并说明。
**判据**:特征测试构造"渲染每次回置 pending"→断言微任务链有限终止+最终高亮正确;注入超限→trace 记录+不锁死。

## G3|渲染纯化断言(1 commit)——防复发
装"rendering"栈内标志:render*(renderReadOnly/renderGuideHighlightFrame/renderActive)执行期间若检测到 refresh 被调用,记 trace 并 drop(fail-loud 可观测),使"渲染触发刷新"这类回边永久暴露而非静默锁死。这是北极星"教程渲染纯投影"精神的守卫化。
**判据**:合成探针在渲染期调 refresh→断言被 drop+trace 记录;正常路径零触发。

## G4|H4 环境验证 + E5 收官(1 commit)——真机定论
terra 隔离环境全程双跑:intro-enter-city-2 通关、投影与 64 基线 diff 空、witness==0、advance-watchdog/refresh-reentry/render-purity 三 trace 计数合理、npm test+smoke ℹ 原文。H1/H2/H3 保留与否按 G1/G2 结论 declared。
**判据**:全程双跑通关(停滞消除的真机证据)+原 E5 全部判据。

做完 G4 即停等 L2 终审。范围外:不追其它步骤停滞(若有另案);S7b 账目另单。

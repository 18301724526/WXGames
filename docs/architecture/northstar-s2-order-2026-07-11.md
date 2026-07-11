# 北极星 S2 任务单:特征网与判决器(2026-07-11)

依据:tutorial-engine-northstar-roadmap-2026-07-11.md §3-S2(不变量 §1 自动继承)。目的:建立后续 S3-S9 所有等价性验收的判决器与计数单源。此后任何"投影 diff 空"判据都指向本单产物。
纪律:一任务一 commit(message 带任务号),按序;判据自验留证据;**监督者署名文档(裁决/清查/路线图/任务单)一律只读,进度标注由监督者维护,单外发现写交接说明**;冻结三件套不碰。

## U1|playtest 规范转录投影 + 双跑一致(1-2 commits)
scripts/playtest-online-tutorial.js 增加 `--transcript` 模式:输出有序规范投影序列,每项 {步键, 动作类型, target type, panelKey};排除字段白名单(时间戳/durationMs/waitedMs/实体 id 与人名[名人 RNG 时间种子]/像素指标/坐标)作为独立文件入 repo(投影实现必须消费该白名单,不得硬编码散落)。目标环境必须显式指定且默认本地(受控环境:本地 backend/server.js 进程或 WSL 本地部署,严禁默认打远程——历史上打错服务器造成过假死锁误报)。
**判据**:同一 commit 下受控环境连跑两次,投影文件 diff 为空;两个 runId+空 diff 证据入验证文档;白名单文件与投影产物样例入 repo;远程地址不再是默认值。

## U2|规则清单机器可读导出(1 commit)
新增脚本从 TutorialGuideFlowRegistry(含工厂产物)自动导出规则清单入 repo:每条 {规则 id/步名, 规则种类, 来源(工厂名或手写), file:line}。禁止手写清单——必须从代码生成,可复跑,重生成与入库文件 diff 为空(此为门禁式判据)。同法导出 TutorialGuideEventRegistry 的事件 handler 清单。
**判据**:重生成 diff 空;清单条目可与源码逐条对上(验证文档抽 3 条人工对账);S7/S8/S9 的一切计数自此以该清单为准。

## U3|教程测试打标 + 收尾(1 commit)
143 个教程相关测试产出机器可读打标清单入 repo:每文件 {路径, 分类: 可复用/退役候选(B3' 陪葬)/反特征}, 反特征=TutorialGuideArchitecture.test.js 类锁实现的测试。不改任何测试本身。收尾跑全量 npm test + node scripts/run-architecture-smoke.js,结果与 U1/U2 证据一并写入 docs/architecture/northstar-s2-verification-2026-07-11.md,含"未做"清单(诚实条款)。
**判据**:打标清单覆盖全部教程相关测试文件(枚举命令写进验证);测试零改动(git diff 只含新增文件);全量门禁绿。

做完 U3 即停,等审查。范围外:不动 FlowRegistry/Controller 产品代码、不做 S3 的 ctx 适配、不碰前端教程实现——本单只建"观测与判决"设施。

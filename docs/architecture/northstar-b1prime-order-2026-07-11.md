# 北极星 B1' 任务单:发放与任务条件改键(2026-07-11)

依据:tutorial-engine-northstar-roadmap-2026-07-11.md §3-B1'(不变量 §1 自动继承)。目的:把"有价值发放"从教程直写改为服务端任务条件(真实游戏状态)校验——这是纯前端教程终态的作弊面唯一防线,必须先于 S2 基线。
纪律:一个任务一个 commit(message 带任务号),按序;判据自验留证据;发现单外必改项写交接说明不动手;冻结三件套不碰;grep 判据用完整命令+显式豁免文件清单。

## T1|名人发放改任务奖励(1 commit)
现状:TaskRewardClaimer→TutorialGrantService.grantScoutFamousPerson→FamousPersonService.grantTutorialScoutFamousPerson 直推 gameState.famousPeople,台账在 gameState.tutorial.grants。
改为:发放由任务奖励声明驱动、经 FamousPersonService 的正规发放路径;发放台账迁出 tutorial 命名空间(落位自定,但不得在 gameState.tutorial 下——终态后端零教程概念)。
**判据**:famousPeople 写点全仓唯一且在 FamousPersonService(grep 命令+豁免清单写进验证);backend/services/tutorial/ 与 grant 链 grep gameState.famousPeople=0;发放幂等契约测试(重复领取不重发)。

## T2|首军发放与兵力 floor 改键(1 commit)
recordFirstArmyGrant 同 T1 迁移;MilitaryService.normalizeMilitaryState 的 getFirstArmyReserveFloor 从读 tutorial.grants 改读新台账(D1 已签:兵力 floor 键任务奖励发放记录)。
**判据**:MilitaryService grep tutorial.grants=0;floor 行为特征测试(有台账记录=floor 生效,无=不生效,数值与迁移前逐值一致);旧档带 tutorial.grants 的兼容读取(迁移或双读,写明取舍)。

## T3|任务条件改键(1 commit)
defaultTaskDefinitions.json 三处 tutorialStepAtLeast + TaskProgressEvaluator/TaskDefinitionNormalizer 的教程步条件类型→真实状态条件(建议:hasBuilding('house')/armyFormationSaved/firstCityOccupied,语义按现任务意图逐条对齐并在验证文档列对照表)。
**判据**:全仓 grep tutorialStepAtLeast=0(含 schema/normalizer);新条件类型逐个契约测试(满足/不满足/边界);现存玩家任务进度不回退(旧档评估测试)。

## T4|收尾验证(1 commit)
全量 npm test + node scripts/run-architecture-smoke.js;领取全流程定向验证(创建新档→满足条件→领取→发放到账)以真实本地服务进程跑通留档;验证文档追加 T1-T3 证据与"未做"清单。
**判据**:测试全绿;流程日志入 verification;诚实条款。

做完 T4 即停,等审查。范围外:不碰教程前端、不碰 S2 及以后任何步骤、不删 TutorialGrantService 文件本体(空壳保留到 B3' 统一删,避免本单扩面)。

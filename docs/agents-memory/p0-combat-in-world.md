---
name: p0-combat-in-world
description: P0 玩法填充——战斗系统本已接好世界，缺的是内容/利害/数值；野怪营地切片1a已实现验证；占城/老兵/平衡待做。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户 2026-07-05 授权填充后续玩法（"别破坏架构/单一事实源/模块化/可回退"）。设计文档=[docs/architecture/p0-combat-in-world-design-2026-07-05.md](../../docs/architecture/p0-combat-in-world-design-2026-07-05.md)。勘察=workflow wj1345lpu。

**颠覆性勘察结论**：战斗系统**不是**需要接线的——它已建好且两条链都闭环：
- 战斗核 `shared/battleSimCore.js` seeded 纯函数，前后端共用，`EntityBattleController` 能重放群体混战动画（三国群英传战斗场景是活的）。
- **占城打一场已闭环**：`claimConquest→resolveMission→ConquestBattleService.resolveConquestBattle`。空城不打只因走 settlement 免战分支（owner==='neutral'→0伤亡）。
- **打野怪打一场已闭环**：`startWorldMarch→resolveMarchTarget→resolveMissionArrival→resolveEncounterBattle`（WorldCombatEncounterService）。
- 真实缺口在**数值**：`BattleSimService.DEFAULT_BALANCE`/`BattleConfig.DEFENDER_PROFILES_BY_OWNER` 全是 PLACEHOLDER 占位；技能 core 里 stub、占城 inputStream 写死 allOut→技能未参战。
- **美术零缺口**：世界站点(camp蛮族营地/ruins/outpost/town/city)5张256×256 cutout + 战斗序列帧(player/enemy各4姿势) + 战场背景全在盘，质感统一。P0纯程序化补UI件即可。

**切片1a 野怪营地 = DONE & 双部署+WSL验证**（提交 `d6b6773b` design / `5a80c936` refactor）：
- `backend/config/WorldCampConfig.js`（纯常量单源）：3原型 bandit/raiders/warband，守军=base+perRing*ring，各带 lootTable+respawnCooldownMs；PLACEMENT 环带/密度/间距/上限。
- `backend/services/worldCombat/WorldCampSpawner.js`（纯+幂等）：`planCamps(seed,capital)` 用 world-gen 的 `roll01` 确定性铺点，避水/避安全环/避占用/minSpacing；`seedCampEncounters` 一次性折叠进 encounters（不覆盖 live 进度）。
- 关键事实：`WorldCombatEncounterService.normalizeEncounter` 本已参数化，多营地零前端改动就渲染成敌军标记；`normalizeCombatState` 遍历全部 encounter。改动=透传营地字段+`respawnCampIfReady`(respawnAt门控，旧stub保无条件重生)+`resolveEncounterBattle`胜利发战利品(走 `CityService.getActiveCity().resources` 规范入口)。
- **WSL实测**：8营地铺成(守军36/80/150按环)，派兵打→victory→战利品{food40,wood20}精确匹配bandit表→营地resolved不秒刷→旧stub不回归。
- 回退：不调seedCampEncounters只剩单桩；删respawnCampIfReady回无条件重生；旧存档新字段归零无害。

**修复：进攻必须行军过去**（提交 `e3ba83e7` design / `10318f13` refactor，WSL验证）：用户报"隔空点进攻就开打"。根因=`WorldMarchActionHandler.js` 对任何 combatEncounterId 直接 `enterInteractiveBattle`(startWorldCombat→openSession)，openSession 只查有没有兵、不查位置。修：①前端攻击一律 `startWorldMarch`(行军，到达/就地自动结算+播放战斗回放，删越权立即开战)；②后端权威门 `openSession` 校验部队 position tileId===敌军格(否则 `WORLD_COMBAT_NOT_IN_RANGE`，与被动 resolveMissionArrival 同条件)；③抽 `applyCampVictorySpoils` 共享纯函数，交互式 resolveSession 也发同样战利品+冷却(之前只有被动路径发，是营地切片引入的不一致)。**遗留/可选下一步**：交互式手动控制战斗现被行军+自动结算取代(仍有回放动画)（已被自动接战+撤退窗口模型取代：到达即 engaged→自动进入交互式实体战，勿再按自动结算模型实现）；若要"到达后手动打"需做 interactive-on-arrival 连线（openSession 门已就绪）。

**自动接战+撤退窗口（DONE & 双部署+WSL端到端验证）**：设计 docs/architecture/auto-engage-retreat-design-2026-07-05.md。**教训**：用户"自动接战+撤退窗口"，我先凭空设计撤退还追问参数——错，被点破"你没看过我战斗内容吗"。**你的战斗核 shared/battleSimCore.js 是实时可指挥 RTS**：小队令 advance/soldierAttack/defend/retreat + 主帅令 allOut/allRetreat（一次性）+ 战法怒气 + 主将阵亡 routChance 溃逃；前端 EntityBattleController interactive 模式（AI 控 side1、玩家控 side0，master('allRetreat')）+ BattleCanvasRenderer「全军撤退」按钮**已存在**。"撤退窗口"=交互式战斗本身。
- 提交链：`830ee17f`(自动接战：arrival→engaged 不秒结算；前端 maybeAutoEnterEngagedBattle 在 syncFromServer 检测自己 engaged mission 自动开交互战斗，dedup key missionId:encounterId:engagedAt；离线 AUTO_ENGAGE_FALLBACK_MS=45s 兜底 allOut，有 open session 时 defer；WorldExplorerMissionNormalizer 白名单加 engaged/inBattle；撤退 winner!==attacker+有幸存兵→resolveSession 后端权威 returnWorldMarch 返程) → `6f37ae76`(**撤退保军**：battleSimCore summarize survivorsByGid 从 alive&&!left 改为 alive——逃离战场但存活的兵算幸存，只有阵亡才算损失；否则全军撤退=全灭。battleSimCore 是 index.html 裸脚本非bundle，bump ?v=) → `dec17945`(**孤儿会话自愈**：客户端DTO不暴露 session，前端从 openSession 响应拿 battleId；关页面→session 永久 open 卡 SESSION_BUSY。normalizeCombatState 的 reapStaleSession：open 超 SESSION_STALE_MS=5min 且有有效 startedAt→清空+mission 重置 engaged)。
- **WSL端到端验证**：march→engaged→openSession(位置门过)→allRetreat→defeat 但攻方末兵300全保留→部队 active 返程往首都→营地存活；孤儿会话自愈。
- 遗留：前端自动开战斗需浏览器验(单测已锁)；空账号 codexqa 被我旧算法测试打光过、已重配 300 兵。

**待做**：切片2 空城守军（加 `hasGarrison` 标志位绕 `normalizeGarrison` neutral→null 短路 + `getOccupationMode` 免战分支，不改neutral全局语义）；切片3 老兵营地（伤亡分流，两落点 settleFormationSnapshot/settleMissionSnapshot 经同一纯函数截流，替换非叠加50%退款，`famousPerson.woundedUntil` 现成挂点）；全局真实平衡数值搬 config registry。1b 打磨：营地挂 camp 贴图 + 程序化守军兵力徽章（现渲成敌军标记，功能可用视觉弱）。相关：[[world-march-passability]]、[[soldier-economy-design-intent]]、[[battle-system]]。

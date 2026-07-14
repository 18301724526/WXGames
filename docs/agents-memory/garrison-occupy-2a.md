---
name: garrison-occupy-2a
description: 占城守军 ②a（空城按距首城档设防→打赢才占）后端已建+双部署，含关键"距首城=距capital不是距world原点"坐标坑；捕获面板②b待做。
metadata:
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-06 建（`049a92b8` design / refactor cherry-pick，双部署）。任务 P0-1「占城=先打一场」后端切片 ②a。

**设计**（用户拍板）：空城(neutral)按**距首城距离档**(config 表 `garrison`：safe≤3 不设防 / near≤8 / frontier≤16 / deep≤9999 设防)决定——出生区 safe 档直接占(settlement)，远档生成守军、打赢才占(conquest)。hostile 领地不变。捕获(打赢几率捕获守将→斩杀/招降/放生)是 ②b 待做（复用 post-war candidate + `FamousPersonService.acceptFamousPerson`招降/`dismissFamousPersonCandidate`放生/斩杀）。夺回/驻防挂起，等 AI/外交/势力系统。

**实现**：新 `backend/services/territory/GarrisonPolicy.js`（纯：resolveBand/isNeutralCityDefended/garrisonSoldiers/band 捕获招降率）。`TerritoryConquestMissions.getOccupationMode(territory, gameState)` 对 neutral safe 档返回 settlement，其余返回 conquest；`TerritoryCombatTargets.normalizeGarrison` 的 neutral 支路按 band 生成守军。两者读取同一 `territory.capitalDistance` 并经同一 GarrisonPolicy 判断，确保模式与守军不矛盾。

**关键坑（对抗 review 部署前抓到，critical）**：`WorldMapService.getDistanceFromCapital(x,y)` 里 `getDistanceFromCapital` **写死 from=(0,0)=世界原点**，但**capital 出生在环上(~18格)、territory 存绝对坐标** → 门口的城算出距离~18→deep 档→520 兵守军，safe 家园环对所有真实玩家失效。修：`TerritoryStateNormalizer.normalizeTerritory` 用**真 capital 原点**(options.capitalOrigin=getWorldMapOrigin(worldMap))`getRelativeDistance` 算**距首城**、盖章 `territory.capitalDistance`；getOccupationMode/normalizeGarrison 只读这个字段，绝不用 world 原点。`createSiteFromScout` 也从 worldMap.origin 盖章(即时守军)。回归测试：capital(18,-4)+site(19,-4)→capitalDistance 1(safe) 不是 19。**教训：距首城≠距世界原点；getScoutOrigin 是活动城不是首城；单测直喂 state.militaryView/坐标会绕过真实坐标空间——core-loop 改动必过对抗 review。**

顺带修：settlement 清 stale 守军/守将、settlement DTO 不发 defender。**遗留(低/自愈，已记)**：直接 0 兵 conquest 请求会 coerce 成 recommendedSoldiers(与 hostile 快占一致，DTO 正确路由客户端)；migration 跨档下次 normalize 才重算守军。

**待做 ②b 捕获面板** + **必须真机验收占城闭环**（占近城仍直占、占远城要打一场）。相关：[[p0-combat-in-world]]、[[config-table-pipeline]]（garrison 表）。

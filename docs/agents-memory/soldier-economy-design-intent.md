---
name: soldier-economy-design-intent
description: "Designer-stated soldier economy rules (2026-07-03): recruit-time food cost only; unassigned soldiers go to a future 老兵营地, NOT back to reserve; the immediate 50% refund is its interim stand-in; the ≥100 expedition reserve gate is deletable legacy scaffolding."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

Soldier economy rules as stated by the designer (2026-07-03), governing the tutorial-chain rework:

- **征兵扣粮，配兵免费**: food is charged ONLY when soldiers are recruited/trained into the city reserve (`MilitaryService.advanceTraining`, 1 food/soldier via `recruitmentCostPerSoldier`). The second charge at formation ASSIGNMENT (`setArmyFormation` positive reserveDelta) is a double-charge bug — remove it.
- **卸下不返预备役 → 老兵营地 (veterans camp, future feature, not yet designed)**: soldiers unassigned from a formation do NOT return to reserve (current code already does this). They will eventually go to a "veterans camp" where they slowly drain over time, refunding a SMALL amount of food per soldier during the drain. The current immediate 50% refund on unassign (`soldierRefundRatio`) is the INTERIM stand-in for that future drain-refund — KEEP it (and the config key) until 老兵营地 lands; do not treat it as dead code.
- **首城征服 ≥100 预备役是遗留脚手架，删除**: the MIN_EXPEDITION_SOLDIERS=100 player-side requirement (TerritoryAction gate) + its tutorial auto-grant scaffolding (`ensureTutorialFirstCityClaimSoldiers`, `ensureTutorialSettlementSoldiers`, `getTutorialSettlementSoldierFloor`) date from the earliest run-the-flow build and are wrong. NOTE the constant also serves as (a) enemy defense/recommendedSoldiers floor + soldier SCALE unit (TerritoryStateNormalizer/TerritoryShared — balance concern, do NOT delete blindly), (b) settlement-mode occupation commits exactly 100 settlers (TerritoryConquestMissions:72), (c) frontend expedition UI min/step/disable thresholds. Removal scope must split these roles; settlement soldier commitment + expedition UI minimum are open designer questions.
- **主线"首支军队"任务面额 = 1000 exactly** (the +100-for-conquest rationale died with the gate). 1000 sticks only via a tutorial cap floor until formation save (barracks L1 reserve cap = 300, `normalizeMilitaryState` clamp).
- All tutorial 幂等发放 (ensure* grants) are to become TASK REWARDS per the designer (house resources, barracks funding, soldiers, and the scout famous-person grant — the latter needs a new famousPerson reward type). Relates to [[world-march-tutorial-403-by-design]] and [[coord-tileid-single-source]] (tutorial cross-cut).

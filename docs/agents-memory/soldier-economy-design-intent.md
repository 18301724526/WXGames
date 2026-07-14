---
name: soldier-economy-design-intent
description: "Designer-stated soldier economy rules (2026-07-03): recruit-time food cost only; unassigned soldiers go to a future 老兵营地, NOT back to reserve; the immediate 50% refund is its interim stand-in; the ≥100 expedition reserve gate is deletable legacy scaffolding."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

Soldier economy rules as stated by the designer (2026-07-03):

- **征兵扣粮，配兵免费**: food is charged ONLY when soldiers are recruited/trained into the city reserve (`MilitaryService.advanceTraining`, 1 food/soldier via `recruitmentCostPerSoldier`). The second charge at formation ASSIGNMENT (`setArmyFormation` positive reserveDelta) is a double-charge bug — remove it.
- **卸下不返预备役 → 老兵营地 (veterans camp, future feature, not yet designed)**: soldiers unassigned from a formation do NOT return to reserve (current code already does this). They will eventually go to a "veterans camp" where they slowly drain over time, refunding a SMALL amount of food per soldier during the drain. The current immediate 50% refund on unassign (`soldierRefundRatio`) is the INTERIM stand-in for that future drain-refund — KEEP it (and the config key) until 老兵营地 lands; do not treat it as dead code.
- **首城征服 ≥100 预备役是遗留脚手架，删除**：`MIN_EXPEDITION_SOLDIERS=100` 的玩家侧门槛不应继续承担准入作用。但该常量还服务于敌军防御/推荐兵力下限、兵力尺度、settlement 模式的 100 人承诺，以及前端远征 UI 的 min/step/disable 阈值，拆除时必须切分这些职责。
- **主线“首支军队”任务面额 = 1000 exactly**；兵营 L1 预备役上限为 300，`normalizeMilitaryState` 的 clamp 与任务目标之间需要独立校准。

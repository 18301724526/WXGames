# Step5 Adjudication + Tranche 1 Order (owner-approved)

Status: **ACTIVE ORDER, 2026-07-11.** Authority: owner delegated the architecture rulings
to the supervising reviewer; owner governance mission = architecture cleanup, redundant
code, dead code, single source of truth, decoupling.
Spec of record: `step5-runtime-decoupling-and-bug-traceability-spec-2026-07-10.md`.
The five open decision points in that spec (§9) are hereby RESOLVED as below — treat
these rulings as normative amendments to the spec. Scope of this order = Part 0 fix +
**Tranche 1 only** (Phase 0-2 + one Phase-4 vertical slice). STOP after Tranche 1 for
review; Phases 3/5/6/7 and the rest of Phase 4 are NOT authorized yet.

## Standing integrity clause (unchanged, applies verbatim)

All verification evidence: real local server process (health captured same-run),
reproducible command, stub-free; measured values only — a hardcoded assertion literal
(`true`) in any evidence artifact is treated as fabrication. Reality mismatch → record
finding or blocker report; never simulate the desired reality. Frozen button-scheduler
files stay blob-identical. Do not touch resource-node. Full `npm test` green, lint
clean, LF, architecture smoke exit 0, per-task commits, push `origin` + `private` after
each phase gate.

## Part 0 — fix the step4 evidence wrapper (before any step5 work)

`scripts/verify-step4-phase3-real-server.js` currently hardcodes
`productionWorker/productionRepositories` and the top-level assertion block
(`realServer/realWorker/noMocksOrStubs/workerWritesThroughPipeline`) as literal `true`
(lines ~59-83), and maps `integrity.productionServer` from a field that does not exist
in the source evidence (step3 script emits `stubFree`, not `productionServer`) —
producing a self-contradictory committed artifact
(`docs/architecture/evidence/step4-phase3-real-server-2026-07-10.json`: line ~8
`productionServer:false` vs line ~2134 `realServer:true`).

Fix: every assertion field must be **measured** from the actual run (derive from the
source evidence's real fields; drop or compute `productionServer` correctly), regenerate
the evidence JSON so it contains no contradictions, and add a self-check: the wrapper
must fail (exit 1) if any assertion field would be emitted without a measured source.

## The five rulings (normative; implement exactly)

**R-D1 — UI runtime state store is APPROVED as a `frontend/js/state/` store-family
member; the bitecs axiom is untouched.**
Boundary, to be stated verbatim in the spec and enforced: the ECS layer (world/fog/
frame/mode simulation state) is REAL bitecs only; UI runtime state (militaryView,
activeTab, armyFormationEditor, and the other §2 fields) belongs to the established
store family (ModalStore / BattleStore / TerritoryUiStateStore precedent). The new
`UiRuntimeStateStore` must follow that family's exact pattern (same subscription/commit
conventions as StateWriter-committed stores). Any ECS-simulation field found in the UI
store is a gate violation.

**R-D2 — Single source of truth via a field-ownership manifest.**
Create a machine-readable manifest mapping every UI runtime field → exactly one owning
store. Fields ModalStore already owns STAY in ModalStore — the new store must not hold,
mirror, or cache them. Add a blocking architecture gate that fails on: a field owned by
two stores, a field absent from the manifest but present in a store, or a read of a
field bypassing its owning store (heuristic scan acceptable; must FIRE on a synthetic
violation — record the probe).

**R-D3 — Trace metadata never enters the idempotency digest.**
The command envelope separates `payload` (digested) from trace metadata (not digested)
as distinct envelope sections. Add a contract test: two submissions identical in payload
but different in trace fields produce the SAME idempotency digest (replay), and a
mutation of payload produces a different digest (conflict). No trace field may be read
by domain handlers.

**R-D4 — Exit criteria become numeric.**
Replace every "明显下降/significantly reduced" exit criterion with numeric targets
derived from the spec's own reproduced baselines (544/17/24; militaryView 67 /
activeTab 42 / armyFormationEditor 23; authority-write 2; command-handler 137;
12552/441). For each: state the target number (zero where the category is being
retired) and wire the corresponding report as the measuring gate. Update spec §7
accordingly in the same commit that implements the measurement.

**R-D5 — Tranche execution.**
Tranche 1 (this order): Phase 0 (freeze baseline + choose retirement subset), Phase 1
(BUG trace链路), Phase 2 (UiRuntimeStateStore per R-D1/R-D2), plus ONE Phase-4 vertical
slice (pick a single input/action descriptor family, migrate it end-to-end through the
new registry as the pattern-proof). STOP after Tranche 1's gates pass and push; the
supervising review runs before Tranche 2 is authorized. Phases 3/5/6/7 and the rest of
Phase 4 are out of scope until then.

## Per-phase self-review gate (same as step3 discipline)

Focused tests green → full `npm test` green → lint clean → LF → smoke exit 0 → frozen
files blob-check → new guards FIRE-probed (novel synthetic, recorded, reverted, tree
clean) → real-server evidence honest → commit per task, push per phase. Verification
doc: `step5-tranche1-verification-2026-07-11.md` with per-phase records. Anything
unachievable → EXECUTION-BLOCKER-REPORT and stop that area. Final summary must state
honestly what was and was not done.

---
## 修正案(2026-07-11,监督者):教程字段两轨划界
教程镜像字段(app/game.state/canvasShell 三宿主)的收敛与删除归教程北极星路线图(tutorial-engine-northstar-roadmap-2026-07-11.md)S3/S9c;step5 各 Phase 执行中遇 tutorial 字段违规**只登记不修**,防两轨双做。check-ui-runtime-field-ownership.js 与 UiRuntimeFieldOwnershipManifest.json 为两轨共享工件,改动 commit message 须标注轨道归属。

# Step3 Overnight Order — Part 0 Fixes + Phases 2-7 (goal mode, self-review to full pass)

Status: **ACTIVE ORDER, 2026-07-10.** Owner is asleep; you run in goal mode: iterate,
self-review against every gate below, and only declare done when EVERYTHING passes.
Scope = Part 0 + Step3 Phases 2-7. Do NOT touch resource-node. Frozen button-scheduler
files stay blob-identical. The supervising reviewer audits the final submission.
Specs of record: step3 implementation spec/tasks + contract oracle v0.7 (§4.4.1 RATIFIED).

## ⚠️ INTEGRITY CLAUSE — read first, this decides whether your work is accepted at all

The previous submission's D1 "real-flow server rejection" evidence was **fabricated**
(HTTP 400 `FORMATION_EMPTY`/`编队为空，无法出征` exists nowhere in the backend; the real
server accepts empty-formation marches; the recorded response came from a stub). That is
the single fastest way to get an entire order rejected.

From now on, ALL verification evidence must be:
1. Produced against the **real local server process** (started from this repo), with the
   health endpoint response captured in the same run to prove which process served it.
2. Reproducible: the exact script/command checked into the verification doc, raw
   request/response captured verbatim.
3. **Stub-free**: any mock/stub in an end-to-end claim = fabrication.
4. If reality does not match a requirement (e.g. the server lacks a validation), you do
   NOT simulate the desired reality — you write it down as a finding, fix it if it is in
   scope, or file an EXECUTION-BLOCKER-REPORT if it is not. Honest blockers are success;
   fabricated passes are the only true failure.

## Part 0 — fix the confirmed re-review findings (gate before Phase 2)

- **P0-1 Server formation validation (the gap the fabrication hid).** Backend
  `startWorldMarch` must reject empty formations / no-soldier primary with a structured
  400 domain error (message in Chinese per backend convention, e.g. `FORMATION_EMPTY`).
  Place validation where other march domain checks live (WorldExplorerActions /
  march validation path), reusing `shared/formationDeploymentEligibility.js` (do not
  fork the rule; it is shared for exactly this reason). Add backend tests: empty
  formation → 400 structured; valid formation → accepted.
- **P0-2 Honest re-verification.** Re-run the D1 real-flow against the REAL server
  (per the integrity clause), replace the fabricated section of
  `step3-phase1-client-command-semantics-verification-2026-07-10.md` with the honest
  record, and add a one-line correction note acknowledging the replaced evidence.
- **P0-3 Guard coverage.** `check-client-command-block-reasons.js`: add the Shell
  forwarders introduced by 7dbbee09 (`CanvasGameShell.js` startWorldMarch/
  returnWorldMarch/stopWorldMarch, ~:1497-1515) to DISPATCH_METHODS coverage; generalize
  the ternary detector beyond the literal `blockCanvasModal` replacement (any
  domain-conditioned replacement of a command action type must fire). Re-run your own
  synthetic FIRE probes (different from previous ones) and record them.
- **P0-4 Deputy-warning confirm flow reachability.** 7dbbee09's Shell fast path made the
  preserved deputy-warning confirmation dead code on the active tap path. Restore the
  confirm-flow behavior (warning shown, confirm path actually submits) on the live path,
  with a test.

## Ratified lock architecture (implement in Phase 4/6 exactly as specified — oracle v0.7)

Generalize the proven SQLite lease-lock. Zero parallel systems, zero temporary bridges.

- Table `owner_locks` (same DB, created via the existing SchemaMigrationService pattern):
  `ownerKey TEXT PRIMARY KEY, holderId TEXT NOT NULL, scope TEXT, lockedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL` + index on `expiresAt`. Key forms: `player:{playerId}`,
  `territory:{territoryId}`, `encounter:{encounterId}`, `ops:global` (extensible:
  `loot:{id}`, `boss:{id}`).
- One repository (`OwnerLockRepository`, modeled line-for-line on
  `PlayerStateLockRepository`: TTL lease, holderId = instanceId+uuid, expired-lock
  reclaim, Atomics.wait poll) and ONE public entry:
  `withOwnerLocks(ownerKeys, scope, fn, options)`:
  - dedupe + sort ownerKeys lexicographically (canonical total order → deadlock-free);
  - acquire all-or-nothing upfront, in order; on timeout release acquired locks in
    reverse and throw `OWNER_LOCK_TIMEOUT` naming the contested key;
  - release in reverse order in `finally`;
  - **no incremental acquisition mid-execution, ever** (COP-LOCK-001/CONCURRENCY-001).
- `withPlayerStateLock(playerId, ...)` becomes a thin delegate to
  `withOwnerLocks(['player:'+playerId], ...)`. Migrate `player_state_locks` data/usages;
  retire the old table via a schema migration. No dual-write period.
- world-worker uses the same repository over the same DB file → cross-process mutual
  exclusion by construction.
- Acceptance tests (oracle §8 addition): ① cross-process — a child-process writer and
  the test process contend on one ownerKey and serialize (better-sqlite3, same file);
  ② different keys run concurrently; ③ lease expiry reclaim (crashed-holder recovery);
  ④ dual-lock canonical order — `player:X`+`encounter:Y` acquired from two callers in
  opposite mention-order do not deadlock.

## Phases 2-7 (per step3 spec/tasks; sequence strict, one phase = one gate)

- **Phase 2** ClientCommandSender: one submit path, stable commandId+idempotencyKey per
  write, in-flight transport dedup, GameAPI helpers become facades.
- **Phase 3** CommandEnvelope normalizer + table-driven CommandOwnerResolver (reject
  missing target ids; exhaustive table tests; report-only owner logs until migration).
- **Phase 4** CommandIdempotencyStore (replay returns stored result; key+different
  payload digest → conflict) + CommandExecutionPipeline skeleton (trace → idempotency →
  owner resolution → **withOwnerLocks** → load → validate → execute → commit →
  projection → response). Committer owns persistence.
- **Phase 5** Route/handler migration per Step1 inventory: build first (strip lock/save
  from BuildBuildingCommandHandler), then /api/game/action registry actions,
  buildings/build, tasks/claim, heartbeat march writes; login/reset per inventory
  classification. Handlers execute inside pipeline-owned owner context; no route-owned
  orchestration left behind helpers.
- **Phase 6** Shared owners live: territory contest + world combat/encounter writes take
  `territory:{id}`/`encounter:{id}` via withOwnerLocks (canonical order with player
  locks); march→encounter handoff points explicit; world-worker writes go through the
  same pipeline/locks.
- **Phase 7** Blocking gates in run-architecture-smoke per migrated inventory id (flip
  report-only→blocking in the same commit that claims each migration); block new writes
  lacking inventory/owner/envelope/idempotency/tests; block route orchestration and
  handler-owned lock/save after migration claimed; block fake compliance patterns.

## Per-phase self-review gate (run ALL before moving on; record results per phase)

1. Focused tests for the phase green; full `npm test` green; `npm run lint` clean; LF;
   `node scripts/run-architecture-smoke.js` exit 0; Step1 report drift 0.
2. Frozen files blob-check: `git rev-parse HEAD:<file>` unchanged for
   CanvasPanelActionRunner.js / its test / CanvasPanelCompatibilityRetirement.test.js.
3. Any new guard/gate you add: synthetic-violation FIRE probe (novel each time),
   recorded, reverted, tree clean.
4. Real-flow claims: integrity clause applies — real server, captured raw, reproducible.
5. Commit per task, push `origin` + `private` after each phase passes its gate (deploy
   gate runs on private push; that is expected).
6. Anything unachievable or any spec contradiction → EXECUTION-BLOCKER-REPORT + stop
   that area; continue independent areas if safe, else stop entirely. Never patch
   around a gap.

## Final self-audit before declaring done

Exit criteria = step3 spec §6 (all 11) + this order's Part 0 all closed + every phase
gate recorded in a verification doc (`step3-phase2-7-verification-2026-07-10.md`) with
honest evidence. State explicitly in the final summary: what was NOT done and why, any
deferred items with records. An accurate "90% done, X blocked because Y" beats a
fabricated 100% — the reviewer will find fabrication, and it voids the whole order.

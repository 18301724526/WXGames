# Step3 Part 0 + Phases 2-7 Verification

Status: **IN PROGRESS, 2026-07-10.** This record is updated only from executed commands.
End-to-end claims require a real local server process and same-run health evidence.

## Baseline

- Branch: `main`.
- Baseline commit: `4711ef009f0d6bce53134a96b327f11eb16362ab`.
- `origin/main`, `private/main`, and local `HEAD` matched before work began.
- `git pull --ff-only origin main`: already up to date.
- Baseline `npm test`: 2282/2282 passed.
- Baseline `npm run lint`: passed.
- Baseline `node scripts/run-architecture-smoke.js`: exit 0.
- Baseline Step1 inventory drift: 0.
- `resource-node`: path is absent from this workspace; no file under that path was created or touched.

Frozen blob baseline:

- `frontend/js/platform/CanvasPanelActionRunner.js`:
  `c45d1ab4eb245337b22b1555a027a147ae8b5a80`
- `frontend/js/platform/CanvasPanelActionRunner.test.js`:
  `c6f92374db9189e5d48792365c48ad1d7669a36e`
- `frontend/js/platform/CanvasPanelCompatibilityRetirement.test.js`:
  `59ea0f56a18194a25dcc09a7e3df5160cb7eb52d`

## Part 0

Contracts: `COP-CLIENT-001`, `COP-CLIENT-002`, `COP-AUTHORITY-001`.

### P0-1 Server Formation Validation

- `startWorldMarch` now uses `shared/formationDeploymentEligibility.js` for every
  non-combat march after tutorial formation lookup.
- Empty formation returns structured HTTP 400 result:
  `FORMATION_EMPTY` / `编队为空，无法出征`.
- Primary general with zero soldiers returns:
  `FORMATION_PRIMARY_NO_SOLDIERS` / `主将未配置士兵，无法出征`.
- Existing world-combat-specific deployment errors remain unchanged.
- Route tests cover empty formation HTTP 400 and a soldiered primary HTTP 200.

### P0-2 Honest Real-Server Re-verification

Reproducible command:

```powershell
node scripts/verify-step3-part0-real-server.js --output docs/architecture/evidence/step3-part0-real-server-2026-07-10.json
```

The script starts the real `backend/server.js`, publishes a temporary matched config release
through production modules, uses temporary SQLite files, logs in through the real route, prepares
state through the real `GameStateRepository`, sends the real HTTP command, and stops the process.
No mock/stub server or route is used.

Captured same-run facts:

- PID `144888`, port `51766`, entry `backend/server.js`.
- `/api/health`: HTTP 200, git commit `4711ef009f0d6bce53134a96b327f11eb16362ab`,
  config runtime `matched`, gate mode `required`.
- `POST /api/game/action` raw body:
  `{"action":"startWorldMarch","targetQ":1,"targetR":0,"cityId":"capital","formationSlot":1}`.
- Actual command result: HTTP 400, `FORMATION_EMPTY`, `编队为空，无法出征`.
- Raw request headers/body and raw response headers/body are stored verbatim in
  `docs/architecture/evidence/step3-part0-real-server-2026-07-10.json`.
- Spawned PID was absent after capture; recorded termination signal: `SIGTERM`.
- The invalid Phase 1 D1 record was explicitly corrected and replaced in
  `step3-phase1-client-command-semantics-verification-2026-07-10.md`.

### P0-3 Guard Coverage

- `CanvasGameShell.startWorldMarch`, `returnWorldMarch`, and `stopWorldMarch` are included in
  `DISPATCH_METHODS` structural inspection.
- A domain-conditioned ternary now fires when either branch replaces a command action with any
  different action type; detection is no longer limited to `blockCanvasModal`.
- `GuideTaskCanvasRenderer` no longer derives claim/navigation action type from `claimable`; it
  consumes the presenter-owned action and keeps only a non-command navigation fallback.

Novel temporary FIRE probes injected into actual source:

```text
frontend/js/platform/CanvasActionDispatcher.js:51 command action startWorldMarch conditionally replaced by openSettings
frontend/js/platform/CanvasGameShell.js:1502 domain-conditioned early return in returnWorldMarch
```

Both probes produced exit code 1, were removed immediately, and the guard then printed
`client command block reason guard passed`. `git diff --check` remained clean.

### P0-4 Deputy Warning Confirm Reachability

- The Shell `startWorldMarch` forwarder now re-enters `CanvasActionController`, so the existing
  `WorldMarchActionHandler` deployment warning is on the live tap path.
- Live-path test proves a deputy with zero soldiers opens
  `worldMarchDeploymentWarning`, performs no submit before confirmation, and submits exactly once
  after `confirmWorldMarchDeployment`.

### Part 0 Gate

Focused tests:

- World route/service, Shell live path, renderer action ownership, and guard tests: 142/142 passed.
- Shared formation error mapping plus world-explorer architecture budget: 42/42 passed.

Iteration note: the first full test attempt passed all behavior tests but failed the existing
`WorldExplorerActions.js < 500 lines` architecture budget. The error mapping was moved into the
shared eligibility module; `WorldExplorerActions.js` ended at 498 lines. The final gate below is
the result after that correction.

Final gate:

- `npm test`: 2286/2286 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0.
- `node scripts/report-command-owner-step1.js`: inventory drift findings 0.
- `node scripts/check-source-encoding.js`: violations 0.
- Changed and untracked files checked after writing this record: 15, all LF-only.
- `git diff --check`: passed.
- Frozen working-tree blob hashes equal the baseline hashes above.
- Real-server verification command: exit 0.
- Temporary FIRE probes removed; production guard passes.

## Phase 2

Status: not started.

## Phase 3

Status: not started.

## Phase 4

Status: not started.

## Phase 5

Status: not started.

## Phase 6

Status: not started.

## Phase 7

Status: not started.

## Final Self-Audit

Status: not started. No completion claim is made while any phase above remains incomplete.

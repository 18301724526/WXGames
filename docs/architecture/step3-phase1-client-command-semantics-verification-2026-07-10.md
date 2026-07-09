# Step3 Phase 1 Client Command Semantics Verification

Status: **RE-ADMISSION DELTA COMPLETE, 2026-07-10.** Scope remains STEP3-T01 + STEP3-T02
plus owner-approved D1-D5 only. Phase 2 was not started and `resource-node` was not touched.

Correction (2026-07-10): the previous D1 HTTP 400 record came from a stub, was invalid, and is replaced below with evidence from a real local `backend/server.js` process.

## Commits

- `1fd860d5` - STEP3-T01: split visual disabled state from command-submit state.
- `3e990e33` - STEP3-T02: restrict and log local command-submit block reasons.
- `6154d4a3` - D2: restore `visualDisabled` button rendering.
- `bb48e6af` - D1: allow empty-formation world march submission.
- `f745c09b` - D3: make tutorial state display-only for command submission.
- `a06722aa` - D4: strengthen and wire the client command-block guard.
- `b5a649b4` - D5: converge tutorial readers and remaining command producers.
- `7dbbee09` - D1 live-flow follow-up: forward world march through the mounted game object.
- `f9506366` - D2 live-flow follow-up: surface territory domain rejection without `pageerror`.
- `cb2a0a42` - synchronize existing Step1 command inventory call-site line numbers.

## D1-D5 Closure

- D1: `WorldMarchActionHandler` no longer treats deployment eligibility as a terminal client
  rejection. Empty formations reach `GameAPI.startWorldMarch`; Part 0 now adds the missing real
  server formation validation and the honest real-process record below.
- D2: `CanvasSurfaceRenderer.drawButton` consumes `visualDisabled` as a disabled-style hint.
  The world-site launch button remains grey, keeps its hit target, submits, and handles HTTP 400.
- D3: compliance option (a) was implemented. Tutorial state may still constrain non-command
  input routing, but it no longer swallows command submissions in `CanvasGameShell` or
  `GameCommandService`. No deviation record is required.
- D4: the guard now parses dispatch paths with `espree`, catches domain-conditioned early
  returns and command-to-modal conditional replacement, checks `commandDisabled` reasons,
  and runs as a blocking architecture-smoke gate with synthetic-violation tests.
- D5: tutorial target readers use `isVisuallyDisabled(action)`, visually disabled commands are
  excluded from guide targets, and remaining command producers use `visualDisabled`.

## Frozen Button Scheduler Contract

- `CanvasPanelActionRunner.js` blob stayed `c45d1ab4eb245337b22b1555a027a147ae8b5a80`.
- `CanvasPanelActionRunner.test.js` blob stayed `c6f92374db9189e5d48792365c48ad1d7669a36e`.
- Direct frozen test run: 6/6 passed, including disabled short-circuit and hook behavior.
- No retired compatibility path or repair layer was reintroduced.

## P0-2 Honest D1 Real-Server Re-verification

Reproducible command:

```powershell
node scripts/verify-step3-part0-real-server.js --output docs/architecture/evidence/step3-part0-real-server-2026-07-10.json
```

The checked-in script starts `backend/server.js` on an OS-assigned free port with temporary
SQLite game/observability databases and a temporary config release published through the real
`ConfigPipeline` and `ConfigReleaseService`. It then performs a real login, prepares the player
state through the real `GameStateRepository`, sends the real HTTP command, asserts the response,
and stops the spawned process. No mock or stub server is involved.

Same-run identity and health evidence:

- Spawned server PID: `144888`; entry: `backend/server.js`; stopped with `SIGTERM` after capture.
- `GET http://127.0.0.1:51766/api/health` returned HTTP `200`.
- The raw health body identifies git commit
  `4711ef009f0d6bce53134a96b327f11eb16362ab`, config status `matched`, and gate mode `required`.
- The exact health request, headers, status, headers, and unmodified response body are stored under
  `health` in
  `docs/architecture/evidence/step3-part0-real-server-2026-07-10.json`.

Empty-formation command evidence:

- Exact body: `{"action":"startWorldMarch","targetQ":1,"targetR":0,"cityId":"capital","formationSlot":1}`.
- The exact request, including the local-only bearer token, and the unmodified raw response are
  stored under `startWorldMarch` in the same evidence JSON.
- Actual response: HTTP `400`; `error: FORMATION_EMPTY`; message `编队为空，无法出征`.
- The evidence assertion records `passed: true`; the spawned PID was confirmed absent after the run.

## Historical D2 UI Evidence Scope

The earlier temporary static/API harness is retained only as historical pixel and client-routing
evidence for D2. It is not used as server-response or end-to-end proof under the current integrity
clause. Server truth claims must use the real-process evidence format above.

### D4 - Adversarial Guard Self-Check

Temporary synthetic violation injected into `CanvasActionDispatcher.handle`:

```js
if (normalizedAction?.eraLocked) return true;
```

Guard result:

```text
EXIT_CODE=1
frontend/js/platform/CanvasActionDispatcher.js:53 domain-conditioned early return in handle
```

The injection was then removed. The file hash returned to
`8fe3b8349d3ec7db41038c0e184dd2d6767414e5`, and the guard printed
`client command block reason guard passed`.

Temporary UI evidence was written outside the repository to:
`%TEMP%/wxgames-step3-readmission-flow/result.json`,
`empty-formation-before-click.png`, and `site-disabled-before-click.png`.

## Quality Gates

- Full `npm test`: 2282/2282 passed.
- `npm run lint`: passed.
- `node scripts/run-architecture-smoke.js`: exit 0.
- Step1 command inventory drift findings: 0.
- Client command block guard: passed after synthetic violation removal.
- Frozen button-scheduler test: 6/6 passed; frozen blobs are identical.
- `resource-node` diff: none.
- Source encoding, LF, and `git diff --check`: passed.

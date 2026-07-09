# EXECUTION-BLOCKER-REPORT: Step1 Command Owner Rectification

Date: 2026-07-09
Status: BLOCKED after T6
Scope: Step1 only

## Blocking Condition

The Step1 rectification order requires stopping if the acceptance path cannot be
met without narrow exceptions or bypasses. T1 through T6 were implemented as
report-only changes and committed independently, but the full architecture smoke
gate cannot currently complete on `main`.

Command run:

```text
node scripts/run-architecture-smoke.js
```

Observed failure:

```text
Error: ENOENT: no such file or directory, open
F:\AI Project\WXGamesLocal\docs\stable_block_manifest_2026-06-09.json
```

The failing file is required by:

```text
scripts/check-stable-blocks.js
```

Repository check:

```text
git ls-tree -r HEAD --name-only | rg "stable_block|stable"
```

Result:

```text
scripts/check-stable-blocks.js
scripts/check-stable-blocks.test.js
```

So the required stable block manifest is not present in the current `HEAD`.
This is outside the Step1 command-owner scanner/report scope and should not be
papered over by moving the Step1 report, skipping the stable guard, adding a
narrow exception, or creating a placeholder manifest without owner approval.

## Completed Before Block

- T1 commit `443af37b` - real Step1 scanners and alias anti-evasion.
- T2 commit `a23ad965` - world-combat actions classified as route-level bypasses.
- T3 commit `580b561b` - ops writes, diagnostic GameAPI writes, and register no-write exclusion inventoried.
- T4 commit `1d822f87` - frontend direct submits expanded to 52 per-call-site rows.
- T5 commit `cbe996bc` - owner-key coverage cross-validates shared lookup blockers.
- T6 commit `56a7d573` - Step1 report wired into architecture smoke and node:test coverage added.

## Verified Before Block

```text
node --test scripts/report-command-owner-step1.test.js
node scripts/report-command-owner-step1.js --summary
npx eslint scripts/run-architecture-smoke.js scripts/report-command-owner-step1.test.js --suppressions-location eslint-suppressions.json
git diff --check
```

The Step1 report summary at the block point shows:

```text
checks defined: 12
server write entries inventoried: 17
server write exclusions documented: 1
game actions inventoried: 29
frontend write helpers inventoried: 32
frontend command paths inventoried: 57
scanned server write routes: 15
scanned GameAPI write helpers: 32
scanned frontend direct submits: 52
inventory drift findings: 0
anti-evasion assertions: 10
```

During the full smoke run, the newly added Step1 node:test file did execute and
passed before the existing stable block guard failed.

## Not Done Because Of Block

- T7 Step1 spec classification amendment.
- T8 contract-test oracle second-writer clause.
- Final Step1 progress completion section.
- Full `npm test`, full `npm run lint`, final smoke confirmation, and pushes to
  `private` and `origin`.

## Required Owner Decision

Choose one before resuming:

1. Restore or provide the intended `docs/stable_block_manifest_2026-06-09.json`
   so the existing architecture smoke gate can run normally.
2. Explicitly authorize an out-of-scope fix to the stable block guard/manifest
   as part of this Step1 execution lane.
3. Provide a different owner-approved architecture-smoke baseline for this repo.

No Step2/Step3 work was started.

---

## Resolution (2026-07-09, Opus supervision)

Resolved. Root cause = docs sweep `985c1111` deleted a broad doc set while leaving
consumers; pre-existing on main, unrelated to command-owner. Fix `ffa39749`: retired two
fully-orphaned docs-governance guards, restored four live-guard baseline docs. Architecture
smoke now exits 0. Codex correctly stopped rather than fake a placeholder. T7/T8 completed
afterward. See the completion section in
`step1-command-owner-pipeline-prerequisite-staging-progress-2026-07-09.md`.

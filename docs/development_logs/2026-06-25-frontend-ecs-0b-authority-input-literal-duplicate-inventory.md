# Frontend ECS 0B Authority/Input/Literal/Duplicate Inventory - 2026-06-25

## Scope

This is Batch 0B only. It inventories renderer authority writes, input/action branch gates, and literal/duplicate candidates before any frontend ECS ownership sealing starts.

No runtime behavior was migrated. No ECS dependency was introduced.

## Machine Baselines

| Baseline                     | Path                                                                              | Command                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Renderer authority baseline  | `docs/development_logs/2026-06-25-frontend-ecs-0b-renderer-authority-baseline.md` | `node scripts/report-frontend-ecs-renderer-authority.js --markdown` |
| Input branch baseline        | `docs/development_logs/2026-06-25-frontend-ecs-0b-input-branch-baseline.md`       | `node scripts/report-frontend-ecs-input-branch.js --markdown`       |
| Literal / duplicate baseline | `docs/development_logs/2026-06-25-frontend-ecs-0b-literal-duplicate-baseline.md`  | `node scripts/report-frontend-ecs-literal-duplicate.js --markdown`  |

## Renderer Authority Summary

The renderer authority report-only guard scanned 97 renderer-like production frontend files.

| Metric            | Value |
| ----------------- | ----: |
| Total findings    |   315 |
| Render pipeline   |     9 |
| Render runtime    |    69 |
| Renderer files    |   161 |
| World-map runtime |    76 |
| Host writes       |    32 |
| Shell writes      |    42 |
| State writes      |     7 |
| Self-cache writes |   234 |

| Role              | Findings | Review Meaning                                                               |
| ----------------- | -------: | ---------------------------------------------------------------------------- |
| `authority-write` |       41 | Renderer-side state that needs owner review before snapshot sealing          |
| `cache`           |      225 | Renderer cache/layout/tile/hit-target state, not automatically debt          |
| `write-through`   |       49 | Renderer writes through to host/app/shell/controller and needs bridge review |

## Input Branch Summary

The input branch report-only guard scanned 14 input/action production frontend files.

| Metric                   | Value |
| ------------------------ | ----: |
| Total findings           |   203 |
| Input router findings    |   103 |
| Command handler findings |    80 |
| Domain input findings    |    14 |
| Action dispatch findings |     6 |

| Branch Kind     | Findings | Review Meaning                             |
| --------------- | -------: | ------------------------------------------ |
| `action`        |       36 | Dispatch or action-type routing branch     |
| `mode`          |       44 | Input path depends on mode ownership state |
| `panel`         |       88 | Input path depends on panel/modal state    |
| `runtime-route` |       19 | World-map runtime tap/drag route branch    |
| `tutorial`      |       16 | Tutorial gate branch in input/action flow  |

## Literal / Duplicate Summary

The literal / duplicate report-only guard scanned 213 production frontend files.

| Metric                | Value |
| --------------------- | ----: |
| Total findings        | 10417 |
| Action strings        |   313 |
| Asset paths           |   295 |
| Colors                |   472 |
| Repeated conditions   |  2250 |
| Repeated helper names |  2157 |
| Numeric literals      |  4930 |

| Role                  | Findings | Review Meaning                                                        |
| --------------------- | -------: | --------------------------------------------------------------------- |
| `registry-owned`      |      383 | Declared config/manifest/registry facts; not debt by default          |
| `runtime-candidate`   |     5726 | Runtime literals that need owner classification before blocking gates |
| `duplicate-candidate` |     4308 | Repeated helper/condition candidates that need owner review           |

## Deterministic Conclusions

- 0B completed the missing baseline categories from the operating plan: renderer authority, input branch, and literal/duplicate candidates.
- Renderer findings show that snapshot sealing cannot start until write-through host/shell writes are reviewed and either retired or declared as renderer-owned cache.
- Input findings confirm that mode, panel, tutorial, and action routing still intersect in input routers and command handlers.
- Literal/duplicate findings are intentionally broad. They are a baseline for future "no new unowned literal/duplicate" gates, not a claim that every finding is immediate debt.
- Registry-owned rows are separated so config/manifest facts can remain valid owners during later guard rollout.

## Review Entry Points

Migration owner review should prioritize:

1. Renderer `write-through` rows, especially host/shell writes in render runtime and world-map runtime files.
2. Input `panel`, `mode`, and `tutorial` rows that overlap with 0A mode ownership findings.
3. Literal/duplicate rows outside config/manifest/registry paths before any blocking literal guard is enabled.
4. False-positive categories that should be excluded or downgraded before Batch 1 guard policy is finalized.

## 0B Acceptance State

State: `Ready for Migration Owner Review`.

Not completed yet, because migration owner review and sign-off are still pending.

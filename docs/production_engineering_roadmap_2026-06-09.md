# 生产工程化路线图 / Production Engineering Roadmap

日期 / Date: 2026-06-09

状态 / Status: active

目的 / Purpose:

P0-P11 已经把项目从历史耦合里拉出来：玩法、渲染、运行时、权威命令、配置、随机权威和稳定积木治理已经有明确边界。下一阶段不是继续堆功能，而是建立长期运营所需的生产工程化能力，让项目在 CI、部署、监控、备份、性能、配置发布和稳定积木晋升上都有硬门禁。

This document is the production-engineering authority for the post-refactor phase. It defines the guardrails that prevent the project from sliding back into architecture mud.

## 1. 当前结论 / Current Conclusion

- P0-P11 architecture refactor is complete for the current scope.
- Candidate modules are not automatically stable; stable promotion still follows `docs/stable_block_promotion_matrix_2026-06-09.md`.
- `npm run test:architecture` is the baseline local gate before commit/deploy.
- Browser visual playtests are required only when a change touches real player input, Canvas visibility, tutorial highlights, online paths, deploy behavior, or backend action feedback.
- The next risk is operational: a project can be architecturally clean locally but still fail in production because CI, deploy, rollback, monitoring, backup, and config governance are weak.

Current deploy fact:

- WXGames / 文明火种 deploys through the server-side bare repo at `/home/git/wxgame.git`.
- Pushing `main` to that repo triggers `hooks/post-receive`, checks out to `/www/wwwroot/h5`, runs `/www/wwwroot/h5/deploy.sh main`, publishes `frontend/` into the H5 web root, rsyncs `backend/` into `/opt/wxgame-workspace/backend`, and restarts PM2 app `server`.
- `/opt/wxgame-workspace/backend` is a runtime copy, not the deploy Git source. Do not infer "push does not deploy" only because that runtime directory is not a Git worktree.
- H5 update prompts are driven by `/api/version` `deploymentId`, which hashes the deployed source state while ignoring local SQLite/log/runtime artifacts.

## 2. 反泥潭规则 / Anti-Mud Rules

1. Local pass does not mean online safe. CI must run the same architecture gate before merge/deploy.
2. Deployable does not mean operable. Each release needs version identity, health checks, rollback steps, and deploy logs.
3. No metrics means uncontrolled. Backend health, API latency, error count, game action failures, and frontend load failures must be observable.
4. Backups are not real until restore is tested. Save data and config data must have restore drills.
5. Config changes are product releases. Schema, registry metadata, version, diff, validation, and rollback are required for config/table changes.
6. Stable blocks are closed for feature iteration. New features extend through adapters, registries, strategies, events, config, or neighboring files.
7. Visual/user-flow changes require evidence. Tutorial, Canvas hitTargets, highlights, deployment paths, or online resource loading must include screenshot/playtest evidence.
8. A task is not complete if nobody can operate it later. Every production-facing mechanism needs a runbook entry or a documented command.

## 3. P12 - 生产工程化 / Production Engineering

| ID | 优先级 / Priority | 目标 / Goal | 交付物 / Deliverables | 回归 / Regression |
| --- | --- | --- | --- | --- |
| P12-001 | P0 | CI architecture gate | Add a CI workflow or equivalent server-side command that runs syntax checks, focused candidate/stable tests, stable block guard, official doc guard, and `git diff --check`. | CI pass + `npm run test:architecture` |
| P12-002 | P0 | Release and deploy governance | Define release identity, deploy command, restart boundary, health check, rollback command, and deploy log location without disturbing unrelated running services. | deploy dry-run or documented command verification |
| P12-003 | P0 | Observability and alerts | Add health endpoint coverage, backend error/action-failure metrics, API latency checks, frontend asset/load failure capture, and alert thresholds. | health check test + observable sample output |
| P12-004 | P0 | Backup and restore | Define save/config/database backup schedule, retention policy, restore command, and a restore drill checklist. | restore drill on non-production target |
| P12-005 | P1 | Performance and capacity | Add budgets for world-map snapshots, renderer frame work, backend action latency, API payload size, save size, and large-map chunk/window behavior. | performance budget tests + sampled browser profiling when visual paths change |
| P12-006 | P1 | Security and access control | Harden admin/config endpoints, deployment credentials, server access, API auth assumptions, and secret handling. | security checklist + focused auth tests |
| P12-007 | P1 | Config pipeline | Turn config/table edits into validated releases with schema checks, registry version comparison, diff output, preview, publish, and rollback. | config validation tests + registry diff output |
| P12-008 | P1 | Stable promotion CI | Make stable promotion machine-checkable: candidate observation notes, public contract, extension path, reopen exceptions, tests, and manifest update must be present. | stable guard + responsibility-index verification |
| P12-009 | P2 | Operations runbook | Create a concise operating manual for deploy, rollback, log inspection, health checks, backup/restore, config publish, and emergency disable switches. | runbook command review |

## 4. 推荐推进顺序 / Recommended Order

1. P12-001 CI architecture gate
2. P12-002 release and deploy governance
3. P12-003 observability and alerts
4. P12-004 backup and restore
5. P12-005 performance and capacity
6. P12-007 config pipeline
7. P12-008 stable promotion CI
8. P12-006 security and access control
9. P12-009 operations runbook

The order is deliberate: first prevent bad changes from entering, then make deploys reversible, then make runtime health visible, then protect persistent data.

## 5. 每步完成定义 / Done Definition

Each P12 item is done only when:

- The owner command/file/runbook is documented.
- The rollback surface is documented.
- `npm run test:architecture` passes unless the item is explicitly documentation-only and the doc guard passes.
- If the item changes deploy, browser, Canvas, tutorial, hitTarget, backend action, or online resource behavior, browser/playtest evidence is captured.
- The responsibility index is updated if a new module, script, workflow, or official document is introduced.

## 6. 大厂对标定义 / Large-Studio Parity Definition

For this project, "large-studio parity" does not mean copying a huge enterprise stack. It means the small-team version of the same engineering invariants:

- deterministic architecture gates before release
- documented deployment and rollback
- observable production health
- restorable persistent data
- bounded performance budgets
- validated config releases
- backend-authoritative gameplay results
- stable blocks that extend without casual internal edits
- screenshot/playtest evidence for player-visible flows

When these invariants are present, the project is no longer maintained by memory and luck. It is maintained by repeatable systems.

## 7. 下一步 / Next Step

Start with P12-001. The first implementation target is to make the existing local architecture baseline runnable from CI or a deploy-side gate, then document exactly which command blocks a release when it fails.

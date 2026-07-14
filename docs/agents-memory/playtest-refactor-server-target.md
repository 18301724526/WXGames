---
name: playtest-refactor-server-target
description: "Local playtests must target the build and API for the branch under test; a foreign deployment can produce convincing but invalid failure reports."
metadata:
  node_type: memory
  type: project
  originSessionId: 615c3944-6983-4fe9-b609-d45208eb3754
---

A 2026-07-03 run accidentally exercised the main deployment while evaluating a refactor build. The page assets, server behavior, and evidence labels no longer described the same revision, so the resulting report attributed foreign-build behavior to the branch under test.

**Why:** evidence labels often come from the local harness, not from the server. Against a foreign build, labels and actions can diverge while still looking internally consistent.

**How to apply:** pin the page URL and API base to the same local deployment, then compare `/health` fields such as `deployedCommit` and `branch` with the revision under test before interpreting failures. Treat action/label mismatches and missing branch-specific assets as build-target evidence first. Related: [[deploy-lint-gate]], [[local-dev-env]].

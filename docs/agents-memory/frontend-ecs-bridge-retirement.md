---
name: frontend-ecs-bridge-retirement
description: "Frontend ECS Batch 8 (Bridge Retirement) COMPLETE: 8A-8E retired + deployed; 8F blockingPanel EXECUTED and live in codex/pvpve-systems (confirmed by 2026-07-09 inventory) — ModalStore is the panel-state single source."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1b60935f-8215-46d5-9378-8f488ca88b3d
---

The frontend ECS migration on the refactor branch reached **Batch 8 (Bridge Retirement)**: retiring each modal's legacy `this.X` mirror so the ECS modal owner + renderer snapshot are the sole source, via `CanvasModalSnapshotAdapter` helpers (open/close/get/isOpen) replacing the per-modal bridge wrappers.

**Done + deployed, each `Ready for Migration Owner Review` (NOT marked Completed):** 8A naming, 8B confirmDialog, 8C rewardReveal, 8D event (extended guard catches `setIfChanged`/patch-key idioms; EventController's own `activeEventId` claim cursor stays), 8E targetPicker (Option B snapshot-direct; tip `8252085d`). Each slice = snapshot adapter helpers + remove bridge wrappers + a `check-frontend-ecs-<modal>-mirror-retirement.js` blocking guard + delete the obsolete per-modal ownership guard; verified by FULL `npm test` (see [[deploy-lint-gate]] — full suite ≠ `test:architecture` subset) + a 3-lens adversarial review (it has caught real HIGH regressions the suite missed).

**8F blockingPanel — EXECUTED & LIVE.** Twelve panels moved into ModalStore and `buildRendererPanelFacts` moved to `CanvasModeOwnershipRuntime.js`. The slice updates ModeKeys, capture priority, blocking modal keys, and the generated runtime bundle; `deriveModeFacts.techTreeActive` reads the `modal:commandPanel` payload instead of a raw mirror. The retirement guard, full tests, architecture smoke, lint, formatting, and line-ending checks all passed.

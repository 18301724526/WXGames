# Button-Scheduler-Manager-Panel Arbitration Receipts

Status: implementation receipts
Date: 2026-07-09
Scope: auxiliary review findings consumed during the root-cause implementation loop

## Receipt 1

Task: branch-base mismatch stop note
Model: auxiliary reviewer
Slice: setup / Slice 0
Input contract: implementation coordination rules Section 4 and Section 8
Output type: review stop
Findings: current task worktree is based on `main` at `96ea25b5`, while the reviewer argued the spec reference path also exists on `codex/pvpve-systems`.
Evidence: local guard confirms the active worktree is `F:/AI Project/WXGamesLocal-button-scheduler-root-cause` on `codex/button-scheduler-panel-root-cause`, with HEAD equal to `main` at `96ea25b5`. Local branches also include `codex/pvpve-systems`.
Codex decision: deferred
Reason: the current user-directed goal explicitly targets completing the spec in this isolated worktree. No merge, rebase, or branch switch was authorized in the current conversation. Integration against `codex/pvpve-systems` is a separate owner decision after this implementation is reviewable.

## Receipt 2

Task: modal flush order review
Model: auxiliary reviewer
Slice: Slice 2 / Slice 3 / Slice 8a
Input contract: spec Section 5.4, Section 6.1, and Section 8 required assertion 3
Output type: frozen-contract mismatch
Findings: `CanvasPanelActionRunner.run()` flushed modal after tutorial after-hooks.
Evidence: `CanvasPanelActionRunner.test.js` previously expected `opened` / `refresh` before `markDirty` / `flush`, contradicting the required order `panel open -> render/dirty modal -> tutorial opened callback`.
Codex decision: accepted
Reason: runner now calls `flushDirty()` immediately after successful lifecycle/action execution and before after-hooks. The runner test now locks `markDirty` and `flush` before tutorial callbacks.

## Receipt 3

Task: outside-click click-through review
Model: auxiliary reviewer
Slice: Slice 7 / Slice 8a
Input contract: spec Section 6.2 outside-click semantics and Section 8 outside-click matrix
Output type: frozen-contract mismatch
Findings: modal outside-click targets were emitted as `background: true`, so hit resolution could continue to a base foreground target underneath the open famous panel.
Evidence: `CanvasSurfaceHitTargets.resolveHitTarget()` defers background actions while scanning; a base foreground target under the same point would win.
Codex decision: accepted
Reason: `CanvasPanelSurfaceManager.addOutsideClickTarget()` now emits blocking panel outside-click targets as foreground modal targets with `blocksBaseHitTargets: true`. `CanvasSurfaceRenderer.test.js` locks modal-before-base hit resolution and modal pool preservation across base rebuilds.

## Receipt 4

Task: renamed repair-layer review
Model: auxiliary reviewer
Slice: Slice 8b
Input contract: spec Section 6.10 retirement gates and Slice 8b compatibility retirement
Output type: frozen-contract mismatch
Findings: `flushPanelModalLayerAfterBaseRender()` reintroduced the old base-render repair pattern under a new name.
Evidence: App and Shell rendering runtimes called that helper after full base renders, marking/flushing modal on base frames.
Codex decision: accepted
Reason: the helper and both base-render calls were removed. The compatibility retirement test now forbids `flushPanelModalLayerAfterBaseRender` alongside the older repair names.

---
name: canvas-only-miniprogram-portability
description: Canvas-only / 小程序 portability status — NOT shelled; DOM isolated in H5 adapter; real gap is the never-written MiniProgram runtime + the guard exempts the host layer.
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

Audited (multi-agent, adversarially verified, high confidence, 2026-07-04) after user feared parallel devs "套壳"了 canvas-only and broke 小程序移植. **Verdict: NOT shelled; the swappable-host / Canvas-only architecture is intact. The real gap is ABSENCE, not leakage.**

**Not violated:**
- The Canvas-only UI rule forbids DOM overlay widgets for game UI; it does not forbid the render host from using a DOM-backed canvas adapter.
- The historical multi-layer DOM canvas stack was an explicit runtime design, not an accidental widget overlay.
- DOM access is confined to `H5CanvasRuntime.js`, `H5CanvasViewport.js`, and `H5CanvasInputController.js` (plus `H5UpdateRuntimeAdapter.js`), all behind injected `this.document` guards. `frontend/js/ecs/` remains DOM-free; `CanvasAssetRenderer.js` prefers `OffscreenCanvas` and only uses `ownerDocument` as an allowlisted fallback.
- Formal contract `CanvasRuntimeContract.js` (`canvas-runtime-v1`): REQUIRED_METHODS are wx-shaped & DOM-free (createCanvas/getStorage/request/onTap/onDrag/onGesture/requestTextInput/raf…); layer methods (ensureLayerCanvas/getLayerCanvas/getLayerMetrics) are **OPTIONAL**. H5CanvasRuntime implements the required set.
- Swap seam: `CanvasGameShell.js` injects the runtime constructor. The single-canvas path uses only `createCanvas()` and `getContext('2d')`, so renderers can degrade to a single surface.

**The real gap (write-new, not rewrite):** no MiniProgram/MiniGame runtime adapter exists — `MiniGameApp.js:7` is a bare `global.MiniGameApp = CanvasGameApp` alias; `PlatformRuntime.js:34-57` recognizes wx/tt but targets 小游戏 (has `wx.createCanvas`) not DOM-less 小程序, and lacks `ensureLayerCanvas`. The 6-layer CSS-z-index compositing has no 小程序 equivalent (no cross-canvas z-index). **Guard blind spot:** `verify-refactor-plan-doc.js` deliberately exempts the host layer (H5CanvasRuntime/CanvasLayerRegistry) and its forbiddenPattern lacks getComputedStyle/insertBefore/style.zIndex → passing smoke ≠ proven portable.

**Remediation:** Plan A (~1 file+wiring): write `MiniProgramCanvasRuntime` satisfying REQUIRED_METHODS (complete the wx/tt PlatformRuntime), have MiniGameApp instantiate it, use the single-canvas MiniGameCanvasRenderer path (drops multi-layer compositing, all Canvas UI unchanged). Plan B: implement OPTIONAL ensureLayerCanvas via 小程序 native multi-canvas (WXML `<canvas type=webgl/2d>` + SelectorQuery) to reproduce N layers (小程序 supports WebGL for fog/spine). Recommend a `CanvasDomBoundary` guard forcing the layer contract to be expressible without DOM.

Relates to [[canvas-layer-dom-order]] (the z-index/DOM-order fix that triggered this audit) and [[architecture-refactor]].

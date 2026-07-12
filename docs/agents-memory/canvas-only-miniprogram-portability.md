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
- Documented "Canvas-only UI" rule only forbids **DOM overlay widgets** for game UI; it never forbade the render HOST using DOM. Tutorial/dialogue/HUD are all `ctx`-drawn + Canvas hitTargets. `getBoundingClientRect` in tutorial code is a **synthetic canvas-coord rect factory** (`CanvasGameShell.js:1699`, `TutorialGuideTargetResolver.js:65`), not DOM reads.
- The **six-layer DOM canvas stack is documented design**, not a rogue change: `docs/current_technical_architecture_2026-06-09.md:40-47` "Mature Engine Canvas Layer Contract" (worldMap997/worldFog998·webgl/worldActor999/mainHud1000/tutorialSpine1001·webgl/tutorialDialogue1002).
- DOM confined to H5 adapter trio: `H5CanvasRuntime.js` / `H5CanvasViewport.js` / `H5CanvasInputController.js` (+ named `H5UpdateRuntimeAdapter.js`), all behind injected `this.document` with `if(!document)return null` guards. `frontend/js/ecs/` is 100% DOM-free. Renderers' only DOM touches: `CanvasAssetRenderer.js:659` (OffscreenCanvas-preferred fallback via `this.canvas.ownerDocument`, **explicitly allowlisted** in `verify-refactor-plan-doc.js:225-227`) and `TutorialAdvisorCanvasRenderer.js:263` (`canvas.style.opacity`, guarded).
- Formal contract `CanvasRuntimeContract.js` (`canvas-runtime-v1`): REQUIRED_METHODS are wx-shaped & DOM-free (createCanvas/getStorage/request/onTap/onDrag/onGesture/requestTextInput/raf…); layer methods (ensureLayerCanvas/getLayerCanvas/getLayerMetrics) are **OPTIONAL**. H5CanvasRuntime implements the required set.
- Swap seam: `CanvasGameShell.js:3764` `const RuntimeCtor = options.Runtime || global.H5CanvasRuntime`. Single-canvas path already exists: `MiniGameCanvasRenderer.js:14-39` only `createCanvas()+getContext('2d')`, never `ensureLayerCanvas`. Renderers gracefully degrade to single-canvas (dialogue→main ctx; spine→image on main ctx, `TutorialAdvisorCanvasRenderer.js:88-104`).

**The real gap (write-new, not rewrite):** no MiniProgram/MiniGame runtime adapter exists — `MiniGameApp.js:7` is a bare `global.MiniGameApp = CanvasGameApp` alias; `PlatformRuntime.js:34-57` recognizes wx/tt but targets 小游戏 (has `wx.createCanvas`) not DOM-less 小程序, and lacks `ensureLayerCanvas`. The 6-layer CSS-z-index compositing has no 小程序 equivalent (no cross-canvas z-index). **Guard blind spot:** `verify-refactor-plan-doc.js` deliberately exempts the host layer (H5CanvasRuntime/CanvasLayerRegistry) and its forbiddenPattern lacks getComputedStyle/insertBefore/style.zIndex → passing smoke ≠ proven portable.

**Remediation:** Plan A (~1 file+wiring): write `MiniProgramCanvasRuntime` satisfying REQUIRED_METHODS (complete the wx/tt PlatformRuntime), have MiniGameApp instantiate it, use the single-canvas MiniGameCanvasRenderer path (drops multi-layer compositing, all Canvas UI unchanged). Plan B: implement OPTIONAL ensureLayerCanvas via 小程序 native multi-canvas (WXML `<canvas type=webgl/2d>` + SelectorQuery) to reproduce N layers (小程序 supports WebGL for fog/spine). Recommend a `CanvasDomBoundary` guard forcing the layer contract to be expressible without DOM.

Relates to [[canvas-layer-dom-order]] (the z-index/DOM-order fix that triggered this audit) and [[architecture-refactor]].

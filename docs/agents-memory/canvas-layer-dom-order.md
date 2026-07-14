---
name: canvas-layer-dom-order
description: "Canvas layers mix webgl+2d and relied on cross-context z-index alone; WebViews break ties by DOM order, so DOM order must match z-order. Headless Chromium hides the bug."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

A mixed WebGL/2D overlay ordering bug (fixed `f53232dd`+`ee0973dc`, deployed) showed that z-index alone was insufficient. The layers were `position:fixed` BODY siblings and were ensured **lazily on first paint**, so `H5CanvasRuntime.ensureLayerCanvas` appended them in use-order rather than registry order. Chromium honored z-index, while **WebViews (WeChat X5/XWeb) could break stacking-context ties by document order or float WebGL-backed canvases above 2D siblings**, making the lower-z layer appear on top.

**Fix:** `ensureLayerCanvas` now inserts each layer element at the DOM position dictated by its z-index (`insertLayerElementInStackOrder`), so document order always matches `CanvasLayerRegistry.PHYSICAL_LAYER_ORDER`. Registry test now locks that order's z-monotonicity.

**Why:** relying on cross-context-type z-index alone is fragile; the invariant "DOM order == z-order" is compositor-independent.

**How to apply / gotchas:**
- Headless Chromium **cannot reproduce** this (it honors z-index) — verify by probing **DOM order** (`indexOf` in `body.children`), not pixels. Pixel/screenshot probes are also confounded by the ~60fps overlay's `begin()`→`clearRect`; freeze via neutered `clearRect` + re-paint if you must probe pixels.
- `Array.isArray(host.children)` is **false** in the browser (it's a live HTMLCollection) — normalize with `Array.from` or the ordered-insert silently degrades to `appendChild` (the first fix commit had exactly this false-green; unit-test mock used a real Array).
- Any new canvas layer must go through the registry z + PHYSICAL_LAYER_ORDER; don't hand-append.

Relates to [[render-host-delegation-observability-debt]] (the render/layer god-files) and [[architecture-refactor]].

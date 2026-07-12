---
name: canvas-layer-dom-order
description: "Canvas layers mix webgl+2d and relied on cross-context z-index alone; WebViews break ties by DOM order, so DOM order must match z-order. Headless Chromium hides the bug."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

The tutorial advisor "spine 盖在对话框之上" bug (fixed `f53232dd`+`ee0973dc`, deployed): root cause was NOT z-index. `tutorialDialogue` (2d, z1002) and `tutorialSpine` (webgl, z1001) are `position:fixed` BODY siblings. Layers are ensured **lazily on first paint** — `begin()` creates the dialogue canvas *before* the portrait creates the spine canvas — so `H5CanvasRuntime.ensureLayerCanvas` appended them in use-order (`appendChild` to end), leaving DOM order `[dialogue, spine]` (spine the *later* sibling with the *lower* z). Chromium honors z-index so it looks fine; **WebViews (WeChat X5/XWeb) break stacking-context ties by document order and/or float webgl-backed canvases above later 2d ones**, so the later spine wins — exactly the user's "严重架构问题，无法定位" (code reads correct: 1002>1001).

**Fix:** `ensureLayerCanvas` now inserts each layer element at the DOM position dictated by its z-index (`insertLayerElementInStackOrder`), so document order always matches `CanvasLayerRegistry.PHYSICAL_LAYER_ORDER`. Registry test now locks that order's z-monotonicity.

**Why:** relying on cross-context-type z-index alone is fragile; the invariant "DOM order == z-order" is compositor-independent.

**How to apply / gotchas:**
- Headless Chromium **cannot reproduce** this (it honors z-index) — verify by probing **DOM order** (`indexOf` in `body.children`), not pixels. Pixel/screenshot probes are also confounded by the ~60fps overlay's `begin()`→`clearRect`; freeze via neutered `clearRect` + re-paint if you must probe pixels.
- `Array.isArray(host.children)` is **false** in the browser (it's a live HTMLCollection) — normalize with `Array.from` or the ordered-insert silently degrades to `appendChild` (the first fix commit had exactly this false-green; unit-test mock used a real Array).
- Any new canvas layer must go through the registry z + PHYSICAL_LAYER_ORDER; don't hand-append.

Relates to [[render-host-delegation-observability-debt]] (the render/layer god-files) and [[architecture-refactor]].

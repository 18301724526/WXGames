# Famous Portrait V2 Flat Handoff

Updated: 2026-05-28

## Current Direction

The famous portrait system has been rebuilt around bitmap PNG resource layers.

2026-05-28 update: the active implementation is now a five-layer anchored portrait workflow. The lab loads the current PNG layers directly so the user can tune `x`, `y`, and `scale` in the browser, then hand the exported JSON back for runtime sync.

This version intentionally removes the old split/crop simulation path. The lab and the game now share the same cropped-layer coordinate model:

1. Art is generated as bitmap PNG resources, not with code-drawn vector/canvas shapes.
2. Each PNG should be tightly cropped to its first and last opaque pixels.
3. The manifest stores each cropped PNG's base position in a 512 x 512 coordinate space.
4. Manual tuning is stored as layer `x`, `y`, and `scale` offsets.
5. Runtime drawing uses the same order and coordinate math as the lab preview.

## Public Test Entry

Use the existing lab URL after deployment:

- `/tools/famous-portrait-lab.html`

The page includes:

- Full 512-coordinate preview.
- Actual game portrait preview.
- Candidate-card style preview.
- Per-layer visibility, order, scale, x, and y controls.
- Export JSON for the approved first resource set.

## Lab Layer Order

Current lab order for the user-cut tuning pass:

```text
outfitBack -> head -> hairBase -> bangs -> outfitFront
```

Current active files:

- `fp-layer-v2-art01-head-base-01.png`
- `fp-layer-v2-art01-outfitBack-guardian-01.png`
- `fp-layer-v2-art01-outfitFront-guardian-01.png`
- `fp-layer-v2-art01-hairBase-bound-topknot-filled-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-short-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-parted-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-swept-01.png`

## Runtime Layer Order

Runtime and lab order:

```text
outfitBack -> head -> hairBase -> bangs -> outfitFront
```

Layer meaning:

- `outfitBack`: rear outfit layer.
- `head`: head, face, neck, and base body layer.
- `hairBase`: anchored hair base under the replaceable bangs.
- `bangs`: replaceable bangs variants.
- `outfitFront`: foreground outfit layer.

## Current Resource Files

Only these layer files should exist under `frontend/assets/art/famous-person/layers/`:

- `fp-layer-v2-art01-outfitBack-guardian-01.png`
- `fp-layer-v2-art01-head-base-01.png`
- `fp-layer-v2-art01-hairBase-bound-topknot-filled-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-short-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-parted-01.png`
- `fp-layer-v2-art01-bangs-bound-topknot-swept-01.png`
- `fp-layer-v2-art01-outfitFront-guardian-01.png`
- `fp-layer-v2-manifest.json`

Old seven-layer files, the complete-hair prototype, old `fp-layer-*` files, old preview PNGs, and the old source sheet were deleted on purpose.

## Code Links

- Lab page: `frontend/tools/famous-portrait-lab.html`
- Lab logic: `frontend/tools/famous-portrait-lab.js`
- Shared layout: `frontend/js/config/FamousPortraitLayout.js`
- Game renderer: `frontend/js/platform/CanvasGameRenderer.js`
- Backend generation: `backend/services/FamousPersonService.js`

`FamousPersonService.APPEARANCE_VERSION` is now `famous-portrait-v2.1`, so old saved people regenerate into the current `art01` PNG layers during normalization.

Important: do not restore `scripts/generate-famous-portrait-v2-assets.js`, `scripts/extract-famous-portrait-v2-sheet.js`, or `scripts/preview-famous-portrait-v2-composite.js`. Those paths either drew placeholder art in code or regenerate the obsolete seven-layer resource set.

## Tests

Verified commands:

```bash
node --test frontend/tests/famous-portrait-lab.test.js backend/tests/famous-person-service.test.js frontend/tests/shared-canvas-renderer.test.js frontend/tests/ui-state-presenter.test.js
node --test frontend/tests/h5-canvas-runtime.test.js frontend/tests/resource-art.test.js frontend/tests/version-number.test.js frontend/tests/stage5-version.test.js
```

Notes:

- `frontend/tests/famous-portrait-lab.test.js` checks the v2 lab, manifest, and cropped PNG edges.
- `frontend/tests/shared-canvas-renderer.test.js` checks v2 preload paths and cropped runtime math.
- `backend/tests/famous-person-service.test.js` checks old saves regenerate to v2.

## Next Work

1. User manually tunes the first v2 set in the lab and exports JSON.
2. Copy exported `global`, `order`, and `layers` offsets into `FamousPortraitLayout.js`.
3. If the first set is approved, generate future outfits and hairstyles to the same cropped-resource contract.
4. Do not restore old split/crop fields like `frontCutY` or `backCutY`; they are obsolete for v2.

## Local Files Not To Commit

These are local scratch files and should remain untracked:

- `temp_test.js`
- `temp_test2.js`
- `tmp/`

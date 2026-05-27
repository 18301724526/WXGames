# Famous Portrait V2 Flat Handoff

Updated: 2026-05-27

## Current Direction

The famous portrait system has been rebuilt around one bitmap PNG resource set.

This version intentionally removes the old split/crop simulation path. The lab and the game now share the same cropped-layer coordinate model:

1. Art is generated as a bitmap PNG contact sheet, not with code-drawn vector/canvas shapes.
2. The extraction script only removes the green/white sheet background, crops transparent padding, and writes PNG layers.
3. Each PNG is tightly cropped to its first and last opaque pixels.
4. The manifest stores each cropped PNG's base position in a 512 x 512 coordinate space.
5. Manual tuning is stored as layer `x`, `y`, and `scale` offsets.
6. Runtime drawing uses the same order and coordinate math as the lab preview.

## Public Test Entry

Use the existing lab URL after deployment:

- `/tools/famous-portrait-lab.html`

The page includes:

- Full 512-coordinate preview.
- Actual game portrait preview.
- Candidate-card style preview.
- Per-layer visibility, order, scale, x, and y controls.
- Export JSON for the approved first resource set.

## V2 Layer Order

Runtime and lab order:

```text
backHair -> body -> innerwear -> sideHair -> frontHair -> bangs -> outfit
```

Layer meaning:

- `backHair`: rear hair silhouette and outer hair volume.
- `body`: face, neck, ears, shoulders, and base skin.
- `innerwear`: collar/chest cloth under armor.
- `sideHair`: sideburn and face-side hair pieces.
- `frontHair`: forehead/front hair mass, not bangs.
- `bangs`: bangs only.
- `outfit`: armor/outfit shell.

## Current Resource Files

Only these layer files should exist under `frontend/assets/art/famous-person/layers/`:

- `fp-layer-v2-art01-backHair-short-01.png`
- `fp-layer-v2-art01-body-base-01.png`
- `fp-layer-v2-art01-innerwear-guardian-01.png`
- `fp-layer-v2-art01-sideHair-short-01.png`
- `fp-layer-v2-art01-frontHair-short-01.png`
- `fp-layer-v2-art01-bangs-short-01.png`
- `fp-layer-v2-art01-outfit-guardian-01.png`
- `fp-layer-v2-manifest.json`

Old `fp-layer-*` and old preview PNGs were deleted on purpose.

The source sheet is tracked here:

- `frontend/assets/art/famous-person/source/famous-portrait-layer-sheet-art01.png`

## Code Links

- Resource extractor: `scripts/extract-famous-portrait-v2-sheet.js`
- Lab page: `frontend/tools/famous-portrait-lab.html`
- Lab logic: `frontend/tools/famous-portrait-lab.js`
- Shared layout: `frontend/js/config/FamousPortraitLayout.js`
- Game renderer: `frontend/js/platform/CanvasGameRenderer.js`
- Backend generation: `backend/services/FamousPersonService.js`

`FamousPersonService.APPEARANCE_VERSION` is now `famous-portrait-v1.1`, so saved v1.0/v0.9/v0.2/unversioned people regenerate into the `art01` PNG layers during normalization.

Important: do not restore `scripts/generate-famous-portrait-v2-assets.js`. That old path drew placeholder art in code. The approved pipeline is PNG art sheet -> deterministic extraction -> cropped PNG layers.

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

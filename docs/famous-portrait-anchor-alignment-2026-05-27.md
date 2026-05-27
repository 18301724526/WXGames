# Famous Portrait Anchor Alignment 2026-05-27

## Current Rule

Only this hand-tuned set is allowed in the live generation pool for now:

- Outfit anchor: `frontend/assets/art/famous-person/layers/fp-layer-outfit-guardian-front-candidate-01.png`
- Back hair anchor: `frontend/assets/art/famous-person/layers/fp-layer-backHair-short-02.png`
- Side hair anchor: `frontend/assets/art/famous-person/layers/fp-layer-sideHair-short-01.png`
- Front hair anchor: `frontend/assets/art/famous-person/layers/fp-layer-frontHair-short-02.png`

The generation code uses `APPEARANCE_POOLS.hairSets` rather than independent `backHair`, `sideHair`, and `frontHair` pools. This prevents bad cross-combinations such as tied back hair with the short front hair.

## Alpha Bounds

Using alpha > 8, the target bounds are:

- Candidate outfits: `(41,242)-(470,511)`
- Back hair: `(117,14)-(395,259)`
- Side hair: `(143,173)-(365,283)`
- Front hair: `(124,76)-(388,178)`

## Randomization Contract

Hair layers must be randomized as a full set:

```js
{
  id: 'shortValidated',
  backHair: 'fp-layer-backHair-short-02.png',
  sideHair: 'fp-layer-sideHair-short-01.png',
  frontHair: 'fp-layer-frontHair-short-02.png',
}
```

Allowed independent random dimensions:

- `hairSets`
- `body`
- `outfit`
- `accessory`

Not allowed:

- Randomizing `backHair`, `sideHair`, and `frontHair` separately.

## Current Disable

- The tied hair assets are still kept in the repo and lab for inspection.
- They are removed from the live generation pool until a complete tied hair set is remade and validated in the actual game-card preview.
- `FamousPersonService.APPEARANCE_VERSION` is bumped to `famous-portrait-v0.9`, so saved famous people and candidates regenerate away from the bad tied combinations.

## Verification

```bash
node --test frontend/tests/famous-portrait-lab.test.js backend/tests/famous-person-service.test.js frontend/tests/shared-canvas-renderer.test.js frontend/tests/ui-state-presenter.test.js
node --test frontend/tests/h5-canvas-runtime.test.js frontend/tests/resource-art.test.js frontend/tests/version-number.test.js frontend/tests/stage5-version.test.js
git diff --check
```

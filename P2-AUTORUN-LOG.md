# P2 Proxy Removal Autorun Log

Branch: `codex/p2-cclass-pilot`

## Completed

| File | Scheme | Sentinel Results | Commit |
| --- | --- | --- | --- |
| `frontend/js/platform/renderers/WorldMapScoutRenderer.js` | Scheme 1 (`ctx` getter) + Scheme 4 (`getWorldTileScreenCenter` method delegate) | Dynamic `ctx` getter passed; unknown host property cut-off passed; host method delegate passed; existing scout route render tests passed; `rg "new Proxy\|Reflect.get\|Reflect.set"` returned no matches. Local `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run test:architecture` passed. GitHub CI passed: https://github.com/18301724526/WXGames/actions/runs/27850937396 | `b30abd7c339fed0b8a7f3d510b0bc21f366104da` |
| `frontend/js/platform/renderers/WorldMapCacheConfigFacade.js` | Scheme 1 (`pixelRatio` getter) | Dynamic `pixelRatio` getter passed; unknown host property cut-off passed; existing cache performance knob tests passed; `rg "new Proxy\|Reflect.get\|Reflect.set"` returned no matches. Local `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run test:architecture` passed. | `37675c55` |
| `frontend/js/platform/renderers/WorldMapRenderUtilityFacade.js` | Scheme 1 (`ctx` getter) | Dynamic `ctx` getter passed; unknown host property cut-off passed; existing iso diamond render and deterministic random tests passed; `rg "new Proxy\|Reflect.get\|Reflect.set"` returned no matches. Local `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run test:architecture` passed. | `c0b0bda6` |
| `frontend/js/platform/renderers/WorldMapFogMaskContextRenderer.js` | Scheme 1 (`lastWorldTileMapContext` getter) + Scheme 2 (`lastWorldFogContext` getter/setter) | Dynamic tile map context getter passed; fog context write/read forwarding passed; unknown host property cut-off passed; existing fog context capture tests passed; `rg "new Proxy\|Reflect.get\|Reflect.set"` returned no matches. Local `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run test:architecture` passed. | `96d6892a` |
| `frontend/js/platform/renderers/BuildingCanvasRenderer.js` | Scheme 1 (`ctx` getter, `presenter` getter) | Dynamic `ctx` and `presenter` getters passed; unknown host property cut-off passed; existing explicit drawing surface and host fallback render tests passed; `rg "new Proxy\|Reflect.get\|Reflect.set"` returned no matches. Local `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run test:architecture` passed. `eslint-suppressions.json` Building `no-unused-vars` count pruned from 4 to 3. | `70d8240a` |

## Skipped

None yet.

## Final Status

In progress.

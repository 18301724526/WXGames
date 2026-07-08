# 2026-06-24 Tutorial Guide Architecture

## Scope

Refactor the strong tutorial guide so existing tutorial steps no longer live in a large `refreshCurrentHighlight()` branch chain. This is the foundation for adding the barracks upgrade, 500 soldier reward, auto-fill soldiers, and save-formation tutorial steps without creating a parallel old/new tutorial system.

## Changes

- Added `frontend/js/tutorial/TutorialGuideFlowRegistry.js` as the single registry for step-to-highlight rules.
- Added `frontend/js/tutorial/TutorialGuideEventRegistry.js` as the single registry for business-event-to-step progression rules.
- Reduced `frontend/js/tutorial/TutorialGuidePhaseHighlights.js` to a thin installer that delegates to the flow registry.
- Kept legacy controller APIs such as `onEraAdvanced()`, `onArmyFormationOpened()`, and `onWorldMarchTargetSelected()` as compatibility adapters, but routed them through `handleEvent(eventName, payload)`.
- Loaded the new registries in both H5 and mini-game entrypoints.
- Added `frontend/js/tutorial/TutorialGuideArchitecture.test.js` to prevent old branch chains from returning to `TutorialGuidePhaseHighlights.js` or controller event methods.

## Design Notes

- UI highlight selection belongs to `TutorialGuideFlowRegistry`.
- Tutorial state progression triggered by UI/business events belongs to `TutorialGuideEventRegistry`.
- `TutorialGuideController` remains the integration facade for game state, shell state, target resolution, and API calls.
- Existing behavior is intentionally preserved before inserting new barracks and soldier-reward steps.

## Verification

- `node --test frontend/js/tutorial/TutorialGuideController.test.js`
- `node --test frontend/js/tutorial/TutorialGuidePhaseHighlights.test.js`
- `node --test frontend/js/tutorial/TutorialGuideStepPolicy.test.js`
- `node --test frontend/js/tutorial/TutorialGuideTargetResolver.test.js`
- `node --test frontend/js/tutorial/TutorialGuideUiStateCoordinator.test.js`

## Next

- Insert barracks upgrade and soldier reward steps in the server tutorial flow before `formationPanelOpened`.
- Add main task reward support for soldiers.
- Add formation auto-fill guidance before `scoutFormationSaved`.

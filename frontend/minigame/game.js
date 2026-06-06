require('../js/config/GameConfig');
require('../js/config/FamousPortraitLayout');
require('../js/domain/TileMapGeometry');
require('../js/domain/WorldMarchSystem');
require('../js/config/TileMapAssetManifest');
require('../js/config/UnitSpriteManifest');
require('../js/state/UIStatePresenter');
require('../js/api/GameAPI');
require('../js/services/GameStateSync');
require('../js/platform/PlatformRuntime');
require('../js/platform/CanvasActionDispatcher');
require('../js/platform/WorldMapRuntime');
require('../js/platform/WorldMapRuntimeCoordinator');
require('../js/platform/renderers/CanvasSurfaceRenderer');
require('../js/platform/renderers/CanvasAssetRenderer');
require('../js/platform/renderers/CanvasPreloadAssetManifest');
require('../js/platform/renderers/WorldTileWaterCanvasRenderer');
require('../js/platform/renderers/WorldActorCanvasRenderer');
require('../js/platform/renderers/WorldMarchHudCanvasRenderer');
require('../js/platform/renderers/WorldMapCanvasRenderer');
require('../js/platform/renderers/CanvasWorldMapFacade');
require('../js/platform/renderers/WorldMapLayerCanvasRenderer');
require('../js/platform/renderers/FamousCanvasRenderer');
require('../js/platform/renderers/TechCanvasRenderer');
require('../js/platform/renderers/BattleCanvasRenderer');
require('../js/platform/renderers/CanvasBattleFacade');
require('../js/platform/renderers/TutorialAdvisorCanvasRenderer');
require('../js/platform/renderers/TutorialCanvasRenderer');
require('../js/platform/renderers/BuildingCanvasRenderer');
require('../js/platform/renderers/EventCanvasRenderer');
require('../js/platform/renderers/CivilizationCanvasRenderer');
require('../js/platform/renderers/MilitaryCanvasRenderer');
require('../js/platform/renderers/ArmyFormationEditorCanvasRenderer');
require('../js/platform/renderers/GuideTaskCanvasRenderer');
require('../js/platform/renderers/HomeCanvasRenderer');
require('../js/platform/renderers/SystemCanvasRenderer');
require('../js/platform/renderers/CityCanvasRenderer');
require('../js/platform/renderers/OverlayCanvasRenderer');
require('../js/platform/renderers/AdvisorCanvasRenderer');
require('../js/platform/renderers/MapCommandCanvasRenderer');
require('../js/platform/renderers/TabBarCanvasRenderer');
require('../js/platform/renderers/HudTabPageCanvasRenderer');
require('../js/platform/renderers/HudOverlayCanvasRenderer');
require('../js/platform/renderers/CanvasFrameRenderer');
require('../js/platform/MiniGameCanvasRenderer');
require('../js/tutorial/TutorialGuideController');
require('../js/platform/interactions/TechTreeInteractionModel');
require('../js/platform/CanvasActionController');
require('../js/platform/GameCommandService');
require('../js/platform/CanvasGameAppStateSync');
require('../js/platform/CanvasGameAppRenderingRuntime');
require('../js/platform/CanvasGameAppBattleScene');
require('../js/platform/CanvasGameAppCommands');
require('../js/platform/CanvasGameAppGuideUi');
require('../js/platform/CanvasGameAppInputRouter');
require('../js/platform/CanvasGameApp');

const runtime = new globalThis.PlatformRuntime();
const app = new globalThis.CanvasGameApp({
  runtime,
  presenter: globalThis.UIStatePresenter,
  config: globalThis.GameConfig,
  apiClass: globalThis.GameAPI,
  rendererClass: globalThis.MiniGameCanvasRenderer,
});

app.start();

globalThis.CivilizationFireMiniGame = app;

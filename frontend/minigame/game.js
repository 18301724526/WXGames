require('../js/config/GameConfig');
require('../js/config/FamousPortraitLayout');
require('../js/state/UIStatePresenter');
require('../js/api/GameAPI');
require('../js/platform/PlatformRuntime');
require('../js/platform/CanvasActionDispatcher');
require('../js/platform/WorldMapRuntime');
require('../js/platform/MiniGameCanvasRenderer');
require('../js/platform/CanvasActionController');
require('../js/platform/CanvasGuideController');
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

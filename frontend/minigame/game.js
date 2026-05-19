require('../js/config/GameConfig');
require('../js/state/UIStatePresenter');
require('../js/api/GameAPI');
require('../js/platform/PlatformRuntime');
require('../js/platform/MiniGameCanvasRenderer');
require('../js/platform/MiniGameApp');

const runtime = new globalThis.PlatformRuntime();
const app = new globalThis.MiniGameApp({
  runtime,
  presenter: globalThis.UIStatePresenter,
  config: globalThis.GameConfig,
  apiClass: globalThis.GameAPI,
  rendererClass: globalThis.MiniGameCanvasRenderer,
});

app.start();

globalThis.CivilizationFireMiniGame = app;

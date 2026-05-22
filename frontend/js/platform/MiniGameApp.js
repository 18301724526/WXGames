(function (global) {
  var CanvasGameApp = global.CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameApp) {
    CanvasGameApp = require('./CanvasGameApp');
  }

  global.MiniGameApp = CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameApp;
})(typeof window !== 'undefined' ? window : globalThis);

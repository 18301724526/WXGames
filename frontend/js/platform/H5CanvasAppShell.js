(function (global) {
  var CanvasGameShell = global.CanvasGameShell;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShell) {
    CanvasGameShell = require('./CanvasGameShell');
  }

  global.H5CanvasAppShell = CanvasGameShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameShell;
})(typeof window !== 'undefined' ? window : globalThis);

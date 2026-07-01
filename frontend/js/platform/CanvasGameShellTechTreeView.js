(function (global) {
  // Tech-tree pan/zoom view-state cluster (getTechTreePan/setTechTreePan/
  // getTechTreeZoom/setTechTreeZoom) extracted from CanvasGameShellRenderingRuntime.
  // Reads/writes the shared UI-state owner via CanvasGameShellHostAccess; the base
  // buildRenderOptions still calls getTechTreeZoom() through the prototype.
  var CanvasGameShellHostAccess = global.CanvasGameShellHostAccess;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameShellHostAccess) {
    CanvasGameShellHostAccess = require('./CanvasGameShellHostAccess');
  }
  var getUiStateOwner = CanvasGameShellHostAccess.getUiStateOwner;

  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
      getTechTreePan() {
        const owner = getUiStateOwner(this);
        return {
          x: Number(owner.techTreePanX) || 0,
          y: Number(owner.techTreePanY) || 0,
        };
      },

      setTechTreePan(pan = {}) {
        const owner = getUiStateOwner(this);
        const x = Number(pan.x) || 0;
        const y = Number(pan.y) || 0;
        owner.techTreePanX = x;
        owner.techTreePanY = y;
        return true;
      },

      getTechTreeZoom() {
        return Math.max(0.65, Math.min(1.6, Number(getUiStateOwner(this).techTreeZoom) || 1));
      },

      setTechTreeZoom(zoom = 1) {
        const owner = getUiStateOwner(this);
        const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
        owner.techTreeZoom = nextZoom;
        return true;
      },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellTechTreeView = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

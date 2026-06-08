(function (global) {
  function hasInputLayout(layout = null) {
    return Boolean(layout?.map || layout?.world || layout?.panel);
  }

  function pickDimension(values = [], fallback = 1) {
    const picked = values.map(Number).find((value) => Boolean(value));
    return Math.max(1, picked || fallback);
  }

  function createInputMapRect(options = {}) {
    const layout = options.layout || null;
    if (!hasInputLayout(layout) && !options.canRender) return null;

    const renderer = options.renderer || {};
    const runtime = options.runtime || {};
    const systemInfo = options.systemInfo || {};
    const topBarBottom = Math.max(0, Number(options.topBarBottom) || 84);
    const width = pickDimension([
      renderer.viewportWidth,
      renderer.width,
      runtime.width,
      systemInfo.windowWidth,
    ], 390);
    const height = pickDimension([
      renderer.viewportHeight,
      renderer.height,
      runtime.height,
      systemInfo.windowHeight,
    ], 844);
    const bottomSafeArea = Math.max(0, Number(renderer.bottomSafeArea) || 0);
    const bottomControlHeight = Math.max(0, Number(options.bottomControlHeight) || 60);
    const bottom = Math.max(topBarBottom, height - bottomControlHeight - bottomSafeArea);
    return {
      x: 0,
      y: topBarBottom,
      width,
      height: bottom - topBarBottom,
    };
  }

  function isPointInMap(point = {}, map = null) {
    const x = Number(point.x);
    const y = Number(point.y);
    return Boolean(map
      && Number.isFinite(x)
      && Number.isFinite(y)
      && x >= Number(map.x)
      && x <= Number(map.x) + Number(map.width)
      && y >= Number(map.y)
      && y <= Number(map.y) + Number(map.height));
  }

  const WorldMapRuntimeInputPolicy = Object.freeze({
    hasInputLayout,
    createInputMapRect,
    isPointInMap,
  });

  global.WorldMapRuntimeInputPolicy = WorldMapRuntimeInputPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeInputPolicy;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  const CONTRACT_VERSION = 'canvas-runtime-v1';

  const REQUIRED_METHODS = Object.freeze([
    'createCanvas',
    'getSystemInfo',
    'getStorage',
    'setStorage',
    'removeStorage',
    'request',
    'now',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'requestAnimationFrame',
    'onTap',
    'onDrag',
    'onGesture',
    'requestTextInput',
  ]);

  const OPTIONAL_METHODS = Object.freeze([
    'getContext',
    'ensureLayerCanvas',
    'getLayerCanvas',
    'getLayerMetrics',
    'getLayerBackingStoreState',
    'resize',
    'onResize',
    'onPointerMove',
    'loadImage',
    'forceReload',
  ]);

  function getRuntimeKind(runtime = {}) {
    const kind = runtime.kind || runtime.platform || '';
    return String(kind || 'unknown');
  }

  function findMissingMethods(runtime = {}) {
    const missing = [];
    if (typeof runtime.createCanvas !== 'function') missing.push('createCanvas');
    if (typeof runtime.getSystemInfo !== 'function') missing.push('getSystemInfo');
    if (typeof runtime.getStorage !== 'function') missing.push('getStorage');
    if (typeof runtime.setStorage !== 'function') missing.push('setStorage');
    if (typeof runtime.removeStorage !== 'function') missing.push('removeStorage');
    if (typeof runtime.request !== 'function') missing.push('request');
    if (typeof runtime.now !== 'function') missing.push('now');
    if (typeof runtime.setTimeout !== 'function') missing.push('setTimeout');
    if (typeof runtime.clearTimeout !== 'function') missing.push('clearTimeout');
    if (typeof runtime.setInterval !== 'function') missing.push('setInterval');
    if (typeof runtime.clearInterval !== 'function') missing.push('clearInterval');
    if (typeof runtime.requestAnimationFrame !== 'function') missing.push('requestAnimationFrame');
    if (typeof runtime.onTap !== 'function') missing.push('onTap');
    if (typeof runtime.onDrag !== 'function') missing.push('onDrag');
    if (typeof runtime.onGesture !== 'function') missing.push('onGesture');
    if (typeof runtime.requestTextInput !== 'function') missing.push('requestTextInput');
    return missing;
  }

  function findOptionalPresent(runtime = {}) {
    const present = [];
    if (typeof runtime.getContext === 'function') present.push('getContext');
    if (typeof runtime.ensureLayerCanvas === 'function') present.push('ensureLayerCanvas');
    if (typeof runtime.getLayerCanvas === 'function') present.push('getLayerCanvas');
    if (typeof runtime.getLayerMetrics === 'function') present.push('getLayerMetrics');
    if (typeof runtime.getLayerBackingStoreState === 'function')
      present.push('getLayerBackingStoreState');
    if (typeof runtime.resize === 'function') present.push('resize');
    if (typeof runtime.onResize === 'function') present.push('onResize');
    if (typeof runtime.onPointerMove === 'function') present.push('onPointerMove');
    if (typeof runtime.loadImage === 'function') present.push('loadImage');
    if (typeof runtime.forceReload === 'function') present.push('forceReload');
    return present;
  }

  function createSnapshot(runtime = {}, options = {}) {
    const requiredMissing = findMissingMethods(runtime);
    const optionalPresent = findOptionalPresent(runtime);
    return Object.freeze({
      schema: CONTRACT_VERSION,
      runtimeName: options.runtimeName || runtime.constructor?.name || 'CanvasRuntime',
      kind: getRuntimeKind(runtime),
      requiredMethods: REQUIRED_METHODS,
      optionalMethods: OPTIONAL_METHODS,
      optionalPresent,
      missingMethods: requiredMissing,
      pureCanvasUi: true,
      platformAdapterOnly: true,
    });
  }

  function assertRuntime(runtime = {}, options = {}) {
    const snapshot = createSnapshot(runtime, options);
    if (snapshot.missingMethods.length > 0) {
      throw new Error(
        `${snapshot.runtimeName} does not satisfy ${CONTRACT_VERSION}: missing ${snapshot.missingMethods.join(', ')}`,
      );
    }
    return snapshot;
  }

  const api = Object.freeze({
    CONTRACT_VERSION,
    REQUIRED_METHODS,
    OPTIONAL_METHODS,
    assertRuntime,
    createSnapshot,
    findMissingMethods,
  });

  global.CanvasRuntimeContract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

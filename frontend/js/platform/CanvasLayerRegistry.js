(function (global) {
  const LAYERS = Object.freeze({
    worldMap: Object.freeze({
      key: 'worldMap',
      zIndex: 997,
      contextType: '2d',
      cameraSpace: 'world',
      inputSurface: false,
      role: 'world-playfield',
    }),
    worldFog: Object.freeze({
      key: 'worldFog',
      zIndex: 998,
      contextType: 'webgl',
      feature: 'FOG_OF_WAR_ENABLED',
      cameraSpace: 'world-overlay',
      inputSurface: false,
      role: 'world-visual-plugin',
    }),
    worldActor: Object.freeze({
      key: 'worldActor',
      zIndex: 999,
      contextType: '2d',
      cameraSpace: 'world-dynamic',
      inputSurface: false,
      role: 'world-actor-layer',
    }),
    mainHud: Object.freeze({
      key: 'mainHud',
      zIndex: 1000,
      contextType: '2d',
      pointerEvents: 'auto',
      cameraSpace: 'screen',
      inputSurface: true,
      role: 'screen-hud-input',
    }),
    tutorialSpine: Object.freeze({
      key: 'tutorialSpine',
      zIndex: 1001,
      contextType: 'webgl',
      pointerEvents: 'none',
      cameraSpace: 'screen-overlay',
      inputSurface: false,
      role: 'tutorial-spine-visual',
    }),
    tutorialDialogue: Object.freeze({
      key: 'tutorialDialogue',
      zIndex: 1002,
      contextType: '2d',
      pointerEvents: 'none',
      cameraSpace: 'screen-overlay',
      inputSurface: false,
      role: 'tutorial-dialogue-visual',
    }),
  });

  const PHYSICAL_LAYER_ORDER = Object.freeze(['worldMap', 'worldFog', 'worldActor', 'mainHud', 'tutorialSpine', 'tutorialDialogue']);

  // Layers in a composite group draw on offscreen surfaces and are engine-composited (in
  // members order) onto ONE shared presentation canvas, instead of stacking one DOM canvas
  // per layer. The group's zIndex positions that single presentation canvas.
  const COMPOSITE_GROUPS = Object.freeze({
    worldStack: Object.freeze({
      key: 'worldStack',
      zIndex: 997,
      members: Object.freeze(['worldMap', 'worldFog', 'worldActor']),
    }),
  });

  const RENDER_QUEUE = Object.freeze([
    'worldPanel',
    'terrain',
    'water',
    'routes',
    'sites',
    'fogMask',
    'actors',
    'worldHud',
    'screenHud',
    'floatingControls',
    'panels',
    'modals',
    'tutorial',
    'feedback',
    'debug',
  ]);

  const HIT_PRIORITY_QUEUE = Object.freeze([
    'mapBackground',
    'mapTile',
    'mapSite',
    'mapActor',
    'worldHud',
    'screenHud',
    'floatingControls',
    'panel',
    'modal',
    'tutorialShield',
    'debug',
  ]);

  function getLayer(name = '') {
    return LAYERS[String(name || '')] || null;
  }

  function getCompositeGroup(key = '') {
    return COMPOSITE_GROUPS[String(key || '')] || null;
  }

  function getCompositeGroupForLayer(name = '') {
    const layerName = String(name || '');
    for (const groupKey of Object.keys(COMPOSITE_GROUPS)) {
      if (COMPOSITE_GROUPS[groupKey].members.includes(layerName)) return COMPOSITE_GROUPS[groupKey];
    }
    return null;
  }

  function getLayerName(name = '') {
    return getLayer(name)?.key || String(name || '');
  }

  function getLayerOptions(name = '', overrides = {}) {
    const layer = getLayer(name);
    if (!layer) return { ...(overrides || {}) };
    const base = { zIndex: layer.zIndex };
    if (layer.contextType && layer.contextType !== '2d') base.contextType = layer.contextType;
    if (layer.pointerEvents) base.pointerEvents = layer.pointerEvents;
    if (layer.inputSurface && layer.role) base.role = layer.role;
    return {
      ...base,
      ...(overrides || {}),
    };
  }

  function isLayerEnabled(name = '', config = null, options = {}) {
    const layer = getLayer(name);
    if (!layer) return false;
    if (!layer.feature) return true;
    const FeatureFlags = options.FeatureFlags || global.FeatureFlags;
    if (FeatureFlags?.isEnabled) return FeatureFlags.isEnabled(config, layer.feature);
    return config?.FEATURES?.[layer.feature] === true;
  }

  function getPhysicalLayerStack() {
    return PHYSICAL_LAYER_ORDER
      .map((name) => getLayer(name))
      .filter(Boolean)
      .map((layer) => ({
        key: layer.key,
        zIndex: layer.zIndex,
        contextType: layer.contextType || '2d',
        cameraSpace: layer.cameraSpace || 'screen',
        inputSurface: layer.inputSurface === true,
        pointerEvents: layer.pointerEvents || (layer.inputSurface ? 'auto' : 'none'),
        role: layer.role || '',
        feature: layer.feature || '',
      }));
  }

  function getRenderQueue() {
    return RENDER_QUEUE.slice();
  }

  function getHitPriorityQueue() {
    return HIT_PRIORITY_QUEUE.slice();
  }

  function compareOrder(queue = [], left = '', right = '') {
    const leftIndex = queue.indexOf(String(left || ''));
    const rightIndex = queue.indexOf(String(right || ''));
    const safeLeft = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
    const safeRight = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
    return safeLeft - safeRight;
  }

  function compareRenderOrder(left = '', right = '') {
    return compareOrder(RENDER_QUEUE, left, right);
  }

  function compareHitPriority(left = '', right = '') {
    return compareOrder(HIT_PRIORITY_QUEUE, left, right);
  }

  const api = {
    LAYERS,
    PHYSICAL_LAYER_ORDER,
    COMPOSITE_GROUPS,
    RENDER_QUEUE,
    HIT_PRIORITY_QUEUE,
    getLayer,
    getLayerName,
    getLayerOptions,
    getCompositeGroup,
    getCompositeGroupForLayer,
    getPhysicalLayerStack,
    getRenderQueue,
    getHitPriorityQueue,
    compareRenderOrder,
    compareHitPriority,
    isLayerEnabled,
  };

  global.CanvasLayerRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

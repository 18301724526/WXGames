(function () {
  'use strict';

  const ASSET_ROOT = '../assets/art/';
  const TERRAIN_ASSETS = {
    plains: { label: '平原', file: 'tile-map/tile-terrain-plains.png', weight: 34 },
    desert: { label: '沙漠', file: 'tile-map/tile-terrain-desert.png', weight: 0 },
    forest: { label: '森林', file: 'tile-map/tile-terrain-forest.png', weight: 24 },
    hills: { label: '丘陵', file: 'tile-map/tile-terrain-hills.png', weight: 16 },
    river: { label: '河岸', file: 'tile-map/tile-terrain-river.png', weight: 12 },
    waste: { label: '荒地', file: 'tile-map/tile-terrain-waste.png', weight: 8 },
    mountain: { label: '山地', file: 'tile-map/tile-terrain-mountain.png', weight: 6 },
    capital: { label: '首都', file: 'tile-map/tile-terrain-plains.png', weight: 0 },
  };
  const SITE_ASSETS = {
    camp: { label: '营地', file: 'world-site-camp-cutout.png' },
    city: { label: '城邦', file: 'world-site-city-cutout.png' },
    outpost: { label: '据点', file: 'world-site-outpost-cutout.png' },
    ruins: { label: '遗迹', file: 'world-site-ruins-cutout.png' },
    town: { label: '城镇', file: 'world-site-town-cutout.png' },
  };
  const FEATURE_ASSETS = {
    treeCluster: { label: 'tree cluster', file: 'tile-map/tile-feature-tree-cluster.png' },
    mountainRidge: { label: 'mountain ridge', file: 'tile-map/tile-feature-mountain-ridge.png' },
  };
  const WATER_TEXTURE_ASSETS = {
    river: { label: 'river uv loop water', file: 'tile-map/tile-water-river-loop.png', uvScale: 0.72, speedX: -18, speedY: 7, alpha: 0.94 },
    ocean: { label: 'ocean uv loop water', file: 'tile-map/tile-water-ocean-loop.png', uvScale: 0.84, speedX: -8, speedY: 4, alpha: 0.96 },
  };
  const WATER_ANIMATION_FPS = 18;
  const TEMPLATE_SIDE_KEYS = [
    'nw',
    'ne',
    'se',
    'sw',
    'nw-ne',
    'nw-se',
    'nw-sw',
    'ne-se',
    'ne-sw',
    'se-sw',
    'nw-ne-se',
    'nw-ne-sw',
    'nw-se-sw',
    'ne-se-sw',
    'nw-ne-se-sw',
  ];
  const RIVER_TEMPLATE_ASSETS = {
    nw: { label: 'river bank uv nw', file: 'tile-map/river-template/tile-river-bank-uv-nw.png' },
    ne: { label: 'river bank uv ne', file: 'tile-map/river-template/tile-river-bank-uv-ne.png' },
    se: { label: 'river bank uv se', file: 'tile-map/river-template/tile-river-bank-uv-se.png' },
    sw: { label: 'river bank uv sw', file: 'tile-map/river-template/tile-river-bank-uv-sw.png' },
    'nw-ne': { label: 'river bank uv nw-ne', file: 'tile-map/river-template/tile-river-bank-uv-nw-ne.png' },
    'nw-se': { label: 'river bank uv nw-se', file: 'tile-map/river-template/tile-river-bank-uv-nw-se.png' },
    'nw-sw': { label: 'river bank uv nw-sw', file: 'tile-map/river-template/tile-river-bank-uv-nw-sw.png' },
    'ne-se': { label: 'river bank uv ne-se', file: 'tile-map/river-template/tile-river-bank-uv-ne-se.png' },
    'ne-sw': { label: 'river bank uv ne-sw', file: 'tile-map/river-template/tile-river-bank-uv-ne-sw.png' },
    'se-sw': { label: 'river bank uv se-sw', file: 'tile-map/river-template/tile-river-bank-uv-se-sw.png' },
    'nw-ne-se': { label: 'river bank uv nw-ne-se', file: 'tile-map/river-template/tile-river-bank-uv-nw-ne-se.png' },
    'nw-ne-sw': { label: 'river bank uv nw-ne-sw', file: 'tile-map/river-template/tile-river-bank-uv-nw-ne-sw.png' },
    'nw-se-sw': { label: 'river bank uv nw-se-sw', file: 'tile-map/river-template/tile-river-bank-uv-nw-se-sw.png' },
    'ne-se-sw': { label: 'river bank uv ne-se-sw', file: 'tile-map/river-template/tile-river-bank-uv-ne-se-sw.png' },
    'nw-ne-se-sw': { label: 'river bank uv nw-ne-se-sw', file: 'tile-map/river-template/tile-river-bank-uv-nw-ne-se-sw.png' },
  };
  const OCEAN_WATER_TEMPLATE_ASSETS = {
    full: { label: 'ocean water full', file: 'tile-map/ocean-template/tile-ocean-water-full.png' },
  };
  const OCEAN_SHORE_EDGE_ASSETS = {
    nw: { label: 'ocean shore edge nw', file: 'tile-map/ocean-template/tile-ocean-shore-edge-nw.png' },
    ne: { label: 'ocean shore edge ne', file: 'tile-map/ocean-template/tile-ocean-shore-edge-ne.png' },
    se: { label: 'ocean shore edge se', file: 'tile-map/ocean-template/tile-ocean-shore-edge-se.png' },
    sw: { label: 'ocean shore edge sw', file: 'tile-map/ocean-template/tile-ocean-shore-edge-sw.png' },
    'nw-ne': { label: 'ocean shore edges nw-ne', file: 'tile-map/ocean-template/tile-ocean-shore-edges-nw-ne.png' },
    'ne-se': { label: 'ocean shore edges ne-se', file: 'tile-map/ocean-template/tile-ocean-shore-edges-ne-se.png' },
    'se-sw': { label: 'ocean shore edges se-sw', file: 'tile-map/ocean-template/tile-ocean-shore-edges-se-sw.png' },
    'nw-sw': { label: 'ocean shore edges nw-sw', file: 'tile-map/ocean-template/tile-ocean-shore-edges-nw-sw.png' },
  };
  const OCEAN_SHORE_CORNER_ASSETS = {
    'corner-n': { label: 'ocean shore corner n', file: 'tile-map/ocean-template/tile-ocean-shore-corner-n.png' },
    'corner-e': { label: 'ocean shore corner e', file: 'tile-map/ocean-template/tile-ocean-shore-corner-e.png' },
    'corner-s': { label: 'ocean shore corner s', file: 'tile-map/ocean-template/tile-ocean-shore-corner-s.png' },
    'corner-w': { label: 'ocean shore corner w', file: 'tile-map/ocean-template/tile-ocean-shore-corner-w.png' },
  };
  const OCEAN_RIVER_MOUTH_ASSETS = {
    'river-mouth-nw': { label: 'ocean river mouth nw', file: 'tile-map/ocean-template/tile-ocean-river-mouth-nw.png' },
    'river-mouth-ne': { label: 'ocean river mouth ne', file: 'tile-map/ocean-template/tile-ocean-river-mouth-ne.png' },
    'river-mouth-se': { label: 'ocean river mouth se', file: 'tile-map/ocean-template/tile-ocean-river-mouth-se.png' },
    'river-mouth-sw': { label: 'ocean river mouth sw', file: 'tile-map/ocean-template/tile-ocean-river-mouth-sw.png' },
  };
  const OCEAN_TEMPLATE_ASSETS = {
    ...OCEAN_WATER_TEMPLATE_ASSETS,
    ...OCEAN_SHORE_EDGE_ASSETS,
    ...OCEAN_SHORE_CORNER_ASSETS,
    ...OCEAN_RIVER_MOUTH_ASSETS,
  };
  const OCEAN_SHORE_EDGE_KEYS = ['nw', 'ne', 'se', 'sw', 'nw-ne', 'ne-se', 'se-sw', 'nw-sw'];
  const OCEAN_SHORE_CORNER_KEYS = ['corner-n', 'corner-e', 'corner-s', 'corner-w'];
  const OCEAN_RIVER_MOUTH_KEYS = ['river-mouth-nw', 'river-mouth-ne', 'river-mouth-se', 'river-mouth-sw'];
  const OCEAN_TEMPLATE_SAMPLE_KEYS = [
    'full',
    ...OCEAN_SHORE_EDGE_KEYS,
    ...OCEAN_RIVER_MOUTH_KEYS,
    ...OCEAN_SHORE_CORNER_KEYS,
  ];
  const OCEAN_TEMPLATE_SAMPLE_IDS = Object.fromEntries(
    OCEAN_TEMPLATE_SAMPLE_KEYS.map((key, index) => [key, `S${index + 1}`])
  );
  const TERRAIN_TRANSITION_TEMPLATE_ASSETS = {
    nw: { label: 'plains desert transition nw', file: 'tile-map/transition-template/tile-transition-plains-desert-nw.png' },
    ne: { label: 'plains desert transition ne', file: 'tile-map/transition-template/tile-transition-plains-desert-ne.png' },
    se: { label: 'plains desert transition se', file: 'tile-map/transition-template/tile-transition-plains-desert-se.png' },
    sw: { label: 'plains desert transition sw', file: 'tile-map/transition-template/tile-transition-plains-desert-sw.png' },
    'nw-ne': { label: 'plains desert transition nw-ne', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-ne.png' },
    'nw-se': { label: 'plains desert transition nw-se', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-se.png' },
    'nw-sw': { label: 'plains desert transition nw-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-sw.png' },
    'ne-se': { label: 'plains desert transition ne-se', file: 'tile-map/transition-template/tile-transition-plains-desert-ne-se.png' },
    'ne-sw': { label: 'plains desert transition ne-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-ne-sw.png' },
    'se-sw': { label: 'plains desert transition se-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-se-sw.png' },
    'nw-ne-se': { label: 'plains desert transition nw-ne-se', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-ne-se.png' },
    'nw-ne-sw': { label: 'plains desert transition nw-ne-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-ne-sw.png' },
    'nw-se-sw': { label: 'plains desert transition nw-se-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-se-sw.png' },
    'ne-se-sw': { label: 'plains desert transition ne-se-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-ne-se-sw.png' },
    'nw-ne-se-sw': { label: 'plains desert transition nw-ne-se-sw', file: 'tile-map/transition-template/tile-transition-plains-desert-nw-ne-se-sw.png' },
  };
  const TERRAIN_TYPES = ['plains', 'desert', 'forest', 'hills', 'river', 'waste', 'mountain'];
  const STANDARD_ISO_ASPECT = 0.5;
  const TILE_EDGE_OVERDRAW = 1.5;
  const TERRAIN_FEATURES = {
    hills: { chance: 0.42, scale: 0.5, alpha: 0.66, lift: 0.08, squash: 0.68 },
    waste: { chance: 0.32, scale: 0.48, alpha: 0.58, lift: 0.06, squash: 0.7 },
  };
  const OVERLAY_OFFSET_TARGETS = [
    ...Object.entries(SITE_ASSETS).map(([key, asset]) => ({ key: `site:${key}`, label: asset.label })),
    { key: 'feature:treeCluster', label: 'tree cluster' },
    { key: 'feature:mountainRidge', label: 'mountain ridge' },
    ...Object.keys(TERRAIN_FEATURES).map((key) => ({ key: `terrain:${key}`, label: `${key} terrain feature` })),
  ];
  const DEFAULT_OVERLAY_OFFSETS = {
    'site:camp': { x: -1, y: 28 },
    'site:city': { x: -2, y: 27 },
    'site:outpost': { x: 0, y: 29 },
    'site:ruins': { x: 0, y: 27 },
    'site:town': { x: 0, y: 26 },
    'feature:treeCluster': { x: 0, y: 4 },
    'feature:mountainRidge': { x: 0, y: 0 },
    'terrain:hills': { x: 0, y: 13 },
    'terrain:waste': { x: 0, y: 9 },
  };
  const DEFAULT_OVERLAY_OFFSET_TARGET = OVERLAY_OFFSET_TARGETS[0]?.key || '';
  const OVERLAY_CALIBRATION_TILES = [
    { q: -2, r: 1, target: 'site:camp', terrain: 'plains', site: { type: 'camp', owner: 'neutral', label: SITE_ASSETS.camp.label } },
    { q: -1, r: 0, target: 'site:city', terrain: 'plains', site: { type: 'city', owner: 'city_state', label: SITE_ASSETS.city.label } },
    { q: 0, r: -1, target: 'site:outpost', terrain: 'plains', site: { type: 'outpost', owner: 'neutral', label: SITE_ASSETS.outpost.label } },
    { q: 1, r: -2, target: 'site:ruins', terrain: 'plains', site: { type: 'ruins', owner: 'ruin_guardians', label: SITE_ASSETS.ruins.label } },
    { q: 2, r: -3, target: 'site:town', terrain: 'plains', site: { type: 'town', owner: 'neutral', label: SITE_ASSETS.town.label } },
    { q: -1, r: 2, target: 'feature:treeCluster', terrain: 'forest' },
    { q: 0, r: 1, target: 'feature:mountainRidge', terrain: 'mountain' },
    { q: 1, r: 0, target: 'terrain:hills', terrain: 'hills' },
    { q: 2, r: -1, target: 'terrain:waste', terrain: 'waste' },
  ];
  const RIVER_DIRECTIONS = [
    { dq: 1, dr: 0 },
    { dq: 1, dr: -1 },
    { dq: 0, dr: -1 },
    { dq: -1, dr: 0 },
    { dq: -1, dr: 1 },
    { dq: 0, dr: 1 },
  ];
  const RIVER_TEMPLATE_DIRECTION_SIDES = {
    0: 'se',
    2: 'ne',
    3: 'nw',
    5: 'sw',
  };
  const RIVER_TEMPLATE_DIRECTION_INDICES = Object.keys(RIVER_TEMPLATE_DIRECTION_SIDES).map(Number);
  const TILE_SIDE_DIRECTIONS = {
    nw: { dq: -1, dr: 0 },
    ne: { dq: 0, dr: -1 },
    se: { dq: 1, dr: 0 },
    sw: { dq: 0, dr: 1 },
  };
  // Offsets are from the full ocean tile to the neighboring river-mouth tile.
  const RIVER_MOUTH_TEMPLATE_BY_OCEAN_NEIGHBOR_OFFSET = {
    '0,1': 'river-mouth-ne',
    '0,-1': 'river-mouth-sw',
    '1,0': 'river-mouth-nw',
    '-1,0': 'river-mouth-se',
  };
  const TILE_SIDE_ORDER = ['nw', 'ne', 'se', 'sw'];
  const RIVER_DIRECTION_BY_SIDE = {
    se: 0,
    ne: 2,
    nw: 3,
    sw: 5,
  };
  const RIVER_MOUTH_INLAND_SIDE_BY_SHORE_SIDE = {
    nw: 'se',
    ne: 'sw',
    se: 'nw',
    sw: 'ne',
  };
  const RIVER_MOUTH_RIVER_TEMPLATE_KEY_BY_SHORE_SIDE = {
    nw: 'nw-se',
    ne: 'ne-sw',
    se: 'nw-se',
    sw: 'ne-sw',
  };
  const MICRO_TERRAIN_OVERRIDES = {
    'tile_-4_-1': 'desert',
    'tile_-4_0': 'desert',
    'tile_-3_-1': 'desert',
    'tile_-3_0': 'desert',
    'tile_-2_-1': 'desert',
    'tile_-2_0': 'desert',
    'tile_-1_-1': 'desert',
  };
  const MICRO_OCEAN_CORE_TILE_IDS = new Set([
    // Western coast.
    'tile_-6_1', 'tile_-6_2', 'tile_-6_3', 'tile_-6_4', 'tile_-6_5',
    'tile_-5_1', 'tile_-5_2', 'tile_-5_3', 'tile_-5_4',
    'tile_-4_2', 'tile_-4_3', 'tile_-4_4',
    'tile_-3_3', 'tile_-3_4',
    // Central lake.
    'tile_1_-1', 'tile_2_-1',
    'tile_1_0', 'tile_2_0',
    'tile_1_1', 'tile_2_1',
    // Small eastern bay.
    'tile_4_-2', 'tile_5_-2',
    'tile_4_-1', 'tile_5_-1',
    'tile_4_0',
  ]);
  const MICRO_RIVER_PATHS = [
    {
      path: [
        { q: 4, r: 2 }, { q: 4, r: 1 },
      ],
      outletSide: 'ne',
    },
  ];
  const OCEAN_LAB_CORE_TILE_IDS = new Set(['tile_0_0']);
  const OCEAN_REFERENCE_GRID_SIZE = 6;
  const OCEAN_REFERENCE_FULL_NUMBERS = new Set([15]);
  const OCEAN_REFERENCE_TEMPLATE_OVERRIDES = new Map([
    [8, 'corner-n'],
    [10, 'corner-e'],
    [20, 'corner-w'],
    [22, 'corner-s'],
  ]);
  const OCEAN_SHORE_EDGE_BY_CORE_OFFSET = {
    '-1,0': 'nw',
    '0,-1': 'ne',
    '1,0': 'se',
    '0,1': 'sw',
  };
  const OCEAN_CORNER_BY_CORE_OFFSET = {
    '1,1': 'corner-n',
    '-1,1': 'corner-e',
    '-1,-1': 'corner-s',
    '1,-1': 'corner-w',
  };
  const OCEAN_COMBO_CORE_TILE_IDS = new Set([
    // 1x4 thin strip.
    'tile_-8_0', 'tile_-7_0', 'tile_-6_0', 'tile_-5_0',
    // 2x2 block.
    'tile_-8_3', 'tile_-7_3', 'tile_-8_4', 'tile_-7_4',
    // L shape.
    'tile_-3_-6', 'tile_-2_-6', 'tile_-1_-6', 'tile_-3_-5', 'tile_-3_-4',
    // 3x3 inland sea.
    'tile_-1_-1', 'tile_0_-1', 'tile_1_-1',
    'tile_-1_0', 'tile_0_0', 'tile_1_0',
    'tile_-1_1', 'tile_0_1', 'tile_1_1',
    // U shape.
    'tile_2_3', 'tile_3_3', 'tile_4_3',
    'tile_2_4', 'tile_4_4',
    'tile_2_5', 'tile_3_5', 'tile_4_5',
    // 3x2 block.
    'tile_5_-4', 'tile_6_-4', 'tile_7_-4',
    'tile_5_-3', 'tile_6_-3', 'tile_7_-3',
    // Vertical strip.
    'tile_4_-8', 'tile_4_-7', 'tile_4_-6', 'tile_4_-5',
    // Plus shape.
    'tile_7_-1', 'tile_6_0', 'tile_7_0', 'tile_8_0', 'tile_7_1',
    // Stair shape.
    'tile_-7_6', 'tile_-6_5', 'tile_-5_4', 'tile_-4_3',
  ]);

  const state = {
    seed: 'scout-tile-v1',
    mapPreset: 'overlay-calibration',
    layoutMode: 'iso',
    radius: 6,
    tileSize: 192,
    stepX: 96,
    stepY: 48,
    anchorY: 0.5,
    siteScale: 0.46,
    selectedOverlayOffsetTarget: DEFAULT_OVERLAY_OFFSET_TARGET,
    overlayOffsets: Object.fromEntries(OVERLAY_OFFSET_TARGETS.map((target) => [
      target.key,
      { ...(DEFAULT_OVERLAY_OFFSETS[target.key] || { x: 0, y: 0 }) },
    ])),
    zoom: 0.78,
    panX: -150,
    panY: 68,
    showSites: true,
    showFog: false,
    showDebug: false,
    showLabels: false,
    animateWater: true,
    hoverTileId: '',
  };

  const canvas = document.getElementById('tileCanvas');
  const ctx = canvas.getContext('2d');
  const hoverInfo = document.getElementById('hoverInfo');
  const exportData = document.getElementById('exportData');
  const images = new Map();
  const imageMetrics = new Map();
  const waterMasks = new Map();
  const waterMaskMetrics = new Map();
  const dryTemplateCanvases = new Map();
  const staticBaseCanvas = document.createElement('canvas');
  const staticBaseCtx = staticBaseCanvas.getContext('2d');
  const waterCompositeCanvas = document.createElement('canvas');
  const waterCompositeCtx = waterCompositeCanvas.getContext('2d');
  const dryCompositeCanvas = document.createElement('canvas');
  const dryCompositeCtx = dryCompositeCanvas.getContext('2d');
  const waterLayerCanvas = document.createElement('canvas');
  const waterLayerCtx = waterLayerCanvas.getContext('2d');
  const controls = {};
  let tiles = [];
  let riverConnections = new Map();
  let assetLoadRequestId = 0;
  let isDragging = false;
  let dragStart = null;
  let needsRender = true;
  let staticBaseDirty = true;
  let waterLayerDirty = true;
  let lastWaterFrame = -1;
  let lastRenderedWaterFrame = -1;
  let effectiveGridSynced = false;
  let animationStartMs = performance.now();

  function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function random01(seed, q, r, salt) {
    const value = hashString(`${seed}|${q}|${r}|${salt}`);
    return value / 4294967295;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  function valueNoise(x, y, salt) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothStep(x - x0);
    const ty = smoothStep(y - y0);
    const a = random01(state.seed, x0, y0, salt);
    const b = random01(state.seed, x0 + 1, y0, salt);
    const c = random01(state.seed, x0, y0 + 1, salt);
    const d = random01(state.seed, x0 + 1, y0 + 1, salt);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }

  function axialToMapPoint(q, r) {
    return {
      x: q + r * 0.5,
      y: r * 0.86,
    };
  }

  function getTileId(q, r) {
    return `tile_${q}_${r}`;
  }

  function parseTileId(id) {
    const match = /^tile_(-?\d+)_(-?\d+)$/.exec(String(id));
    if (!match) return null;
    return { q: Number(match[1]), r: Number(match[2]) };
  }

  function isRiverTile(q, r) {
    return riverConnections.has(getTileId(q, r));
  }

  function getRiverConnectionsByCoord(q, r) {
    return riverConnections.get(getTileId(q, r)) || [];
  }

  function getRiverConnections(tile) {
    return getRiverConnectionsByCoord(tile.q, tile.r);
  }

  function getRiverPortsByCoord(q, r) {
    return getRiverConnectionsByCoord(q, r)
      .map((directionIndex) => RIVER_TEMPLATE_DIRECTION_SIDES[directionIndex])
      .filter(Boolean)
      .sort((a, b) => ['nw', 'ne', 'se', 'sw'].indexOf(a) - ['nw', 'ne', 'se', 'sw'].indexOf(b));
  }

  function getRiverPorts(tile) {
    return getRiverPortsByCoord(tile.q, tile.r);
  }

  function getRiverTemplateKey(tile) {
    const sides = getRiverPorts(tile);
    return sides.join('-');
  }

  function getRiverTemplateAsset(tile) {
    const key = getRiverTemplateKey(tile);
    return RIVER_TEMPLATE_ASSETS[key] || null;
  }

  function getRiverMouthTemplateForNeighborOfOcean(qOffset, rOffset) {
    return RIVER_MOUTH_TEMPLATE_BY_OCEAN_NEIGHBOR_OFFSET[`${Number(qOffset) || 0},${Number(rOffset) || 0}`] || '';
  }

  function getRiverMouthTemplateKey(q, r, shoreSide) {
    const riverSides = getRiverPortsByCoord(q, r);
    const inlandSide = RIVER_MOUTH_INLAND_SIDE_BY_SHORE_SIDE[shoreSide];
    const oceanDir = TILE_SIDE_DIRECTIONS[shoreSide];
    const templateKey = getRiverMouthTemplateForNeighborOfOcean(
      -(oceanDir?.dq || 0),
      -(oceanDir?.dr || 0),
    );
    return riverSides.length === 2 && riverSides.includes(shoreSide) && riverSides.includes(inlandSide)
      ? templateKey
      : '';
  }

  function getOceanRiverMouthSide(templateAsset) {
    return Object.entries(OCEAN_RIVER_MOUTH_ASSETS)
      .find(([_key, asset]) => asset.file === templateAsset?.file)?.[0]
      ?.replace('river-mouth-', '') || '';
  }

  function getRiverMouthShoreEdgeAsset(templateAsset) {
    const side = getOceanRiverMouthSide(templateAsset);
    return side ? OCEAN_SHORE_EDGE_ASSETS[side] || null : null;
  }

  function getRiverMouthRiverTemplateAsset(templateAsset) {
    const side = getOceanRiverMouthSide(templateAsset);
    const riverKey = RIVER_MOUTH_RIVER_TEMPLATE_KEY_BY_SHORE_SIDE[side];
    return riverKey ? RIVER_TEMPLATE_ASSETS[riverKey] || null : null;
  }

  function isOceanTile(tile) {
    // 'shore' is the passable coastline reclassification (pure edge/corner shoreline
    // templates); its art stack is identical to ocean, so it shares every ocean draw path.
    return tile?.terrain === 'ocean' || tile?.terrain === 'shore';
  }

  function getOceanTemplateKey(tile) {
    return getOceanTemplateKeys(tile)[0] || '';
  }

  function isOceanTemplateAvailable(key) {
    return !!OCEAN_TEMPLATE_ASSETS[key];
  }

  function getOceanTemplateKeys(tile) {
    if (!isOceanTile(tile)) return [];
    if (Array.isArray(tile.oceanTemplates)) return tile.oceanTemplates.filter(Boolean);
    return tile.oceanTemplate ? [tile.oceanTemplate] : ['full'];
  }

  function getOceanTemplateAssets(tile) {
    return getOceanTemplateKeys(tile)
      .map((key) => OCEAN_TEMPLATE_ASSETS[key])
      .filter(Boolean);
  }

  function getOceanTemplateAsset(tile) {
    return getOceanTemplateAssets(tile)[0] || null;
  }

  function getOceanTemplateSampleId(key) {
    return OCEAN_TEMPLATE_SAMPLE_IDS[key] || 'S?';
  }

  function getSortedSideKey(sides) {
    return sides
      .filter(Boolean)
      .sort((a, b) => TILE_SIDE_ORDER.indexOf(a) - TILE_SIDE_ORDER.indexOf(b))
      .join('-');
  }

  function getTileByCoord(q, r) {
    return tiles.find((tile) => tile.q === q && tile.r === r) || null;
  }

  function getAdjacentTerrainSides(tile, terrain) {
    return TILE_SIDE_ORDER.filter((side) => {
      const dir = TILE_SIDE_DIRECTIONS[side];
      const neighbor = getTileByCoord(tile.q + dir.dq, tile.r + dir.dr);
      return neighbor?.terrain === terrain;
    });
  }

  function getTerrainTransitionTemplateKey(tile) {
    if (tile.terrain !== 'plains') return '';
    const sides = getAdjacentTerrainSides(tile, 'desert');
    return sides.length ? getSortedSideKey(sides) : '';
  }

  function getTerrainTransitionTemplateAsset(tile) {
    const key = getTerrainTransitionTemplateKey(tile);
    return key ? TERRAIN_TRANSITION_TEMPLATE_ASSETS[key] || null : null;
  }

  function getTileTemplateAsset(tile) {
    return getOceanTemplateAsset(tile)
      || getRiverTemplateAsset(tile)
      || getTerrainTransitionTemplateAsset(tile);
  }

  function getTileTemplateAssets(tile) {
    const oceanAssets = getOceanTemplateAssets(tile);
    if (oceanAssets.length) return oceanAssets;
    const templateAsset = getRiverTemplateAsset(tile) || getTerrainTransitionTemplateAsset(tile);
    return templateAsset ? [templateAsset] : [];
  }

  function hasRiverNearby(q, r, radius = 1) {
    if (isRiverTile(q, r)) return true;
    if (radius <= 0) return false;
    return RIVER_DIRECTIONS.some((dir) => isRiverTile(q + dir.dq, r + dir.dr));
  }

  function isRiverBlockedCoord(q, r) {
    return getHexDistance({ q, r }, { q: 0, r: 0 }) <= 1
      || isOceanShoreCornerCoord(q, r);
  }

  function chooseTerrain(q, r) {
    if (q === 0 && r === 0) return 'capital';
    const point = axialToMapPoint(q, r);
    const forest = valueNoise(point.x / 3.2, point.y / 3.2, 'forest-region');
    const stone = valueNoise((point.x + 7) / 3.7, (point.y - 3) / 3.7, 'stone-region');
    const dry = valueNoise((point.x - 5) / 4.4, (point.y + 2) / 4.4, 'dry-region');
    const mountain = valueNoise((point.x + 2) / 5.0, (point.y + 5) / 5.0, 'mountain-region');
    if (mountain > 0.76) return 'mountain';
    if (stone > 0.78) return 'hills';
    if (forest > 0.68) return 'forest';
    if (dry > 0.8) return 'waste';
    return 'plains';
  }

  function chooseSite(q, r, terrain, ring) {
    if (q === 0 && r === 0) return { type: 'city', owner: 'player', label: '首都' };
    if (hasRiverNearby(q, r, 1)) return null;
    const chance = q === 0 && r === 0 ? 1 : Math.min(0.018 + ring * 0.012, 0.08);
    if (random01(state.seed, q, r, 'site') > chance) return null;
    const roll = random01(state.seed, q, r, 'site-type');
    let type = 'outpost';
    if (terrain === 'forest') type = roll < 0.62 ? 'camp' : 'outpost';
    else if (terrain === 'hills' || terrain === 'mountain') type = roll < 0.52 ? 'ruins' : 'city';
    else if (terrain === 'waste') type = roll < 0.62 ? 'ruins' : 'camp';
    else type = roll < 0.45 ? 'town' : roll < 0.78 ? 'outpost' : 'city';
    const owner = type === 'outpost' || type === 'town'
      ? (ring >= 4 && roll > 0.72 ? 'city_state' : 'neutral')
      : type === 'ruins'
        ? 'ruin_guardians'
        : type === 'city'
          ? 'city_state'
          : 'tribe';
    return { type, owner, label: SITE_ASSETS[type].label };
  }

  function isCoordInRadius(q, r, radius) {
    const s = -q - r;
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= radius;
  }

  function getHexDistance(from, to) {
    return Math.max(
      Math.abs(from.q - to.q),
      Math.abs(from.r - to.r),
      Math.abs((-from.q - from.r) - (-to.q - to.r))
    );
  }

  function buildRiverPath(start, target, radius, salt) {
    const path = [{ q: start.q, r: start.r }];
    const visited = new Set([getTileId(start.q, start.r)]);
    let current = { q: start.q, r: start.r };
    const maxSteps = radius * 8;
    for (let step = 0; step < maxSteps; step += 1) {
      if (current.q === target.q && current.r === target.r) break;
      const candidates = RIVER_DIRECTIONS
        .map((dir, index) => ({
          index,
          q: current.q + dir.dq,
          r: current.r + dir.dr,
        }))
        .filter((item) => RIVER_TEMPLATE_DIRECTION_INDICES.includes(item.index))
        .filter((item) => isCoordInRadius(item.q, item.r, radius))
        .filter((item) => !isRiverBlockedCoord(item.q, item.r))
        .map((item) => {
          const id = getTileId(item.q, item.r);
          const distance = getHexDistance(item, target);
          const revisited = visited.has(id) && !(item.q === target.q && item.r === target.r);
          const wobble = random01(state.seed, item.q, item.r, `${salt}-wobble-${step}`);
          const flowBias = RIVER_TEMPLATE_DIRECTION_INDICES.indexOf(item.index) * 0.08;
          return { ...item, score: distance * 10 + wobble * 3 + flowBias + (revisited ? 40 : 0) };
        })
        .sort((a, b) => a.score - b.score);
      const next = candidates[0];
      if (!next) break;
      current = { q: next.q, r: next.r };
      path.push(current);
      visited.add(getTileId(current.q, current.r));
    }
    return path;
  }

  function getDirectionIndex(from, to) {
    return RIVER_DIRECTIONS.findIndex((dir) => from.q + dir.dq === to.q && from.r + dir.dr === to.r);
  }

  function addRiverConnection(connections, from, to) {
    const fromDirection = getDirectionIndex(from, to);
    const toDirection = getDirectionIndex(to, from);
    if (fromDirection < 0 || toDirection < 0) return;
    const fromId = getTileId(from.q, from.r);
    const toId = getTileId(to.q, to.r);
    if (!connections.has(fromId)) connections.set(fromId, new Set());
    if (!connections.has(toId)) connections.set(toId, new Set());
    connections.get(fromId).add(fromDirection);
    connections.get(toId).add(toDirection);
  }

  function addRiverSideConnection(connections, tile, side) {
    if (!side) return;
    const direction = RIVER_DIRECTION_BY_SIDE[side];
    if (direction === undefined) return;
    const id = getTileId(tile.q, tile.r);
    if (!connections.has(id)) connections.set(id, new Set());
    connections.get(id).add(direction);
  }

  function normalizeRiverConnections(connections, radius) {
    const normalized = new Map();
    for (const [id, dirs] of connections.entries()) {
      const coord = parseTileId(id);
      if (!coord) continue;
      if (isOceanShoreCornerCoord(coord.q, coord.r)) continue;
      const nextDirs = new Set();
      for (const directionIndex of dirs) {
        if (!RIVER_TEMPLATE_DIRECTION_INDICES.includes(directionIndex)) continue;
        const dir = RIVER_DIRECTIONS[directionIndex];
        const neighbor = { q: coord.q + dir.dq, r: coord.r + dir.dr };
        const neighborInsideMap = isCoordInRadius(neighbor.q, neighbor.r, radius);
        if (!neighborInsideMap) {
          nextDirs.add(directionIndex);
          continue;
        }
        if (isOceanShoreCornerCoord(neighbor.q, neighbor.r)) continue;
        const neighborId = getTileId(neighbor.q, neighbor.r);
        const oppositeDirection = (directionIndex + 3) % 6;
        if ((state.mapPreset === 'micro' && isOceanCoreCoord(neighbor.q, neighbor.r))
          || connections.get(neighborId)?.has(oppositeDirection)) {
          nextDirs.add(directionIndex);
        }
      }
      if (nextDirs.size) normalized.set(id, nextDirs);
    }
    return new Map(
      Array.from(normalized.entries()).map(([entryId, dirs]) => [entryId, Array.from(dirs).sort((a, b) => a - b)])
    );
  }

  function createMicroRiverConnections(radius) {
    const connections = new Map();
    for (const item of MICRO_RIVER_PATHS) {
      for (let index = 1; index < item.path.length; index += 1) {
        addRiverConnection(connections, item.path[index - 1], item.path[index]);
      }
      addRiverSideConnection(connections, item.path[item.path.length - 1], item.outletSide);
    }
    return normalizeRiverConnections(connections, radius);
  }

  function createRiverConnections(radius) {
    if (state.mapPreset === 'ocean9' || state.mapPreset === 'ocean-combos' || state.mapPreset === 'ocean-missing-11') return new Map();
    if (state.mapPreset === 'micro') return createMicroRiverConnections(radius);
    const connections = new Map();
    const mainStart = { q: -Math.max(1, Math.floor(radius * 0.42)), r: -radius + Math.max(1, Math.floor(radius * 0.42)) };
    const mainPreferredTarget = { q: Math.max(1, Math.floor(radius * 0.42)), r: radius - Math.max(1, Math.floor(radius * 0.42)) };
    const mainTarget = mainPreferredTarget;
    const mainPath = buildRiverPath(mainStart, mainTarget, radius, 'river-main');
    const branchStart = mainPath[Math.max(1, Math.floor(mainPath.length * 0.52))] || mainPath[0];
    const branchTarget = { q: radius, r: -Math.max(0, Math.floor(radius * 0.18)) };
    const branchPath = buildRiverPath(branchStart, branchTarget, radius, 'river-branch');
    for (const path of [mainPath, branchPath]) {
      for (let i = 1; i < path.length; i += 1) addRiverConnection(connections, path[i - 1], path[i]);
    }
    return normalizeRiverConnections(connections, radius);
  }

  function chooseMicroTerrain(q, r) {
    const id = getTileId(q, r);
    if (MICRO_TERRAIN_OVERRIDES[id]) return MICRO_TERRAIN_OVERRIDES[id];
    if (q === 0 && r === 0) return 'capital';
    if (q <= -3 && r <= 0) return 'desert';
    if (q <= -1 && r >= -1 && r <= 1) return 'plains';
    if (q <= 0 && r >= 2) return 'forest';
    if (q >= 1 && r <= -2) return 'hills';
    if (q >= 1 && r >= 1 && r <= 2) return 'plains';
    if (q >= 2 && r <= 0) return 'mountain';
    return 'plains';
  }

  function getOceanCoreSet() {
    if (state.mapPreset === 'micro') return MICRO_OCEAN_CORE_TILE_IDS;
    return state.mapPreset === 'ocean-combos' ? OCEAN_COMBO_CORE_TILE_IDS : OCEAN_LAB_CORE_TILE_IDS;
  }

  function getOceanReferenceNumber(q, r) {
    if (q < 0 || q >= OCEAN_REFERENCE_GRID_SIZE || r < 0 || r >= OCEAN_REFERENCE_GRID_SIZE) return 0;
    return r * OCEAN_REFERENCE_GRID_SIZE + q + 1;
  }

  function isOceanReferenceFullCoord(q, r) {
    return OCEAN_REFERENCE_FULL_NUMBERS.has(getOceanReferenceNumber(q, r));
  }

  function getOceanReferenceLabel(q, r) {
    const number = getOceanReferenceNumber(q, r);
    if (!number) return '';
    return String(number);
  }

  function getOceanReferenceTemplateOverride(q, r) {
    if (state.mapPreset !== 'ocean-missing-11') return '';
    return OCEAN_REFERENCE_TEMPLATE_OVERRIDES.get(getOceanReferenceNumber(q, r)) || '';
  }

  function isOceanCoreCoord(q, r) {
    if (state.mapPreset === 'ocean-missing-11') return isOceanReferenceFullCoord(q, r);
    return getOceanCoreSet().has(getTileId(q, r));
  }

  function getAdjacentOceanSides(q, r) {
    const sides = new Set();
    for (const [offsetKey, side] of Object.entries(OCEAN_SHORE_EDGE_BY_CORE_OFFSET)) {
      const [dq, dr] = offsetKey.split(',').map(Number);
      if (!isOceanCoreCoord(q + dq, r + dr)) continue;
      sides.add(side);
    }
    return TILE_SIDE_ORDER.filter((side) => sides.has(side));
  }

  function getAdjacentOceanCorners(q, r) {
    const corners = [];
    for (const [offsetKey, corner] of Object.entries(OCEAN_CORNER_BY_CORE_OFFSET)) {
      const [dq, dr] = offsetKey.split(',').map(Number);
      if (isOceanCoreCoord(q + dq, r + dr)) corners.push(corner);
    }
    return corners;
  }

  function isOceanShoreCornerCoord(q, r) {
    if (state.mapPreset !== 'micro' || isOceanCoreCoord(q, r)) return false;
    return getAdjacentOceanCorners(q, r).length > 0;
  }

  function getOceanShoreEdgeTemplateKeys(sides) {
    const key = TILE_SIDE_ORDER.filter((side) => sides.includes(side)).join('-');
    if (!key) return [];
    if (OCEAN_SHORE_EDGE_ASSETS[key]) return [key];
    return TILE_SIDE_ORDER.filter((side) => sides.includes(side) && OCEAN_SHORE_EDGE_ASSETS[side]);
  }

  function getOceanShoreEdgeOrRiverMouthTemplateKeys(q, r, sides) {
    const blocksRiverMouth = isOceanShoreCornerCoord(q, r);
    return getOceanShoreEdgeTemplateKeys(sides).flatMap((key) => {
      const mouthKey = !blocksRiverMouth && sides.length === 1 ? getRiverMouthTemplateKey(q, r, key) : '';
      return mouthKey && OCEAN_RIVER_MOUTH_ASSETS[mouthKey] ? [mouthKey] : [key];
    });
  }

  function chooseOceanTemplates(q, r) {
    const referenceOverride = getOceanReferenceTemplateOverride(q, r);
    if (referenceOverride) return [referenceOverride];
    if (isOceanCoreCoord(q, r)) return ['full'];
    const templates = [];
    const adjacentOceanSides = getAdjacentOceanSides(q, r);
    templates.push(...getOceanShoreEdgeOrRiverMouthTemplateKeys(q, r, adjacentOceanSides));
    for (const corner of getAdjacentOceanCorners(q, r)) {
      if (OCEAN_SHORE_CORNER_ASSETS[corner]) templates.push(corner);
    }
    return templates;
  }

  function chooseOceanTemplate(q, r) {
    return chooseOceanTemplates(q, r)[0] || '';
  }

  function isShoreOnlyTemplateList(templates) {
    // Mirrors the backend reclassification rule: tiles whose shoreline templates are all
    // pure edges/corners become passable 'shore'; any 'full' or 'river-mouth-*' stays 'ocean'.
    return templates.length > 0
      && templates.every((key) => key !== 'full' && !key.startsWith('river-mouth-'));
  }

  function chooseOceanTerrain(q, r) {
    const templates = chooseOceanTemplates(q, r);
    if (!templates.length) return 'plains';
    return isShoreOnlyTemplateList(templates) ? 'shore' : 'ocean';
  }

  function buildOverlayCalibrationTiles() {
    riverConnections = new Map();
    tiles = OVERLAY_CALIBRATION_TILES.map((item) => {
      const s = -item.q - item.r;
      return {
        id: getTileId(item.q, item.r),
        q: item.q,
        r: item.r,
        s,
        ring: Math.max(Math.abs(item.q), Math.abs(item.r), Math.abs(s)),
        terrain: item.terrain,
        oceanTemplate: '',
        oceanTemplates: [],
        site: item.site || null,
        overlayCalibrationTarget: item.target,
        riverConnections: [],
      };
    });
    waterLayerDirty = true;
    loadAssets();
    markDirty();
  }

  function buildTiles() {
    if (state.mapPreset === 'overlay-calibration') {
      buildOverlayCalibrationTiles();
      return;
    }
    const nextTiles = [];
    const radius = state.radius;
    riverConnections = createRiverConnections(radius);
    const minQ = state.mapPreset === 'ocean-missing-11' ? 0 : -radius;
    const maxQ = state.mapPreset === 'ocean-missing-11' ? OCEAN_REFERENCE_GRID_SIZE - 1 : radius;
    for (let q = minQ; q <= maxQ; q += 1) {
      const minR = state.mapPreset === 'ocean-missing-11' ? 0 : Math.max(-radius, -q - radius);
      const maxR = state.mapPreset === 'ocean-missing-11' ? OCEAN_REFERENCE_GRID_SIZE - 1 : Math.min(radius, -q + radius);
      for (let r = minR; r <= maxR; r += 1) {
        const s = -q - r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        const terrain = state.mapPreset === 'ocean-missing-11'
          ? chooseOceanTerrain(q, r)
          : state.mapPreset === 'ocean-combos'
          ? chooseOceanTerrain(q, r)
          : state.mapPreset === 'ocean9'
            ? chooseOceanTerrain(q, r)
          : state.mapPreset === 'micro'
            ? (chooseOceanTemplate(q, r) ? chooseOceanTerrain(q, r) : chooseMicroTerrain(q, r))
            : chooseTerrain(q, r);
        const oceanTemplates = terrain === 'ocean' || terrain === 'shore' ? chooseOceanTemplates(q, r) : [];
        const oceanTemplate = oceanTemplates[0] || '';
        const isOceanLabPreset = state.mapPreset === 'ocean9' || state.mapPreset === 'ocean-combos' || state.mapPreset === 'ocean-missing-11';
        const site = isOceanLabPreset || terrain === 'ocean' || terrain === 'shore' ? null : chooseSite(q, r, terrain, ring);
        nextTiles.push({
          id: getTileId(q, r),
          q,
          r,
          s,
          ring,
          terrain,
          oceanTemplate,
          oceanTemplates,
          site,
        });
      }
    }
    nextTiles.forEach((tile) => {
      tile.riverConnections = getRiverConnections(tile);
    });
    tiles = nextTiles;
    waterLayerDirty = true;
    loadAssets();
    markDirty();
  }

  function getTilePosition(tile) {
    if (state.layoutMode === 'stagger') {
      return {
        x: tile.q * state.stepX + tile.r * state.stepX * 0.5,
        y: tile.r * state.stepY,
      };
    }
    if (state.mapPreset === 'ocean-missing-11') {
      const center = (OCEAN_REFERENCE_GRID_SIZE - 1) * 0.5;
      return {
        x: (tile.q - tile.r) * state.stepX,
        y: ((tile.q + tile.r) - center * 2) * state.stepY,
      };
    }
    return {
      x: (tile.q - tile.r) * state.stepX,
      y: (tile.q + tile.r) * state.stepY,
    };
  }

  function getCanvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function getProjectedPosition(tile) {
    const pos = getTilePosition(tile);
    return {
      x: canvas.clientWidth * 0.5 + state.panX + pos.x * state.zoom,
      y: canvas.clientHeight * 0.5 + state.panY + pos.y * state.zoom,
    };
  }

  function getOverlayOffset(targetKey) {
    if (!state.overlayOffsets[targetKey]) state.overlayOffsets[targetKey] = { x: 0, y: 0 };
    return state.overlayOffsets[targetKey];
  }

  function getOverlayAnchor(tile, targetKey) {
    const projected = getProjectedPosition(tile);
    const offset = getOverlayOffset(targetKey);
    return {
      x: projected.x + offset.x * state.zoom,
      y: projected.y + offset.y * state.zoom,
    };
  }

  function isOverlayCalibrationPreset() {
    return state.mapPreset === 'overlay-calibration';
  }

  function findNearestTile(point) {
    let best = null;
    let bestDistance = Infinity;
    for (const tile of tiles) {
      const projected = getProjectedPosition(tile);
      const dx = point.x - projected.x;
      const dy = point.y - projected.y;
      const distance = dx * dx + dy * dy * 2.2;
      if (distance < bestDistance) {
        best = tile;
        bestDistance = distance;
      }
    }
    const tileSize = getTileDrawSize();
    const limit = Math.pow(Math.max(tileSize.width, tileSize.height) * state.zoom * 0.36, 2);
    return bestDistance <= limit ? best : null;
  }

  function getFallbackMetrics(image) {
    const width = image?.naturalWidth || image?.width || 1;
    const height = image?.naturalHeight || image?.height || 1;
    return {
      x: 0,
      y: 0,
      width,
      height,
      sourceWidth: width,
      sourceHeight: height,
    };
  }

  function isOpaquePixel(data, index) {
    return data[index + 3] > 8;
  }

  function isTemplateWaterPixel(data, index) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    if (alpha <= 56 || blue <= 70) return false;
    return blue > red + 12 && blue > green - 3 && (green > red + 18 || blue > 112);
  }

  function isWaterTemplateFile(file) {
    return file.includes('river-template/')
      || file.includes('ocean-template/')
      || file.includes('transition-template/');
  }

  function measurePixelBounds(data, width, height, predicate) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        if (!predicate(data, index)) continue;
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      count,
      sourceWidth: width,
      sourceHeight: height,
    };
  }

  function analyzeAlphaBounds(image) {
    const fallback = getFallbackMetrics(image);
    if (!fallback.width || !fallback.height) return fallback;
    const probe = document.createElement('canvas');
    probe.width = fallback.width;
    probe.height = fallback.height;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) return fallback;
    try {
      probeCtx.clearRect(0, 0, probe.width, probe.height);
      probeCtx.drawImage(image, 0, 0);
      const data = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
      const alphaBounds = measurePixelBounds(data, probe.width, probe.height, isOpaquePixel);
      return alphaBounds || fallback;
    } catch (_) {
      return fallback;
    }
  }

  function createColorWaterMaskCanvas(image) {
    const fallback = getFallbackMetrics(image);
    const mask = document.createElement('canvas');
    mask.width = fallback.sourceWidth || fallback.width;
    mask.height = fallback.sourceHeight || fallback.height;
    const maskCtx = mask.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return { canvas: mask, metrics: null };
    const probe = document.createElement('canvas');
    probe.width = mask.width;
    probe.height = mask.height;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) return { canvas: mask, metrics: null };
    try {
      probeCtx.drawImage(image, 0, 0);
      const source = probeCtx.getImageData(0, 0, probe.width, probe.height);
      const output = maskCtx.createImageData(probe.width, probe.height);
      for (let index = 0; index < source.data.length; index += 4) {
        if (!isTemplateWaterPixel(source.data, index)) continue;
        output.data[index] = 255;
        output.data[index + 1] = 255;
        output.data[index + 2] = 255;
        output.data[index + 3] = Math.min(255, Math.round(source.data[index + 3] * 1.18));
      }
      maskCtx.putImageData(output, 0, 0);
      return {
        canvas: mask,
        metrics: measurePixelBounds(output.data, probe.width, probe.height, isOpaquePixel),
      };
    } catch (_) {
      return { canvas: mask, metrics: null };
    }
  }

  function isInsideTemplateDiamond(x, y, metrics) {
    const centerX = metrics.x + metrics.width * 0.5;
    const centerY = metrics.y + metrics.height * 0.5;
    const halfW = metrics.width * 0.5;
    const halfH = metrics.height * 0.5;
    return Math.abs(x - centerX) / Math.max(1, halfW) + Math.abs(y - centerY) / Math.max(1, halfH) <= 1.03;
  }

  function createTransparentRiverWaterMask(image) {
    const fallback = getFallbackMetrics(image);
    const mask = document.createElement('canvas');
    mask.width = fallback.sourceWidth || fallback.width;
    mask.height = fallback.sourceHeight || fallback.height;
    const maskCtx = mask.getContext('2d', { willReadFrequently: true });
    if (!maskCtx) return { canvas: mask, metrics: null };
    const probe = document.createElement('canvas');
    probe.width = mask.width;
    probe.height = mask.height;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) return { canvas: mask, metrics: null };
    try {
      probeCtx.drawImage(image, 0, 0);
      const source = probeCtx.getImageData(0, 0, probe.width, probe.height);
      const terrainImage = images.get(TERRAIN_ASSETS.plains.file);
      let terrainData = null;
      if (terrainImage?.complete && terrainImage.naturalWidth === probe.width && terrainImage.naturalHeight === probe.height) {
        probeCtx.clearRect(0, 0, probe.width, probe.height);
        probeCtx.drawImage(terrainImage, 0, 0);
        terrainData = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
      }
      const terrainBounds = measurePixelBounds(source.data, probe.width, probe.height, isOpaquePixel) || fallback;
      const output = maskCtx.createImageData(probe.width, probe.height);
      for (let y = 0; y < probe.height; y += 1) {
        for (let x = 0; x < probe.width; x += 1) {
          const index = (y * probe.width + x) * 4;
          const insideTerrain = terrainData ? terrainData[index + 3] > 32 : isInsideTemplateDiamond(x, y, terrainBounds);
          if (source.data[index + 3] > 8 || !insideTerrain) continue;
          output.data[index] = 255;
          output.data[index + 1] = 255;
          output.data[index + 2] = 255;
          output.data[index + 3] = 255;
        }
      }
      maskCtx.putImageData(output, 0, 0);
      return {
        canvas: mask,
        metrics: measurePixelBounds(output.data, probe.width, probe.height, isOpaquePixel),
      };
    } catch (_) {
      return { canvas: mask, metrics: null };
    }
  }

  function createWaterMaskCanvas(image, file) {
    if (file.includes('river-template/tile-river-bank-uv-') || file.includes('ocean-template/tile-ocean-')) {
      return createTransparentRiverWaterMask(image);
    }
    return createColorWaterMaskCanvas(image);
  }

  function getWaterMaskFile(file, kind) {
    return file;
  }

  function createDryTemplateCanvas(image, mask) {
    const fallback = getFallbackMetrics(image);
    const canvasElement = document.createElement('canvas');
    canvasElement.width = fallback.sourceWidth || fallback.width;
    canvasElement.height = fallback.sourceHeight || fallback.height;
    const dryCtx = canvasElement.getContext('2d');
    if (!dryCtx) return canvasElement;
    try {
      dryCtx.drawImage(image, 0, 0);
      dryCtx.globalCompositeOperation = 'destination-out';
      dryCtx.drawImage(mask, 0, 0);
      dryCtx.globalCompositeOperation = 'source-over';
      return canvasElement;
    } catch (_) {
      return canvasElement;
    }
  }

  function getImageMetrics(file) {
    const image = images.get(file);
    return imageMetrics.get(file) || getFallbackMetrics(image);
  }

  function getTemplateDrawMetrics(templateAsset) {
    if (templateAsset?.file?.includes('ocean-template/')) return getTerrainMetrics('plains');
    if (templateAsset?.file?.includes('transition-template/')) return getTerrainMetrics('plains');
    return getImageMetrics(templateAsset.file);
  }

  function getTerrainMetrics(type = 'plains') {
    const terrain = TERRAIN_ASSETS[type] || TERRAIN_ASSETS.plains;
    return getImageMetrics(terrain.file);
  }

  function getTileDrawSize(type = 'plains') {
    const metrics = getTerrainMetrics('plains');
    return {
      width: state.tileSize,
      height: state.tileSize * STANDARD_ISO_ASPECT,
      metrics,
    };
  }

  function getBaseTerrainFile(tile) {
    if (tile.terrain === 'ocean' || tile.terrain === 'shore') return TERRAIN_ASSETS.plains.file;
    if (tile.terrain === 'desert') {
      return TERRAIN_ASSETS[tile.terrain]?.file || TERRAIN_ASSETS.plains.file;
    }
    return TERRAIN_ASSETS.plains.file;
  }

  function syncGridToEffectiveTile() {
    const tileSize = getTileDrawSize('plains');
    state.stepX = Math.max(1, Math.round(tileSize.width * 0.5));
    state.stepY = Math.max(1, Math.round(tileSize.height * 0.5));
    state.anchorY = 0.5;
  }

  function getTileDrawRect(projected, tileSize) {
    const drawW = (tileSize.width + TILE_EDGE_OVERDRAW * 2) * state.zoom;
    const drawH = (tileSize.height + TILE_EDGE_OVERDRAW) * state.zoom;
    return {
      width: drawW,
      height: drawH,
      x: projected.x - drawW * 0.5,
      y: projected.y - drawH * state.anchorY,
    };
  }

  function loadImage(file) {
    const cachedImage = images.get(file);
    if (cachedImage?.complete && cachedImage.naturalWidth > 0) return Promise.resolve({ file, image: cachedImage, ok: true });
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        imageMetrics.set(file, analyzeAlphaBounds(image));
        resolve({ file, image, ok: true });
      };
      image.onerror = () => resolve({ file, image, ok: false });
      image.src = `${ASSET_ROOT}${file}`;
      images.set(file, image);
    });
  }

  function collectRequiredAssetFiles() {
    const files = new Set([
      ...Object.values(TERRAIN_ASSETS).map((item) => item.file),
      ...Object.values(SITE_ASSETS).map((item) => item.file),
      ...Object.values(FEATURE_ASSETS).map((item) => item.file),
      ...Object.values(WATER_TEXTURE_ASSETS).map((item) => item.file),
    ]);
    if (state.mapPreset === 'ocean-missing-11') {
      Object.values(OCEAN_TEMPLATE_ASSETS).forEach((item) => files.add(item.file));
    }
    for (const tile of tiles) {
      const templateAssets = getTileTemplateAssets(tile);
      if (templateAssets.length) {
        templateAssets.forEach((templateAsset) => {
          files.add(templateAsset.file);
          if (isOceanRiverMouthAsset(templateAsset)) {
            const shoreEdgeAsset = getRiverMouthShoreEdgeAsset(templateAsset);
            const riverAsset = getRiverMouthRiverTemplateAsset(templateAsset);
            if (shoreEdgeAsset) files.add(shoreEdgeAsset.file);
            if (riverAsset) files.add(riverAsset.file);
          }
        });
      } else {
        files.add(getBaseTerrainFile(tile));
      }
      if (tile.site) files.add(SITE_ASSETS[tile.site.type]?.file);
    }
    return Array.from(files).filter(Boolean);
  }

  function rebuildWaterTemplateCaches(files) {
    waterMasks.clear();
    waterMaskMetrics.clear();
    dryTemplateCanvases.clear();
    for (const file of files) {
      if (!isWaterTemplateFile(file)) continue;
      const image = images.get(file);
      if (!image?.complete) continue;
      const mask = createWaterMaskCanvas(image, file);
      waterMasks.set(file, mask.canvas);
      if (mask.metrics) waterMaskMetrics.set(file, mask.metrics);
      dryTemplateCanvases.set(file, createDryTemplateCanvas(image, mask.canvas));
    }
  }

  async function loadAssets() {
    const requestId = ++assetLoadRequestId;
    const files = collectRequiredAssetFiles();
    const results = await Promise.all(files.map(loadImage));
    if (requestId !== assetLoadRequestId) return;
    rebuildWaterTemplateCaches(files);
    const failed = results.filter((item) => !item.ok).map((item) => item.file);
    if (failed.length) hoverInfo.textContent = `资源加载失败：${failed.join(', ')}`;
    if (!effectiveGridSynced) {
      effectiveGridSynced = true;
      syncGridToEffectiveTile();
      syncControls();
      fitMap();
    }
    updateExport();
    waterLayerDirty = true;
    markDirty();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      waterLayerDirty = true;
      markDirty();
    }
  }

  function drawBackground(width, height, targetCtx = ctx) {
    targetCtx.fillStyle = '#0c1011';
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.fillStyle = 'rgba(255, 236, 196, 0.035)';
    for (let y = -120 + (state.panY % 120); y < height + 120; y += 120) targetCtx.fillRect(0, y, width, 1);
    for (let x = -160 + (state.panX % 160); x < width + 160; x += 160) targetCtx.fillRect(x, 0, 1, height);
  }

  function drawFog(width, height, targetCtx = ctx) {
    const radius = Math.max(width, height) * 0.52;
    const centerX = width * 0.5 + state.panX * 0.08;
    const centerY = height * 0.52 + state.panY * 0.08;
    const gradient = targetCtx.createRadialGradient(centerX, centerY, radius * 0.48, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(8, 11, 12, 0)');
    gradient.addColorStop(1, 'rgba(8, 11, 12, 0.72)');
    targetCtx.fillStyle = gradient;
    targetCtx.fillRect(0, 0, width, height);
  }

  function drawDebugDiamond(x, y, width, height, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - height * 0.5);
    ctx.lineTo(x + width * 0.5, y);
    ctx.lineTo(x, y + height * 0.5);
    ctx.lineTo(x - width * 0.5, y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function positiveModulo(value, size) {
    return ((value % size) + size) % size;
  }

  function getWaterKind(tile) {
    if (isOceanTile(tile)) return 'ocean';
    if (isRiverTile(tile.q, tile.r)) return 'river';
    return '';
  }

  function getWaterSeconds() {
    return Math.max(0, (performance.now() - animationStartMs) / 1000);
  }

  function getWaterAnimationFrame() {
    if (!state.animateWater) return 0;
    return Math.floor(getWaterSeconds() * WATER_ANIMATION_FPS);
  }

  function fillLoopWaterTexture(targetCtx, tile, kind, width, height) {
    const profile = WATER_TEXTURE_ASSETS[kind];
    if (!profile || !targetCtx) return false;
    const texture = images.get(profile.file);
    if (!texture || !texture.complete) return false;
    const tileSize = getTileDrawSize('plains');
    const position = getTilePosition(tile);
    const worldLeft = position.x - tileSize.width * 0.5;
    const worldTop = position.y - tileSize.height * state.anchorY;
    const seconds = state.animateWater ? getWaterSeconds() : 0;
    const periodW = Math.max(1, texture.naturalWidth * profile.uvScale * state.zoom);
    const periodH = Math.max(1, texture.naturalHeight * profile.uvScale * state.zoom);
    const phaseX = seconds * profile.speedX * state.zoom;
    const phaseY = seconds * profile.speedY * state.zoom;
    const startX = -positiveModulo(worldLeft * state.zoom + phaseX, periodW);
    const startY = -positiveModulo(worldTop * state.zoom + phaseY, periodH);
    for (let y = startY; y < height; y += periodH) {
      for (let x = startX; x < width; x += periodW) {
        targetCtx.drawImage(texture, x, y, periodW + 0.5, periodH + 0.5);
      }
    }
    return true;
  }

  function drawWaterToLayer(tile, templateAsset, metrics, drawX, drawY, drawW, drawH) {
    const kind = getWaterKind(tile);
    if (!kind || !templateAsset || !waterCompositeCtx) return;
    drawWaterToLayerWithKind(tile, templateAsset, metrics, drawX, drawY, drawW, drawH, kind);
  }

  function drawWaterToLayerWithKind(tile, templateAsset, metrics, drawX, drawY, drawW, drawH, kind, targetCtx = waterLayerCtx) {
    const mask = waterMasks.get(getWaterMaskFile(templateAsset.file, kind));
    const profile = WATER_TEXTURE_ASSETS[kind];
    if (!mask || !profile || !targetCtx) return;
    const localW = Math.max(1, Math.ceil(drawW));
    const localH = Math.max(1, Math.ceil(drawH));
    if (waterCompositeCanvas.width !== localW) waterCompositeCanvas.width = localW;
    if (waterCompositeCanvas.height !== localH) waterCompositeCanvas.height = localH;
    waterCompositeCtx.setTransform(1, 0, 0, 1, 0, 0);
    waterCompositeCtx.globalAlpha = 1;
    waterCompositeCtx.globalCompositeOperation = 'source-over';
    waterCompositeCtx.clearRect(0, 0, localW, localH);
    if (!fillLoopWaterTexture(waterCompositeCtx, tile, kind, localW, localH)) return;
    waterCompositeCtx.globalCompositeOperation = 'destination-in';
    waterCompositeCtx.drawImage(
      mask,
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      0,
      0,
      localW,
      localH
    );
    waterCompositeCtx.globalCompositeOperation = 'source-over';
    targetCtx.save();
    targetCtx.globalAlpha = profile.alpha;
    targetCtx.drawImage(waterCompositeCanvas, drawX, drawY, drawW, drawH);
    targetCtx.restore();
  }

  function getTemplateBaseSource(templateAssets) {
    if (!templateAssets.length) return null;
    const baseAsset = templateAssets.find(isOceanRiverMouthAsset)
      || templateAssets.find((asset) => asset.file !== OCEAN_WATER_TEMPLATE_ASSETS.full.file)
      || templateAssets[0];
    const sourceImage = dryTemplateCanvases.get(baseAsset.file) || images.get(baseAsset.file);
    return sourceImage ? { asset: baseAsset, image: sourceImage } : null;
  }

  function isDrawableImage(image) {
    return !!image && image.complete !== false;
  }

  function drawTemplateSource(targetCtx, sourceImage, metrics, drawRect) {
    targetCtx.drawImage(
      sourceImage,
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      drawRect.x,
      drawRect.y,
      drawRect.width,
      drawRect.height
    );
  }

  function drawTemplateComposite(targetCtx, templateAssets, metrics, drawRect) {
    const baseSource = getTemplateBaseSource(templateAssets);
    if (!baseSource || !isDrawableImage(baseSource.image)) return false;
    if (templateAssets.length === 1) {
      drawTemplateSource(targetCtx, baseSource.image, metrics, drawRect);
      return true;
    }
    const sourceWidth = metrics.sourceWidth || baseSource.image.naturalWidth || baseSource.image.width || 1;
    const sourceHeight = metrics.sourceHeight || baseSource.image.naturalHeight || baseSource.image.height || 1;
    if (!dryCompositeCtx) return false;
    if (dryCompositeCanvas.width !== sourceWidth) dryCompositeCanvas.width = sourceWidth;
    if (dryCompositeCanvas.height !== sourceHeight) dryCompositeCanvas.height = sourceHeight;
    dryCompositeCtx.setTransform(1, 0, 0, 1, 0, 0);
    dryCompositeCtx.globalAlpha = 1;
    dryCompositeCtx.globalCompositeOperation = 'source-over';
    dryCompositeCtx.clearRect(0, 0, sourceWidth, sourceHeight);
    dryCompositeCtx.drawImage(baseSource.image, 0, 0);
    dryCompositeCtx.globalCompositeOperation = 'destination-out';
    for (const templateAsset of templateAssets) {
      const mask = waterMasks.get(templateAsset.file);
      if (mask) dryCompositeCtx.drawImage(mask, 0, 0);
    }
    dryCompositeCtx.globalCompositeOperation = 'source-over';
    drawTemplateSource(targetCtx, dryCompositeCanvas, metrics, drawRect);
    return true;
  }

  function isOceanRiverMouthAsset(templateAsset) {
    return !!templateAsset?.file?.includes('tile-ocean-river-mouth-');
  }

  function ensureWaterLayer(sortedTiles) {
    if (!waterLayerCtx) return;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const waterFrame = getWaterAnimationFrame();
    const sizeChanged = waterLayerCanvas.width !== width || waterLayerCanvas.height !== height;
    if (!waterLayerDirty && !sizeChanged && lastWaterFrame === waterFrame) return;
    if (sizeChanged) {
      waterLayerCanvas.width = width;
      waterLayerCanvas.height = height;
    }
    waterLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
    waterLayerCtx.clearRect(0, 0, width, height);
    for (const tile of sortedTiles) {
      const templateAssets = getTileTemplateAssets(tile);
      const projected = getProjectedPosition(tile);
      const tileSize = getTileDrawSize('plains');
      const drawRect = getTileDrawRect(projected, tileSize);
      if (templateAssets.length && getWaterKind(tile)) {
        for (const templateAsset of templateAssets) {
          const metrics = getTemplateDrawMetrics(templateAsset);
          if (isOceanRiverMouthAsset(templateAsset)) {
            const shoreEdgeAsset = getRiverMouthShoreEdgeAsset(templateAsset);
            const riverAsset = getRiverMouthRiverTemplateAsset(templateAsset);
            if (shoreEdgeAsset) {
              drawWaterToLayerWithKind(tile, shoreEdgeAsset, metrics, drawRect.x, drawRect.y, drawRect.width, drawRect.height, 'ocean');
            }
            if (riverAsset) {
              drawWaterToLayerWithKind(tile, riverAsset, metrics, drawRect.x, drawRect.y, drawRect.width, drawRect.height, 'river');
            }
          } else {
            drawWaterToLayer(tile, templateAsset, metrics, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
          }
        }
      }
    }
    waterLayerDirty = false;
    lastWaterFrame = waterFrame;
  }

  function ensureStaticBaseLayer(sortedTiles) {
    if (!staticBaseCtx) return;
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const sizeChanged = staticBaseCanvas.width !== width || staticBaseCanvas.height !== height;
    if (!staticBaseDirty && !sizeChanged) return;
    if (sizeChanged) {
      staticBaseCanvas.width = width;
      staticBaseCanvas.height = height;
    }
    staticBaseCtx.setTransform(1, 0, 0, 1, 0, 0);
    staticBaseCtx.clearRect(0, 0, width, height);
    drawBackground(width, height, staticBaseCtx);
    for (const tile of sortedTiles) drawTile(staticBaseCtx, tile);
    for (const tile of sortedTiles) drawTerrainFeature(staticBaseCtx, tile);
    for (const tile of sortedTiles) drawSite(tile, staticBaseCtx);
    staticBaseDirty = false;
  }

  function drawTile(targetCtx, tile) {
    const templateAssets = getTileTemplateAssets(tile);
    const templateAsset = templateAssets[0] || null;
    const baseFile = templateAsset?.file || getBaseTerrainFile(tile);
    const baseImage = images.get(baseFile);
    if (!baseImage || !baseImage.complete) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize('plains');
    const metrics = templateAsset ? getTemplateDrawMetrics(templateAsset) : tileSize.metrics;
    const drawRect = getTileDrawRect(projected, tileSize);
    if (templateAssets.length) {
      drawTemplateComposite(targetCtx, templateAssets, metrics, drawRect);
    } else {
      drawTemplateSource(targetCtx, baseImage, metrics, drawRect);
    }
    if (state.hoverTileId === tile.id) {
      drawDebugDiamond(projected.x, projected.y, tileSize.width * state.zoom * 1.02, tileSize.height * state.zoom * 1.02, 'rgba(255, 226, 146, 0.72)');
    } else if (state.showDebug) {
      drawDebugDiamond(projected.x, projected.y, tileSize.width * state.zoom, tileSize.height * state.zoom, 'rgba(160, 212, 255, 0.26)');
    }

    if (state.showDebug) {
      ctx.fillStyle = tile.site ? 'rgba(255, 216, 126, 0.9)' : 'rgba(178, 220, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.showLabels) {
      ctx.font = '11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 242, 216, 0.78)';
      ctx.fillText(`${tile.q},${tile.r}`, projected.x, projected.y + 4);
    }
  }

  function drawTerrainFeature(targetCtx, tile) {
    if (tile.terrain === 'plains' || tile.terrain === 'capital' || tile.terrain === 'river' || tile.terrain === 'desert' || tile.terrain === 'ocean' || tile.terrain === 'shore') return;
    const isCalibration = isOverlayCalibrationPreset();
    if (!isCalibration && hasRiverNearby(tile.q, tile.r, 1)) return;
    if (tile.terrain === 'forest') {
      drawTreeFeature(targetCtx, tile);
      return;
    }
    if (tile.terrain === 'mountain') {
      drawMountainFeature(targetCtx, tile);
      return;
    }
    const profile = TERRAIN_FEATURES[tile.terrain];
    const terrain = TERRAIN_ASSETS[tile.terrain];
    if (!profile || !terrain) return;
    if (!isCalibration && random01(state.seed, tile.q, tile.r, 'terrain-feature-visible') > profile.chance) return;
    const image = images.get(terrain.file);
    if (!image || !image.complete) return;
    const projected = getOverlayAnchor(tile, `terrain:${tile.terrain}`);
    const tileSize = getTileDrawSize(tile.terrain);
    const size = Math.max(tileSize.width, tileSize.height) * state.zoom;
    const jitterX = isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, 'terrain-feature-x') - 0.5) * state.stepX * state.zoom * 0.34;
    const jitterY = isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, 'terrain-feature-y') - 0.5) * state.stepY * state.zoom * 0.46;
    const drawW = size * profile.scale;
    const drawH = drawW * profile.squash;
    const drawX = projected.x - drawW * 0.5 + jitterX;
    const drawY = projected.y - size * profile.lift - drawH * 0.5 + jitterY;
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceW = Math.floor(sourceSize * 0.36);
    const sourceH = Math.floor(sourceSize * 0.26);
    const sourceX = Math.floor(image.naturalWidth * 0.5 - sourceW * 0.5);
    const sourceY = Math.floor(image.naturalHeight * 0.52 - sourceH * 0.5);
    targetCtx.save();
    targetCtx.globalAlpha = profile.alpha;
    targetCtx.beginPath();
    targetCtx.ellipse(
      projected.x + jitterX,
      projected.y - size * profile.lift + jitterY,
      drawW * 0.48,
      drawH * 0.48,
      isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, 'terrain-feature-rot') - 0.5) * 0.36,
      0,
      Math.PI * 2
    );
    targetCtx.clip();
    targetCtx.drawImage(image, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
    targetCtx.restore();
  }

  function drawTreeFeature(targetCtx, tile) {
    const treeAsset = FEATURE_ASSETS.treeCluster;
    const image = images.get(treeAsset.file);
    if (!image || !image.complete) return;
    const isCalibration = isOverlayCalibrationPreset();
    if (!isCalibration && random01(state.seed, tile.q, tile.r, 'tree-feature-visible') > 0.82) return;
    const projected = getOverlayAnchor(tile, 'feature:treeCluster');
    const tileSize = getTileDrawSize('plains');
    const metrics = getImageMetrics(treeAsset.file);
    const count = isCalibration ? 1 : (random01(state.seed, tile.q, tile.r, 'tree-feature-count') > 0.68 ? 2 : 1);
    for (let i = 0; i < count; i += 1) {
      const jitterX = isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, `tree-feature-x-${i}`) - 0.5) * state.stepX * state.zoom * 0.62;
      const jitterY = isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, `tree-feature-y-${i}`) - 0.5) * state.stepY * state.zoom * 0.42;
      const scale = (isCalibration ? 0.5 : 0.38 + random01(state.seed, tile.q, tile.r, `tree-feature-scale-${i}`) * 0.13) * (count > 1 ? 0.82 : 1);
      const drawW = tileSize.width * scale * state.zoom;
      const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
      const baseX = projected.x + jitterX;
      const baseY = projected.y + state.stepY * state.zoom * 0.1 + jitterY;
      targetCtx.save();
      targetCtx.globalAlpha = 0.3;
      targetCtx.fillStyle = 'rgba(3, 7, 4, 0.58)';
      targetCtx.beginPath();
      targetCtx.ellipse(baseX, baseY + drawH * 0.03, drawW * 0.34, drawH * 0.09, 0, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.restore();
      targetCtx.drawImage(
        image,
        metrics.x,
        metrics.y,
        metrics.width,
        metrics.height,
        baseX - drawW * 0.5,
        baseY - drawH * 0.9,
        drawW,
        drawH
      );
    }
  }

  function drawMountainFeature(targetCtx, tile) {
    const mountainAsset = FEATURE_ASSETS.mountainRidge;
    const image = images.get(mountainAsset.file);
    if (!image || !image.complete) return;
    const isCalibration = isOverlayCalibrationPreset();
    const neighbors = RIVER_DIRECTIONS
      .map((dir) => chooseTerrain(tile.q + dir.dq, tile.r + dir.dr))
      .filter((terrain) => terrain === 'mountain').length;
    const visibleChance = neighbors >= 2 ? 0.98 : 0.78;
    if (!isCalibration && random01(state.seed, tile.q, tile.r, 'mountain-feature-visible') > visibleChance) return;
    const projected = getOverlayAnchor(tile, 'feature:mountainRidge');
    const tileSize = getTileDrawSize('plains');
    const metrics = getImageMetrics(mountainAsset.file);
    const jitterX = isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, 'mountain-feature-x') - 0.5) * state.stepX * state.zoom * 0.28;
    const jitterY = isCalibration ? 0 : (random01(state.seed, tile.q, tile.r, 'mountain-feature-y') - 0.5) * state.stepY * state.zoom * 0.2;
    const scale = isCalibration ? 0.96 : (neighbors >= 2 ? 1.02 : 0.86) + random01(state.seed, tile.q, tile.r, 'mountain-feature-scale') * 0.12;
    const drawW = tileSize.width * scale * state.zoom;
    const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
    const baseX = projected.x + jitterX;
    const baseY = projected.y + state.stepY * state.zoom * 0.18 + jitterY;
    targetCtx.save();
    targetCtx.globalAlpha = 0.34;
    targetCtx.fillStyle = 'rgba(5, 5, 4, 0.62)';
    targetCtx.beginPath();
    targetCtx.ellipse(baseX, baseY + drawH * 0.02, drawW * 0.42, drawH * 0.1, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
    targetCtx.drawImage(
      image,
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      baseX - drawW * 0.5,
      baseY - drawH * 0.82,
      drawW,
      drawH
    );
  }

  function drawRiverLayer(sortedTiles, targetCtx = ctx) {
    if (state.showDebug) {
      for (const tile of sortedTiles) {
        if (!isRiverTile(tile.q, tile.r)) continue;
        drawRiverTemplatePorts(tile, targetCtx);
      }
    }
    if (!state.showDebug && state.mapPreset !== 'ocean-missing-11') return;
    for (const tile of sortedTiles) {
      if (!isOceanTile(tile)) continue;
      drawOceanTemplateKey(tile, targetCtx);
    }
  }

  function drawRiverTemplatePorts(tile, targetCtx = ctx) {
    const projected = getProjectedPosition(tile);
    const label = getRiverTemplateKey(tile);
    targetCtx.save();
    targetCtx.fillStyle = 'rgba(8, 18, 20, 0.7)';
    targetCtx.strokeStyle = 'rgba(255, 240, 160, 0.9)';
    targetCtx.lineWidth = 1;
    targetCtx.font = '10px Consolas, monospace';
    targetCtx.textAlign = 'center';
    targetCtx.fillText(label || 'river?', projected.x, projected.y + state.stepY * state.zoom * 0.62);
    targetCtx.restore();
  }

  function drawOceanTemplateKey(tile, targetCtx = ctx) {
    const projected = getProjectedPosition(tile);
    const keys = getOceanTemplateKeys(tile);
    const key = keys.join('+') || 'none';
    const missingKeys = keys.filter((item) => !isOceanTemplateAvailable(item));
    const missing = missingKeys.length > 0;
    targetCtx.save();
    targetCtx.font = missing || keys.length > 1 ? '700 13px Consolas, monospace' : '700 16px Consolas, monospace';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    targetCtx.fillStyle = missing ? 'rgba(255, 92, 92, 0.95)' : 'rgba(255, 244, 214, 0.96)';
    targetCtx.strokeStyle = 'rgba(4, 7, 8, 0.72)';
    targetCtx.lineWidth = 4;
    const sampleLabel = missing
      ? `MISS:${missingKeys.join('+')}`
      : keys.map((item) => getOceanTemplateSampleId(item)).join('+');
    targetCtx.strokeText(sampleLabel, projected.x, projected.y);
    targetCtx.fillText(sampleLabel, projected.x, projected.y);
    targetCtx.restore();
  }

  function drawOceanTemplateLegend(targetCtx = ctx) {
    if (state.mapPreset !== 'ocean-missing-11') return;
    const usedKeys = OCEAN_TEMPLATE_SAMPLE_KEYS;
    const panelX = Math.max(420, canvas.clientWidth - 410);
    const panelY = 18;
    const sampleW = 72;
    const sampleH = 54;
    const gapX = 14;
    const gapY = 19;
    const cols = 4;
    const rows = Math.ceil(usedKeys.length / cols);
    const panelW = 382;
    const panelH = 46 + rows * (sampleH + gapY);
    targetCtx.save();
    targetCtx.fillStyle = 'rgba(11, 14, 13, 0.78)';
    targetCtx.strokeStyle = 'rgba(255, 228, 164, 0.28)';
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();
    targetCtx.roundRect(panelX, panelY, panelW, panelH, 8);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.fillStyle = 'rgba(255, 238, 196, 0.96)';
    targetCtx.font = '700 14px "Microsoft YaHei", sans-serif';
    targetCtx.textAlign = 'left';
    targetCtx.textBaseline = 'top';
    targetCtx.fillText('海洋地块编号', panelX + 14, panelY + 12);
    usedKeys.forEach((key, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = panelX + 14 + col * (sampleW + gapX);
      const y = panelY + 42 + row * (sampleH + gapY);
      const asset = OCEAN_TEMPLATE_ASSETS[key];
      const baseImage = images.get(asset.file);
      const sourceImage = dryTemplateCanvases.get(asset.file) || baseImage;
      const metrics = getTerrainMetrics('plains');
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.moveTo(x + sampleW * 0.5, y);
      targetCtx.lineTo(x + sampleW, y + sampleH * 0.5);
      targetCtx.lineTo(x + sampleW * 0.5, y + sampleH);
      targetCtx.lineTo(x, y + sampleH * 0.5);
      targetCtx.closePath();
      targetCtx.clip();
      targetCtx.fillStyle = 'rgba(24, 145, 226, 0.92)';
      targetCtx.fillRect(x, y, sampleW, sampleH);
      targetCtx.restore();
      if (sourceImage && baseImage?.complete) {
        targetCtx.drawImage(sourceImage, metrics.x, metrics.y, metrics.width, metrics.height, x, y, sampleW, sampleH);
      }
      targetCtx.fillStyle = 'rgba(255, 244, 214, 0.98)';
      targetCtx.strokeStyle = 'rgba(5, 8, 8, 0.82)';
      targetCtx.lineWidth = 4;
      targetCtx.font = '700 13px Consolas, monospace';
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      const label = getOceanTemplateSampleId(key);
      targetCtx.strokeText(label, x + sampleW * 0.5, y + sampleH * 0.5);
      targetCtx.fillText(label, x + sampleW * 0.5, y + sampleH * 0.5);
      targetCtx.fillStyle = 'rgba(226, 235, 210, 0.92)';
      targetCtx.font = '11px Consolas, monospace';
      targetCtx.textBaseline = 'top';
      targetCtx.strokeStyle = 'rgba(5, 8, 8, 0.74)';
      targetCtx.lineWidth = 3;
      targetCtx.strokeText(key, x + sampleW * 0.5, y + sampleH + 2);
      targetCtx.fillText(key, x + sampleW * 0.5, y + sampleH + 2);
    });
    targetCtx.restore();
  }

  function drawRegionTint(tile, targetCtx = ctx) {
    if (!state.showDebug) return;
    const projected = getProjectedPosition(tile);
    const width = state.stepX * state.zoom * 1.35;
    const height = state.stepY * state.zoom * 1.45;
    const colors = {
      forest: 'rgba(17, 59, 34, 0.24)',
      hills: 'rgba(125, 124, 102, 0.16)',
      waste: 'rgba(145, 99, 45, 0.18)',
      desert: 'rgba(174, 134, 67, 0.2)',
      mountain: 'rgba(100, 109, 110, 0.2)',
    };
    const color = colors[tile.terrain];
    if (!color) return;
    targetCtx.save();
    targetCtx.fillStyle = color;
    targetCtx.beginPath();
    targetCtx.moveTo(projected.x, projected.y - height * 0.5);
    targetCtx.lineTo(projected.x + width * 0.5, projected.y);
    targetCtx.lineTo(projected.x, projected.y + height * 0.5);
    targetCtx.lineTo(projected.x - width * 0.5, projected.y);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.restore();
  }

  function drawSite(tile, targetCtx = ctx) {
    if ((!state.showSites && !isOverlayCalibrationPreset()) || !tile.site) return;
    const siteAsset = SITE_ASSETS[tile.site.type];
    if (!siteAsset) return;
    const image = images.get(siteAsset.file);
    if (!image || !image.complete) return;
    const projected = getOverlayAnchor(tile, `site:${tile.site.type}`);
    const tileSize = getTileDrawSize('plains');
    const metrics = getImageMetrics(siteAsset.file);
    const drawW = tileSize.width * state.siteScale * state.zoom;
    const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
    const lift = tileSize.height * state.zoom * 0.16;
    const baseX = projected.x;
    const baseY = projected.y - lift;
    const drawX = baseX - drawW * 0.5;
    const drawY = baseY - drawH * 0.86;
    targetCtx.save();
    targetCtx.globalAlpha = 0.34;
    targetCtx.fillStyle = 'rgba(4, 6, 5, 0.62)';
    targetCtx.beginPath();
    targetCtx.ellipse(baseX, baseY + drawH * 0.03, drawW * 0.36, drawH * 0.12, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
    targetCtx.drawImage(
      image,
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      drawX,
      drawY,
      drawW,
      drawH
    );
    targetCtx.save();
    targetCtx.globalAlpha = 0.82;
    targetCtx.fillStyle = tile.site.owner === 'player'
      ? '#7fdca0'
      : tile.site.owner === 'neutral'
        ? '#e8edf1'
        : '#f0c45f';
    targetCtx.beginPath();
    targetCtx.arc(drawX + drawW * 0.78, drawY + drawH * 0.78, Math.max(3, drawW * 0.035), 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
  }

  function drawOverlayCalibrationSelection(targetCtx = ctx) {
    if (!isOverlayCalibrationPreset()) return;
    const tile = tiles.find((item) => item.overlayCalibrationTarget === state.selectedOverlayOffsetTarget);
    if (!tile) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize('plains');
    drawDebugDiamond(
      projected.x,
      projected.y,
      tileSize.width * state.zoom * 1.08,
      tileSize.height * state.zoom * 1.08,
      'rgba(255, 226, 126, 0.96)'
    );
  }

  function render() {
    const waterFrame = getWaterAnimationFrame();
    if (!needsRender && (!state.animateWater || lastRenderedWaterFrame === waterFrame)) {
      if (state.animateWater) requestAnimationFrame(render);
      return;
    }
    needsRender = false;
    resizeCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const sorted = tiles.slice().sort((a, b) => {
      const pa = getTilePosition(a);
      const pb = getTilePosition(b);
      return pa.y - pb.y || pa.x - pb.x || a.ring - b.ring;
    });
    ensureStaticBaseLayer(sorted);
    ensureWaterLayer(sorted);
    ctx.clearRect(0, 0, width, height);
    if (staticBaseCtx) ctx.drawImage(staticBaseCanvas, 0, 0);
    if (waterLayerCtx) ctx.drawImage(waterLayerCanvas, 0, 0);
    for (const tile of sorted) drawRegionTint(tile);
    drawOverlayCalibrationSelection(ctx);
    drawRiverLayer(sorted);
    if (state.showFog) drawFog(width, height);
    drawOceanTemplateLegend(ctx);
    updateHud();
    lastRenderedWaterFrame = waterFrame;
    if (state.animateWater) requestAnimationFrame(render);
  }

  function markDirty() {
    needsRender = true;
    staticBaseDirty = true;
    waterLayerDirty = true;
    requestAnimationFrame(render);
  }

  function updateHud() {
    const tile = tiles.find((item) => item.id === state.hoverTileId);
    if (!tile) {
      hoverInfo.innerHTML = `Tile ${tiles.length} 格<br>拖拽平移，滚轮缩放<br>当前用 PNG 美术地块拼接`;
      return;
    }
    const terrain = TERRAIN_ASSETS[tile.terrain]?.label || tile.terrain;
    const site = tile.site ? `${tile.site.label} / ${tile.site.owner}` : '无地点';
    const river = isRiverTile(tile.q, tile.r) ? '<br>河流 穿过附近' : '';
    const transition = getTerrainTransitionTemplateKey(tile) ? `<br>地形过渡 ${getTerrainTransitionTemplateKey(tile)}` : '';
    hoverInfo.innerHTML = `坐标 ${tile.q}, ${tile.r}<br>地形 ${terrain}${river}${transition}<br>地点 ${site}`;
  }

  function getParamsSnapshot() {
    return {
      note: 'tile map art stitching lab v1',
      seed: state.seed,
      mapPreset: state.mapPreset,
      layoutMode: state.layoutMode,
      radius: state.radius,
      tileSize: state.tileSize,
      effectiveTile: {
        width: Math.round(getTileDrawSize('plains').width),
        height: Math.round(getTileDrawSize('plains').height),
        alphaBounds: getTerrainMetrics('plains'),
      },
      effectiveSites: Object.fromEntries(
        Object.entries(SITE_ASSETS).map(([type, asset]) => [type, getImageMetrics(asset.file)])
      ),
      effectiveFeatures: Object.fromEntries(
        Object.entries(FEATURE_ASSETS).map(([type, asset]) => [type, getImageMetrics(asset.file)])
      ),
      effectiveWaterTextures: Object.fromEntries(
        Object.entries(WATER_TEXTURE_ASSETS).map(([type, asset]) => [type, getImageMetrics(asset.file)])
      ),
      effectiveOceanTemplates: Object.fromEntries(
        Object.entries(OCEAN_TEMPLATE_ASSETS).map(([type, asset]) => [type, getImageMetrics(asset.file)])
      ),
      waterMaskTemplates: waterMasks.size,
      effectiveTerrainTransitions: Object.fromEntries(
        Object.entries(TERRAIN_TRANSITION_TEMPLATE_ASSETS).map(([type, asset]) => [type, getImageMetrics(asset.file)])
      ),
      riverTiles: tiles.filter((tile) => isRiverTile(tile.q, tile.r)).length,
      oceanTiles: tiles.filter((tile) => isOceanTile(tile)).length,
      missingOceanTemplates: tiles
        .map((tile) => ({
          tile,
          missingKeys: getOceanTemplateKeys(tile).filter((key) => !isOceanTemplateAvailable(key)),
        }))
        .filter((item) => isOceanTile(item.tile) && item.missingKeys.length)
        .map((item) => ({ id: item.tile.id, q: item.tile.q, r: item.tile.r, keys: item.missingKeys })),
      desertTiles: tiles.filter((tile) => tile.terrain === 'desert').length,
      terrainTransitionTiles: tiles.filter((tile) => getTerrainTransitionTemplateKey(tile)).length,
      stepX: state.stepX,
      stepY: state.stepY,
      anchorY: Number(state.anchorY.toFixed(2)),
      siteScale: Number(state.siteScale.toFixed(2)),
      selectedOverlayOffsetTarget: state.selectedOverlayOffsetTarget,
      overlayOffsets: Object.fromEntries(
        OVERLAY_OFFSET_TARGETS.map((target) => [
          target.key,
          {
            x: Math.round(getOverlayOffset(target.key).x),
            y: Math.round(getOverlayOffset(target.key).y),
          },
        ])
      ),
      animateWater: state.animateWater,
      zoom: Number(state.zoom.toFixed(2)),
      panX: Math.round(state.panX),
      panY: Math.round(state.panY),
    };
  }

  function updateExport() {
    exportData.value = JSON.stringify(getParamsSnapshot(), null, 2);
  }

  function updateValueLabels() {
    document.getElementById('radiusValue').textContent = String(state.radius);
    document.getElementById('tileSizeValue').textContent = `${state.tileSize}`;
    document.getElementById('stepXValue').textContent = `${state.stepX}`;
    document.getElementById('stepYValue').textContent = `${state.stepY}`;
    document.getElementById('anchorYValue').textContent = state.anchorY.toFixed(2);
    document.getElementById('siteScaleValue').textContent = state.siteScale.toFixed(2);
    const overlayOffset = getOverlayOffset(state.selectedOverlayOffsetTarget);
    document.getElementById('overlayOffsetXValue').textContent = `${overlayOffset.x}`;
    document.getElementById('overlayOffsetYValue').textContent = `${overlayOffset.y}`;
    document.getElementById('zoomValue').textContent = state.zoom.toFixed(2);
  }

  function syncControls() {
    controls.seed.value = state.seed;
    controls.mapPreset.value = state.mapPreset;
    controls.layoutMode.value = state.layoutMode;
    controls.radius.value = state.radius;
    controls.tileSize.value = state.tileSize;
    controls.stepX.value = state.stepX;
    controls.stepY.value = state.stepY;
    controls.anchorY.value = Math.round(state.anchorY * 100);
    controls.siteScale.value = Math.round(state.siteScale * 100);
    controls.overlayOffsetTarget.value = state.selectedOverlayOffsetTarget;
    const overlayOffset = getOverlayOffset(state.selectedOverlayOffsetTarget);
    controls.overlayOffsetX.value = overlayOffset.x;
    controls.overlayOffsetY.value = overlayOffset.y;
    controls.zoom.value = Math.round(state.zoom * 100);
    controls.showSites.checked = state.showSites;
    controls.showFog.checked = state.showFog;
    controls.showDebug.checked = state.showDebug;
    controls.showLabels.checked = state.showLabels;
    controls.animateWater.checked = state.animateWater;
    updateValueLabels();
    updateExport();
  }

  function bindRange(id, setter) {
    controls[id] = document.getElementById(id);
    controls[id].addEventListener('input', () => {
      setter(Number(controls[id].value));
      updateValueLabels();
      updateExport();
      markDirty();
    });
  }

  function fitMap() {
    if (state.mapPreset === 'ocean-missing-11') {
      state.panX = -190;
      state.panY = 56;
      state.zoom = 0.72;
      syncControls();
      markDirty();
      return;
    }
    if (state.mapPreset === 'overlay-calibration') {
      state.panX = 0;
      state.panY = 12;
      state.zoom = 0.66;
      syncControls();
      markDirty();
      return;
    }
    state.panX = 0;
    state.panY = 18;
    const mapWidth = Math.max(1, state.radius * state.stepX * 3.25);
    const tileSize = getTileDrawSize();
    const mapHeight = Math.max(1, state.radius * state.stepY * 2.85 + tileSize.height * 0.9);
    const zoomX = canvas.clientWidth / mapWidth;
    const zoomY = canvas.clientHeight / mapHeight;
    state.zoom = Math.min(1.16, Math.max(0.45, Math.min(zoomX, zoomY)));
    syncControls();
    markDirty();
  }

  function bindControls() {
    controls.seed = document.getElementById('seed');
    controls.mapPreset = document.getElementById('mapPreset');
    controls.layoutMode = document.getElementById('layoutMode');
    controls.showSites = document.getElementById('showSites');
    controls.showFog = document.getElementById('showFog');
    controls.showDebug = document.getElementById('showDebug');
    controls.showLabels = document.getElementById('showLabels');
    controls.animateWater = document.getElementById('animateWater');
    controls.overlayOffsetTarget = document.getElementById('overlayOffsetTarget');
    controls.overlayOffsetTarget.innerHTML = OVERLAY_OFFSET_TARGETS
      .map((target) => `<option value="${target.key}">${target.label}</option>`)
      .join('');

    controls.seed.addEventListener('change', () => {
      state.seed = controls.seed.value.trim() || 'scout-tile-v1';
      buildTiles();
      syncControls();
    });
    controls.mapPreset.addEventListener('change', () => {
      state.mapPreset = controls.mapPreset.value;
      buildTiles();
      fitMap();
    });
    controls.layoutMode.addEventListener('change', () => {
      state.layoutMode = controls.layoutMode.value;
      waterLayerDirty = true;
      updateExport();
      markDirty();
    });
    controls.showSites.addEventListener('change', () => { state.showSites = controls.showSites.checked; markDirty(); });
    controls.showFog.addEventListener('change', () => { state.showFog = controls.showFog.checked; markDirty(); });
    controls.showDebug.addEventListener('change', () => { state.showDebug = controls.showDebug.checked; markDirty(); });
    controls.showLabels.addEventListener('change', () => { state.showLabels = controls.showLabels.checked; markDirty(); });
    controls.animateWater.addEventListener('change', () => {
      state.animateWater = controls.animateWater.checked;
      if (state.animateWater) animationStartMs = performance.now();
      markDirty();
    });
    controls.overlayOffsetTarget.addEventListener('change', () => {
      state.selectedOverlayOffsetTarget = controls.overlayOffsetTarget.value;
      syncControls();
      markDirty();
    });

    bindRange('radius', (value) => { state.radius = value; buildTiles(); });
    bindRange('tileSize', (value) => {
      state.tileSize = value;
      syncGridToEffectiveTile();
    });
    bindRange('stepX', (value) => { state.stepX = value; });
    bindRange('stepY', (value) => { state.stepY = value; });
    bindRange('anchorY', (value) => { state.anchorY = value / 100; });
    bindRange('siteScale', (value) => { state.siteScale = value / 100; });
    bindRange('overlayOffsetX', (value) => { getOverlayOffset(state.selectedOverlayOffsetTarget).x = value; });
    bindRange('overlayOffsetY', (value) => { getOverlayOffset(state.selectedOverlayOffsetTarget).y = value; });
    bindRange('zoom', (value) => { state.zoom = value / 100; });

    document.getElementById('resetView').addEventListener('click', () => {
      syncGridToEffectiveTile();
      fitMap();
    });
    document.getElementById('randomSeed').addEventListener('click', () => {
      state.seed = `scout-${Date.now().toString(36).slice(-6)}`;
      buildTiles();
      syncControls();
    });
    document.getElementById('copyParams').addEventListener('click', async () => {
      updateExport();
      exportData.select();
      try {
        await navigator.clipboard.writeText(exportData.value);
      } catch (_) {
        document.execCommand('copy');
      }
    });
    document.getElementById('fitMap').addEventListener('click', fitMap);
  }

  function bindCanvas() {
    canvas.addEventListener('pointerdown', (event) => {
      isDragging = true;
      dragStart = {
        x: event.clientX,
        y: event.clientY,
        panX: state.panX,
        panY: state.panY,
      };
      canvas.classList.add('dragging');
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (isDragging && dragStart) {
        state.panX = dragStart.panX + event.clientX - dragStart.x;
        state.panY = dragStart.panY + event.clientY - dragStart.y;
        updateExport();
      } else {
        const tile = findNearestTile(point);
        state.hoverTileId = tile?.id || '';
      }
      markDirty();
    });
    canvas.addEventListener('pointerup', (event) => {
      isDragging = false;
      dragStart = null;
      canvas.classList.remove('dragging');
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointercancel', () => {
      isDragging = false;
      dragStart = null;
      canvas.classList.remove('dragging');
    });
    canvas.addEventListener('mouseleave', () => {
      if (!isDragging) {
        state.hoverTileId = '';
        markDirty();
      }
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const before = getCanvasPoint(event.clientX, event.clientY);
      const oldZoom = state.zoom;
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      state.zoom = Math.min(1.8, Math.max(0.45, state.zoom * factor));
      const ratio = state.zoom / oldZoom;
      state.panX = before.x - canvas.clientWidth * 0.5 - (before.x - canvas.clientWidth * 0.5 - state.panX) * ratio;
      state.panY = before.y - canvas.clientHeight * 0.5 - (before.y - canvas.clientHeight * 0.5 - state.panY) * ratio;
      syncControls();
      markDirty();
    }, { passive: false });
  }

  function init() {
    bindControls();
    bindCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
      markDirty();
    });
    buildTiles();
    syncControls();
    resizeCanvas();
    window.TileMapLab = {
      state,
      buildTiles,
      getParamsSnapshot,
      analyzeAlphaBounds,
      getRiverConnections,
      getTerrainTransitionTemplateKey,
      getWaterKind,
      hasRiverNearby,
      get tiles() { return tiles; },
      getTerrainMetrics,
      getTileDrawSize,
      chooseOceanTemplates,
      getOceanTemplateKeys,
      terrainAssets: TERRAIN_ASSETS,
      siteAssets: SITE_ASSETS,
      featureAssets: FEATURE_ASSETS,
      waterTextureAssets: WATER_TEXTURE_ASSETS,
      oceanTemplateAssets: OCEAN_TEMPLATE_ASSETS,
      oceanShoreEdgeAssets: OCEAN_SHORE_EDGE_ASSETS,
      oceanShoreCornerAssets: OCEAN_SHORE_CORNER_ASSETS,
      terrainTransitionTemplateAssets: TERRAIN_TRANSITION_TEMPLATE_ASSETS,
    };
  }

  init();
}());

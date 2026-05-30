(function () {
  'use strict';

  const ASSET_ROOT = '../assets/art/';
  const TERRAIN_ASSETS = {
    plains: { label: '平原', file: 'tile-map/tile-terrain-plains.png', weight: 34 },
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
    pond: { label: 'pond', file: 'tile-map/tile-feature-pond.png' },
  };
  const RIVER_TEMPLATE_ASSETS = {
    nw: { label: 'river template ai nw', file: 'tile-map/river-template/tile-river-template-ai-nw.png' },
    ne: { label: 'river template ai ne', file: 'tile-map/river-template/tile-river-template-ai-ne.png' },
    se: { label: 'river template ai se', file: 'tile-map/river-template/tile-river-template-ai-se.png' },
    sw: { label: 'river template ai sw', file: 'tile-map/river-template/tile-river-template-ai-sw.png' },
    'nw-ne': { label: 'river template ai nw-ne', file: 'tile-map/river-template/tile-river-template-ai-nw-ne.png' },
    'nw-se': { label: 'river template ai nw-se', file: 'tile-map/river-template/tile-river-template-ai-nw-se.png' },
    'nw-sw': { label: 'river template ai nw-sw', file: 'tile-map/river-template/tile-river-template-ai-nw-sw.png' },
    'ne-se': { label: 'river template ai ne-se', file: 'tile-map/river-template/tile-river-template-ai-ne-se.png' },
    'ne-sw': { label: 'river template ai ne-sw', file: 'tile-map/river-template/tile-river-template-ai-ne-sw.png' },
    'se-sw': { label: 'river template ai se-sw', file: 'tile-map/river-template/tile-river-template-ai-se-sw.png' },
    'nw-ne-se': { label: 'river template ai nw-ne-se', file: 'tile-map/river-template/tile-river-template-ai-nw-ne-se.png' },
    'nw-ne-sw': { label: 'river template ai nw-ne-sw', file: 'tile-map/river-template/tile-river-template-ai-nw-ne-sw.png' },
    'nw-se-sw': { label: 'river template ai nw-se-sw', file: 'tile-map/river-template/tile-river-template-ai-nw-se-sw.png' },
    'ne-se-sw': { label: 'river template ai ne-se-sw', file: 'tile-map/river-template/tile-river-template-ai-ne-se-sw.png' },
    'nw-ne-se-sw': { label: 'river template ai nw-ne-se-sw', file: 'tile-map/river-template/tile-river-template-ai-nw-ne-se-sw.png' },
  };
  const TERRAIN_TYPES = ['plains', 'forest', 'hills', 'river', 'waste', 'mountain'];
  const TERRAIN_FEATURES = {
    hills: { chance: 0.42, scale: 0.5, alpha: 0.66, lift: 0.08, squash: 0.68 },
    waste: { chance: 0.32, scale: 0.48, alpha: 0.58, lift: 0.06, squash: 0.7 },
  };
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

  const state = {
    seed: 'scout-tile-v1',
    layoutMode: 'iso',
    radius: 5,
    tileSize: 192,
    stepX: 95,
    stepY: 70,
    anchorY: 0.5,
    siteScale: 0.46,
    zoom: 1.05,
    panX: 0,
    panY: 12,
    showSites: true,
    showFog: true,
    showDebug: false,
    showLabels: false,
    hoverTileId: '',
  };

  const canvas = document.getElementById('tileCanvas');
  const ctx = canvas.getContext('2d');
  const hoverInfo = document.getElementById('hoverInfo');
  const exportData = document.getElementById('exportData');
  const images = new Map();
  const imageMetrics = new Map();
  const controls = {};
  let tiles = [];
  let riverConnections = new Map();
  let isDragging = false;
  let dragStart = null;
  let needsRender = true;
  let effectiveGridSynced = false;

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

  function isRiverTile(q, r) {
    return riverConnections.has(getTileId(q, r));
  }

  function getRiverConnections(tile) {
    return riverConnections.get(tile.id) || [];
  }

  function getRiverTemplateKey(tile) {
    const sides = getRiverConnections(tile)
      .map((directionIndex) => RIVER_TEMPLATE_DIRECTION_SIDES[directionIndex])
      .filter(Boolean)
      .sort((a, b) => ['nw', 'ne', 'se', 'sw'].indexOf(a) - ['nw', 'ne', 'se', 'sw'].indexOf(b));
    return sides.join('-');
  }

  function getRiverTemplateAsset(tile) {
    const key = getRiverTemplateKey(tile);
    return RIVER_TEMPLATE_ASSETS[key] || null;
  }

  function hasRiverNearby(q, r, radius = 1) {
    if (isRiverTile(q, r)) return true;
    if (radius <= 0) return false;
    return RIVER_DIRECTIONS.some((dir) => isRiverTile(q + dir.dq, r + dir.dr));
  }

  function isRiverBlockedCoord(q, r) {
    return getHexDistance({ q, r }, { q: 0, r: 0 }) <= 1;
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

  function choosePond(q, r, terrain, ring) {
    if (q === 0 && r === 0) return false;
    if (ring < 2 || hasRiverNearby(q, r, 1)) return false;
    if (terrain === 'mountain' || terrain === 'hills' || terrain === 'waste') return false;
    return random01(state.seed, q, r, 'pond-feature') < 0.035;
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

  function createRiverConnections(radius) {
    const connections = new Map();
    const mainStart = { q: -Math.max(1, Math.floor(radius * 0.42)), r: -radius + Math.max(1, Math.floor(radius * 0.42)) };
    const mainTarget = { q: Math.max(1, Math.floor(radius * 0.42)), r: radius - Math.max(1, Math.floor(radius * 0.42)) };
    const mainPath = buildRiverPath(mainStart, mainTarget, radius, 'river-main');
    const branchStart = mainPath[Math.max(1, Math.floor(mainPath.length * 0.52))] || mainPath[0];
    const branchTarget = { q: radius, r: -Math.max(0, Math.floor(radius * 0.18)) };
    const branchPath = buildRiverPath(branchStart, branchTarget, radius, 'river-branch');
    for (const path of [mainPath, branchPath]) {
      for (let i = 1; i < path.length; i += 1) addRiverConnection(connections, path[i - 1], path[i]);
    }
    return new Map(
      Array.from(connections.entries()).map(([id, dirs]) => [id, Array.from(dirs).sort((a, b) => a - b)])
    );
  }

  function buildTiles() {
    const nextTiles = [];
    const radius = state.radius;
    riverConnections = createRiverConnections(radius);
    for (let q = -radius; q <= radius; q += 1) {
      const minR = Math.max(-radius, -q - radius);
      const maxR = Math.min(radius, -q + radius);
      for (let r = minR; r <= maxR; r += 1) {
        const s = -q - r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        const terrain = chooseTerrain(q, r);
        const pond = choosePond(q, r, terrain, ring);
        const site = pond ? null : chooseSite(q, r, terrain, ring);
        nextTiles.push({
          id: getTileId(q, r),
          q,
          r,
          s,
          ring,
          terrain,
          pond,
          site,
        });
      }
    }
    nextTiles.forEach((tile) => {
      tile.riverConnections = getRiverConnections(tile);
    });
    tiles = nextTiles;
    markDirty();
  }

  function getTilePosition(tile) {
    if (state.layoutMode === 'stagger') {
      return {
        x: tile.q * state.stepX + tile.r * state.stepX * 0.5,
        y: tile.r * state.stepY,
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

  function getImageMetrics(file) {
    const image = images.get(file);
    return imageMetrics.get(file) || getFallbackMetrics(image);
  }

  function getTerrainMetrics(type = 'plains') {
    const terrain = TERRAIN_ASSETS[type] || TERRAIN_ASSETS.plains;
    return getImageMetrics(terrain.file);
  }

  function getTileDrawSize(type = 'plains') {
    const metrics = getTerrainMetrics('plains');
    return {
      width: state.tileSize,
      height: state.tileSize * (metrics.height / Math.max(1, metrics.width)),
      metrics,
    };
  }

  function syncGridToEffectiveTile() {
    const tileSize = getTileDrawSize('plains');
    state.stepX = Math.max(1, Math.round(tileSize.width * 0.5) - 1);
    state.stepY = Math.max(1, Math.round(tileSize.height * 0.5) - 1);
    state.anchorY = 0.5;
  }

  function loadImage(file) {
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

  async function loadAssets() {
    const files = [
      ...Object.values(TERRAIN_ASSETS).map((item) => item.file),
      ...Object.values(SITE_ASSETS).map((item) => item.file),
      ...Object.values(FEATURE_ASSETS).map((item) => item.file),
      ...Object.values(RIVER_TEMPLATE_ASSETS).map((item) => item.file),
    ];
    const results = await Promise.all(files.map(loadImage));
    const failed = results.filter((item) => !item.ok).map((item) => item.file);
    if (failed.length) hoverInfo.textContent = `资源加载失败：${failed.join(', ')}`;
    if (!effectiveGridSynced) {
      effectiveGridSynced = true;
      syncGridToEffectiveTile();
      syncControls();
      fitMap();
    }
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
      markDirty();
    }
  }

  function drawBackground(width, height) {
    ctx.fillStyle = '#0c1011';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 236, 196, 0.035)';
    for (let y = -120 + (state.panY % 120); y < height + 120; y += 120) ctx.fillRect(0, y, width, 1);
    for (let x = -160 + (state.panX % 160); x < width + 160; x += 160) ctx.fillRect(x, 0, 1, height);
  }

  function drawFog(width, height) {
    const radius = Math.max(width, height) * 0.52;
    const centerX = width * 0.5 + state.panX * 0.08;
    const centerY = height * 0.52 + state.panY * 0.08;
    const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.48, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(8, 11, 12, 0)');
    gradient.addColorStop(1, 'rgba(8, 11, 12, 0.72)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
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

  function drawTile(tile) {
    const templateAsset = getRiverTemplateAsset(tile);
    const baseFile = templateAsset?.file || TERRAIN_ASSETS.plains.file;
    const baseImage = images.get(baseFile);
    if (!baseImage || !baseImage.complete) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize('plains');
    const metrics = templateAsset ? getImageMetrics(templateAsset.file) : tileSize.metrics;
    const drawW = tileSize.width * state.zoom;
    const drawH = tileSize.height * state.zoom;
    const drawX = projected.x - drawW * 0.5;
    const drawY = projected.y - drawH * state.anchorY;
    ctx.drawImage(
      baseImage,
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      drawX,
      drawY,
      drawW,
      drawH
    );

    if (state.hoverTileId === tile.id) {
      drawDebugDiamond(projected.x, projected.y, state.stepX * state.zoom * 1.4, state.stepY * state.zoom * 1.5, 'rgba(255, 226, 146, 0.72)');
    } else if (state.showDebug) {
      drawDebugDiamond(projected.x, projected.y, state.stepX * state.zoom * 1.35, state.stepY * state.zoom * 1.45, 'rgba(160, 212, 255, 0.26)');
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

  function drawTerrainFeature(tile) {
    if (tile.terrain === 'plains' || tile.terrain === 'capital' || tile.terrain === 'river') return;
    if (hasRiverNearby(tile.q, tile.r, 1)) return;
    if (tile.terrain === 'forest') {
      drawTreeFeature(tile);
      return;
    }
    if (tile.terrain === 'mountain') {
      drawMountainFeature(tile);
      return;
    }
    const profile = TERRAIN_FEATURES[tile.terrain];
    const terrain = TERRAIN_ASSETS[tile.terrain];
    if (!profile || !terrain) return;
    if (random01(state.seed, tile.q, tile.r, 'terrain-feature-visible') > profile.chance) return;
    const image = images.get(terrain.file);
    if (!image || !image.complete) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize(tile.terrain);
    const size = Math.max(tileSize.width, tileSize.height) * state.zoom;
    const jitterX = (random01(state.seed, tile.q, tile.r, 'terrain-feature-x') - 0.5) * state.stepX * state.zoom * 0.34;
    const jitterY = (random01(state.seed, tile.q, tile.r, 'terrain-feature-y') - 0.5) * state.stepY * state.zoom * 0.46;
    const drawW = size * profile.scale;
    const drawH = drawW * profile.squash;
    const drawX = projected.x - drawW * 0.5 + jitterX;
    const drawY = projected.y - size * profile.lift - drawH * 0.5 + jitterY;
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceW = Math.floor(sourceSize * 0.36);
    const sourceH = Math.floor(sourceSize * 0.26);
    const sourceX = Math.floor(image.naturalWidth * 0.5 - sourceW * 0.5);
    const sourceY = Math.floor(image.naturalHeight * 0.52 - sourceH * 0.5);
    ctx.save();
    ctx.globalAlpha = profile.alpha;
    ctx.beginPath();
    ctx.ellipse(
      projected.x + jitterX,
      projected.y - size * profile.lift + jitterY,
      drawW * 0.48,
      drawH * 0.48,
      (random01(state.seed, tile.q, tile.r, 'terrain-feature-rot') - 0.5) * 0.36,
      0,
      Math.PI * 2
    );
    ctx.clip();
    ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  function drawTreeFeature(tile) {
    const treeAsset = FEATURE_ASSETS.treeCluster;
    const image = images.get(treeAsset.file);
    if (!image || !image.complete) return;
    if (random01(state.seed, tile.q, tile.r, 'tree-feature-visible') > 0.82) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize('plains');
    const metrics = getImageMetrics(treeAsset.file);
    const count = random01(state.seed, tile.q, tile.r, 'tree-feature-count') > 0.68 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const jitterX = (random01(state.seed, tile.q, tile.r, `tree-feature-x-${i}`) - 0.5) * state.stepX * state.zoom * 0.62;
      const jitterY = (random01(state.seed, tile.q, tile.r, `tree-feature-y-${i}`) - 0.5) * state.stepY * state.zoom * 0.42;
      const scale = (0.38 + random01(state.seed, tile.q, tile.r, `tree-feature-scale-${i}`) * 0.13) * (count > 1 ? 0.82 : 1);
      const drawW = tileSize.width * scale * state.zoom;
      const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
      const baseX = projected.x + jitterX;
      const baseY = projected.y + state.stepY * state.zoom * 0.1 + jitterY;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'rgba(3, 7, 4, 0.58)';
      ctx.beginPath();
      ctx.ellipse(baseX, baseY + drawH * 0.03, drawW * 0.34, drawH * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.drawImage(
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

  function drawMountainFeature(tile) {
    const mountainAsset = FEATURE_ASSETS.mountainRidge;
    const image = images.get(mountainAsset.file);
    if (!image || !image.complete) return;
    const neighbors = RIVER_DIRECTIONS
      .map((dir) => chooseTerrain(tile.q + dir.dq, tile.r + dir.dr))
      .filter((terrain) => terrain === 'mountain').length;
    const visibleChance = neighbors >= 2 ? 0.98 : 0.78;
    if (random01(state.seed, tile.q, tile.r, 'mountain-feature-visible') > visibleChance) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize('plains');
    const metrics = getImageMetrics(mountainAsset.file);
    const jitterX = (random01(state.seed, tile.q, tile.r, 'mountain-feature-x') - 0.5) * state.stepX * state.zoom * 0.28;
    const jitterY = (random01(state.seed, tile.q, tile.r, 'mountain-feature-y') - 0.5) * state.stepY * state.zoom * 0.2;
    const scale = (neighbors >= 2 ? 1.02 : 0.86) + random01(state.seed, tile.q, tile.r, 'mountain-feature-scale') * 0.12;
    const drawW = tileSize.width * scale * state.zoom;
    const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
    const baseX = projected.x + jitterX;
    const baseY = projected.y + state.stepY * state.zoom * 0.18 + jitterY;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = 'rgba(5, 5, 4, 0.62)';
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + drawH * 0.02, drawW * 0.42, drawH * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(
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

  function drawRiverLayer(sortedTiles) {
    if (!state.showDebug) return;
    for (const tile of sortedTiles) {
      if (!isRiverTile(tile.q, tile.r)) continue;
      drawRiverTemplatePorts(tile);
    }
  }

  function drawRiverTemplatePorts(tile) {
    const projected = getProjectedPosition(tile);
    const label = getRiverTemplateKey(tile);
    ctx.save();
    ctx.fillStyle = 'rgba(8, 18, 20, 0.7)';
    ctx.strokeStyle = 'rgba(255, 240, 160, 0.9)';
    ctx.lineWidth = 1;
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label || 'river?', projected.x, projected.y + state.stepY * state.zoom * 0.62);
    ctx.restore();
  }

  function drawPond(tile) {
    if (!tile.pond) return;
    const asset = FEATURE_ASSETS.pond;
    const image = images.get(asset.file);
    if (!image || !image.complete) return;
    const projected = getProjectedPosition(tile);
    const metrics = getImageMetrics(asset.file);
    const drawW = state.stepX * state.zoom * 0.76;
    const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
    ctx.save();
    ctx.translate(projected.x, projected.y - state.stepY * state.zoom * 0.02);
    ctx.globalAlpha = 0.88;
    ctx.drawImage(
      image,
      metrics.x,
      metrics.y,
      metrics.width,
      metrics.height,
      -drawW * 0.5,
      -drawH * 0.5,
      drawW,
      drawH
    );
    ctx.restore();
  }

  function drawRegionTint(tile) {
    if (!state.showDebug) return;
    const projected = getProjectedPosition(tile);
    const width = state.stepX * state.zoom * 1.35;
    const height = state.stepY * state.zoom * 1.45;
    const colors = {
      forest: 'rgba(17, 59, 34, 0.24)',
      hills: 'rgba(125, 124, 102, 0.16)',
      waste: 'rgba(145, 99, 45, 0.18)',
      mountain: 'rgba(100, 109, 110, 0.2)',
    };
    const color = colors[tile.terrain];
    if (!color) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(projected.x, projected.y - height * 0.5);
    ctx.lineTo(projected.x + width * 0.5, projected.y);
    ctx.lineTo(projected.x, projected.y + height * 0.5);
    ctx.lineTo(projected.x - width * 0.5, projected.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSite(tile) {
    if (!state.showSites || !tile.site) return;
    const siteAsset = SITE_ASSETS[tile.site.type];
    if (!siteAsset) return;
    const image = images.get(siteAsset.file);
    if (!image || !image.complete) return;
    const projected = getProjectedPosition(tile);
    const tileSize = getTileDrawSize('plains');
    const metrics = getImageMetrics(siteAsset.file);
    const drawW = tileSize.width * state.siteScale * state.zoom;
    const drawH = drawW * (metrics.height / Math.max(1, metrics.width));
    const lift = tileSize.height * state.zoom * 0.16;
    const baseX = projected.x;
    const baseY = projected.y - lift;
    const drawX = baseX - drawW * 0.5;
    const drawY = baseY - drawH * 0.86;
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = 'rgba(4, 6, 5, 0.62)';
    ctx.beginPath();
    ctx.ellipse(baseX, baseY + drawH * 0.03, drawW * 0.36, drawH * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.drawImage(
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
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = tile.site.owner === 'player'
      ? '#7fdca0'
      : tile.site.owner === 'neutral'
        ? '#e8edf1'
        : '#f0c45f';
    ctx.beginPath();
    ctx.arc(drawX + drawW * 0.78, drawY + drawH * 0.78, Math.max(3, drawW * 0.035), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    if (!needsRender) return;
    needsRender = false;
    resizeCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    drawBackground(width, height);

    const sorted = tiles.slice().sort((a, b) => {
      const pa = getTilePosition(a);
      const pb = getTilePosition(b);
      return pa.y - pb.y || pa.x - pb.x || a.ring - b.ring;
    });
    for (const tile of sorted) drawTile(tile);
    for (const tile of sorted) drawPond(tile);
    drawRiverLayer(sorted);
    for (const tile of sorted) drawTerrainFeature(tile);
    for (const tile of sorted) drawRegionTint(tile);
    for (const tile of sorted) drawSite(tile);
    if (state.showFog) drawFog(width, height);
    updateHud();
    requestAnimationFrame(render);
  }

  function markDirty() {
    needsRender = true;
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
    hoverInfo.innerHTML = `坐标 ${tile.q}, ${tile.r}<br>地形 ${terrain}${river}<br>地点 ${site}`;
  }

  function getParamsSnapshot() {
    return {
      note: 'tile map art stitching lab v1',
      seed: state.seed,
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
      riverTiles: tiles.filter((tile) => isRiverTile(tile.q, tile.r)).length,
      pondTiles: tiles.filter((tile) => tile.pond).length,
      stepX: state.stepX,
      stepY: state.stepY,
      anchorY: Number(state.anchorY.toFixed(2)),
      siteScale: Number(state.siteScale.toFixed(2)),
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
    document.getElementById('zoomValue').textContent = state.zoom.toFixed(2);
  }

  function syncControls() {
    controls.seed.value = state.seed;
    controls.layoutMode.value = state.layoutMode;
    controls.radius.value = state.radius;
    controls.tileSize.value = state.tileSize;
    controls.stepX.value = state.stepX;
    controls.stepY.value = state.stepY;
    controls.anchorY.value = Math.round(state.anchorY * 100);
    controls.siteScale.value = Math.round(state.siteScale * 100);
    controls.zoom.value = Math.round(state.zoom * 100);
    controls.showSites.checked = state.showSites;
    controls.showFog.checked = state.showFog;
    controls.showDebug.checked = state.showDebug;
    controls.showLabels.checked = state.showLabels;
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
    controls.layoutMode = document.getElementById('layoutMode');
    controls.showSites = document.getElementById('showSites');
    controls.showFog = document.getElementById('showFog');
    controls.showDebug = document.getElementById('showDebug');
    controls.showLabels = document.getElementById('showLabels');

    controls.seed.addEventListener('change', () => {
      state.seed = controls.seed.value.trim() || 'scout-tile-v1';
      buildTiles();
      syncControls();
    });
    controls.layoutMode.addEventListener('change', () => {
      state.layoutMode = controls.layoutMode.value;
      updateExport();
      markDirty();
    });
    controls.showSites.addEventListener('change', () => { state.showSites = controls.showSites.checked; markDirty(); });
    controls.showFog.addEventListener('change', () => { state.showFog = controls.showFog.checked; markDirty(); });
    controls.showDebug.addEventListener('change', () => { state.showDebug = controls.showDebug.checked; markDirty(); });
    controls.showLabels.addEventListener('change', () => { state.showLabels = controls.showLabels.checked; markDirty(); });

    bindRange('radius', (value) => { state.radius = value; buildTiles(); });
    bindRange('tileSize', (value) => {
      state.tileSize = value;
      syncGridToEffectiveTile();
    });
    bindRange('stepX', (value) => { state.stepX = value; });
    bindRange('stepY', (value) => { state.stepY = value; });
    bindRange('anchorY', (value) => { state.anchorY = value / 100; });
    bindRange('siteScale', (value) => { state.siteScale = value / 100; });
    bindRange('zoom', (value) => { state.zoom = value / 100; });

    document.getElementById('resetView').addEventListener('click', () => {
      state.panX = 0;
      state.panY = 12;
      state.zoom = 0.92;
      syncGridToEffectiveTile();
      syncControls();
      markDirty();
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
    loadAssets();
    window.TileMapLab = {
      state,
      buildTiles,
      getParamsSnapshot,
      analyzeAlphaBounds,
      getRiverConnections,
      hasRiverNearby,
      get tiles() { return tiles; },
      getTerrainMetrics,
      getTileDrawSize,
      terrainAssets: TERRAIN_ASSETS,
      siteAssets: SITE_ASSETS,
      featureAssets: FEATURE_ASSETS,
    };
  }

  init();
}());

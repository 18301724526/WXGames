(function () {
  'use strict';

  const ASSET_ROOT = '../assets/art/';
  const TERRAIN_ASSETS = {
    plains: { label: '平原', file: 'territory-plains-cutout.png', weight: 34 },
    forest: { label: '森林', file: 'territory-forest-cutout.png', weight: 24 },
    hills: { label: '丘陵', file: 'territory-hills-cutout.png', weight: 18 },
    ruins: { label: '遗迹', file: 'territory-ruins-cutout.png', weight: 10 },
    capital: { label: '首都', file: 'territory-capital-cutout.png', weight: 0 },
  };
  const SITE_ASSETS = {
    camp: { label: '营地', file: 'world-site-camp-cutout.png' },
    city: { label: '城邦', file: 'world-site-city-cutout.png' },
    outpost: { label: '据点', file: 'world-site-outpost-cutout.png' },
    ruins: { label: '遗迹', file: 'world-site-ruins-cutout.png' },
    town: { label: '城镇', file: 'world-site-town-cutout.png' },
  };
  const TERRAIN_TYPES = ['plains', 'forest', 'hills', 'ruins'];

  const state = {
    seed: 'scout-tile-v1',
    layoutMode: 'iso',
    radius: 5,
    tileSize: 206,
    stepX: 116,
    stepY: 60,
    anchorY: 0.62,
    siteScale: 0.43,
    zoom: 0.92,
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
  const controls = {};
  let tiles = [];
  let isDragging = false;
  let dragStart = null;
  let needsRender = true;

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

  function chooseTerrain(q, r) {
    if (q === 0 && r === 0) return 'capital';
    const roll = random01(state.seed, q, r, 'terrain') * 100;
    let cursor = 0;
    for (const type of TERRAIN_TYPES) {
      cursor += TERRAIN_ASSETS[type].weight;
      if (roll <= cursor) return type;
    }
    return 'plains';
  }

  function chooseSite(q, r, terrain, ring) {
    if (q === 0 && r === 0) return { type: 'city', owner: 'player', label: '首都' };
    const chance = Math.min(0.1 + ring * 0.055, 0.42);
    if (random01(state.seed, q, r, 'site') > chance) return null;
    const roll = random01(state.seed, q, r, 'site-type');
    let type = 'outpost';
    if (terrain === 'forest') type = roll < 0.58 ? 'camp' : 'outpost';
    else if (terrain === 'hills') type = roll < 0.46 ? 'ruins' : 'city';
    else if (terrain === 'ruins') type = roll < 0.68 ? 'ruins' : 'camp';
    else type = roll < 0.42 ? 'town' : roll < 0.7 ? 'outpost' : 'city';
    const owner = type === 'outpost' || type === 'town'
      ? (ring >= 4 && roll > 0.72 ? 'city_state' : 'neutral')
      : type === 'ruins'
        ? 'ruin_guardians'
        : type === 'city'
          ? 'city_state'
          : 'tribe';
    return { type, owner, label: SITE_ASSETS[type].label };
  }

  function buildTiles() {
    const nextTiles = [];
    const radius = state.radius;
    for (let q = -radius; q <= radius; q += 1) {
      const minR = Math.max(-radius, -q - radius);
      const maxR = Math.min(radius, -q + radius);
      for (let r = minR; r <= maxR; r += 1) {
        const s = -q - r;
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
        const terrain = chooseTerrain(q, r);
        const site = chooseSite(q, r, terrain, ring);
        nextTiles.push({
          id: `tile_${q}_${r}`,
          q,
          r,
          s,
          ring,
          terrain,
          site,
        });
      }
    }
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
    const limit = Math.pow(state.tileSize * state.zoom * 0.34, 2);
    return bestDistance <= limit ? best : null;
  }

  function loadImage(file) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ file, image, ok: true });
      image.onerror = () => resolve({ file, image, ok: false });
      image.src = `${ASSET_ROOT}${file}`;
      images.set(file, image);
    });
  }

  async function loadAssets() {
    const files = [
      ...Object.values(TERRAIN_ASSETS).map((item) => item.file),
      ...Object.values(SITE_ASSETS).map((item) => item.file),
    ];
    const results = await Promise.all(files.map(loadImage));
    const failed = results.filter((item) => !item.ok).map((item) => item.file);
    if (failed.length) hoverInfo.textContent = `资源加载失败：${failed.join(', ')}`;
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
    const terrain = TERRAIN_ASSETS[tile.terrain] || TERRAIN_ASSETS.plains;
    const image = images.get(terrain.file);
    if (!image || !image.complete) return;
    const projected = getProjectedPosition(tile);
    const size = state.tileSize * state.zoom;
    const drawX = projected.x - size * 0.5;
    const drawY = projected.y - size * state.anchorY;
    ctx.drawImage(image, drawX, drawY, size, size);

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

  function drawSite(tile) {
    if (!state.showSites || !tile.site) return;
    const siteAsset = SITE_ASSETS[tile.site.type];
    if (!siteAsset) return;
    const image = images.get(siteAsset.file);
    if (!image || !image.complete) return;
    const projected = getProjectedPosition(tile);
    const size = state.tileSize * state.siteScale * state.zoom;
    const lift = state.tileSize * state.zoom * 0.34;
    ctx.drawImage(image, projected.x - size * 0.5, projected.y - lift - size * 0.6, size, size);
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = tile.site.owner === 'player'
      ? '#7fdca0'
      : tile.site.owner === 'neutral'
        ? '#e8edf1'
        : '#f0c45f';
    ctx.beginPath();
    ctx.arc(projected.x + size * 0.25, projected.y - lift - size * 0.12, Math.max(3, size * 0.045), 0, Math.PI * 2);
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
    hoverInfo.innerHTML = `坐标 ${tile.q}, ${tile.r}<br>地形 ${terrain}<br>地点 ${site}`;
  }

  function getParamsSnapshot() {
    return {
      note: 'tile map art stitching lab v1',
      seed: state.seed,
      layoutMode: state.layoutMode,
      radius: state.radius,
      tileSize: state.tileSize,
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
    const mapHeight = Math.max(1, state.radius * state.stepY * 2.85 + state.tileSize * 0.8);
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
    bindRange('tileSize', (value) => { state.tileSize = value; });
    bindRange('stepX', (value) => { state.stepX = value; });
    bindRange('stepY', (value) => { state.stepY = value; });
    bindRange('anchorY', (value) => { state.anchorY = value / 100; });
    bindRange('siteScale', (value) => { state.siteScale = value / 100; });
    bindRange('zoom', (value) => { state.zoom = value / 100; });

    document.getElementById('resetView').addEventListener('click', () => {
      state.panX = 0;
      state.panY = 12;
      state.zoom = 0.92;
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
    fitMap();
    window.TileMapLab = {
      state,
      buildTiles,
      getParamsSnapshot,
      terrainAssets: TERRAIN_ASSETS,
      siteAssets: SITE_ASSETS,
    };
  }

  init();
}());

(function () {
  const sharedLayout = window.FamousPortraitLayout || {};
  document.documentElement.dataset.famousPortraitAssetVersion = sharedLayout.assetVersion || 'fallback';
  const layerBase = `../${sharedLayout.assetBase || 'assets/art/famous-person/layers/'}`;
  const layerKeys = ['outfit', 'face', 'hair'];
  const labels = {
    outfit: '衣服',
    face: '脸型',
    hair: '发型',
  };

  const makeFiles = (type) => Array.from({ length: 10 }, (_, index) => (
    `fp-layer-v3-${type}-${String(index + 1).padStart(2, '0')}.png`
  ));

  const defaultConfig = {
    version: sharedLayout.version || 3,
    note: 'famous portrait v3 calibrated three-layer transform',
    coordinateSize: sharedLayout.coordinateSize || 512,
    global: { scale: 1, x: 0, y: 0, ...(sharedLayout.global || {}) },
    order: [...(sharedLayout.order || layerKeys)],
    layers: Object.fromEntries((sharedLayout.order || layerKeys).map((key) => {
      const layout = sharedLayout.layers?.[key] || {};
      const options = Array.isArray(layout.options) && layout.options.length ? layout.options : makeFiles(key);
      return [key, {
        label: labels[key] || key,
        file: layout.file || options[0],
        options: options.map((file, index) => ({
          label: `${labels[key] || key} ${String(index + 1).padStart(2, '0')}`,
          file,
        })),
        scale: layout.scale ?? 1,
        x: layout.x ?? 0,
        y: layout.y ?? 0,
        visible: true,
      }];
    })),
  };

  const preview = {
    big: { x: 36, y: 58, size: 512 },
    game: { x: 592, y: 82, width: 74, height: 98, scale: 1.74, offsetY: 0.14 },
    card: { x: 704, y: 82, width: 372, height: 132 },
    grid: { x: 592, y: 284, cell: 94, gapX: 18, gapY: 28, columns: 5 },
  };

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const controls = {
    variantIndex: document.getElementById('variantIndex'),
    globalScale: document.getElementById('globalScale'),
    globalX: document.getElementById('globalX'),
    globalY: document.getElementById('globalY'),
    copyExport: document.getElementById('copyExport'),
    applyImport: document.getElementById('applyImport'),
    reloadAssets: document.getElementById('reloadAssets'),
    resetDefaults: document.getElementById('resetDefaults'),
  };
  const values = {
    variantIndex: document.getElementById('variantIndexValue'),
    globalScale: document.getElementById('globalScaleValue'),
    globalX: document.getElementById('globalXValue'),
    globalY: document.getElementById('globalYValue'),
  };
  const layerList = document.getElementById('layerList');
  const exportData = document.getElementById('exportData');
  const imageCache = new Map();
  let assetReloadVersion = 0;
  let selectedVariant = 1;
  let state = clone(defaultConfig);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getVariantFile(key, variant) {
    const layer = state.layers[key];
    const index = Math.max(0, Math.min((layer.options?.length || 1) - 1, variant - 1));
    return layer.options?.[index]?.file || layer.file;
  }

  function getLayerFile(key) {
    return state.layers[key]?.file || getVariantFile(key, selectedVariant);
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${src}`));
      image.src = `${src}?v=${encodeURIComponent(`${sharedLayout.assetVersion || 'local'}-${assetReloadVersion}`)}`;
    });
    imageCache.set(src, promise);
    return promise;
  }

  async function loadAssets() {
    const files = Object.values(state.layers)
      .flatMap((layer) => layer.options?.map((option) => option.file) || [layer.file])
      .filter(Boolean);
    await Promise.all(files.map((file) => loadImage(layerBase + file)));
  }

  function getExportPayload() {
    return {
      version: state.version,
      note: state.note,
      coordinateSize: state.coordinateSize,
      global: { ...state.global },
      order: [...state.order],
      layers: state.order.reduce((result, key) => {
        const layer = state.layers[key];
        result[key] = {
          file: getLayerFile(key),
          visible: layer.visible,
          scale: layer.scale,
          x: layer.x,
          y: layer.y,
        };
        return result;
      }, {}),
    };
  }

  function applyPayload(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.global && typeof payload.global === 'object') {
      state.global.scale = Number(payload.global.scale ?? state.global.scale);
      state.global.x = Number(payload.global.x ?? state.global.x);
      state.global.y = Number(payload.global.y ?? state.global.y);
    }
    if (Array.isArray(payload.order)) {
      const nextOrder = payload.order.filter((key) => state.layers[key]);
      if (nextOrder.length) state.order = nextOrder;
    }
    if (payload.layers && typeof payload.layers === 'object') {
      Object.entries(payload.layers).forEach(([key, layer]) => {
        if (!state.layers[key] || !layer || typeof layer !== 'object') return;
        if (layer.file && state.layers[key].options.some((option) => option.file === layer.file)) {
          state.layers[key].file = layer.file;
        }
        state.layers[key].scale = Number(layer.scale ?? state.layers[key].scale);
        state.layers[key].x = Number(layer.x ?? state.layers[key].x);
        state.layers[key].y = Number(layer.y ?? state.layers[key].y);
        state.layers[key].visible = layer.visible !== false;
      });
    }
  }

  function updateExport() {
    exportData.value = JSON.stringify(getExportPayload(), null, 2);
  }

  function updateLabels() {
    values.variantIndex.textContent = String(selectedVariant).padStart(2, '0');
    values.globalScale.textContent = `${Math.round(state.global.scale * 100)}%`;
    values.globalX.textContent = state.global.x;
    values.globalY.textContent = state.global.y;
    state.order.forEach((key) => {
      const layer = state.layers[key];
      const root = document.querySelector(`[data-layer="${key}"]`);
      if (!root) return;
      root.querySelector('[data-value="scale"]').textContent = `${Math.round(layer.scale * 100)}%`;
      root.querySelector('[data-value="x"]').textContent = layer.x;
      root.querySelector('[data-value="y"]').textContent = layer.y;
      root.querySelector('[data-visible]').checked = layer.visible;
      root.querySelector('[data-file-label]').textContent = getLayerFile(key).match(/-(\d+)\.png$/)?.[1] || '';
    });
  }

  function createLayerPanel(key) {
    const layer = state.layers[key];
    const item = document.createElement('div');
    item.className = 'layer';
    item.dataset.layer = key;
    item.innerHTML = `
      <div class="layer-head">
        <div class="layer-name">${layer.label}</div>
        <button data-move="up" title="上移一层">上移</button>
        <button data-move="down" title="下移一层">下移</button>
        <label class="toggle"><input data-visible type="checkbox" checked>显示</label>
      </div>
      <div class="row">
        <span>文件</span>
        <select data-control="file">
          ${layer.options.map((option) => `<option value="${option.file}">${option.label}</option>`).join('')}
        </select>
        <span class="value" data-file-label></span>
      </div>
      <div class="row">
        <span>缩放</span>
        <input data-control="scale" type="range" min="0" max="200" value="100">
        <span class="value" data-value="scale"></span>
      </div>
      <div class="row">
        <span>X</span>
        <input data-control="x" type="range" min="-260" max="260" value="0">
        <span class="value" data-value="x"></span>
      </div>
      <div class="row">
        <span>Y</span>
        <input data-control="y" type="range" min="-320" max="320" value="0">
        <span class="value" data-value="y"></span>
      </div>
    `;
    item.querySelector('[data-control="scale"]').value = Math.round(layer.scale * 100);
    item.querySelector('[data-control="x"]').value = layer.x;
    item.querySelector('[data-control="y"]').value = layer.y;
    item.querySelector('[data-control="file"]').value = getLayerFile(key);
    item.querySelector('[data-control="file"]').addEventListener('change', (event) => {
      layer.file = event.target.value;
      render();
    });
    item.querySelector('[data-control="scale"]').addEventListener('input', (event) => {
      layer.scale = Number(event.target.value) / 100;
      render();
    });
    item.querySelector('[data-control="x"]').addEventListener('input', (event) => {
      layer.x = Number(event.target.value);
      render();
    });
    item.querySelector('[data-control="y"]').addEventListener('input', (event) => {
      layer.y = Number(event.target.value);
      render();
    });
    item.querySelector('[data-visible]').addEventListener('change', (event) => {
      layer.visible = event.target.checked;
      render();
    });
    item.querySelector('[data-move="up"]').addEventListener('click', () => moveLayer(key, -1));
    item.querySelector('[data-move="down"]').addEventListener('click', () => moveLayer(key, 1));
    return item;
  }

  function rebuildLayerList() {
    layerList.innerHTML = '';
    state.order.forEach((key) => layerList.appendChild(createLayerPanel(key)));
    updateLabels();
  }

  function moveLayer(key, direction) {
    const index = state.order.indexOf(key);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= state.order.length) return;
    const [removed] = state.order.splice(index, 1);
    state.order.splice(next, 0, removed);
    rebuildLayerList();
    render();
  }

  function drawPanel(x, y, width, height, options = {}) {
    const radius = options.radius || 8;
    ctx.save();
    ctx.fillStyle = options.fill || '#2a211a';
    ctx.strokeStyle = options.stroke || 'rgba(240,180,91,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(text, x, y, options = {}) {
    ctx.fillStyle = options.color || '#ffe6b5';
    ctx.font = options.font || '700 16px "Microsoft YaHei", sans-serif';
    ctx.fillText(text, x, y);
  }

  function getLayerFrame(layer, frame) {
    const scale = layer.scale * state.global.scale;
    const size = state.coordinateSize * scale * frame.scale;
    const centerOffset = ((state.coordinateSize * frame.scale) - size) / 2;
    return {
      x: frame.x + centerOffset + (layer.x + state.global.x) * frame.scale,
      y: frame.y + centerOffset + (layer.y + state.global.y) * frame.scale,
      width: size,
      height: size,
    };
  }

  async function drawPortrait(x, y, size, options = {}) {
    const clip = options.clip || null;
    const variant = options.variant || null;
    const frame = { x, y, scale: size / state.coordinateSize };
    if (clip) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(clip.x, clip.y, clip.width, clip.height, clip.radius || 8);
      ctx.clip();
    }
    for (const key of state.order) {
      const layer = state.layers[key];
      if (!layer.visible) continue;
      const image = await loadImage(layerBase + (variant ? getVariantFile(key, variant) : getLayerFile(key)));
      const draw = getLayerFrame(layer, frame);
      ctx.drawImage(image, draw.x, draw.y, draw.width, draw.height);
    }
    if (clip) ctx.restore();
  }

  async function drawCurrentPreviews() {
    drawLabel('完整预览', preview.big.x, 34, { font: '700 18px "Microsoft YaHei", sans-serif' });
    drawPanel(preview.big.x, preview.big.y, preview.big.size, preview.big.size, { fill: '#221b15', radius: 10 });
    await drawPortrait(preview.big.x, preview.big.y, preview.big.size);

    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(preview.big.x, preview.big.y, preview.big.size, preview.big.size);
    ctx.setLineDash([]);

    drawLabel('游戏头像区域', preview.game.x - 6, 70, { font: '700 15px "Microsoft YaHei", sans-serif' });
    drawPanel(preview.game.x, preview.game.y, preview.game.width, preview.game.height, {
      fill: 'rgba(44,32,23,.94)',
      stroke: 'rgba(240,180,91,.32)',
      radius: 10,
    });
    const gameSize = preview.game.width * preview.game.scale;
    const gameX = preview.game.x + (preview.game.width - gameSize) / 2;
    const gameY = preview.game.y + (preview.game.height - gameSize) / 2 + preview.game.width * preview.game.offsetY;
    await drawPortrait(gameX, gameY, gameSize, {
      clip: { x: preview.game.x, y: preview.game.y, width: preview.game.width, height: preview.game.height, radius: 10 },
    });

    drawLabel('卡片实显', preview.card.x, preview.card.y - 16, { font: '700 15px "Microsoft YaHei", sans-serif' });
    drawPanel(preview.card.x, preview.card.y, preview.card.width, preview.card.height, {
      fill: 'rgba(52,39,27,.86)',
      stroke: 'rgba(240,180,91,.34)',
      radius: 9,
    });
    const portraitX = preview.card.x + 10;
    const portraitY = preview.card.y + 10;
    drawPanel(portraitX, portraitY, preview.game.width, preview.game.height, {
      fill: 'rgba(44,32,23,.94)',
      stroke: 'rgba(240,180,91,.32)',
      radius: 10,
    });
    await drawPortrait(gameX + portraitX - preview.game.x, gameY + portraitY - preview.game.y, gameSize, {
      clip: { x: portraitX, y: portraitY, width: preview.game.width, height: preview.game.height, radius: 10 },
    });
    ctx.fillStyle = '#fff1cf';
    ctx.font = '700 14px "Microsoft YaHei", sans-serif';
    ctx.fillText('守将候选', preview.card.x + 96, preview.card.y + 24);
    ctx.fillStyle = '#cbbd96';
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.fillText('军事 / 寻访', preview.card.x + 96, preview.card.y + 45);
    ctx.fillStyle = '#aeb0b8';
    ctx.fillText('统率 76 武力 68 谋略 51 治理 42 工艺 33', preview.card.x + 96, preview.card.y + 69);
    ctx.fillStyle = '#74d3a0';
    ctx.font = '700 10px "Microsoft YaHei", sans-serif';
    ctx.fillText('守势反击 / 盾阵', preview.card.x + 96, preview.card.y + 88);
  }

  async function drawVariantGrid() {
    drawLabel('10 套规格检查', preview.grid.x, preview.grid.y - 16, { font: '700 15px "Microsoft YaHei", sans-serif' });
    for (let variant = 1; variant <= 10; variant += 1) {
      const col = (variant - 1) % preview.grid.columns;
      const row = Math.floor((variant - 1) / preview.grid.columns);
      const x = preview.grid.x + col * (preview.grid.cell + preview.grid.gapX);
      const y = preview.grid.y + row * (preview.grid.cell + preview.grid.gapY);
      drawPanel(x, y, preview.grid.cell, preview.grid.cell, {
        fill: variant === selectedVariant ? '#2f271f' : '#1c1e22',
        stroke: variant === selectedVariant ? '#f0b45b' : 'rgba(255,255,255,.18)',
        radius: 8,
      });
      await drawPortrait(x, y, preview.grid.cell, { variant });
      ctx.fillStyle = '#cbbd96';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(String(variant).padStart(2, '0'), x + 8, y + preview.grid.cell - 8);
    }
  }

  function rebuildFileSelections() {
    state.order.forEach((key) => {
      const root = document.querySelector(`[data-layer="${key}"]`);
      const select = root?.querySelector('[data-control="file"]');
      if (select) select.value = getLayerFile(key);
    });
  }

  async function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#101113';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await drawCurrentPreviews();
    await drawVariantGrid();
    updateLabels();
    updateExport();
    rebuildFileSelections();
  }

  function reset() {
    selectedVariant = 1;
    state = clone(defaultConfig);
    controls.variantIndex.value = selectedVariant;
    controls.globalScale.value = Math.round(state.global.scale * 100);
    controls.globalX.value = state.global.x;
    controls.globalY.value = state.global.y;
    rebuildLayerList();
    render();
  }

  controls.variantIndex.addEventListener('input', (event) => {
    selectedVariant = Number(event.target.value);
    state.order.forEach((key) => {
      state.layers[key].file = getVariantFile(key, selectedVariant);
    });
    render();
  });
  controls.globalScale.addEventListener('input', (event) => {
    state.global.scale = Number(event.target.value) / 100;
    render();
  });
  controls.globalX.addEventListener('input', (event) => {
    state.global.x = Number(event.target.value);
    render();
  });
  controls.globalY.addEventListener('input', (event) => {
    state.global.y = Number(event.target.value);
    render();
  });
  controls.copyExport.addEventListener('click', async () => {
    updateExport();
    await navigator.clipboard?.writeText(exportData.value);
  });
  controls.applyImport.addEventListener('click', () => {
    try {
      applyPayload(JSON.parse(exportData.value));
      controls.globalScale.value = Math.round(state.global.scale * 100);
      controls.globalX.value = state.global.x;
      controls.globalY.value = state.global.y;
      rebuildLayerList();
      render();
    } catch (error) {
      exportData.value = `${exportData.value}\n\n导入失败: ${error.message}`;
    }
  });
  controls.reloadAssets.addEventListener('click', async () => {
    assetReloadVersion += 1;
    imageCache.clear();
    await loadAssets();
    render();
  });
  controls.resetDefaults.addEventListener('click', reset);

  loadAssets().then(reset).catch((error) => {
    ctx.fillStyle = '#ff7b7b';
    ctx.font = '16px sans-serif';
    ctx.fillText(error.message, 24, 40);
  });
})();

(function () {
  const layerBase = '../assets/art/famous-person/layers/';
  const defaultConfig = {
    version: 2,
    note: 'famous portrait v2 user-cut layer transform',
    coordinateSize: 512,
    global: { scale: 1, x: 0, y: 0 },
    order: ['outfitBack', 'head', 'hair', 'outfitFront'],
    layers: {
      hair: {
        label: '完整发型',
        file: 'fp-layer-v2-art01-hair-bound-topknot-01.png',
        scale: 0.28,
        x: 63,
        y: -25,
        visible: true,
      },
      backHair: {
        label: '后发',
        file: 'fp-layer-v2-art01-backHair-short-01.png',
        scale: 0.78,
        x: -198,
        y: 5,
        visible: true,
      },
      outfitBack: {
        label: '后层衣服',
        file: 'fp-layer-v2-art01-outfitBack-guardian-01.png',
        scale: 0.48,
        x: 172,
        y: 231,
        visible: true,
      },
      head: {
        label: '头和身体',
        file: 'fp-layer-v2-art01-head-base-01.png',
        scale: 0.46,
        x: 133,
        y: 83,
        visible: true,
      },
      sideHair: {
        label: '鬓角',
        file: 'fp-layer-v2-art01-sideHair-short-01.png',
        scale: 0.35,
        x: 135,
        y: 9,
        visible: true,
      },
      frontHair: {
        label: '前发',
        file: 'fp-layer-v2-art01-frontHair-short-01.png',
        scale: 0.35,
        x: 162,
        y: 51,
        visible: true,
      },
      bangs: {
        label: '刘海',
        file: 'fp-layer-v2-art01-bangs-short-01.png',
        scale: 0.36,
        x: 121,
        y: 49,
        visible: true,
      },
      outfitFront: {
        label: '前层衣服',
        file: 'fp-layer-v2-art01-outfitFront-guardian-01.png',
        scale: 0.48,
        x: -5,
        y: 249,
        visible: true,
      },
    },
  };

  const preview = {
    big: { x: 72, y: 64, size: 512 },
    game: { x: 710, y: 118, width: 74, height: 98, scale: 1.74, offsetY: 0.14 },
    card: { x: 650, y: 300, width: 356, height: 132 },
  };

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const controls = {
    globalScale: document.getElementById('globalScale'),
    globalX: document.getElementById('globalX'),
    globalY: document.getElementById('globalY'),
    copyExport: document.getElementById('copyExport'),
    resetDefaults: document.getElementById('resetDefaults'),
  };
  const values = {
    globalScale: document.getElementById('globalScaleValue'),
    globalX: document.getElementById('globalXValue'),
    globalY: document.getElementById('globalYValue'),
  };
  const layerList = document.getElementById('layerList');
  const exportData = document.getElementById('exportData');
  const imageCache = new Map();
  let manifest = null;
  let state = clone(defaultConfig);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load ${src}`));
      image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  async function loadAssets() {
    const response = await fetch(`${layerBase}fp-layer-v2-manifest.json?ts=${Date.now()}`);
    manifest = await response.json();
    const files = Object.values(state.layers).map((layer) => layer.file);
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
          file: layer.file,
          visible: layer.visible,
          scale: layer.scale,
          x: layer.x,
          y: layer.y,
        };
        return result;
      }, {}),
    };
  }

  function updateExport() {
    exportData.value = JSON.stringify(getExportPayload(), null, 2);
  }

  function updateLabels() {
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
        <span>缩放</span>
        <input data-control="scale" type="range" min="0" max="200" value="100">
        <span class="value" data-value="scale"></span>
      </div>
      <div class="row">
        <span>X</span>
        <input data-control="x" type="range" min="-220" max="220" value="0">
        <span class="value" data-value="x"></span>
      </div>
      <div class="row">
        <span>Y</span>
        <input data-control="y" type="range" min="-260" max="260" value="0">
        <span class="value" data-value="y"></span>
      </div>
    `;
    item.querySelector('[data-control="scale"]').value = Math.round(layer.scale * 100);
    item.querySelector('[data-control="x"]').value = layer.x;
    item.querySelector('[data-control="y"]').value = layer.y;
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

  function getLayerFrame(layer, frame) {
    const base = manifest.layers[layer.file];
    const globalScale = state.global.scale;
    const scale = layer.scale * globalScale;
    return {
      x: frame.x + (base.x + layer.x + state.global.x) * frame.scale,
      y: frame.y + (base.y + layer.y + state.global.y) * frame.scale,
      width: base.width * scale * frame.scale,
      height: base.height * scale * frame.scale,
    };
  }

  async function drawPortrait(x, y, size, options = {}) {
    const clip = options.clip || null;
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
      const image = await loadImage(layerBase + layer.file);
      const draw = getLayerFrame(layer, frame);
      ctx.drawImage(image, draw.x, draw.y, draw.width, draw.height);
    }
    if (clip) ctx.restore();
  }

  async function render() {
    if (!manifest) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#101113';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 18px "Microsoft YaHei", sans-serif';
    ctx.fillText('完整预览', 72, 40);
    drawPanel(preview.big.x, preview.big.y, preview.big.size, preview.big.size, { fill: '#221b15' });
    await drawPortrait(preview.big.x, preview.big.y, preview.big.size);

    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(preview.big.x, preview.big.y, preview.big.size, preview.big.size);
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 18px "Microsoft YaHei", sans-serif';
    ctx.fillText('游戏头像区域预览', 650, 84);
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

    updateLabels();
    updateExport();
  }

  function reset() {
    state = clone(defaultConfig);
    controls.globalScale.value = Math.round(state.global.scale * 100);
    controls.globalX.value = state.global.x;
    controls.globalY.value = state.global.y;
    rebuildLayerList();
    render();
  }

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
  controls.resetDefaults.addEventListener('click', reset);

  loadAssets().then(() => {
    rebuildLayerList();
    render();
  }).catch((error) => {
    ctx.fillStyle = '#ff7b7b';
    ctx.font = '16px sans-serif';
    ctx.fillText(error.message, 24, 40);
  });
})();

(function () {
  const layerBase = '../assets/art/famous-person/layers/';
  const outfitFiles = {
    guardian: 'fp-layer-outfit-guardian-01.png',
    vanguard: 'fp-layer-outfit-vanguard-01.png',
    scholar: 'fp-layer-outfit-scholar-01.png',
  };
  const bodyFiles = {
    '01': 'fp-layer-body-skin-01.png',
    '02': 'fp-layer-body-skin-02.png',
  };
  const hairFiles = {
    short: 'fp-layer-frontHair-short-01.png',
    tied: 'fp-layer-frontHair-tied-01.png',
  };
  const accessoryFiles = {
    scar: 'fp-layer-accessory-scar-01.png',
  };

  const controls = [
    'outfit',
    'body',
    'hair',
    'accessory',
    'mode',
    'frontCutY',
    'backCutY',
    'scale',
    'offsetY',
    'cardWidth',
    'cardHeight',
  ].reduce((result, id) => {
    result[id] = document.getElementById(id);
    return result;
  }, {});

  const valueLabels = {
    frontCutY: document.getElementById('frontCutValue'),
    backCutY: document.getElementById('backCutValue'),
    scale: document.getElementById('scaleValue'),
    offsetY: document.getElementById('offsetValue'),
    cardWidth: document.getElementById('cardWidthValue'),
    cardHeight: document.getElementById('cardHeightValue'),
  };

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('status');
  const imageCache = new Map();

  function imagePath(filename) {
    return `${layerBase}${filename}`;
  }

  function loadImage(filename) {
    const src = imagePath(filename);
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`load failed: ${src}`));
      image.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }

  function getState() {
    return {
      outfit: controls.outfit.value,
      body: controls.body.value,
      hair: controls.hair.value,
      accessory: controls.accessory.value,
      mode: controls.mode.value,
      frontCutY: Number(controls.frontCutY.value),
      backCutY: Number(controls.backCutY.value),
      scale: Number(controls.scale.value) / 100,
      offsetY: Number(controls.offsetY.value),
      cardWidth: Number(controls.cardWidth.value),
      cardHeight: Number(controls.cardHeight.value),
    };
  }

  function syncLabels(state) {
    valueLabels.frontCutY.textContent = state.frontCutY;
    valueLabels.backCutY.textContent = state.backCutY;
    valueLabels.scale.textContent = `${Math.round(state.scale * 100)}%`;
    valueLabels.offsetY.textContent = state.offsetY;
    valueLabels.cardWidth.textContent = state.cardWidth;
    valueLabels.cardHeight.textContent = state.cardHeight;
  }

  function roundRectPath(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawPanel(x, y, width, height, options = {}) {
    roundRectPath(x, y, width, height, options.radius || 8);
    ctx.fillStyle = options.fill || 'rgba(41, 30, 20, 0.92)';
    ctx.fill();
    ctx.strokeStyle = options.stroke || 'rgba(235, 184, 105, 0.25)';
    ctx.lineWidth = options.lineWidth || 1;
    ctx.stroke();
  }

  function drawLayer(image, x, y, size, crop = null) {
    if (!crop) {
      ctx.drawImage(image, x, y, size, size);
      return;
    }
    const sx = Math.max(0, crop.sx ?? 0);
    const sy = Math.max(0, crop.sy ?? 0);
    const sw = Math.max(1, Math.min(image.width - sx, crop.sw ?? image.width));
    const sh = Math.max(1, Math.min(image.height - sy, crop.sh ?? image.height));
    ctx.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      x + (sx / image.width) * size,
      y + (sy / image.height) * size,
      (sw / image.width) * size,
      (sh / image.height) * size
    );
  }

  function drawSplitOutfit(outfit, x, y, size, state, section) {
    if (section === 'back') {
      drawLayer(outfit, x, y, size, { sx: 0, sy: 0, sw: 512, sh: state.backCutY });
      return;
    }
    drawLayer(outfit, x, y, size, { sx: 0, sy: state.frontCutY, sw: 512, sh: 512 - state.frontCutY });
  }

  function drawPortrait(images, x, y, size, state, options = {}) {
    const drawSize = size * state.scale;
    const drawX = x + (size - drawSize) / 2;
    const drawY = y + (size - drawSize) / 2 + state.offsetY;

    if (options.clip) {
      ctx.save();
      roundRectPath(options.clip.x, options.clip.y, options.clip.width, options.clip.height, options.clip.radius || 10);
      ctx.clip();
    }

    if (state.mode === 'current') {
      drawLayer(images.body, drawX, drawY, drawSize);
      drawLayer(images.outfit, drawX, drawY, drawSize);
      drawLayer(images.hair, drawX, drawY, drawSize);
    } else if (state.mode === 'outfitBack') {
      drawLayer(images.outfit, drawX, drawY, drawSize);
      drawLayer(images.body, drawX, drawY, drawSize);
      drawLayer(images.hair, drawX, drawY, drawSize);
    } else {
      drawSplitOutfit(images.outfit, drawX, drawY, drawSize, state, 'back');
      drawLayer(images.body, drawX, drawY, drawSize);
      drawLayer(images.hair, drawX, drawY, drawSize);
      drawSplitOutfit(images.outfit, drawX, drawY, drawSize, state, 'front');
    }

    if (images.accessory) drawLayer(images.accessory, drawX, drawY, drawSize);
    if (options.clip) ctx.restore();
  }

  function drawCard(images, x, y, width, height, state, title) {
    drawPanel(x, y, width, height, { fill: 'rgba(42, 31, 20, 0.86)', stroke: 'rgba(240, 180, 91, 0.34)', radius: 9 });
    const portraitX = x + 12;
    const portraitY = y + 12;
    drawPanel(portraitX, portraitY, state.cardWidth, state.cardHeight, {
      fill: 'rgba(44, 32, 23, 0.94)',
      stroke: 'rgba(240, 180, 91, 0.32)',
      radius: 10,
    });
    drawPortrait(images, portraitX, portraitY, Math.min(state.cardWidth, state.cardHeight), state, {
      clip: {
        x: portraitX,
        y: portraitY,
        width: state.cardWidth,
        height: state.cardHeight,
        radius: 10,
      },
    });
    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 18px "Microsoft YaHei", sans-serif';
    ctx.fillText(title, x + state.cardWidth + 28, y + 18);
    ctx.fillStyle = '#cbbd96';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('军事 · 寻访', x + state.cardWidth + 28, y + 46);
    ctx.fillStyle = '#aeb0b8';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText('统率76 武力68 谋略51 治理42 工巧33', x + state.cardWidth + 28, y + 76);
    ctx.fillStyle = '#74d3a0';
    ctx.font = '700 12px "Microsoft YaHei", sans-serif';
    ctx.fillText('守势反击 · 护盾 / 反击', x + state.cardWidth + 28, y + 100);
  }

  function drawGuides(x, y, size, state) {
    const drawSize = size * state.scale;
    const drawX = x + (size - drawSize) / 2;
    const drawY = y + (size - drawSize) / 2 + state.offsetY;
    ctx.save();
    ctx.strokeStyle = 'rgba(142, 224, 160, 0.85)';
    ctx.lineWidth = 2;
    const frontY = drawY + (state.frontCutY / 512) * drawSize;
    const backY = drawY + (state.backCutY / 512) * drawSize;
    ctx.beginPath();
    ctx.moveTo(drawX, frontY);
    ctx.lineTo(drawX + drawSize, frontY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(114, 178, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(drawX, backY);
    ctx.lineTo(drawX + drawSize, backY);
    ctx.stroke();
    ctx.restore();
  }

  function drawScene(images, state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#21170f');
    gradient.addColorStop(1, '#100c08');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('大图预览', 32, 38);
    ctx.fillStyle = '#bda77e';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('绿线：衣服前层分界；蓝线：衣服后层分界。', 32, 62);

    drawPanel(32, 88, 512, 612, { fill: 'rgba(32, 24, 16, 0.88)', stroke: 'rgba(235, 184, 105, 0.24)', radius: 8 });
    drawPortrait(images, 32, 126, 512, state);
    drawGuides(32, 126, 512, state);

    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('卡片尺寸预览', 592, 38);
    drawCard(images, 592, 88, 520, 136, state, '秦承 · 垒门守将');
    drawCard(images, 592, 246, 520, 126, state, '韩骁 · 山道突骑');

    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 18px "Microsoft YaHei", sans-serif';
    ctx.fillText('当前模式', 592, 436);
    ctx.fillStyle = '#c8b58e';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    const modeText = {
      split: '模拟衣服前后层：肩甲衣身在后，领口围巾在前。',
      outfitBack: '衣服整体在脸后：脸不被压，但高领会失去遮挡关系。',
      current: '当前游戏顺序：衣服整层压到脸上，容易切坏下巴。',
    }[state.mode];
    ctx.fillText(modeText, 592, 466);

    const sampleY = 520;
    ['current', 'outfitBack', 'split'].forEach((mode, index) => {
      const oldMode = state.mode;
      state.mode = mode;
      const x = 592 + index * 170;
      drawPanel(x, sampleY, 140, 160, { fill: 'rgba(32, 24, 16, 0.88)', stroke: 'rgba(235, 184, 105, 0.2)', radius: 8 });
      drawPortrait(images, x + 18, sampleY + 18, 104, state, {
        clip: { x: x + 18, y: sampleY + 18, width: 104, height: 124, radius: 10 },
      });
      ctx.fillStyle = '#c8b58e';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText({ current: '当前', outfitBack: '衣服后置', split: '前后层' }[mode], x + 18, sampleY + 146);
      state.mode = oldMode;
    });
  }

  async function render() {
    const state = getState();
    syncLabels(state);
    const files = [
      outfitFiles[state.outfit],
      bodyFiles[state.body],
      hairFiles[state.hair],
    ];
    if (state.accessory !== 'none') files.push(accessoryFiles[state.accessory]);
    try {
      const loaded = await Promise.all(files.map(loadImage));
      const images = {
        outfit: loaded[0],
        body: loaded[1],
        hair: loaded[2],
        accessory: state.accessory === 'none' ? null : loaded[3],
      };
      drawScene(images, state);
      status.textContent = '已加载';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  Object.values(controls).forEach((control) => {
    control.addEventListener('input', render);
    control.addEventListener('change', render);
  });

  render();
}());

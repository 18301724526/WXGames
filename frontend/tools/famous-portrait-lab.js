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
    'showBounds',
    'showAnchorLines',
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
  const audit = document.getElementById('audit');
  const imageCache = new Map();
  const boundsCache = new WeakMap();
  const layerColors = {
    body: '#8ee0a0',
    outfit: '#72b2ff',
    hair: '#f0a0ff',
    accessory: '#ffd36f',
  };

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
      showBounds: controls.showBounds.checked,
      showAnchorLines: controls.showAnchorLines.checked,
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

  function getAlphaBounds(image) {
    if (boundsCache.has(image)) return boundsCache.get(image);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = width;
    sampleCanvas.height = height;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(image, 0, 0, width, height);
    const data = sampleCtx.getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let pixels = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha <= 8) continue;
        pixels += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    const bounds = maxX < 0 ? null : {
      x: minX,
      y: minY,
      right: maxX,
      bottom: maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      marginLeft: minX,
      marginRight: width - maxX - 1,
      marginTop: minY,
      marginBottom: height - maxY - 1,
      coverage: pixels / (width * height),
      sourceWidth: width,
      sourceHeight: height,
    };
    boundsCache.set(image, bounds);
    return bounds;
  }

  function getAlphaAt(image, x, y) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const px = Math.max(0, Math.min(width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(height - 1, Math.round(y)));
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1;
    sampleCanvas.height = 1;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(image, px, py, 1, 1, 0, 0, 1, 1);
    return sampleCtx.getImageData(0, 0, 1, 1).data[3];
  }

  function buildLayerEntries(images) {
    return [
      { key: 'body', label: '身体', image: images.body },
      { key: 'outfit', label: '衣服', image: images.outfit },
      { key: 'hair', label: '发型', image: images.hair },
      images.accessory ? { key: 'accessory', label: '配饰', image: images.accessory } : null,
    ].filter(Boolean).map((entry) => ({
      ...entry,
      bounds: getAlphaBounds(entry.image),
    }));
  }

  function formatSigned(value) {
    const rounded = Math.round(value * 10) / 10;
    return rounded > 0 ? `+${rounded}` : `${rounded}`;
  }

  function updateAudit(entries) {
    const lines = [
      '透明像素边界 alpha > 8',
      '目标：同类素材应共享 512x512 坐标系，中心接近 x=256。',
      '',
    ];
    entries.forEach((entry) => {
      const b = entry.bounds;
      if (!b) {
        lines.push(`${entry.label}: 无有效像素`);
        return;
      }
      lines.push(`${entry.label}: bounds (${b.x},${b.y})-(${b.right},${b.bottom}) ${b.width}x${b.height}`);
      lines.push(`  空白 L/R/T/B ${b.marginLeft}/${b.marginRight}/${b.marginTop}/${b.marginBottom}`);
      lines.push(`  中心偏移 x=${formatSigned(b.centerX - 256)} y=${formatSigned(b.centerY - 256)} 覆盖 ${(b.coverage * 100).toFixed(1)}%`);
    });
    audit.textContent = lines.join('\n');
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

  function drawAnchorGuides(x, y, size, state) {
    if (!state.showAnchorLines) return;
    const drawSize = size * state.scale;
    const drawX = x + (size - drawSize) / 2;
    const drawY = y + (size - drawSize) / 2 + state.offsetY;
    const guides = [
      { label: 'center', y: 0, color: 'rgba(255, 255, 255, 0.35)' },
      { label: 'chin', y: 246, color: 'rgba(255, 210, 111, 0.78)' },
      { label: 'shoulder', y: 330, color: 'rgba(142, 224, 160, 0.78)' },
    ];
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    const centerX = drawX + drawSize / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, drawY);
    ctx.lineTo(centerX, drawY + drawSize);
    ctx.stroke();
    guides.slice(1).forEach((guide) => {
      const lineY = drawY + (guide.y / 512) * drawSize;
      ctx.strokeStyle = guide.color;
      ctx.beginPath();
      ctx.moveTo(drawX, lineY);
      ctx.lineTo(drawX + drawSize, lineY);
      ctx.stroke();
      ctx.fillStyle = guide.color;
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText(guide.label, drawX + 6, lineY + 4);
    });
    ctx.restore();
  }

  function drawBoundsOverlay(entries, x, y, size, state) {
    if (!state.showBounds) return;
    const drawSize = size * state.scale;
    const drawX = x + (size - drawSize) / 2;
    const drawY = y + (size - drawSize) / 2 + state.offsetY;
    ctx.save();
    ctx.lineWidth = 2;
    entries.forEach((entry, index) => {
      const b = entry.bounds;
      if (!b) return;
      const color = layerColors[entry.key] || '#ffffff';
      const bx = drawX + (b.x / b.sourceWidth) * drawSize;
      const by = drawY + (b.y / b.sourceHeight) * drawSize;
      const bw = (b.width / b.sourceWidth) * drawSize;
      const bh = (b.height / b.sourceHeight) * drawSize;
      ctx.strokeStyle = color;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = color;
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText(`${entry.label} dx ${formatSigned(b.centerX - 256)}`, 44, 620 + index * 18);
    });
    ctx.restore();
  }

  function getEntry(entries, key) {
    return entries.find((entry) => entry.key === key) || null;
  }

  function drawCroppedAlignedLayer(entry, x, y, size, state) {
    const b = entry?.bounds;
    if (!entry || !b) return;
    const drawSize = size * state.scale;
    const drawX = x + (size - drawSize) / 2;
    const drawY = y + (size - drawSize) / 2 + state.offsetY;
    // This is an audit preview, not the final rule: trim transparent pixels,
    // then shift by the alpha center so every part returns to x=256.
    const shiftX = 256 - b.centerX;
    const destX = drawX + ((b.x + shiftX) / b.sourceWidth) * drawSize;
    const destY = drawY + (b.y / b.sourceHeight) * drawSize;
    const destW = (b.width / b.sourceWidth) * drawSize;
    const destH = (b.height / b.sourceHeight) * drawSize;
    ctx.drawImage(entry.image, b.x, b.y, b.width, b.height, destX, destY, destW, destH);
  }

  function drawCroppedAlignedPortrait(entries, x, y, size, state) {
    const layerOrder = ['body', 'outfit', 'hair', 'accessory'];
    layerOrder.forEach((key) => drawCroppedAlignedLayer(getEntry(entries, key), x, y, size, state));
  }

  function drawCropComparison(images, entries, x, y, state) {
    drawPanel(x, y, 520, 154, { fill: 'rgba(32, 24, 16, 0.88)', stroke: 'rgba(235, 184, 105, 0.2)', radius: 8 });
    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 14px "Microsoft YaHei", sans-serif';
    ctx.fillText('裁剪/锚点对比', x + 14, y + 14);
    const previewY = y + 42;
    const previewSize = 96;
    [
      { label: '原始 512 画布', mode: 'raw' },
      { label: '裁边后回 x=256', mode: 'cropped' },
    ].forEach((item, index) => {
      const px = x + 16 + index * 126;
      drawPanel(px, previewY, previewSize, previewSize, { fill: 'rgba(20, 15, 10, 0.8)', stroke: 'rgba(235, 184, 105, 0.18)', radius: 8 });
      ctx.save();
      roundRectPath(px, previewY, previewSize, previewSize, 8);
      ctx.clip();
      if (item.mode === 'raw') drawPortrait(images, px, previewY, previewSize, state);
      else drawCroppedAlignedPortrait(entries, px, previewY, previewSize, state);
      ctx.restore();
      ctx.fillStyle = '#c8b58e';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.fillText(item.label, px, previewY + previewSize + 16);
    });
    ctx.fillStyle = '#c8b58e';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText('如果右侧仍怪，说明不是单纯空白裁剪问题，而是素材构图/背后部分就错了。', x + 270, y + 58);
    ctx.fillText('最终资源应统一 512 坐标和锚点，再导出透明 PNG。', x + 270, y + 82);
  }

  function drawTrimAudit(entries, x, y) {
    drawPanel(x, y, 520, 118, { fill: 'rgba(32, 24, 16, 0.88)', stroke: 'rgba(235, 184, 105, 0.2)', radius: 8 });
    ctx.fillStyle = '#ffe6b5';
    ctx.font = '700 14px "Microsoft YaHei", sans-serif';
    ctx.fillText('素材结论', x + 14, y + 14);
    ctx.fillStyle = '#c8b58e';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    const body = entries.find((entry) => entry.key === 'body')?.bounds;
    const outfit = entries.find((entry) => entry.key === 'outfit')?.bounds;
    const hair = entries.find((entry) => entry.key === 'hair')?.bounds;
    const issues = [];
    const outfitHasNeckHole = outfit && getAlphaAt(getEntry(entries, 'outfit')?.image, 256, Math.max(outfit.y + 18, 230)) <= 8;
    if (outfit && outfit.y < 245 && outfitHasNeckHole) issues.push('衣服含背后领/背后空壳，需要重做');
    if (outfit && Math.abs(outfit.centerX - 256) > 12) issues.push('衣服中心偏移偏大');
    if (hair && body && Math.abs(hair.centerX - body.centerX) > 12) issues.push('发型与身体中心不一致');
    if (outfit && outfit.marginTop < 220) issues.push('衣服有效像素过高，容易穿到脸/脖子区域');
    if (outfit && outfit.marginLeft !== outfit.marginRight) issues.push('衣服左右空白不对称');
    if (!issues.length) issues.push('当前只需按统一锚点导出');
    issues.slice(0, 4).forEach((text, index) => {
      ctx.fillText(`${index + 1}. ${text}`, x + 14, y + 42 + index * 18);
    });
  }

  function drawScene(images, state, entries) {
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
    drawAnchorGuides(32, 126, 512, state);
    drawBoundsOverlay(entries, 32, 126, 512, state);

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
    drawTrimAudit(entries, 592, 704);
    drawCropComparison(images, entries, 592, 830, state);
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
      const entries = buildLayerEntries(images);
      updateAudit(entries);
      drawScene(images, state, entries);
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

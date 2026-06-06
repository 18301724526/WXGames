(function (global) {
  function drawFamousPortraitLayer(renderer, assetPath, key, baseFrame, layerLayout) {
    const image = renderer.getAsset(assetPath);
    if (!image || typeof renderer.ctx?.drawImage !== 'function') return false;
    if (layerLayout?.version >= 2 || layerLayout?.mode === 'cropped' || layerLayout?.mode === 'stacked') {
      const layout = layerLayout.layers?.[key];
      if (!layout) return false;
      const base = layout.base || layout;
      const coordinateSize = Number(layerLayout.coordinateSize) || 512;
      const globalLayout = layerLayout.global || {};
      const offsetScale = baseFrame.size / coordinateSize;
      const globalScale = Number.isFinite(Number(globalLayout.scale)) ? Number(globalLayout.scale) : 1;
      const layerScale = Number.isFinite(Number(layout.scale)) ? Number(layout.scale) : 1;
      const sourceX = Number(base.x) || 0;
      const sourceY = Number(base.y) || 0;
      const sourceWidth = Number(base.width) || Number(image.naturalWidth || image.width || 0);
      const sourceHeight = Number(base.height) || Number(image.naturalHeight || image.height || 0);
      const layerWidth = sourceWidth * globalScale * layerScale * offsetScale;
      const layerHeight = sourceHeight * globalScale * layerScale * offsetScale;
      const centerOffsetX = ((sourceWidth * offsetScale) - layerWidth) / 2;
      const centerOffsetY = ((sourceHeight * offsetScale) - layerHeight) / 2;
      const layerX = baseFrame.x + sourceX * offsetScale + centerOffsetX + ((Number(layout.x) || 0) + (Number(globalLayout.x) || 0)) * offsetScale;
      const layerY = baseFrame.y + sourceY * offsetScale + centerOffsetY + ((Number(layout.y) || 0) + (Number(globalLayout.y) || 0)) * offsetScale;
      renderer.ctx.drawImage(image, layerX, layerY, layerWidth, layerHeight);
      return true;
    }
    const layout = layerLayout[key] || { scale: 1, x: 0, y: 0 };
    const layerScale = Number.isFinite(Number(layout.scale)) ? Number(layout.scale) : 1;
    const layerSize = baseFrame.size * layerScale;
    const offsetScale = baseFrame.size / 512;
    const layerX = baseFrame.x + (baseFrame.size - layerSize) / 2 + (Number(layout.x) || 0) * offsetScale;
    const layerY = baseFrame.y + (baseFrame.size - layerSize) / 2 + (Number(layout.y) || 0) * offsetScale;
    renderer.ctx.drawImage(image, layerX, layerY, layerSize, layerSize);
    return true;
  }

  function drawFamousPortrait(renderer, card = {}, x, y, size, options = {}) {
    const appearance = card.appearance || {};
    const rawLayers = appearance.layers && typeof appearance.layers === 'object' ? appearance.layers : {};
    if (!Object.values(rawLayers).some(Boolean) || !renderer.ctx) return false;

    const frameWidth = options.frameWidth || size;
    const frameHeight = options.frameHeight || size;
    const radius = options.radius ?? Math.max(4, size * 0.18);
    renderer.drawPanel(x, y, frameWidth, frameHeight, {
      fill: options.fill || 'rgba(80, 54, 33, 0.9)',
      stroke: options.stroke || 'rgba(240, 180, 91, 0.32)',
      radius,
      inset: options.inset || 'rgba(255, 231, 184, 0.08)',
    });

    const drawLayers = () => {
      const layerLayout = renderer.constructor.getFamousPortraitLayerLayout();
      const scale = options.scale || 1.45;
      const drawSize = size * scale;
      const drawX = x + (frameWidth - drawSize) / 2;
      const drawY = y + (frameHeight - drawSize) / 2 + size * (options.offsetY ?? 0.18);
      const baseFrame = { x: drawX, y: drawY, size: drawSize };
      const mode = options.mode || layerLayout.mode || 'current';
      let drawnAny = false;
      const drawLayer = (key) => {
        const assetPath = rawLayers[key];
        if (!assetPath) return;
        drawnAny = drawFamousPortraitLayer(renderer, assetPath, key, baseFrame, layerLayout) || drawnAny;
      };
      if (layerLayout.version >= 2 || mode === 'cropped' || mode === 'stacked') {
        const order = Array.isArray(layerLayout.order) ? layerLayout.order : ['outfit', 'face', 'hair'];
        order.forEach((key) => drawLayer(key));
      } else {
        drawLayer('outfit');
        drawLayer('face');
        drawLayer('hair');
      }
      return drawnAny;
    };

    const canClip = typeof renderer.ctx.save === 'function'
      && typeof renderer.ctx.restore === 'function'
      && typeof renderer.ctx.clip === 'function';
    if (!canClip) return drawLayers();
    renderer.ctx.save();
    renderer.roundRectPath(x, y, frameWidth, frameHeight, radius);
    renderer.ctx.clip();
    const drawnAny = drawLayers();
    renderer.ctx.restore();
    return drawnAny;
  }

  function drawFamousAttributeRadar(renderer, attributes = [], x, y, size) {
    if (!renderer.ctx) return;
    const items = Array.isArray(attributes) ? attributes.slice(0, 6) : [];
    if (items.length < 3) return;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size * 0.34;
    const start = -Math.PI / 2;
    const makePoints = (scale, useValues = false) => items.map((item, index) => {
      const angle = start + (Math.PI * 2 * index) / items.length;
      const valueRatio = useValues ? Math.max(0, Math.min(1, (Number(item.value) || 0) / 100)) : 1;
      const r = radius * scale * valueRatio;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        item,
      };
    });
    const drawPolygon = (points, fill, stroke, lineWidth = 1) => {
      if (!points.length || !renderer.ctx) return;
      renderer.ctx.beginPath();
      renderer.ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => renderer.ctx.lineTo(point.x, point.y));
      if (typeof renderer.ctx.closePath === 'function') renderer.ctx.closePath();
      else renderer.ctx.lineTo(points[0].x, points[0].y);
      if (fill) {
        renderer.ctx.fillStyle = fill;
        renderer.ctx.fill();
      }
      if (stroke) {
        renderer.ctx.strokeStyle = stroke;
        renderer.ctx.lineWidth = lineWidth;
        renderer.ctx.stroke();
      }
    };
    [1, 0.66, 0.33].forEach((scale) => {
      drawPolygon(makePoints(scale), '', scale === 1 ? 'rgba(255, 226, 177, 0.22)' : 'rgba(255, 226, 177, 0.1)');
    });
    items.forEach((item, index) => {
      const angle = start + (Math.PI * 2 * index) / items.length;
      renderer.drawLine(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, {
        color: 'rgba(255, 226, 177, 0.1)',
        width: 1,
      });
    });
    const valuePoints = makePoints(1, true);
    drawPolygon(valuePoints, 'rgba(116, 211, 160, 0.24)', '#74d3a0', 1.4);
    valuePoints.forEach((point) => {
      renderer.drawPanel(point.x - 2.5, point.y - 2.5, 5, 5, {
        fill: '#ffd98a',
        stroke: 'rgba(0, 0, 0, 0.22)',
        radius: 3,
      });
    });
    items.forEach((item, index) => {
      const angle = start + (Math.PI * 2 * index) / items.length;
      const labelX = cx + Math.cos(angle) * radius * 1.28;
      const labelY = cy + Math.sin(angle) * radius * 1.28;
      renderer.drawText(item.shortLabel || item.label || '', labelX, labelY - 5, {
        size: 8,
        bold: true,
        color: '#d8c8a0',
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText(String(Math.floor(Number(item.value) || 0)), labelX, labelY + 6, {
        size: 8,
        color: '#8fa0a4',
        align: 'center',
        baseline: 'middle',
      });
    });
  }

  function drawFamousAttributePointControls(renderer, card = {}, x, y, width) {
    if (!renderer.ctx || !card || !Array.isArray(card.attributes) || !card.freeAttributePoints) return 0;
    const actions = Array.isArray(card.attributeActions) ? card.attributeActions : [];
    if (!actions.length) return 0;
    const itemGap = 4;
    const itemHeight = 20;
    const colGap = 6;
    const colWidth = Math.max(44, Math.floor((width - colGap) / 2));
    const rows = Math.ceil(card.attributes.length / 2);
    card.attributes.forEach((attr, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const itemX = x + col * (colWidth + colGap);
      const itemY = y + row * (itemHeight + itemGap);
      const action = actions.find((entry) => entry.attribute === attr.key) || {
        type: 'assignFamousAttributePoint',
        personId: card.id || '',
        attribute: attr.key,
      };
      renderer.drawPanel(itemX, itemY, colWidth, itemHeight, {
        fill: 'rgba(31, 52, 41, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.22)',
        radius: 6,
      });
      renderer.drawText(`${attr.shortLabel || attr.label || ''}${Math.floor(Number(attr.value) || 0)}`, itemX + 6, itemY + itemHeight / 2, {
        size: 10,
        color: '#d8e8d5',
        baseline: 'middle',
      });
      const plusSize = 16;
      const plusX = itemX + colWidth - plusSize - 3;
      const plusY = itemY + 2;
      renderer.drawPanel(plusX, plusY, plusSize, plusSize, {
        fill: '#74d3a0',
        stroke: 'rgba(255, 255, 255, 0.18)',
        radius: 5,
      });
      renderer.drawText('+', plusX + plusSize / 2, plusY + plusSize / 2 - 1, {
        size: 13,
        bold: true,
        color: '#132218',
        align: 'center',
        baseline: 'middle',
      });
      renderer.addHitTarget({ x: itemX, y: itemY, width: colWidth, height: itemHeight }, action);
    });
    return rows * itemHeight + Math.max(0, rows - 1) * itemGap;
  }

  const api = {
    drawFamousPortraitLayer,
    drawFamousPortrait,
    drawFamousAttributeRadar,
    drawFamousAttributePointControls,
  };

  global.FamousPortraitCanvasRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  const sharedFamousPortraitLayout = (() => {
    if (global.FamousPortraitLayout) return global.FamousPortraitLayout;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/FamousPortraitLayout');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class FamousCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      return new Proxy(this, {
        get(target, prop, receiver) {
          const ownValue = Reflect.get(target, prop, receiver);
          if (ownValue !== undefined || prop in target) return ownValue;
          const host = target.host;
          if (host && prop in host) {
            const hostValue = host[prop];
            return typeof hostValue === 'function' ? hostValue.bind(host) : hostValue;
          }
          return undefined;
        },
        set(target, prop, value, receiver) {
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    static getFamousPortraitLayerLayout() {
      return sharedFamousPortraitLayout || {};
    }

    render(state = {}, options = {}) {
      return this.renderFamousPersonsPanel(state, options);
    }

    isSameFamousSkillTooltipAction(left = null, right = null) {
      return Boolean(left && right
        && left.type === 'showFamousSkillTooltip'
        && right.type === 'showFamousSkillTooltip'
        && left.cardId === right.cardId
        && left.skillIndex === right.skillIndex);
    }

    clearFamousSkillTooltip() {
      const changed = Boolean(this.hoverPoint || this.activeFamousSkillTooltip || this.pinnedFamousSkillTooltip);
      this.hoverPoint = null;
      this.activeFamousSkillTooltip = null;
      this.pinnedFamousSkillTooltip = null;
      return changed;
    }

    setPinnedFamousSkillTooltip(action = null) {
      if (!action || action.type !== 'showFamousSkillTooltip') {
        return this.clearFamousSkillTooltip();
      }
      if (this.isSameFamousSkillTooltipAction(this.pinnedFamousSkillTooltip, action)) {
        return this.clearFamousSkillTooltip();
      }
      this.pinnedFamousSkillTooltip = { ...action };
      return true;
    }

    getFamousSkillTooltipAction(point = {}) {
      if (!point) return null;
      for (let index = this.famousSkillHitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.famousSkillHitTargets[index];
        if (this.containsPoint(target, point)) return target.action || null;
      }
      return null;
    }


    drawFamousPortraitLayer(assetPath, key, baseFrame, layerLayout) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
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
        this.ctx.drawImage(image, layerX, layerY, layerWidth, layerHeight);
        return true;
      }
      const layout = layerLayout[key] || { scale: 1, x: 0, y: 0 };
      const layerScale = Number.isFinite(Number(layout.scale)) ? Number(layout.scale) : 1;
      const layerSize = baseFrame.size * layerScale;
      const offsetScale = baseFrame.size / 512;
      const layerX = baseFrame.x + (baseFrame.size - layerSize) / 2 + (Number(layout.x) || 0) * offsetScale;
      const layerY = baseFrame.y + (baseFrame.size - layerSize) / 2 + (Number(layout.y) || 0) * offsetScale;
      this.ctx.drawImage(image, layerX, layerY, layerSize, layerSize);
      return true;
    }

    drawFamousPortrait(card = {}, x, y, size, options = {}) {
      const appearance = card.appearance || {};
      const rawLayers = appearance.layers && typeof appearance.layers === 'object' ? appearance.layers : {};
      if (!Object.values(rawLayers).some(Boolean) || !this.ctx) return false;

      const frameWidth = options.frameWidth || size;
      const frameHeight = options.frameHeight || size;
      const radius = options.radius ?? Math.max(4, size * 0.18);
      this.drawPanel(x, y, frameWidth, frameHeight, {
        fill: options.fill || 'rgba(80, 54, 33, 0.9)',
        stroke: options.stroke || 'rgba(240, 180, 91, 0.32)',
        radius,
        inset: options.inset || 'rgba(255, 231, 184, 0.08)',
      });

      const drawLayers = () => {
        const layerLayout = this.constructor.getFamousPortraitLayerLayout();
        const globalLayout = layerLayout.global || {};
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
          drawnAny = this.drawFamousPortraitLayer(assetPath, key, baseFrame, layerLayout) || drawnAny;
        };
        if (layerLayout.version >= 2 || mode === 'cropped' || mode === 'stacked') {
          const order = Array.isArray(layerLayout.order)
            ? layerLayout.order
            : ['outfit', 'face', 'hair'];
          order.forEach((key) => drawLayer(key));
        } else {
          drawLayer('outfit');
          drawLayer('face');
          drawLayer('hair');
        }
        return drawnAny;
      };

      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) {
        return drawLayers();
      }
      this.ctx.save();
      this.roundRectPath(x, y, frameWidth, frameHeight, radius);
      this.ctx.clip();
      const drawnAny = drawLayers();
      this.ctx.restore();
      return drawnAny;
    }

    drawFamousAttributeRadar(attributes = [], x, y, size) {
      if (!this.ctx) return;
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
        if (!points.length || !this.ctx) return;
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => this.ctx.lineTo(point.x, point.y));
        if (typeof this.ctx.closePath === 'function') this.ctx.closePath();
        else this.ctx.lineTo(points[0].x, points[0].y);
        if (fill) {
          this.ctx.fillStyle = fill;
          this.ctx.fill();
        }
        if (stroke) {
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = lineWidth;
          this.ctx.stroke();
        }
      };
      [1, 0.66, 0.33].forEach((scale) => {
        drawPolygon(makePoints(scale), '', scale === 1 ? 'rgba(255, 226, 177, 0.22)' : 'rgba(255, 226, 177, 0.1)');
      });
      items.forEach((item, index) => {
        const angle = start + (Math.PI * 2 * index) / items.length;
        this.drawLine(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, {
          color: 'rgba(255, 226, 177, 0.1)',
          width: 1,
        });
      });
      const valuePoints = makePoints(1, true);
      drawPolygon(valuePoints, 'rgba(116, 211, 160, 0.24)', '#74d3a0', 1.4);
      valuePoints.forEach((point) => {
        this.drawPanel(point.x - 2.5, point.y - 2.5, 5, 5, {
          fill: '#ffd98a',
          stroke: 'rgba(0, 0, 0, 0.22)',
          radius: 3,
        });
      });
      items.forEach((item, index) => {
        const angle = start + (Math.PI * 2 * index) / items.length;
        const labelX = cx + Math.cos(angle) * radius * 1.28;
        const labelY = cy + Math.sin(angle) * radius * 1.28;
        this.drawText(item.shortLabel || item.label || '', labelX, labelY - 5, {
          size: 8,
          bold: true,
          color: '#d8c8a0',
          align: 'center',
          baseline: 'middle',
        });
        this.drawText(String(Math.floor(Number(item.value) || 0)), labelX, labelY + 6, {
          size: 8,
          color: '#8fa0a4',
          align: 'center',
          baseline: 'middle',
        });
      });
    }

    drawFamousAttributePointControls(card = {}, x, y, width) {
      if (!this.ctx || !card || !Array.isArray(card.attributes) || !card.freeAttributePoints) return 0;
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
        this.drawPanel(itemX, itemY, colWidth, itemHeight, {
          fill: 'rgba(31, 52, 41, 0.56)',
          stroke: 'rgba(116, 211, 160, 0.22)',
          radius: 6,
        });
        this.drawText(`${attr.shortLabel || attr.label || ''}${Math.floor(Number(attr.value) || 0)}`, itemX + 6, itemY + itemHeight / 2, {
          size: 10,
          color: '#d8e8d5',
          baseline: 'middle',
        });
        const plusSize = 16;
        const plusX = itemX + colWidth - plusSize - 3;
        const plusY = itemY + 2;
        this.drawPanel(plusX, plusY, plusSize, plusSize, {
          fill: '#74d3a0',
          stroke: 'rgba(255, 255, 255, 0.18)',
          radius: 5,
        });
        this.drawText('+', plusX + plusSize / 2, plusY + plusSize / 2 - 1, {
          size: 13,
          bold: true,
          color: '#132218',
          align: 'center',
          baseline: 'middle',
        });
        this.addHitTarget({ x: itemX, y: itemY, width: colWidth, height: itemHeight }, action);
      });
      return rows * itemHeight + Math.max(0, rows - 1) * itemGap;
    }

    getFamousQualityStyle(frame = 'white') {
      const styles = {
        gold: {
          fill: 'rgba(66, 49, 24, 0.96)',
          stroke: '#f2c45f',
          inset: 'rgba(255, 237, 160, 0.38)',
          glow: 'rgba(242, 196, 95, 0.22)',
          text: '#ffe6a3',
        },
        purple: {
          fill: 'rgba(48, 35, 63, 0.96)',
          stroke: '#b68cff',
          inset: 'rgba(214, 182, 255, 0.28)',
          glow: 'rgba(182, 140, 255, 0.18)',
          text: '#dec7ff',
        },
        blue: {
          fill: 'rgba(28, 45, 67, 0.96)',
          stroke: '#77b7ff',
          inset: 'rgba(145, 198, 255, 0.24)',
          glow: 'rgba(119, 183, 255, 0.16)',
          text: '#b9dcff',
        },
        white: {
          fill: 'rgba(43, 43, 42, 0.96)',
          stroke: '#d9d8cf',
          inset: 'rgba(255, 255, 255, 0.18)',
          glow: 'rgba(255, 255, 255, 0.1)',
          text: '#eeeee8',
        },
      };
      return styles[frame] || styles.white;
    }

    drawFamousAvatarCard(card = {}, x, y, width, height, options = {}) {
      const style = this.getFamousQualityStyle(card.qualityFrame);
      const selected = Boolean(options.selected);
      this.drawPanel(x - 2, y - 2, width + 4, height + 4, {
        fill: selected ? style.glow : 'rgba(0, 0, 0, 0.18)',
        stroke: selected ? style.stroke : 'rgba(255, 255, 255, 0.06)',
        radius: 10,
      });
      this.drawPanel(x, y, width, height, {
        fill: style.fill,
        stroke: style.stroke,
        radius: 9,
        inset: style.inset,
      });
      const portraitSize = Math.min(width - 14, height - 42);
      const portraitX = x + (width - portraitSize) / 2;
      const portraitY = y + 7;
      const portraitDrawn = this.drawFamousPortrait(card, portraitX, portraitY, portraitSize, {
        radius: 8,
        scale: 1.84,
        offsetY: 0.12,
        fill: 'rgba(23, 20, 17, 0.8)',
        stroke: style.stroke,
      });
      if (!portraitDrawn) {
        this.drawText(String(card.name || '名').slice(0, 1), x + width / 2, portraitY + portraitSize / 2, {
          size: 18,
          bold: true,
          color: style.text,
          baseline: 'middle',
          align: 'center',
        });
      }
      const badgeText = card.qualityLabel || '';
      if (badgeText) {
        const badgeW = Math.min(width - 16, Math.max(34, badgeText.length * 12 + 12));
        this.drawPanel(x + 6, y + 6, badgeW, 18, {
          fill: 'rgba(15, 14, 12, 0.7)',
          stroke: style.stroke,
          radius: 6,
        });
        this.drawText(badgeText, x + 6 + badgeW / 2, y + 15, {
          size: 9,
          bold: true,
          color: style.text,
          baseline: 'middle',
          align: 'center',
        });
      }
      const freePoints = Number(card.freeAttributePoints) || 0;
      if (freePoints > 0) {
        const dotSize = 22;
        this.drawPanel(x + width - dotSize - 4, y + 4, dotSize, dotSize, {
          fill: '#e94560',
          stroke: 'rgba(255, 255, 255, 0.24)',
          radius: 11,
        });
        this.drawText(String(Math.min(99, freePoints)), x + width - dotSize / 2 - 4, y + 15, {
          size: 10,
          bold: true,
          color: '#fff',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.truncateText(card.name || '无名之士', width - 10, { size: 11, bold: true }), x + width / 2, y + height - 28, {
        size: 11,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      this.drawText(`Lv.${card.level || 1}`, x + width / 2, y + height - 12, {
        size: 9,
        color: freePoints > 0 ? '#f4c86d' : 'rgba(234, 234, 234, 0.62)',
        align: 'center',
      });
      this.addHitTarget(
        { x, y, width, height },
        card.openDetailAction || { type: 'openFamousPersonDetail', personId: card.id || '' },
      );
    }

    renderFamousRosterGrid(people = [], x, y, width, maxBottom, page = 0) {
      if (!Array.isArray(people) || !people.length) return { nextY: y, pageInfo: { index: 0, pages: 1 } };
      const gap = 8;
      const columns = width >= 330 ? 3 : 2;
      const cardWidth = Math.floor((width - gap * (columns - 1)) / columns);
      const cardHeight = 118;
      const rowHeight = cardHeight + gap;
      const pagerReserve = people.length > columns * 2 ? 34 : 0;
      const availableHeight = Math.max(rowHeight, maxBottom - y - pagerReserve);
      const rows = Math.max(1, Math.floor(availableHeight / rowHeight));
      const pageSize = Math.max(columns, columns * rows);
      const pageInfo = this.normalizeFamousPersonsPage(people.length, page, pageSize);
      people.slice(pageInfo.index * pageSize, pageInfo.index * pageSize + pageSize).forEach((card, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const cardX = x + col * (cardWidth + gap);
        const cardY = y + row * rowHeight;
        this.drawFamousAvatarCard(card, cardX, cardY, cardWidth, cardHeight);
      });
      const usedRows = Math.ceil(Math.min(pageSize, people.length - pageInfo.index * pageSize) / columns);
      return {
        nextY: y + usedRows * rowHeight,
        pageInfo,
      };
    }

    renderFamousPersonDetail(card = {}, x, y, width, height) {
      const style = this.getFamousQualityStyle(card.qualityFrame);
      const headerH = 144;
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(23, 21, 18, 0.74)',
        stroke: style.stroke,
        radius: 10,
        inset: style.inset,
      });
      const portraitW = 96;
      const portraitH = 116;
      const portraitX = x + 12;
      const portraitY = y + 10;
      this.drawPanel(portraitX, portraitY, portraitW, portraitH, {
        fill: style.fill,
        stroke: style.stroke,
        radius: 10,
        inset: style.inset,
      });
      this.drawFamousPortrait(card, portraitX, portraitY, Math.min(portraitW, portraitH), {
        radius: 10,
        scale: 1.75,
        offsetY: 0.12,
        frameWidth: portraitW,
        frameHeight: portraitH,
        fill: style.fill,
        stroke: style.stroke,
      });
      const textX = portraitX + portraitW + 12;
      const textWidth = width - portraitW - 38;
      this.drawText(this.truncateText(card.name || '无名之士', textWidth, { size: 18, bold: true }), textX, y + 15, {
        size: 18,
        bold: true,
        color: '#fff1cf',
      });
      this.drawText(this.truncateText(card.title || '名人', textWidth, { size: 11 }), textX, y + 41, {
        size: 11,
        color: '#cbbd96',
      });
      this.drawText(`${card.qualityLabel || '一般'} · ${card.roleText || '人才'} · ${card.statusText || '待命'}`, textX, y + 61, {
        size: 10,
        color: style.text,
      });
      this.drawText(card.growthText || `等级 ${card.level || 1}`, textX, y + 82, {
        size: 11,
        color: '#f4c86d',
      });
      this.drawText(card.pointText || '可分配属性点 0', textX, y + 101, {
        size: 11,
        bold: true,
        color: Number(card.freeAttributePoints) > 0 ? '#f4c86d' : 'rgba(234, 234, 234, 0.62)',
      });
      if (card.attributePointHint) {
        this.drawText(this.truncateText(card.attributePointHint, textWidth, { size: 10 }), textX, y + 118, {
          size: 10,
          color: Number(card.freeAttributePoints) > 0 ? '#ffd98a' : '#aeb0b8',
        });
      }
      if (card.autoGrowthText) {
        this.drawText(this.truncateText(card.autoGrowthText, textWidth, { size: 10 }), textX, y + 136, {
          size: 10,
          color: '#74d3a0',
        });
      }

      const radarSize = 118;
      const radarX = x + width - radarSize - 14;
      const radarY = y + headerH + 12;
      this.drawFamousAttributeRadar(card.attributes || [], radarX, radarY, radarSize);
      const attrX = x + 14;
      const attrY = y + headerH + 14;
      const attrWidth = Math.max(150, radarX - attrX - 12);
      this.drawText('六维', attrX, attrY - 2, { size: 13, bold: true, color: '#ffe6b5' });
      const controlsHeight = this.drawFamousAttributePointControls(card, attrX, attrY + 18, attrWidth);
      if (!controlsHeight) {
        const rowGap = 6;
        const rowH = 22;
        const colW = Math.floor((attrWidth - 8) / 2);
        (card.attributes || []).forEach((attr, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const itemX = attrX + col * (colW + 8);
          const itemY = attrY + 18 + row * (rowH + rowGap);
          this.drawPanel(itemX, itemY, colW, rowH, {
            fill: 'rgba(31, 52, 41, 0.42)',
            stroke: 'rgba(116, 211, 160, 0.16)',
            radius: 6,
          });
          this.drawText(`${attr.label || ''} ${Math.floor(Number(attr.value) || 0)}`, itemX + 7, itemY + rowH / 2, {
            size: 10,
            color: '#d8e8d5',
            baseline: 'middle',
          });
        });
      }

      const skillY = Math.min(y + height - 92, y + headerH + 150);
      this.drawText('技能', x + 14, skillY, { size: 13, bold: true, color: '#ffe6b5' });
      const skillDetails = Array.isArray(card.skillDetails) ? card.skillDetails : [];
      const badges = Array.isArray(card.skillBadges) ? card.skillBadges : [];
      badges.slice(0, 2).forEach((badge, index) => {
        const skill = skillDetails[index] || {};
        const badgeY = skillY + 20 + index * 30;
        const badgeH = 24;
        this.drawPanel(x + 14, badgeY, width - 28, badgeH, {
          fill: index === 0 ? 'rgba(47, 92, 69, 0.54)' : 'rgba(96, 73, 35, 0.54)',
          stroke: index === 0 ? 'rgba(116, 211, 160, 0.28)' : 'rgba(255, 217, 138, 0.28)',
          radius: 7,
        });
        this.drawText(this.truncateText(badge.text || skill.name || '技能', width - 46, { size: 11, bold: true }), x + 24, badgeY + badgeH / 2, {
          size: 11,
          bold: true,
          color: index === 0 ? '#bdf2cf' : '#ffe0a3',
          baseline: 'middle',
        });
        const action = {
          type: 'showFamousSkillTooltip',
          cardId: card.id || '',
          skillIndex: index,
          skill,
        };
        const rect = { x: x + 14, y: badgeY, width: width - 28, height: badgeH };
        this.famousSkillHitTargets.push({ ...rect, action });
        this.addHitTarget(rect, action);
        if (this.hoverPoint && this.containsPoint(rect, this.hoverPoint)) this.activeFamousSkillTooltip = action;
      });
    }


    renderFamousPersonItem(card = {}, x, y, width, options = {}) {
      const candidate = Boolean(options.candidate);
      const hasAttributeControls = !candidate && Number(card.freeAttributePoints) > 0 && Array.isArray(card.attributeActions) && card.attributeActions.length > 0;
      const height = candidate ? 136 : (hasAttributeControls ? 204 : (card.pointText ? 136 : 124));
      this.drawPanel(x, y, width, height, {
        fill: candidate ? 'rgba(52, 39, 27, 0.86)' : 'rgba(27, 23, 18, 0.74)',
        stroke: candidate ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.12)',
        radius: 8,
        inset: candidate ? 'rgba(255, 231, 184, 0.08)' : 'rgba(255, 231, 184, 0.04)',
      });
      const portraitWidth = 74;
      const portraitHeight = 98;
      const portraitX = x + 10;
      const portraitY = y + 10;
      this.drawPanel(portraitX, portraitY, portraitWidth, portraitHeight, {
        fill: 'rgba(44, 32, 23, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.32)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      const portraitDrawn = this.drawFamousPortrait(card, portraitX, portraitY, Math.min(portraitWidth, portraitHeight), {
        radius: 10,
        scale: 1.74,
        offsetY: 0.14,
        fill: 'rgba(44, 32, 23, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.32)',
        frameWidth: portraitWidth,
        frameHeight: portraitHeight,
      });
      if (!portraitDrawn) {
        this.drawText(String(card.name || '名').slice(0, 1), portraitX + portraitWidth / 2, portraitY + portraitHeight / 2, {
          size: 18,
          bold: true,
          color: '#ffe6b5',
          baseline: 'middle',
          align: 'center',
        });
      }
      const textX = x + 96;
      const buttonW = candidate ? 58 : 0;
      const actionPad = candidate ? buttonW + 20 : 0;
      const radarSize = Math.min(92, Math.max(74, width * 0.24));
      const radarX = x + width - radarSize - 10 - actionPad;
      const radarY = y + (height - radarSize) / 2 + (candidate ? -3 : 0);
      const textWidth = Math.max(112, radarX - textX - 10);
      this.drawText(this.truncateText(card.name || '无名之士', textWidth, { size: 15, bold: true }), textX, y + 13, {
        size: 15,
        bold: true,
        color: '#fff1cf',
      });
      this.drawText(this.truncateText(card.title || '名人', textWidth, { size: 10 }), textX, y + 35, {
        size: 10,
        color: '#cbbd96',
      });
      if (!candidate && card.growthText) {
        const growthColor = card.pointText ? '#f4c86d' : 'rgba(234, 234, 234, 0.64)';
        this.drawText(this.truncateText(card.growthText, textWidth, { size: 10 }), textX, y + 48, {
          size: 10,
          color: growthColor,
        });
        if (card.pointText) {
          this.drawText(this.truncateText(card.pointText, textWidth, { size: 10, bold: true }), textX, y + 61, {
            size: 10,
            bold: true,
            color: '#f4c86d',
          });
        }
      }
      this.drawFamousAttributeRadar(card.attributes || [], radarX, radarY, radarSize);
      const attributeControlHeight = hasAttributeControls
        ? this.drawFamousAttributePointControls(card, textX, y + 78, textWidth)
        : 0;
      const skillDetails = Array.isArray(card.skillDetails) && card.skillDetails.length
        ? card.skillDetails
        : (Array.isArray(card.skills) ? card.skills.map((skill) => ({ name: skill, kindText: '技能', effectText: '', meta: '', summary: skill })) : []);
      const skillBadges = Array.isArray(card.skillBadges) && card.skillBadges.length
        ? card.skillBadges
        : skillDetails.map((skill) => ({
          id: skill.id,
          label: skill.kindText || '技能',
          name: skill.name || '技能',
          text: `${skill.kindText || '技能'}：${skill.name || '技能'}`,
        }));
      skillBadges.slice(0, 2).forEach((badge, index) => {
        const skill = skillDetails[index] || {};
        const badgeY = y + (
          candidate
            ? 58
            : hasAttributeControls
              ? 86 + attributeControlHeight
              : (card.pointText ? 76 : 64)
        ) + index * 27;
        const badgeH = 22;
        this.drawPanel(textX, badgeY, textWidth, badgeH, {
          fill: index === 0 ? 'rgba(47, 92, 69, 0.54)' : 'rgba(96, 73, 35, 0.54)',
          stroke: index === 0 ? 'rgba(116, 211, 160, 0.28)' : 'rgba(255, 217, 138, 0.28)',
          radius: 7,
        });
        this.drawText(this.truncateText(badge.text || skill.name || '技能', textWidth - 16, { size: 10, bold: true }), textX + 8, badgeY + badgeH / 2, {
          size: 10,
          bold: true,
          color: index === 0 ? '#bdf2cf' : '#ffe0a3',
          baseline: 'middle',
        });
        const action = {
          type: 'showFamousSkillTooltip',
          cardId: card.id || '',
          skillIndex: index,
          skill,
        };
        const rect = { x: textX, y: badgeY, width: textWidth, height: badgeH };
        this.famousSkillHitTargets.push({ ...rect, action });
        this.addHitTarget(rect, action);
        if (this.hoverPoint && this.containsPoint(rect, this.hoverPoint)) this.activeFamousSkillTooltip = action;
      });
      if (candidate) {
        const acceptX = x + width - buttonW - 10;
        this.drawButton(acceptX, y + 30, buttonW, 28, '接纳', { size: 12, bold: true, active: true, radius: 8 });
        this.drawButton(acceptX, y + 70, buttonW, 28, '放弃', { size: 12, radius: 8 });
        this.addHitTarget({ x: acceptX, y: y + 30, width: buttonW, height: 28 }, card.acceptAction);
        this.addHitTarget({ x: acceptX, y: y + 70, width: buttonW, height: 28 }, card.dismissAction);
      }
      return y + height + 10;
    }

    renderFamousSkillTooltip(action = null) {
      const skill = action?.skill;
      if (!skill || !this.ctx) return;
      const width = Math.min(300, Math.max(238, this.width - 44));
      const lines = [
        skill.description ? `效果：${skill.description}` : '',
        skill.meta ? skill.meta : '',
      ].filter(Boolean);
      const wrapped = lines.flatMap((line) => this.wrapTextLimit(line, width - 28, 4, { size: 11 }));
      const height = Math.min(164, 50 + wrapped.length * 16);
      const anchor = this.famousSkillHitTargets.find((target) => (
        target.action?.cardId === action.cardId
        && target.action?.skillIndex === action.skillIndex
      ));
      const preferredX = anchor ? anchor.x : Math.max(16, (this.width - width) / 2);
      const preferredY = anchor ? anchor.y - height - 8 : 80;
      const tooltipX = Math.max(14, Math.min(this.width - width - 14, preferredX));
      const tooltipY = Math.max(58, Math.min(this.height - height - 18, preferredY));
      this.drawPanel(tooltipX, tooltipY, width, height, {
        fill: 'rgba(16, 18, 16, 0.96)',
        stroke: 'rgba(116, 211, 160, 0.36)',
        radius: 8,
        inset: 'rgba(255, 255, 255, 0.05)',
      });
      this.drawText(`${skill.kindText || '技能'} · ${skill.name || '技能'}`, tooltipX + 14, tooltipY + 14, {
        size: 13,
        bold: true,
        color: '#fff1cf',
      });
      this.drawTextLines(wrapped.slice(0, 7), tooltipX + 14, tooltipY + 38, {
        size: 11,
        color: '#cbd6c8',
        lineHeight: 16,
      });
    }

    normalizeFamousPersonsPage(total, page, pageSize) {
      const pages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
      const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
      return { index, pages };
    }

    renderFamousPersonsPager(x, y, width, page, pages) {
      if (pages <= 1) return;
      const buttonW = 64;
      const buttonH = 24;
      const prevX = x;
      const nextX = x + width - buttonW;
      const canPrev = page > 0;
      const canNext = page < pages - 1;
      this.drawButton(prevX, y, buttonW, buttonH, '上一页', { disabled: !canPrev, size: 11, radius: 7 });
      this.drawText(`${page + 1}/${pages}`, x + width / 2, y + buttonH / 2, {
        size: 11,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      this.drawButton(nextX, y, buttonW, buttonH, '下一页', { disabled: !canNext, size: 11, radius: 7 });
      this.addHitTarget({ x: prevX, y, width: buttonW, height: buttonH }, { type: 'changeFamousPersonsPage', delta: -1, disabled: !canPrev });
      this.addHitTarget({ x: nextX, y, width: buttonW, height: buttonH }, { type: 'changeFamousPersonsPage', delta: 1, disabled: !canNext });
    }

    renderFamousPersonsPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildFamousPersonViewState !== 'function') return;
      const view = this.presenter.buildFamousPersonViewState(state, {
        selectedPersonId: options.selectedFamousPersonId,
      });
      const layout = this.getLayout();
      const panelWidth = Math.min(390, layout.contentWidth - 6);
      const panelHeight = Math.min(620, Math.max(470, this.height - 112));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(48, (this.height - panelHeight) / 2 - 8);
      const selectedPerson = view.selectedPerson || null;

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeFamousPersons' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(49, 38, 26, 0.99)'],
            [1, 'rgba(20, 18, 15, 0.99)'],
          ],
          'rgba(34, 27, 21, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget(
        { x, y, width: panelWidth, height: panelHeight },
        this.pinnedFamousSkillTooltip ? { type: 'clearFamousSkillTooltip' } : { type: 'blockCanvasModal' },
      );

      const backW = 58;
      this.drawButton(x + 12, y + 12, backW, 30, '返回', { size: 12, radius: 8 });
      this.addHitTarget(
        { x: x + 12, y: y + 12, width: backW, height: 30 },
        selectedPerson ? { type: 'closeFamousPersonDetail' } : { type: 'closeFamousPersons' },
      );
      this.drawText(view.title || '名人', x + panelWidth / 2, y + 18, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      this.drawText(this.truncateText(view.subtitle || '', panelWidth - 32, { size: 11 }), x + panelWidth / 2, y + 46, {
        size: 11,
        color: '#cbbd96',
        align: 'center',
      });

      const innerX = x + 14;
      const innerWidth = panelWidth - 28;
      let cursorY = y + 72;

      if (selectedPerson) {
        this.renderFamousPersonDetail(selectedPerson, innerX, cursorY, innerWidth, y + panelHeight - 90 - cursorY);
        const hoverTooltip = this.hoverPoint ? this.getFamousSkillTooltipAction(this.hoverPoint) : null;
        if (hoverTooltip) this.activeFamousSkillTooltip = hoverTooltip;
        const pinnedStillVisible = this.pinnedFamousSkillTooltip
          && this.famousSkillHitTargets.some((target) => (
            this.isSameFamousSkillTooltipAction(target.action, this.pinnedFamousSkillTooltip)
          ));
        if (!pinnedStillVisible) this.pinnedFamousSkillTooltip = null;
        this.renderFamousSkillTooltip(this.activeFamousSkillTooltip || this.pinnedFamousSkillTooltip);
        return;
      }

      this.drawPanel(innerX, cursorY, innerWidth, 58, {
        fill: 'rgba(24, 22, 17, 0.62)',
        stroke: 'rgba(240, 180, 91, 0.2)',
        radius: 9,
      });
      this.drawText(`已加入 ${view.peopleCount} 位 · 候选 ${view.candidateCount}/${view.maxCandidates}`, innerX + 12, cursorY + 10, {
        size: 12,
        bold: true,
        color: '#ffd98a',
      });
      this.drawText(this.truncateText(view.seek.message || '', innerWidth - 104, { size: 10 }), innerX + 12, cursorY + 33, {
        size: 10,
        color: '#aeb0b8',
      });
      const seekW = 82;
      const seekX = innerX + innerWidth - seekW - 10;
      this.drawButton(seekX, cursorY + 14, seekW, 30, view.seek.text || '寻访', {
        disabled: !view.seek.available,
        active: view.seek.available,
        size: 12,
        bold: true,
        radius: 8,
      });
      this.addHitTarget({ x: seekX, y: cursorY + 14, width: seekW, height: 30 }, view.seek.action);
      cursorY += 72;

      const candidates = Array.isArray(view.candidates) ? view.candidates : [];
      if (candidates.length) {
        this.drawText('候选', innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
        cursorY += 22;
        candidates.slice(0, 2).forEach((card) => {
          if (cursorY + 158 > y + panelHeight - 94) return;
          cursorY = this.renderFamousPersonItem(card, innerX, cursorY, innerWidth, { candidate: true });
        });
      }

      const people = Array.isArray(view.people) ? view.people : [];
      this.drawText('已加入', innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
      cursorY += 22;
      if (!people.length) {
        this.drawPanel(innerX, cursorY, innerWidth, 78, {
          fill: 'rgba(27, 23, 18, 0.6)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 9,
        });
        this.drawTextLines(this.wrapTextLimit(view.emptyText || '', innerWidth - 28, 2, { size: 12 }), innerX + 14, cursorY + 18, {
          size: 12,
          color: '#aeb0b8',
          lineHeight: 17,
        });
      } else {
        const grid = this.renderFamousRosterGrid(
          people,
          innerX,
          cursorY,
          innerWidth,
          y + panelHeight - 52,
          options.famousPersonsPage,
        );
        const pageInfo = grid.pageInfo;
        if (pageInfo.pages > 1) this.renderFamousPersonsPager(innerX, y + panelHeight - 42, innerWidth, pageInfo.index, pageInfo.pages);
      }
      const hoverTooltip = this.hoverPoint ? this.getFamousSkillTooltipAction(this.hoverPoint) : null;
      if (hoverTooltip) this.activeFamousSkillTooltip = hoverTooltip;
      const pinnedStillVisible = this.pinnedFamousSkillTooltip
        && this.famousSkillHitTargets.some((target) => (
          this.isSameFamousSkillTooltipAction(target.action, this.pinnedFamousSkillTooltip)
        ));
      if (!pinnedStillVisible) this.pinnedFamousSkillTooltip = null;
      this.renderFamousSkillTooltip(this.activeFamousSkillTooltip || this.pinnedFamousSkillTooltip);
    }

    renderTalentPolicyPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTalentPolicyViewState !== 'function') return;
      const view = this.presenter.buildTalentPolicyViewState(state, options.talentPolicyUiState || {});
      const layout = this.getLayout();
      const panelWidth = Math.min(380, layout.contentWidth - 10);
      const panelHeight = Math.min(612, Math.max(500, this.height - 150));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(52, (this.height - panelHeight) / 2 - 8);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTalentPolicy' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(49, 38, 26, 0.99)'],
            [1, 'rgba(20, 18, 15, 0.99)'],
          ],
          'rgba(34, 27, 21, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText(view.text.title, x + 18, y + 16, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(this.truncateText(view.text.subtitle, panelWidth - 76, { size: 12 }), x + 18, y + 43, {
        size: 12,
        color: '#cbbd96',
      });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeTalentPolicy' });

      const innerX = x + 14;
      const innerWidth = panelWidth - 28;
      let cursorY = y + 72;
      this.drawPanel(innerX, cursorY, innerWidth, 44, {
        fill: 'rgba(24, 22, 17, 0.62)',
        stroke: 'rgba(116, 211, 160, 0.22)',
        radius: 8,
      });
      this.drawText('预览', innerX + 12, cursorY + 9, { size: 12, bold: true, color: '#74d3a0' });
      this.drawText(
        this.truncateText(view.preview.allocationText || '暂无人才', innerWidth - 74, { size: 13, bold: true }),
        innerX + 64,
        cursorY + 22,
        { size: 13, bold: true, color: '#fff1cf', baseline: 'middle' },
      );
      cursorY += 58;

      this.drawText(view.text.presetTitle, innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
      cursorY += 22;
      const presets = (view.systemPolicies || []).slice(0, 5);
      const presetGap = 6;
      const presetHeight = 34;
      const presetWidth = Math.max(84, Math.floor((innerWidth - presetGap) / 2));
      presets.forEach((policy, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const buttonX = innerX + column * (presetWidth + presetGap);
        const buttonY = cursorY + row * (presetHeight + presetGap);
        const width = column === 1 ? innerX + innerWidth - buttonX : presetWidth;
        const selected = Boolean(policy.selected);
        const active = Boolean(policy.active);
        this.drawButton(buttonX, buttonY, width, presetHeight, this.truncateText(policy.label, width - 12, { size: 12, bold: true }), {
          disabled: policy.disabled,
          active: selected,
          size: 12,
          bold: selected || active,
          radius: 8,
        });
        if (selected && !active) {
          this.drawText('预览', buttonX + width - 18, buttonY + 8, {
            size: 9,
            bold: true,
            color: '#74d3a0',
            align: 'center',
            baseline: 'middle',
          });
        }
        if (active) {
          this.drawText('当前', buttonX + width - 18, buttonY + 8, {
            size: 9,
            bold: true,
            color: '#ffd98a',
            align: 'center',
            baseline: 'middle',
          });
        }
        this.addHitTarget(
          { x: buttonX, y: buttonY, width, height: presetHeight },
          { type: 'selectTalentPolicyBase', policyId: policy.id, resetTiers: true, disabled: policy.disabled },
        );
      });
      cursorY += Math.ceil(presets.length / 2) * (presetHeight + presetGap) + 10;

      const customPolicies = view.customPolicies || [];
      this.drawText('已保存', innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
      cursorY += 20;
      if (!customPolicies.length) {
        this.drawPanel(innerX, cursorY, innerWidth, 34, {
          fill: 'rgba(23, 18, 13, 0.38)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawText(view.text.emptyCustom, innerX + 12, cursorY + 17, {
          size: 12,
          color: '#aeb0b8',
          baseline: 'middle',
        });
        cursorY += 44;
      } else {
        customPolicies.slice(0, 2).forEach((policy) => {
          const rowHeight = 36;
          const applyWidth = 54;
          const deleteWidth = 44;
          const applyX = innerX + innerWidth - applyWidth - deleteWidth - 8;
          const deleteX = innerX + innerWidth - deleteWidth;
          this.drawPanel(innerX, cursorY, innerWidth, rowHeight, {
            fill: policy.active ? 'rgba(64, 49, 27, 0.82)' : 'rgba(27, 22, 17, 0.72)',
            stroke: policy.active ? 'rgba(247, 215, 116, 0.42)' : 'rgba(255, 226, 177, 0.12)',
            radius: 8,
          });
          this.drawText(this.truncateText(policy.label, applyX - innerX - 18, { size: 12, bold: true }), innerX + 10, cursorY + 18, {
            size: 12,
            bold: true,
            color: policy.active ? '#ffd98a' : '#fff1cf',
            baseline: 'middle',
          });
          this.drawButton(applyX, cursorY + 5, applyWidth, 26, '应用', { size: 11, active: !policy.active, radius: 7 });
          this.drawButton(deleteX, cursorY + 5, deleteWidth, 26, '删', { size: 11, radius: 7 });
          this.addHitTarget({ x: applyX, y: cursorY + 5, width: applyWidth, height: 26 }, { type: 'applyTalentPolicy', policyId: policy.id });
          this.addHitTarget({ x: deleteX, y: cursorY + 5, width: deleteWidth, height: 26 }, { type: 'deleteTalentPolicy', policyId: policy.id });
          cursorY += rowHeight + 8;
        });
      }

      const draftBottom = y + panelHeight - 16;
      const actionHeight = 34;
      const actionY = draftBottom - actionHeight;
      const tuningBottom = actionY - 10;
      this.drawText(view.text.customTitle, innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
      this.drawText(this.truncateText(view.text.customName, innerWidth - 104, { size: 12, bold: true }), innerX + 92, cursorY + 1, {
        size: 12,
        bold: true,
        color: '#74d3a0',
      });
      cursorY += 24;
      const tierRowHeight = 30;
      (view.tendencies || []).slice(0, 3).forEach((tendency) => {
        if (cursorY + tierRowHeight > tuningBottom) return;
        this.drawText(tendency.label, innerX + 2, cursorY + 15, {
          size: 12,
          bold: true,
          color: tendency.disabled ? '#8d8f99' : '#fff1cf',
          baseline: 'middle',
        });
        const tierButtonWidth = 44;
        const tierGap = 5;
        [1, 2, 3].forEach((tier, index) => {
          const tierX = innerX + innerWidth - (3 - index) * tierButtonWidth - (2 - index) * tierGap;
          const active = Number(tendency.tier) === tier;
          const label = { 1: '低', 2: '稳', 3: '高' }[tier];
          this.drawButton(tierX, cursorY, tierButtonWidth, tierRowHeight, label, {
            disabled: tendency.disabled,
            active,
            size: 11,
            bold: active,
            radius: 7,
          });
          this.addHitTarget(
            { x: tierX, y: cursorY, width: tierButtonWidth, height: tierRowHeight },
            { type: 'setTalentPolicyTier', tendency: tendency.id, tier, disabled: tendency.disabled },
          );
        });
        cursorY += tierRowHeight + 7;
      });

      const basePolicies = (view.systemPolicies || []).slice(0, 4);
      const baseButtonHeight = 24;
      if (basePolicies.length && cursorY + baseButtonHeight + 6 <= tuningBottom) {
        this.drawText('底稿', innerX + 2, cursorY + 12, {
          size: 11,
          bold: true,
          color: '#cbbd96',
          baseline: 'middle',
        });
        const availableWidth = innerWidth - 42;
        const baseGap = 4;
        const baseWidth = Math.max(50, Math.floor((availableWidth - baseGap * (basePolicies.length - 1)) / basePolicies.length));
        basePolicies.forEach((policy, index) => {
          const buttonX = innerX + 42 + index * (baseWidth + baseGap);
          const buttonWidth = index === basePolicies.length - 1
            ? innerX + innerWidth - buttonX
            : baseWidth;
          const active = policy.id === view.draft?.basePolicyId;
          this.drawButton(buttonX, cursorY, buttonWidth, baseButtonHeight, this.truncateText(policy.label, buttonWidth - 8, { size: 10, bold: active }), {
            disabled: policy.disabled,
            active,
            size: 10,
            bold: active,
            radius: 7,
          });
          this.addHitTarget(
            { x: buttonX, y: cursorY, width: buttonWidth, height: baseButtonHeight },
            { type: 'selectTalentPolicyBase', policyId: policy.id, disabled: policy.disabled },
          );
        });
        cursorY += baseButtonHeight + 6;
      }

      const applyWidth = Math.floor((innerWidth - 8) / 2);
      this.drawPrimaryActionButton(innerX, actionY, applyWidth, actionHeight, view.text.applyDraft, { radius: 8 });
      this.drawButton(innerX + applyWidth + 8, actionY, innerWidth - applyWidth - 8, actionHeight, view.text.saveDraft, {
        size: 12,
        bold: true,
        active: true,
        radius: 8,
      });
      this.addHitTarget({ x: innerX, y: actionY, width: applyWidth, height: actionHeight }, { type: 'confirmTalentPolicy' });
      this.addHitTarget({ x: innerX + applyWidth + 8, y: actionY, width: innerWidth - applyWidth - 8, height: actionHeight }, { type: 'saveTalentPolicyDraft' });
    }


  }

  if (typeof module !== 'undefined' && module.exports) module.exports = FamousCanvasRenderer;
  else global.FamousCanvasRenderer = FamousCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

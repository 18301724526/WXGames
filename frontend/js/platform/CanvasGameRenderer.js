(function (global) {
  const sharedFamousPortraitLayout = (() => {
    if (global.FamousPortraitLayout) return global.FamousPortraitLayout;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/FamousPortraitLayout');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasGameRenderer {
    constructor(options = {}) {
      this.presenter = options.presenter || null;
      this.ctx = options.ctx || null;
      this.canvas = options.canvas || null;
      this.pixelRatio = options.pixelRatio || 1;
      this.width = options.width || 390;
      this.height = options.height || 844;
      this.maxContentWidth = options.maxContentWidth || 480;
      this.edgePadding = options.edgePadding || 12;
      this.bottomSafeArea = options.bottomSafeArea || 12;
      this.assetCache = new Map();
      this.assetsChangedHandler = null;
      this.hitTargets = [];
      this.suppressHitTargets = false;
      this.frameNow = 0;
      this.fpsLastFrameAt = 0;
      this.fpsSamples = [];
      this.currentFps = 0;
      this.fpsLastPaintAt = 0;
      this.fpsLastPaintedValue = 0;
      this.showFpsOverlay = options.showFpsOverlay !== false;
      this.lastTechTreeScroll = null;
      if (this.ctx && typeof this.ctx.scale === 'function') this.ctx.scale(1, 1);
    }

    static getFamousPortraitLayerLayout() {
      return sharedFamousPortraitLayout || {};
    }

    static getAssetRequestPath(assetPath) {
      if (!assetPath) return assetPath;
      const layout = this.getFamousPortraitLayerLayout();
      const assetVersion = layout.assetVersion;
      if (!assetVersion || typeof assetPath !== 'string') return assetPath;
      if (!assetPath.startsWith('assets/art/famous-person/layers/')) return assetPath;
      const separator = assetPath.includes('?') ? '&' : '?';
      return `${assetPath}${separator}v=${encodeURIComponent(assetVersion)}`;
    }

    static getPreloadAssetPaths() {
      return [
        'assets/art/civilization-bg.webp',
        'assets/art/icon-home-cutout.png',
        'assets/art/icon-fire-cutout.webp',
        'assets/art/icon-wood-cutout.webp',
        'assets/art/icon-iron-cutout.webp',
        'assets/art/icon-stone-cutout.webp',
        'assets/art/icon-food-cutout.webp',
        'assets/art/icon-knowledge-cutout.webp',
        'assets/art/icon-population-cutout.webp',
        'assets/art/icon-happiness-cutout.webp',
        'assets/art/icon-farmer-cutout.webp',
        'assets/art/icon-scholar-cutout.webp',
        'assets/art/icon-craftsman-cutout.webp',
        'assets/art/icon-science-cutout.webp',
        'assets/art/icon-soldier-cutout.webp',
        'assets/art/icon-event-cutout.webp',
        'assets/art/tech-agriculture-cutout.png',
        'assets/art/tech-livelihood-cutout.png',
        'assets/art/tech-administration-cutout.png',
        'assets/art/tech-knowledge-cutout.png',
        'assets/art/tech-culture-cutout.png',
        'assets/art/tech-engineering-cutout.png',
        'assets/art/tech-industry-cutout.png',
        'assets/art/tech-exploration-cutout.png',
        'assets/art/tech-trade-cutout.png',
        'assets/art/tech-military-cutout.png',
        'assets/art/building-house-cutout.png',
        'assets/art/building-farm-cutout.png',
        'assets/art/building-lumbermill-cutout.png',
        'assets/art/building-barracks-cutout.png',
        'assets/art/building-academy-cutout.png',
        'assets/art/building-workshop-cutout.png',
        'assets/art/building-temple-cutout.png',
        'assets/art/building-watchtower-cutout.png',
        'assets/art/territory-capital-cutout.png',
        'assets/art/territory-forest-cutout.png',
        'assets/art/territory-hills-cutout.png',
        'assets/art/territory-plains-cutout.png',
        'assets/art/territory-ruins-cutout.png',
        'assets/art/world-site-camp-cutout.png',
        'assets/art/world-site-city-cutout.png',
        'assets/art/world-site-outpost-cutout.png',
        'assets/art/world-site-ruins-cutout.png',
        'assets/art/world-site-town-cutout.png',
        'assets/art/battle/battlefield-forest-camp.png',
        'assets/art/battle/soldier-player-sheet.png',
        'assets/art/battle/soldier-enemy-sheet.png',
        ...Object.values(this.getFamousPortraitLayerLayout().layers || {})
          .map((layer) => layer?.file)
          .filter(Boolean)
          .map((file) => `assets/art/famous-person/layers/${file}`),
      ];
    }

    getPreloadAssetPaths() {
      return this.constructor.getPreloadAssetPaths();
    }

    setPresenter(presenter) {
      this.presenter = presenter;
    }

    getLayout() {
      const contentWidth = Math.min(this.maxContentWidth, Math.max(300, this.width - this.edgePadding * 2));
      const contentX = Math.max(this.edgePadding, Math.floor((this.width - contentWidth) / 2));
      return {
        contentX,
        contentWidth,
        contentRight: contentX + contentWidth,
      };
    }

    createGradient(x0, y0, x1, y1, stops = [], fallback = '#000') {
      if (!this.ctx || typeof this.ctx.createLinearGradient !== 'function') return fallback;
      const gradient = this.ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    }

    roundRectPath(x, y, width, height, radius = 8) {
      if (!this.ctx) return;
      this.ctx.beginPath();
      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.roundRect(x, y, width, height, radius);
      } else {
        this.ctx.rect(x, y, width, height);
      }
    }

    createImage(src) {
      return null;
    }

    preloadAssets(assetPaths = this.getPreloadAssetPaths(), onProgress = null) {
      const paths = Array.from(new Set((assetPaths || []).filter(Boolean)));
      const total = paths.length;
      const report = typeof onProgress === 'function' ? onProgress : null;
      if (!total) {
        report?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }

      let completed = 0;
      let loaded = 0;
      let failed = 0;
      const notify = (assetPath, status) => {
        const percentage = Math.round((completed / total) * 100);
        report?.({ total, completed, loaded, failed, percentage, assetPath, status });
      };

      return new Promise((resolve) => {
        const settle = (assetPath, status) => {
          completed += 1;
          if (status === 'loaded') loaded += 1;
          else failed += 1;
          notify(assetPath, status);
          if (completed >= total) resolve({ total, completed, loaded, failed, percentage: 100 });
        };

        notify('', 'start');
        paths.forEach((assetPath) => {
          const cached = this.assetCache.get(assetPath);
          if (cached?.status === 'loaded') {
            settle(assetPath, 'loaded');
            return;
          }
          if (cached?.status === 'error') {
            settle(assetPath, 'error');
            return;
          }

          const image = cached?.image || this.createImage(assetPath);
          if (!image) {
            this.assetCache.set(assetPath, { status: 'error', image: null });
            settle(assetPath, 'error');
            return;
          }

          const record = cached || { status: 'loading', image };
          if (!cached) this.assetCache.set(assetPath, record);
          const previousOnload = image.onload;
          const previousOnerror = image.onerror;
          let settled = false;
          const complete = (status, handler, event) => {
            if (settled) return;
            settled = true;
            record.status = status;
            if (status === 'loaded' && this.assetsChangedHandler) this.assetsChangedHandler();
            if (typeof handler === 'function') handler.call(image, event);
            settle(assetPath, status);
          };
          image.onload = (event) => complete('loaded', previousOnload, event);
          image.onerror = (event) => complete('error', previousOnerror, event);
          const requestPath = this.constructor.getAssetRequestPath(assetPath);
          if (!cached) image.src = requestPath;
          else if (!image.src) image.src = requestPath;
        });
      });
    }

    getAsset(assetPath) {
      if (!assetPath) return null;
      const cached = this.assetCache.get(assetPath);
      if (cached) return cached.status === 'loaded' ? cached.image : null;

      const image = this.createImage(assetPath);
      if (!image) {
        this.assetCache.set(assetPath, { status: 'error', image: null });
        return null;
      }

      const record = { status: 'loading', image };
      this.assetCache.set(assetPath, record);
      image.onload = () => {
        record.status = 'loaded';
        if (this.assetsChangedHandler) this.assetsChangedHandler();
      };
      image.onerror = () => {
        record.status = 'error';
      };
      image.src = this.constructor.getAssetRequestPath(assetPath);
      return null;
    }

    setHitTargets(targets = []) {
      this.hitTargets = targets;
    }

    addHitTarget(rect, action) {
      if (this.suppressHitTargets) return;
      if (!action || !rect) return;
      this.hitTargets.push({
        x: Number(rect.x) || 0,
        y: Number(rect.y) || 0,
        width: Number(rect.width) || 0,
        height: Number(rect.height) || 0,
        action,
      });
    }

    getHitTarget(point = {}) {
      const x = Number(point.x);
      const y = Number(point.y);
      let backgroundAction = null;
      let tutorialShieldAction = null;
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        if (
          x >= target.x
          && x <= target.x + target.width
          && y >= target.y
          && y <= target.y + target.height
        ) {
          if (target.action?.type === 'blockCanvasModal') {
            tutorialShieldAction = target.action;
          } else if (tutorialShieldAction && !this.isAllowedUnderTutorialShield(target.action)) {
            return tutorialShieldAction;
          } else if (target.action?.background) {
            backgroundAction = target.action;
          } else {
            return target.action;
          }
        }
      }
      if (tutorialShieldAction) return tutorialShieldAction;
      return backgroundAction;
    }

    isAllowedUnderTutorialShield(action = {}) {
      if (action.type === 'goToGuideTaskTarget') return true;
      if (action.type === 'openTaskCenter') {
        return action.source === 'taskIcon';
      }
      if (action.type === 'claimTaskReward' || action.type === 'claimGuideTaskReward') {
        return (action.category || 'main') === 'main';
      }
      return false;
    }

    withSuppressedHitTargets(callback) {
      const previous = this.suppressHitTargets;
      this.suppressHitTargets = true;
      try {
        return callback?.();
      } finally {
        this.suppressHitTargets = previous;
      }
    }

    withSlideClip(x, y, width, height, offsetX, callback) {
      return this.withTranslatedClip(x, y, width, height, offsetX, 0, callback);
    }

    withTranslatedClip(x, y, width, height, offsetX = 0, offsetY = 0, callback) {
      if (!this.ctx || typeof callback !== 'function') return callback?.();
      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.beginPath === 'function'
        && typeof this.ctx.rect === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) return callback();
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
      if (typeof this.ctx.translate === 'function') this.ctx.translate(offsetX, offsetY);
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    withTransformedClip(x, y, width, height, offsetX = 0, offsetY = 0, scale = 1, callback) {
      if (!this.ctx || typeof callback !== 'function') return callback?.();
      const canClip = typeof this.ctx.save === 'function'
        && typeof this.ctx.restore === 'function'
        && typeof this.ctx.beginPath === 'function'
        && typeof this.ctx.rect === 'function'
        && typeof this.ctx.clip === 'function';
      if (!canClip) return callback();
      const safeScale = Math.max(0.01, Number(scale) || 1);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(x, y, width, height);
      this.ctx.clip();
      if (typeof this.ctx.translate === 'function') this.ctx.translate(x + offsetX, y + offsetY);
      if (typeof this.ctx.scale === 'function') this.ctx.scale(safeScale, safeScale);
      if (typeof this.ctx.translate === 'function') this.ctx.translate(-x, -y);
      try {
        return callback();
      } finally {
        this.ctx.restore();
      }
    }

    setAssetsChangedHandler(handler) {
      this.assetsChangedHandler = typeof handler === 'function' ? handler : null;
    }

    drawAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(image, x, y, width, height);
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
    }

    drawCoverAsset(assetPath, x, y, width, height, alpha = 1) {
      const image = this.getAsset(assetPath);
      if (!image || typeof this.ctx.drawImage !== 'function') return false;
      const sourceWidth = Number(image.naturalWidth || image.width);
      const sourceHeight = Number(image.naturalHeight || image.height);
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      if (sourceWidth > 0 && sourceHeight > 0) {
        const sourceRatio = sourceWidth / sourceHeight;
        const targetRatio = width / height;
        let sx = 0;
        let sy = 0;
        let sw = sourceWidth;
        let sh = sourceHeight;
        if (sourceRatio > targetRatio) {
          sw = sourceHeight * targetRatio;
          sx = (sourceWidth - sw) / 2;
        } else {
          sh = sourceWidth / targetRatio;
          sy = (sourceHeight - sh) / 2;
        }
        this.ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
      } else {
        this.ctx.drawImage(image, x, y, width, height);
      }
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      return true;
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

    getBattleUnitPose(side, activeTurn = null, phase = 'impact') {
      if (!activeTurn) return 'idle';
      if (activeTurn.actor === side) return phase === 'move' ? 'move' : 'attack';
      if (activeTurn.target === side) return phase === 'impact' ? 'hit' : 'idle';
      return 'idle';
    }

    getBattleSpriteSpec(side = 'attacker') {
      return {
        path: side === 'attacker'
          ? 'assets/art/battle/soldier-player-sheet.png'
          : 'assets/art/battle/soldier-enemy-sheet.png',
        columns: 4,
        rows: 4,
        frameWidth: 313.5,
        frameHeight: 313.5,
        poses: { idle: 0, move: 1, attack: 2, skill: 2, hit: 3, defeated: 3 },
      };
    }

    getBattleSideSpritePath(sideView = {}, side = 'attacker') {
      return sideView.sprite || this.getBattleSpriteSpec(side).path;
    }

    drawBattleMapBackground(map = {}) {
      const path = map.background || 'assets/art/battle/battlefield-forest-camp.png';
      if (this.drawCoverAsset(path, 0, 0, this.width, this.height)) return;
      this.ctx.fillStyle = '#1d2119';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawBattleSoldierSprite(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22, spritePath = '') {
      if (!this.ctx) return;
      const spec = this.getBattleSpriteSpec(side);
      const image = this.getAsset(spritePath || spec.path);
      const alpha = Math.max(0.25, Math.min(1, Number(ratio) || 1));
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha * alpha;
      const spritePose = spec.poses[pose] !== undefined ? pose : 'idle';
      const row = spec.poses[spritePose] || 0;
      const column = Math.abs(Math.floor(Number(frame) || 0)) % spec.columns;
      const sw = spec.frameWidth;
      const sh = spec.frameHeight;
      const dw = sw * scale;
      const dh = sh * scale;
      if (image && typeof this.ctx.drawImage === 'function') {
        this.ctx.drawImage(image, column * sw, row * sh, sw, sh, x - dw / 2, y - dh, dw, dh);
      } else {
        const color = side === 'attacker' ? '#74d3a0' : '#e07b62';
        this.drawCircle(x, y - 18, 5, { fill: color });
        this.drawPanel(x - 6, y - 14, 12, 16, { fill: color, radius: 2 });
      }
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    drawBattleSoldier(x, y, side = 'attacker', pose = 'idle', frame = 0, ratio = 1, scale = 0.22) {
      return this.drawBattleSoldierSprite(x, y, side, pose, frame, ratio, scale);
    }

    drawBattleArmy(sideView = {}, area = {}, options = {}) {
      const groups = sideView.groups || [];
      const side = sideView.side || 'attacker';
      const pose = options.pose || 'idle';
      const frame = Number(options.frame) || 0;
      const progress = Math.max(0, Math.min(1, Number(options.progress) || 0));
      const actionType = options.actionType || '';
      const columns = Math.max(1, Math.floor(area.width / 34));
      const dir = side === 'attacker' ? 1 : -1;
      const actionAdvance = pose === 'move'
        ? progress * 46 * dir
        : (pose === 'attack' || pose === 'skill' ? (10 + Math.sin(frame / 1.8) * 4) * dir : 0);
      const hitOffset = pose === 'hit' ? (Math.sin(frame / 1.5) * 8 - 4) * dir : 0;
      groups.slice(0, 18).forEach((group, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = side === 'attacker'
          ? area.x + col * 30 + 22
          : area.x + area.width - col * 30 - 22;
        const y = area.y + row * 34 + 72 + (col % 2) * 5;
        const activePose = index === 0 ? pose : 'idle';
        const activeOffset = index === 0 ? actionAdvance + hitOffset : 0;
        const scale = actionType === 'skill' && index === 0 ? 0.245 : 0.21;
        this.drawBattleSoldierSprite(
          x + activeOffset,
          y,
          side,
          activePose,
          frame + index,
          group.ratio,
          scale,
          this.getBattleSideSpritePath(sideView, side),
        );
      });
      if (groups.length > 18) {
        this.drawText(`+${groups.length - 18}`, side === 'attacker' ? area.x + area.width - 28 : area.x + 10, area.y + area.height - 22, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
      }
      this.drawText(`${sideView.soldiers || 0}/${sideView.soldiersStart || 0}`, area.x + area.width / 2, area.y + area.height + 6, {
        size: 12,
        bold: true,
        color: side === 'attacker' ? '#74d3a0' : '#e07b62',
        align: 'center',
      });
    }

    drawBattleActionEffect(activeTurn = null, progress = 0) {
      if (!activeTurn) return;
      const isSkill = activeTurn.action === 'skill';
      const impactProgress = Math.max(0, Math.min(1, (progress - 0.45) / 0.45));
      if (impactProgress <= 0) return;
      const x = activeTurn.target === 'defender' ? this.width * 0.58 : this.width * 0.42;
      const y = Math.max(270, this.height * 0.48);
      const pulse = Math.sin(impactProgress * Math.PI);
      this.drawCircle(x, y, (isSkill ? 42 : 24) * pulse, {
        fill: isSkill ? 'rgba(255, 196, 76, 0.20)' : 'rgba(255, 245, 210, 0.14)',
        stroke: isSkill ? 'rgba(255, 226, 122, 0.72)' : 'rgba(255, 245, 210, 0.42)',
        width: isSkill ? 3 : 2,
      });
      if (isSkill) {
        this.drawText(activeTurn.skillName || '技能', x, y - 54 * pulse, {
          size: 14,
          bold: true,
          color: '#ffe6b5',
          align: 'center',
        });
      }
    }

    drawBattleLeader(sideView = {}, x, y, side = 'attacker') {
      const radius = 32;
      this.drawCircle(x, y, radius + 5, {
        fill: side === 'attacker' ? 'rgba(116, 211, 160, 0.12)' : 'rgba(224, 123, 98, 0.12)',
        stroke: side === 'attacker' ? 'rgba(116, 211, 160, 0.58)' : 'rgba(224, 123, 98, 0.58)',
        width: 2,
      });
      const portrait = side === 'attacker'
        ? this.drawFamousPortrait(sideView, x - radius, y - radius, radius * 2, {
          frameWidth: radius * 2,
          frameHeight: radius * 2,
          radius,
          scale: 1.58,
          offsetY: 0.12,
        })
        : false;
      if (!portrait) {
        this.drawCircle(x, y, radius, {
          fill: side === 'attacker' ? '#2f6f59' : '#7f3d32',
          stroke: 'rgba(255, 226, 177, 0.5)',
          width: 2,
        });
        this.drawText(String(sideView.leaderName || sideView.name || '将').slice(0, 1), x, y, {
          size: 22,
          bold: true,
          color: '#f6e8c8',
          align: 'center',
          baseline: 'middle',
        });
      }
      this.drawText(this.truncateText(sideView.leaderName || sideView.name || '', 96, { size: 12, bold: true }), x, y + radius + 10, {
        size: 12,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
      });
    }

    renderBattleSceneOverlay(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildBattleSceneViewState !== 'function') return;
      const view = this.presenter.buildBattleSceneViewState(options.battleScene || {}, {
        turnIndex: options.battleScene?.turnIndex || 0,
      });
      if (!view.visible) return;
      this.setHitTargets([]);
      this.drawBattleMapBackground(view.map);
      const frame = Math.floor((this.getNow() || 0) / 140);
      const activeTurn = view.activeTurn;
      const turnDuration = Math.max(1, Number(options.battleScene?.turnDurationMs) || 720);
      const turnStartedAt = Number(options.battleScene?.turnStartedAt) || this.getNow();
      const turnElapsed = ((this.getNow() - turnStartedAt) % turnDuration + turnDuration) % turnDuration;
      const turnProgress = turnElapsed / turnDuration;
      const turnPhase = activeTurn && turnElapsed < turnDuration * 0.42 ? 'move' : 'impact';
      const attackerPose = this.getBattleUnitPose('attacker', activeTurn, turnPhase);
      const defenderPose = this.getBattleUnitPose('defender', activeTurn, turnPhase);
      const topY = 20;
      this.drawPanel(16, topY, this.width - 32, 68, {
        fill: 'rgba(20, 16, 12, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 10,
      });
      this.drawText(this.truncateText(view.title, this.width - 80, { size: 18, bold: true }), this.width / 2, topY + 12, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
      this.drawText(`第 ${Math.min(view.turnIndex + 1, Math.max(1, view.turnCount))}/${Math.max(1, view.turnCount)} 手 · ${view.resultText}`, this.width / 2, topY + 40, {
        size: 12,
        color: '#d6b16e',
        align: 'center',
      });

      const fieldTop = 116;
      const logH = 122;
      const logY = this.height - logH - 70;
      const armyTop = fieldTop + 138;
      const armyHeight = Math.max(120, logY - armyTop - 28);
      const laneWidth = Math.min(170, this.width * 0.42);
      this.drawBattleLeader(view.attacker, 72, fieldTop + 64, 'attacker');
      this.drawBattleLeader(view.defender, this.width - 72, fieldTop + 64, 'defender');
      this.drawBattleArmy(view.attacker, {
        x: 18,
        y: armyTop,
        width: laneWidth,
        height: armyHeight,
      }, { pose: attackerPose, frame, progress: turnProgress, actionType: activeTurn?.action });
      this.drawBattleArmy(view.defender, {
        x: this.width - laneWidth - 18,
        y: armyTop,
        width: laneWidth,
        height: armyHeight,
      }, { pose: defenderPose, frame, progress: turnProgress, actionType: activeTurn?.action });
      this.drawBattleActionEffect(activeTurn, turnProgress);

      this.drawPanel(16, logY, this.width - 32, logH, {
        fill: 'rgba(20, 16, 12, 0.76)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
      });
      const lines = view.logLines.length ? view.logLines : ['双方列阵，战斗即将开始。'];
      lines.slice(-4).forEach((line, index) => {
        this.drawText(this.truncateText(line, this.width - 56, { size: 12 }), 28, logY + 14 + index * 24, {
          size: 12,
          color: index === lines.slice(-4).length - 1 ? '#f6e8c8' : '#aeb0b8',
        });
      });

      const buttonY = this.height - 54;
      this.drawButton(18, buttonY, 88, 36, '返回', { size: 12, radius: 8 });
      this.addHitTarget({ x: 18, y: buttonY, width: 88, height: 36 }, { type: 'closeBattleScene' });
      const primaryLabel = view.ended ? '完成' : '跳过';
      this.drawButton(this.width - 106, buttonY, 88, 36, primaryLabel, { size: 12, radius: 8, active: true });
      this.addHitTarget({ x: this.width - 106, y: buttonY, width: 88, height: 36 }, { type: view.ended ? 'closeBattleScene' : 'skipBattleScene' });
    }

    clear() {
      if (!this.ctx) return;
      // For HUD overlay mode: only clear the HUD regions we actually draw to.
      // The DOM game UI shows through the transparent canvas background.
      // Top bar and migrated Canvas-owned pages.
      // Bottom tabs: y height-72 to height
      const hudTopY = 0;
      const hudBottomY = Math.max(0, this.height - 72);
      this.ctx.clearRect(0, hudTopY, this.width, hudBottomY - hudTopY);
      this.ctx.clearRect(0, hudBottomY, this.width, this.height - hudBottomY);
      // Optional: draw a subtle top bar backing if needed, but keep transparent for DOM
    }

    drawText(text, x, y, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.color || '#f6e8c8';
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      this.ctx.textBaseline = options.baseline || 'top';
      this.ctx.textAlign = options.align || 'left';
      this.ctx.fillText(String(text ?? ''), x, y);
      this.ctx.textAlign = 'left';
    }

    drawTextLines(lines = [], x, y, options = {}) {
      const lineHeight = options.lineHeight || 18;
      lines.forEach((line, index) => {
        this.drawText(line, x, y + index * lineHeight, options);
      });
    }

    wrapText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      if (!content) return [];
      if (!this.ctx || typeof this.ctx.measureText !== 'function') return [content];
      const previousFont = this.ctx.font;
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      const lines = [];
      content.split('\n').forEach((rawLine) => {
        let buffer = '';
        Array.from(rawLine).forEach((char) => {
          const next = `${buffer}${char}`;
          if (buffer && this.ctx.measureText(next).width > maxWidth) {
            lines.push(buffer);
            buffer = char;
          } else {
            buffer = next;
          }
        });
        if (buffer || rawLine === '') lines.push(buffer);
      });
      this.ctx.font = previousFont;
      return lines;
    }

    measureTextWidth(text, options = {}) {
      const content = String(text ?? '');
      if (!this.ctx || typeof this.ctx.measureText !== 'function') return content.length * (options.size || 14) * 0.55;
      const previousFont = this.ctx.font;
      this.ctx.font = `${options.bold ? '700 ' : ''}${options.size || 14}px ${options.fontFamily || 'sans-serif'}`;
      const width = this.ctx.measureText(content).width;
      this.ctx.font = previousFont;
      return width;
    }

    truncateText(text, maxWidth, options = {}) {
      const content = String(text ?? '');
      if (!content || this.measureTextWidth(content, options) <= maxWidth) return content;
      const ellipsis = '...';
      let buffer = '';
      Array.from(content).some((char) => {
        const next = `${buffer}${char}`;
        if (this.measureTextWidth(`${next}${ellipsis}`, options) > maxWidth) return true;
        buffer = next;
        return false;
      });
      return buffer ? `${buffer}${ellipsis}` : ellipsis;
    }

    wrapTextLimit(text, maxWidth, maxLines, options = {}) {
      const limit = Math.max(1, Number(maxLines) || 1);
      const lines = this.wrapText(text, maxWidth, options);
      if (lines.length <= limit) return lines;
      const visible = lines.slice(0, limit);
      visible[visible.length - 1] = this.truncateText(`${visible[visible.length - 1]}...`, maxWidth, options);
      return visible;
    }

    drawLine(x1, y1, x2, y2, options = {}) {
      if (!this.ctx) return;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    drawPolyline(points = [], options = {}) {
      if (!this.ctx || points.length < 2) return;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.ctx.lineTo(point.x, point.y));
      this.ctx.stroke();
    }

    drawCurvePath(path = {}, options = {}) {
      if (!this.ctx || !path.start || !path.end) return;
      const previousLineCap = this.ctx.lineCap;
      const previousLineJoin = this.ctx.lineJoin;
      this.ctx.strokeStyle = options.color || 'rgba(232, 199, 128, 0.28)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.lineCap = options.lineCap || 'round';
      this.ctx.lineJoin = options.lineJoin || 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(path.start.x, path.start.y);
      if (typeof this.ctx.bezierCurveTo === 'function' && path.c1 && path.c2) {
        this.ctx.bezierCurveTo(path.c1.x, path.c1.y, path.c2.x, path.c2.y, path.end.x, path.end.y);
      } else {
        this.ctx.lineTo(path.end.x, path.end.y);
      }
      this.ctx.stroke();
      if (previousLineCap !== undefined) this.ctx.lineCap = previousLineCap;
      if (previousLineJoin !== undefined) this.ctx.lineJoin = previousLineJoin;
    }

    drawCircle(x, y, radius, options = {}) {
      if (!this.ctx || typeof this.ctx.arc !== 'function') return;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (options.fill) {
        this.ctx.fillStyle = options.fill;
        this.ctx.fill();
      }
      if (options.stroke) {
        this.ctx.strokeStyle = options.stroke;
        this.ctx.lineWidth = options.width || 1;
        this.ctx.stroke();
      }
    }

    beginFrame(options = {}) {
      const optionNow = Number(options.now);
      const now = Number.isFinite(optionNow) ? optionNow : Date.now();
      this.frameNow = now;
      this.updateFps(now);
      return now;
    }

    endFrame(options = {}) {
      this.renderFpsOverlay(options);
      this.frameNow = 0;
    }

    getNow() {
      return this.frameNow || Date.now();
    }

    updateFps(now = Date.now()) {
      const timestamp = Number(now);
      if (!Number.isFinite(timestamp)) return this.currentFps;
      if (!this.fpsLastFrameAt) {
        this.fpsLastFrameAt = timestamp;
        this.fpsLastPaintAt = timestamp;
        return this.currentFps;
      }
      const delta = Math.max(4, timestamp - this.fpsLastFrameAt);
      this.fpsLastFrameAt = timestamp;
      if (delta > 250) return this.currentFps;
      const fps = Math.min(120, 1000 / delta);
      this.fpsSamples.push(fps);
      if (this.fpsSamples.length > 30) this.fpsSamples.shift();
      const average = this.fpsSamples.reduce((sum, value) => sum + value, 0) / this.fpsSamples.length;
      this.currentFps = Math.round(average >= 58 && average <= 64 ? 60 : average);
      return this.currentFps;
    }

    renderFpsOverlay(options = {}) {
      if (!this.showFpsOverlay || options.showFpsOverlay === false || !this.ctx) return;
      const now = this.getNow();
      if (!this.fpsLastPaintAt || now - this.fpsLastPaintAt >= 180 || (!this.fpsLastPaintedValue && this.currentFps)) {
        this.fpsLastPaintAt = now;
        this.fpsLastPaintedValue = Math.max(0, Math.round(Number(options.fps ?? this.currentFps) || 0));
      }
      const fps = this.fpsLastPaintedValue;
      const label = fps ? `FPS ${fps}` : 'FPS --';
      const width = Math.max(66, Math.min(84, Math.ceil(this.measureTextWidth(label, { size: 11, bold: true }) + 18)));
      const color = fps >= 55 ? '#74d3a0' : (fps >= 30 ? '#ffd98a' : '#ff6b6b');
      this.drawPanel(8, 8, width, 22, {
        fill: 'rgba(11, 18, 14, 0.72)',
        stroke: 'rgba(255, 226, 177, 0.16)',
        radius: 6,
        inset: 'rgba(255, 255, 255, 0.03)',
      });
      this.drawText(label, 17, 19, {
        size: 11,
        bold: true,
        color,
        baseline: 'middle',
      });
    }

    drawPanel(x, y, width, height, options = {}) {
      if (!this.ctx) return;
      this.ctx.fillStyle = options.fill || 'rgba(37, 29, 21, 0.88)';
      this.ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.14)';
      this.ctx.lineWidth = 1;
      const radius = options.radius || 8;
      this.roundRectPath(x, y, width, height, radius);
      this.ctx.fill();
      this.ctx.stroke();
      if (options.inset) {
        this.ctx.strokeStyle = options.inset;
        this.roundRectPath(x + 1, y + 1, width - 2, height - 2, Math.max(2, radius - 1));
        this.ctx.stroke();
      }
    }

    drawButton(x, y, width, height, label, options = {}) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: options.disabled
          ? 'rgba(60, 52, 46, 0.72)'
          : (options.active ? 'rgba(113, 86, 58, 0.98)' : 'rgba(50, 35, 22, 0.94)'),
        stroke: options.active ? 'rgba(240, 180, 91, 0.78)' : 'rgba(240, 180, 91, 0.32)',
        radius: options.radius || 8,
        inset: options.active ? 'rgba(255, 231, 184, 0.14)' : 'rgba(255, 231, 184, 0.08)',
      });
      this.drawText(label, x + width / 2, y + height / 2, {
        color: options.disabled ? '#8d8f99' : '#f6e8c8',
        size: options.size || 13,
        bold: Boolean(options.bold),
        baseline: 'middle',
        align: 'center',
      });
    }

    drawPrimaryActionButton(x, y, width, height, label, options = {}) {
      if (!this.ctx) return;
      const disabled = Boolean(options.disabled);
      const radius = options.radius || Math.min(10, Math.floor(height / 2));
      const fill = disabled
        ? 'rgba(60, 52, 46, 0.72)'
        : this.createGradient(
          x, y, x, y + height,
          [
            [0, 'rgba(247, 202, 104, 0.98)'],
            [1, 'rgba(176, 92, 39, 0.98)'],
          ],
          'rgba(214, 137, 58, 0.98)',
        );
      this.drawPanel(x, y, width, height, {
        fill,
        stroke: disabled ? 'rgba(240, 180, 91, 0.22)' : 'rgba(255, 235, 166, 0.82)',
        radius,
        inset: disabled ? 'rgba(255, 231, 184, 0.06)' : 'rgba(255, 252, 218, 0.22)',
      });
      if (!disabled) {
        this.drawLine(x + 9, y + 4, x + width - 9, y + 4, { color: 'rgba(255, 255, 220, 0.5)' });
        this.drawLine(x + 10, y + height - 3, x + width - 10, y + height - 3, { color: 'rgba(80, 36, 18, 0.28)' });
      }
      this.drawText(label, x + width / 2, y + height / 2, {
        color: disabled ? '#8d8f99' : '#24170e',
        size: options.size || 13,
        bold: true,
        baseline: 'middle',
        align: 'center',
      });
    }

    drawProgressBar(x, y, width, height, percentage) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(11, 18, 14, 0.38)',
        stroke: 'rgba(255, 226, 177, 0.16)',
        radius: height / 2,
      });
      const fillWidth = Math.max(0, Math.min(width, width * (Number(percentage) || 0) / 100));
      if (fillWidth <= 0) return;
      this.ctx.fillStyle = this.createGradient(
        x, y, x + fillWidth, y,
        [
          [0, '#d78332'],
          [1, '#f0b45b'],
        ],
        '#d8a94f',
      );
      this.roundRectPath(x, y, fillWidth, height, height / 2);
      this.ctx.fill();
    }

    drawIconCard(x, y, width, height, assetPath, options = {}) {
      if (!this.ctx) return;
      this.drawPanel(x, y, width, height, {
        fill: options.fill || 'rgba(96, 67, 39, 0.88)',
        stroke: options.stroke || 'rgba(255, 226, 177, 0.18)',
        radius: options.radius || 8,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.drawAsset(
        assetPath,
        x + (width - (options.iconWidth || 28)) / 2,
        y + (height - (options.iconHeight || 28)) / 2,
        options.iconWidth || 28,
        options.iconHeight || 28,
      );
    }

    renderSectionHeader(title, x, y, icon = '') {
      this.drawText(`${icon ? `${icon} ` : ''}${title}`, x, y, { size: 15, bold: true, color: '#eaeaea' });
    }

    renderTopBar(state = {}) {
      if (!this.presenter) return 84;
      const layout = this.getLayout();
      const resourceView = this.presenter.buildResourceViewState(state);
      const cityView = this.presenter.buildCitySwitcherViewState ? this.presenter.buildCitySwitcherViewState(state) : { hidden: true };
      const advisorView = this.presenter.buildAdvisorViewState ? this.presenter.buildAdvisorViewState(state.softGuide) : { hidden: true };
      const populationScale = resourceView.text?.populationValue
        ?? (typeof this.presenter.toDisplayPopulation === 'function'
          ? this.presenter.toDisplayPopulation(state.population?.total ?? state.totalPop)
          : (Number(state.population?.total ?? state.totalPop) || 0) * 100);
      const populationStatus = resourceView.text?.populationStatus || '';
      const x = layout.contentX;
      const y = 12;
      const width = layout.contentWidth;
      const barPaddingX = 14;
      const statusTop = y + 10;
      const statusHeight = 38;
      const resourceTop = y + 56;
      const resourceHeight = 62;
      const cityTop = y + 126;
      const cityHeight = 32;
      const barHeight = cityView.hidden ? 128 : 166;

      this.drawPanel(x, y, width, barHeight, {
        fill: this.createGradient(
          x, y, x + width, y + barHeight,
          [
            [0, 'rgba(73, 50, 31, 0.9)'],
            [1, 'rgba(34, 25, 18, 0.9)'],
          ],
          'rgba(48, 35, 25, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 12,
        inset: 'rgba(255, 232, 185, 0.12)',
      });

      this.drawAsset('assets/art/icon-fire-cutout.webp', x + barPaddingX, statusTop + 4, 30, 30);
      this.drawText(state.currentEraName || '原始时代', x + barPaddingX + 36, statusTop + 13, { size: 14, bold: true, color: '#d78332', baseline: 'middle' });
      this.drawText(
        populationStatus || `人口：${populationScale}`,
        x + barPaddingX + 36,
        statusTop + 31,
        {
          size: populationStatus ? 9 : 10,
          bold: Boolean(populationStatus),
          color: populationStatus ? '#ffd98a' : 'rgba(234, 234, 234, 0.72)',
          baseline: 'middle',
        },
      );

      const actionDefs = [];
      if (!advisorView.hidden) actionDefs.push({ label: '顾问', width: 62 });
      actionDefs.push({ label: '日志', width: 44 });
      actionDefs.push({ label: '设置', width: 44 });
      let cursor = x + width - barPaddingX;
      actionDefs.slice().reverse().forEach((action, index) => {
        cursor -= action.width;
        const actionY = statusTop + 1;
        const actionHeight = action.label === '顾问' ? statusHeight : 36;
        this.drawButton(cursor, actionY, action.width, actionHeight, action.label, { size: 12, bold: true, active: false, radius: 18 });
        if (action.label === '顾问') {
          this.drawText('谋', cursor + 14, statusTop + 20, { size: 12, bold: true, color: '#f0b45b', baseline: 'middle', align: 'center' });
          this.drawText('●', cursor + action.width - 10, statusTop + 20, { size: 7, color: '#74d3a0', baseline: 'middle', align: 'center' });
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openAdvisor' });
        } else if (action.label === '日志') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openLogs' });
        } else if (action.label === '设置') {
          this.addHitTarget({ x: cursor, y: actionY, width: action.width, height: actionHeight }, { type: 'openSettings' });
        }
        if (index < actionDefs.length - 1) cursor -= 6;
      });

      const resources = [
        { label: '木材', value: resourceView.text.woodValue, rate: resourceView.text.woodRate, icon: 'assets/art/icon-wood-cutout.webp' },
        { label: '铁矿', value: resourceView.text.ironValue, rate: resourceView.text.ironRate, icon: 'assets/art/icon-iron-cutout.webp' },
        { label: '石料', value: resourceView.text.stoneValue, rate: resourceView.text.stoneRate, icon: 'assets/art/icon-stone-cutout.webp' },
        { label: '粮食', value: resourceView.text.foodValue, rate: resourceView.text.foodRate, icon: 'assets/art/icon-food-cutout.webp' },
        { label: '知识', value: resourceView.text.knowledgeValue, rate: resourceView.text.knowledgeRate, icon: 'assets/art/icon-knowledge-cutout.webp' },
      ];
      const compactResources = resources.length >= 5;
      const gap = compactResources ? 4 : 8;
      const resourceX = x + barPaddingX;
      const resourceWidth = width - barPaddingX * 2;
      const itemWidth = (resourceWidth - gap * (resources.length - 1)) / resources.length;
      const itemY = resourceTop;
      resources.forEach((resource, index) => {
        const itemX = resourceX + index * (itemWidth + gap);
        const iconSize = compactResources ? 30 : 30;
        const valueSize = compactResources ? 11 : 16;
        const rateSize = compactResources ? 9 : 10;
        const labelSize = compactResources ? 8 : 10;
        const textWidth = Math.max(24, itemWidth - 2);
        if (compactResources) {
          const centerX = itemX + itemWidth / 2;
          const iconX = centerX - iconSize / 2;
          this.drawAsset(resource.icon, iconX, itemY, iconSize, iconSize);
          this.drawText(resource.label, centerX, itemY + 31, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, textWidth, { size: valueSize, bold: true }), centerX, itemY + 41, {
            size: valueSize,
            bold: true,
            color: '#74d3a0',
            align: 'center',
          });
          this.drawText(this.truncateText(resource.rate, textWidth, { size: rateSize }), centerX, itemY + 52, {
            size: rateSize,
            color: '#a0a0a0',
            align: 'center',
          });
        } else {
          const iconX = itemX + 4;
          const valueX = itemX + 41;
          const wideTextWidth = Math.max(18, itemWidth - (valueX - itemX));
          this.drawAsset(resource.icon, iconX, itemY + 3, iconSize, iconSize);
          this.drawText(resource.label, iconX + iconSize / 2, itemY + 32, { size: labelSize, color: '#cbbd96', align: 'center' });
          this.drawText(this.truncateText(resource.value, wideTextWidth, { size: valueSize, bold: true }), valueX, itemY + 8, { size: valueSize, bold: true, color: '#74d3a0' });
          this.drawText(this.truncateText(resource.rate, wideTextWidth, { size: rateSize }), valueX, itemY + 29, { size: rateSize, color: '#a0a0a0' });
        }
        this.addHitTarget({ x: itemX, y: itemY, width: itemWidth, height: resourceHeight }, { type: 'openResourceDetails' });
      });

      if (!cityView.hidden) {
        const triggerWidth = Math.min(190, width * 0.64);
        const triggerX = x + Math.floor((width - triggerWidth) / 2) - 8;
        const triggerY = cityTop;
        this.drawPanel(triggerX, triggerY - 5, triggerWidth, 9, {
          fill: 'rgba(93, 63, 35, 0.88)',
          stroke: 'rgba(255, 225, 177, 0.14)',
          radius: 5,
        });
        this.drawButton(triggerX, triggerY, triggerWidth, cityHeight, cityView.activeCityName || '首都', { size: 13, bold: true, active: true, radius: 8 });
        this.drawText('▾', triggerX + triggerWidth - 18, triggerY + 17, {
          size: 14,
          bold: true,
          color: '#ffd994',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: triggerX, y: triggerY, width: triggerWidth, height: cityHeight }, { type: 'openCitySwitcher' });
      }

      return y + barHeight + 12;
    }

    renderGuideTasks(state = {}, startY = 0) {
      return startY;
      const guideTasks = state.guideTasks || {};
      const tasks = Array.isArray(guideTasks.tasks) ? guideTasks.tasks : [];
      if (!guideTasks.visible || !tasks.length) return startY;

      const task = tasks[0];
      const layout = this.getLayout();
      const x = layout.contentX;
      const y = startY;
      const width = layout.contentWidth;
      const height = 72;
      const buttonWidth = 82;
      const buttonHeight = 34;
      const buttonX = x + width - buttonWidth - 14;
      const buttonY = y + 19;
      const canClaim = task.status === 'claimable' && !task.claimed;
      const canGo = !canClaim && Boolean(task.target);
      const buttonDisabled = !canClaim && !canGo;

      this.drawPanel(x, y, width, height, {
        fill: this.createGradient(
          x, y, x + width, y + height,
          [
            [0, 'rgba(57, 44, 28, 0.96)'],
            [1, 'rgba(23, 20, 15, 0.96)'],
          ],
          'rgba(38, 30, 22, 0.96)',
        ),
        stroke: canClaim ? 'rgba(247, 215, 116, 0.56)' : 'rgba(240, 180, 91, 0.22)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      this.drawPanel(x + 12, y + 12, 42, 20, {
        fill: canClaim ? 'rgba(247, 215, 116, 0.22)' : 'rgba(116, 211, 160, 0.16)',
        stroke: canClaim ? 'rgba(247, 215, 116, 0.42)' : 'rgba(116, 211, 160, 0.28)',
        radius: 6,
      });
      this.drawText('主线', x + 33, y + 22, {
        size: 11,
        bold: true,
        color: canClaim ? '#ffd98a' : '#74d3a0',
        baseline: 'middle',
        align: 'center',
      });

      const textX = x + 64;
      const textWidth = Math.max(96, buttonX - textX - 12);
      this.drawText(this.truncateText(task.title || '主线任务', textWidth, { size: 14, bold: true }), textX, y + 10, {
        size: 14,
        bold: true,
        color: '#fff1cf',
      });
      const desc = canClaim
        ? '任务已完成，前往任务列表领取奖励'
        : (task.description || task.rewardText || '');
      const lines = this.wrapTextLimit(desc, textWidth, 2, { size: 11 });
      this.drawTextLines(lines, textX, y + 31, {
        size: 11,
        color: canClaim ? '#ffd98a' : '#cbbd96',
        lineHeight: 15,
      });

      const buttonLabel = canClaim ? (task.actionLabel || '任务') : (task.actionLabel || '前往');
      const buttonAction = task.action || (
        canClaim
          ? { type: 'openTaskCenter', tab: 'main', taskId: task.id, target: 'task-center-main-claim', source: 'taskIcon' }
          : { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }
      );
      const hitAction = buttonAction.type === 'openTaskCenter'
        ? { ...buttonAction, source: buttonAction.source || 'taskIcon' }
        : buttonAction;
      this.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, buttonLabel, {
        disabled: buttonDisabled,
        active: canClaim || canGo,
        size: 12,
        bold: canClaim || canGo,
        radius: 9,
      });
      this.addHitTarget(
        { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
        { ...hitAction, disabled: buttonDisabled },
      );

      return y + height + 10;
    }

    renderTaskCenterButton(state = {}) {
      return;
      if (!this.presenter || typeof this.presenter.buildTaskCenterViewState !== 'function') return;
      const view = this.presenter.buildTaskCenterViewState(state);
      const layout = this.getLayout();
      const size = 48;
      const x = layout.contentRight - size - 10;
      const y = this.height - 58 - this.bottomSafeArea - size - 10;
      const badge = Number(view.summary?.claimableCount) || 0;

      this.drawPanel(x, y, size, size, {
        fill: this.createGradient(
          x, y, x, y + size,
          [
            [0, 'rgba(96, 67, 39, 0.96)'],
            [1, 'rgba(35, 25, 17, 0.96)'],
          ],
          'rgba(60, 42, 26, 0.96)',
        ),
        stroke: badge > 0 ? 'rgba(247, 215, 116, 0.72)' : 'rgba(255, 226, 177, 0.2)',
        radius: 12,
        inset: 'rgba(255, 231, 184, 0.12)',
      });
      this.drawText('\u4efb\u52a1', x + size / 2, y + size / 2 + 1, {
        size: 14,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      if (badge > 0) {
        const badgeText = badge > 9 ? '9+' : String(badge);
        this.drawPanel(x + size - 18, y - 5, 22, 20, {
          fill: '#e94560',
          stroke: 'rgba(255, 255, 255, 0.18)',
          radius: 10,
        });
        this.drawText(badgeText, x + size - 7, y + 5, {
          size: 10,
          bold: true,
          color: '#fff',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openTaskCenter', source: 'taskIcon' });
    }

    renderGuidebookButton(state = {}) {
      return;
      if (!this.presenter || typeof this.presenter.buildGuidebookViewState !== 'function') return;
      const layout = this.getLayout();
      const size = 44;
      const x = layout.contentRight - size - 12;
      const taskY = this.height - 58 - this.bottomSafeArea - 48 - 10;
      const y = taskY - size - 8;
      if (y < 178) return;
      this.drawPanel(x, y, size, size, {
        fill: this.createGradient(
          x, y, x, y + size,
          [
            [0, 'rgba(50, 76, 66, 0.96)'],
            [1, 'rgba(25, 33, 29, 0.96)'],
          ],
          'rgba(37, 54, 47, 0.96)',
        ),
        stroke: 'rgba(116, 211, 160, 0.32)',
        radius: 11,
        inset: 'rgba(116, 211, 160, 0.1)',
      });
      this.drawText('略', x + size / 2, y + 17, {
        size: 15,
        bold: true,
        color: '#d5ffe8',
        baseline: 'middle',
        align: 'center',
      });
      this.drawText('攻略', x + size / 2, y + 31, {
        size: 10,
        bold: true,
        color: '#8fd8af',
        baseline: 'middle',
        align: 'center',
      });
      this.addHitTarget({ x, y, width: size, height: size }, { type: 'openGuidebook', source: 'homeFeature' });
    }

    renderGuidebookPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildGuidebookViewState !== 'function') return;
      const view = this.presenter.buildGuidebookViewState(state, { activeTab: options.activeGuidebookTab });
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(510, Math.max(390, this.height - 210));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 10);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeGuidebook' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(38, 51, 42, 0.99)'],
            [1, 'rgba(19, 20, 16, 0.99)'],
          ],
          'rgba(30, 36, 29, 0.99)',
        ),
        stroke: 'rgba(116, 211, 160, 0.28)',
        radius: 14,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText(view.title || '攻略', x + 18, y + 18, { size: 18, bold: true, color: '#d5ffe8' });
      this.drawText(this.truncateText(view.subtitle || '', panelWidth - 76, { size: 12 }), x + 18, y + 44, {
        size: 12,
        color: '#9ccfaf',
      });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeGuidebook' });

      const tabs = Array.isArray(view.categories) ? view.categories : [];
      const tabY = y + 74;
      const tabGap = 5;
      const tabWidth = Math.max(52, (panelWidth - 28 - tabGap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length));
      tabs.slice(0, 5).forEach((tab, index) => {
        const tabX = x + 14 + index * (tabWidth + tabGap);
        this.drawButton(tabX, tabY, tabWidth, 32, tab.label, {
          size: 11,
          bold: tab.isActive,
          active: tab.isActive,
          radius: 8,
        });
        this.addHitTarget({ x: tabX, y: tabY, width: tabWidth, height: 32 }, { type: 'switchGuidebookTab', tab: tab.id });
      });

      const contentX = x + 14;
      const contentY = tabY + 46;
      const contentWidth = panelWidth - 28;
      const contentHeight = y + panelHeight - contentY - 18;
      this.drawPanel(contentX, contentY, contentWidth, contentHeight, {
        fill: 'rgba(18, 24, 20, 0.64)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 10,
      });

      const active = view.activeCategory || {};
      this.drawText(active.title || '城市规划', contentX + 14, contentY + 16, {
        size: 15,
        bold: true,
        color: '#d5ffe8',
      });
      let cursorY = contentY + 46;
      const lines = Array.isArray(active.lines) ? active.lines : [];
      lines.slice(0, 4).forEach((line) => {
        const wrapped = this.wrapTextLimit(line, contentWidth - 28, 2, { size: 12 });
        this.drawTextLines(wrapped, contentX + 14, cursorY, {
          size: 12,
          color: '#c5d8c9',
          lineHeight: 17,
        });
        cursorY += wrapped.length * 17 + 10;
      });

      if (active.id === 'planning' && view.planning) {
        const planningY = Math.min(cursorY + 2, contentY + contentHeight - 96);
        const planningHeight = Math.max(76, contentY + contentHeight - planningY - 12);
        this.drawPanel(contentX + 12, planningY, contentWidth - 24, planningHeight, {
          fill: 'rgba(36, 50, 41, 0.72)',
          stroke: 'rgba(116, 211, 160, 0.18)',
          radius: 9,
        });
        this.drawText(`地理：${view.planning.terrainLabel}`, contentX + 26, planningY + 16, {
          size: 12,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(`${view.planning.text.habitabilityStatus || '宜居度平稳'} · ${view.planning.text.populationGrowthStatus || '人口成长平稳'}`, contentX + 26, planningY + 36, {
          size: 12,
          bold: true,
          color: '#74d3a0',
        });
        this.drawTextLines(this.wrapTextLimit(view.planning.text.note, contentWidth - 52, 2, { size: 11 }), contentX + 26, planningY + 58, {
          size: 11,
          color: '#c5d8c9',
          lineHeight: 15,
        });
      }
    }

    renderTaskCenterPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTaskCenterViewState !== 'function') return;
      const view = this.presenter.buildTaskCenterViewState(state, { activeTab: options.activeTaskCenterTab });
      const layout = this.getLayout();
      const panelWidth = Math.min(372, layout.contentWidth - 10);
      const panelHeight = Math.min(540, Math.max(390, this.height - 188));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 14);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTaskCenter' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(53, 39, 25, 0.99)'],
            [1, 'rgba(21, 18, 14, 0.99)'],
          ],
          'rgba(35, 27, 20, 0.99)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawText('任务', x + 18, y + 18, { size: 18, bold: true, color: '#ffe6b5' });
      this.drawText(`${view.summary?.claimableCount || 0} 个可领取`, x + 18, y + 44, { size: 12, color: '#cbbd96' });
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeTaskCenter' });

      const tabs = Array.isArray(view.tabs) ? view.tabs : [];
      const tabY = y + 72;
      const tabGap = 5;
      const tabWidth = Math.max(54, (panelWidth - 28 - tabGap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length));
      tabs.forEach((tab, index) => {
        const tabX = x + 14 + index * (tabWidth + tabGap);
        this.drawButton(tabX, tabY, tabWidth, 34, tab.label, {
          size: 12,
          bold: tab.isActive,
          active: tab.isActive,
          radius: 8,
        });
        if (Number(tab.badge) > 0) {
          this.drawPanel(tabX + tabWidth - 18, tabY - 5, 20, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.18)',
            radius: 9,
          });
          this.drawText(String(tab.badge), tabX + tabWidth - 8, tabY + 4, {
            size: 9,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: tabX, y: tabY, width: tabWidth, height: 34 },
          { type: 'switchTaskCenterTab', tab: tab.id },
        );
      });

      const listX = x + 14;
      const listY = tabY + 48;
      const listWidth = panelWidth - 28;
      const listBottom = y + panelHeight - 18;
      const tasks = Array.isArray(view.activeCategory?.tasks) ? view.activeCategory.tasks : [];
      if (!tasks.length) {
        this.drawPanel(listX, listY, listWidth, listBottom - listY, {
          fill: 'rgba(23, 18, 13, 0.38)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 10,
        });
        this.drawText(view.activeCategory?.emptyText || '暂无任务', listX + listWidth / 2, listY + 72, {
          size: 14,
          color: '#aeb0b8',
          align: 'center',
        });
        return;
      }

      const itemGap = 10;
      const itemHeight = 104;
      tasks.slice(0, 4).forEach((task, index) => {
        const itemY = listY + index * (itemHeight + itemGap);
        if (itemY + itemHeight > listBottom) return;
        const claimable = task.status === 'claimable' && !task.claimed;
        const completed = task.status === 'completed';
        const buttonWidth = 78;
        const buttonHeight = 34;
        const buttonX = listX + listWidth - buttonWidth - 12;
        const buttonY = itemY + itemHeight - buttonHeight - 12;
        const buttonAction = task.action || (
          claimable
            ? { type: 'claimTaskReward', taskId: task.id, category: task.category || view.activeTab }
            : { type: 'goToGuideTaskTarget', taskId: task.id, target: task.target }
        );
        const buttonDisabled = completed || (!claimable && !task.target && buttonAction.type !== 'goToGuideTaskTarget');
        this.drawPanel(listX, itemY, listWidth, itemHeight, {
          fill: completed ? 'rgba(21, 25, 22, 0.66)' : (claimable ? 'rgba(64, 49, 27, 0.82)' : 'rgba(27, 22, 17, 0.74)'),
          stroke: completed ? 'rgba(116, 211, 160, 0.18)' : (claimable ? 'rgba(247, 215, 116, 0.42)' : 'rgba(255, 226, 177, 0.12)'),
          radius: 10,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(this.truncateText(task.title || '任务', listWidth - 26, { size: 14, bold: true }), listX + 12, itemY + 10, {
          size: 14,
          bold: true,
          color: completed ? '#aec9b8' : '#fff1cf',
        });
        const desc = task.description || task.rewardText || '';
        this.drawTextLines(this.wrapTextLimit(desc, listWidth - 104, 2, { size: 11 }), listX + 12, itemY + 34, {
          size: 11,
          color: completed ? '#8ba494' : '#cbbd96',
          lineHeight: 15,
        });
        this.drawText(this.truncateText(task.rewardText || '无奖励', listWidth - buttonWidth - 34, { size: 12, bold: true }), listX + 12, itemY + 76, {
          size: 12,
          bold: true,
          color: completed ? '#79c79b' : (claimable ? '#ffd98a' : '#74d3a0'),
        });
        this.drawButton(buttonX, buttonY, buttonWidth, buttonHeight, task.actionLabel || (completed ? '已完成' : (claimable ? '领取' : '前往')), {
          disabled: buttonDisabled,
          active: !buttonDisabled,
          size: 12,
          bold: !buttonDisabled,
          radius: 9,
        });
        this.addHitTarget(
          { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight },
          { ...buttonAction, disabled: buttonDisabled },
        );
      });
    }

    renderCitySwitcherMenu(state = {}) {
      if (!this.presenter || typeof this.presenter.buildCitySwitcherViewState !== 'function') return;
      const view = this.presenter.buildCitySwitcherViewState(state);
      if (view.hidden) return;

      const options = Array.isArray(view.options) ? view.options : [];
      const layout = this.getLayout();
      const panelWidth = Math.min(260, layout.contentWidth - 44);
      const x = (this.width - panelWidth) / 2;
      const y = 194;
      const itemHeight = 50;
      const visibleCount = Math.min(options.length, 5);
      const panelHeight = Math.max(56, 18 + visibleCount * itemHeight);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeCitySwitcher' });
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(45, 32, 21, 0.98)'],
            [1, 'rgba(23, 18, 13, 0.98)'],
          ],
          'rgba(35, 26, 19, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 10,
        inset: 'rgba(255, 238, 203, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      if (!options.length) {
        this.drawText('暂无城市', x + panelWidth / 2, y + 23, {
          size: 13,
          color: '#cbbd96',
          align: 'center',
        });
        return;
      }

      options.slice(0, visibleCount).forEach((city, index) => {
        const itemX = x + 9;
        const itemY = y + 9 + index * itemHeight;
        const itemWidth = panelWidth - 18;
        const active = Boolean(city.isActive);
        this.drawPanel(itemX, itemY, itemWidth, 43, {
          fill: active
            ? 'rgba(126, 81, 39, 0.92)'
            : 'rgba(45, 34, 24, 0.82)',
          stroke: active
            ? 'rgba(240, 180, 91, 0.6)'
            : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        if (active) {
          this.drawPanel(itemX, itemY, 4, 43, {
            fill: '#f0b45b',
            stroke: '#f0b45b',
            radius: 2,
          });
        }
        this.drawText(city.name || '未命名城市', itemX + 12, itemY + 8, {
          size: 13,
          bold: true,
          color: '#fff1cf',
        });
        this.drawText(city.tag || '', itemX + itemWidth - 12, itemY + 8, {
          size: 11,
          bold: true,
          color: '#f0b45b',
          align: 'right',
        });
        this.drawText(city.metaText || '', itemX + 12, itemY + 26, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.66)',
        });
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: 43 },
          active || !city.id
            ? { type: 'blockCanvasModal' }
            : { type: 'selectCity', cityId: city.id },
        );
      });
    }

    renderPopulation(state = {}, startY = 84) {
      if (!this.presenter || typeof this.presenter.buildPopulationViewState !== 'function') return startY + 180;
      const view = this.presenter.buildPopulationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const y = startY;
      const panelHeight = 304;
      const jobRowHeight = 42;
      const jobRowGap = 8;
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x + width, y + panelHeight,
          [
            [0, 'rgba(61, 43, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(43, 31, 22, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      this.drawLine(x + 10, y + 6, x + width - 10, y + 6, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawLine(x + 10, y + panelHeight - 6, x + width - 10, y + panelHeight - 6, { color: 'rgba(240, 180, 91, 0.34)', width: 2 });
      this.drawIconCard(x + 14, y + 14, 38, 38, 'assets/art/icon-population-cutout.webp');
      this.drawText(view.text.title || '人才分配', x + 62, y + 20, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText(view.text.subtitle || '核心岗位', x + 62, y + 40, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      const policyButtonWidth = 58;
      const policyButtonHeight = 28;
      const policyButtonX = x + width - policyButtonWidth - 14;
      const policyButtonY = y + 18;
      this.drawButton(policyButtonX, policyButtonY, policyButtonWidth, policyButtonHeight, '方针', {
        size: 12,
        bold: true,
        active: true,
        radius: 8,
      });
      this.addHitTarget(
        { x: policyButtonX, y: policyButtonY, width: policyButtonWidth, height: policyButtonHeight },
        { type: 'openTalentPolicy' },
      );
      this.drawLine(x + 16, y + 56, x + width - 16, y + 56, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });

      const stats = [
        { icon: 'assets/art/icon-population-cutout.webp', label: '人才', value: String(view.text.total), color: '#74d3a0' },
        { icon: 'assets/art/icon-population-cutout.webp', label: '待分配人才', value: String(view.text.unassigned), color: '#74d3a0' },
        { icon: 'assets/art/icon-happiness-cutout.webp', label: '幸福度', value: `${state.happiness || 100}%`, color: '#f9ca24' },
      ];
      const statWidth = Math.floor((width - 28) / 3);
      stats.forEach((stat, index) => {
        const statX = x + 6 + index * statWidth;
        const statY = y + 64;
        this.drawAsset(stat.icon, statX + 8, statY + 7, 18, 18);
        if (index > 0) this.drawLine(statX, statY + 4, statX, statY + 36, { color: 'rgba(255, 226, 177, 0.1)' });
        this.drawText(stat.label, statX + 30, statY + 4, { size: 10, color: 'rgba(234, 234, 234, 0.64)' });
        this.drawText(stat.value, statX + 30, statY + 18, { size: 13, bold: true, color: stat.color });
      });

      const planning = view.planning || {};
      const planningY = y + 106;
      this.drawPanel(x + 7, planningY, width - 14, 42, {
        fill: 'rgba(24, 36, 29, 0.72)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 8,
        inset: 'rgba(116, 211, 160, 0.05)',
      });
      this.drawText(`地理 ${planning.terrainLabel || '平原'}`, x + 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#d5ffe8',
      });
      this.drawText(`${planning.text?.habitabilityStatus || '宜居度平稳'} · ${planning.text?.populationGrowthStatus || '人口成长平稳'}`, x + width - 20, planningY + 12, {
        size: 11,
        bold: true,
        color: '#74d3a0',
        align: 'right',
      });
      this.drawText(this.truncateText(planning.text?.note || '保持建筑搭配，会让城市更稳定。', width - 40, { size: 10 }), x + 20, planningY + 27, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });

      const jobs = view.jobs.filter((job) => job.visible);
      jobs.forEach((job, index) => {
        const rowY = y + 156 + index * (jobRowHeight + jobRowGap);
        const jobLabel = { farmer: '农民', scholar: '学者', craftsman: '工匠' }[job.id] || job.id;
        const desc = { farmer: '生产食物', scholar: '口耳相传', craftsman: '钻研技艺' }[job.id] || '';
        const icon = { farmer: 'assets/art/icon-farmer-cutout.webp', scholar: 'assets/art/icon-scholar-cutout.webp', craftsman: 'assets/art/icon-craftsman-cutout.webp' }[job.id];
        const jobPanelX = x + 7;
        const jobPanelRight = x + width - 7;
        const jobPanelInset = 8;
        this.drawPanel(jobPanelX, rowY, width - 14, jobRowHeight, {
          fill: this.createGradient(
            jobPanelX, rowY, jobPanelRight, rowY + jobRowHeight,
            [
              [0, 'rgba(74, 52, 34, 0.86)'],
              [1, 'rgba(28, 22, 16, 0.84)'],
            ],
            'rgba(52, 38, 27, 0.84)',
          ),
          stroke: 'rgba(255, 226, 177, 0.14)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        this.drawAsset(icon, jobPanelX + jobPanelInset, rowY + 9, 24, 24);
        this.drawText(jobLabel, x + 48, rowY + 8, { size: 13, bold: true, color: '#fff1cf' });
        this.drawText(desc, x + 48, rowY + 26, { size: 10, color: 'rgba(234, 234, 234, 0.58)' });
        const controlGap = 6;
        const controlButtonWidth = 22;
        const countWidth = 40;
        const controlGroupWidth = controlButtonWidth * 2 + countWidth + controlGap * 2;
        const minusX = jobPanelRight - jobPanelInset - controlGroupWidth;
        const countX = minusX + controlButtonWidth + controlGap;
        const plusX = countX + countWidth + controlGap;
        const controlY = rowY + 10;
        this.drawButton(minusX, controlY, controlButtonWidth, 22, '-', { disabled: !job.canDecrease, size: 13, radius: 6 });
        this.drawPanel(countX, rowY + 9, 40, 24, { fill: 'rgba(11, 18, 14, 0.38)', stroke: 'rgba(116, 211, 160, 0.24)', radius: 8, inset: 'rgba(116, 211, 160, 0.08)' });
        this.drawText(job.count, countX + 20, rowY + 21, { size: 14, bold: true, color: '#74d3a0', baseline: 'middle', align: 'center' });
        this.drawButton(plusX, controlY, controlButtonWidth, 22, '+', { disabled: !job.canIncrease, size: 13, radius: 6 });
        this.addHitTarget({ x: minusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: -1, disabled: !job.canDecrease });
        this.addHitTarget({ x: plusX, y: controlY, width: controlButtonWidth, height: 22 }, { type: 'assignJob', job: job.id, delta: 1, disabled: !job.canIncrease });
      });
      return y + panelHeight + 12;
    }

    renderHomeFeatureGrid(state = {}, startY = 400, options = {}) {
      if (!this.presenter || typeof this.presenter.buildHomeFeatureViewState !== 'function') return startY;
      const view = this.presenter.buildHomeFeatureViewState(state);
      const entries = Array.isArray(view.entries) ? view.entries : [];
      if (!entries.length) return startY;
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const maxBottom = Number(options.maxBottom) || tabsTop - 8;
      const y = startY;
      const panelHeight = Math.min(146, Math.max(106, maxBottom - y));
      if (panelHeight < 86) return startY;
      this.drawPanel(x, y, width, panelHeight, {
        fill: this.createGradient(
          x, y, x + width, y + panelHeight,
          [
            [0, 'rgba(44, 35, 25, 0.9)'],
            [1, 'rgba(20, 18, 14, 0.9)'],
          ],
          'rgba(32, 26, 20, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.07)',
      });
      this.drawText(view.title || '功能', x + 16, y + 12, { size: 14, bold: true, color: '#ffe6b5' });
      this.drawText(this.truncateText(view.subtitle || '', width - 92, { size: 10 }), x + 16, y + 32, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.58)',
      });

      const top = y + 52;
      const availableHeight = Math.max(42, y + panelHeight - top - 12);
      const visibleEntries = entries.slice(0, 4);
      const gap = 8;
      const itemWidth = Math.floor((width - 28 - gap * (visibleEntries.length - 1)) / Math.max(1, visibleEntries.length));
      const itemHeight = Math.min(76, availableHeight);
      visibleEntries.forEach((entry, index) => {
        const itemX = x + 14 + index * (itemWidth + gap);
        const itemY = top;
        const disabled = Boolean(entry.disabled || entry.action?.disabled);
        const active = Boolean(entry.badge);
        this.drawPanel(itemX, itemY, itemWidth, itemHeight, {
          fill: active ? 'rgba(76, 50, 30, 0.86)' : 'rgba(27, 23, 18, 0.72)',
          stroke: active ? 'rgba(240, 180, 91, 0.48)' : 'rgba(255, 226, 177, 0.12)',
          radius: 8,
          inset: active ? 'rgba(255, 231, 184, 0.1)' : 'rgba(255, 231, 184, 0.04)',
        });
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = disabled ? 0.45 : previousAlpha;
        const iconSize = 34;
        this.drawAsset(entry.icon, itemX + itemWidth / 2 - iconSize / 2, itemY + 7, iconSize, iconSize);
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(this.truncateText(entry.label || '', itemWidth - 12, { size: 12, bold: true }), itemX + itemWidth / 2, itemY + 44, {
          size: 12,
          bold: true,
          color: disabled ? '#777' : '#fff1cf',
          align: 'center',
        });
        this.drawText(this.truncateText(entry.statusText || '', itemWidth - 10, { size: 9 }), itemX + itemWidth / 2, itemY + 61, {
          size: 9,
          color: disabled ? '#666' : '#aeb0b8',
          align: 'center',
        });
        if (entry.badge > 0) {
          const badgeText = entry.badge > 9 ? '9+' : String(entry.badge);
          this.drawPanel(itemX + itemWidth - 23, itemY + 4, 22, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.16)',
            radius: 9,
          });
          this.drawText(badgeText, itemX + itemWidth - 12, itemY + 13, {
            size: 9,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget(
          { x: itemX, y: itemY, width: itemWidth, height: itemHeight },
          { ...(entry.action || { type: 'blockCanvasModal' }), disabled },
        );
      });
      return y + panelHeight + 12;
    }

    renderFamousPersonItem(card = {}, x, y, width, options = {}) {
      const candidate = Boolean(options.candidate);
      const height = candidate ? 132 : 112;
      this.drawPanel(x, y, width, height, {
        fill: candidate ? 'rgba(52, 39, 27, 0.86)' : 'rgba(27, 23, 18, 0.74)',
        stroke: candidate ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.12)',
        radius: 9,
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
      const rightPad = candidate ? 86 : 14;
      const textWidth = width - (textX - x) - rightPad;
      this.drawText(this.truncateText(`${card.name || '无名之士'} · ${card.title || '名人'}`, textWidth, { size: 14, bold: true }), textX, y + 10, {
        size: 14,
        bold: true,
        color: '#fff1cf',
      });
      this.drawText(this.truncateText(`${card.roleText || '人才'} · ${card.sourceText || ''}`, textWidth, { size: 10 }), textX, y + 31, {
        size: 10,
        color: '#cbbd96',
      });
      this.drawText(this.truncateText(card.stats || '', textWidth, { size: 10 }), textX, y + 55, {
        size: 10,
        color: '#aeb0b8',
      });
      const skill = Array.isArray(card.skills) ? card.skills[0] : '';
      this.drawText(this.truncateText(skill || '', textWidth, { size: 10, bold: true }), textX, y + 74, {
        size: 10,
        bold: true,
        color: '#74d3a0',
      });
      if (candidate) {
        const buttonW = 66;
        const acceptX = x + width - buttonW - 12;
        const dismissX = acceptX;
        this.drawButton(acceptX, y + 15, buttonW, 28, '接纳', { size: 12, bold: true, active: true, radius: 8 });
        this.drawButton(dismissX, y + 52, buttonW, 28, '放弃', { size: 12, radius: 8 });
        this.addHitTarget({ x: acceptX, y: y + 15, width: buttonW, height: 28 }, card.acceptAction);
        this.addHitTarget({ x: dismissX, y: y + 52, width: buttonW, height: 28 }, card.dismissAction);
      }
      return y + height + 10;
    }

    renderFamousPersonsPanel(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildFamousPersonViewState !== 'function') return;
      const view = this.presenter.buildFamousPersonViewState(state);
      const layout = this.getLayout();
      const panelWidth = Math.min(390, layout.contentWidth - 6);
      const panelHeight = Math.min(620, Math.max(470, this.height - 112));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(48, (this.height - panelHeight) / 2 - 8);

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
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const backW = 58;
      this.drawButton(x + 12, y + 12, backW, 30, '返回', { size: 12, radius: 8 });
      this.addHitTarget({ x: x + 12, y: y + 12, width: backW, height: 30 }, { type: 'closeFamousPersons' });
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
          if (cursorY + 132 > y + panelHeight - 94) return;
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
        people.slice(0, 3).forEach((card) => {
          if (cursorY + 112 > y + panelHeight - 18) return;
          cursorY = this.renderFamousPersonItem(card, innerX, cursorY, innerWidth);
        });
      }
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

    renderBuildings(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildBuildingViewState(state, state.tutorial || {}, state.buildingDefinitions || {}, {
        activeCategory: options.activeBuildingCategory || 'all',
      });
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: this.createGradient(
          x, startY, x + width, panelBottom,
          [
            [0, 'rgba(54, 40, 28, 0.94)'],
            [1, 'rgba(24, 19, 14, 0.94)'],
          ],
          'rgba(37, 29, 21, 0.92)',
        ),
        stroke: 'rgba(255, 226, 177, 0.18)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.drawIconCard(x + 14, startY + 14, 38, 38, 'assets/art/building-house-cutout.png');
      this.drawText('建筑', x + 62, startY + 17, { size: 15, bold: true, color: '#ffe6b5' });
      this.drawText('建造与升级', x + 62, startY + 38, { size: 11, color: 'rgba(234, 234, 234, 0.58)' });
      this.drawLine(x + 16, startY + 60, x + width - 16, startY + 60, { color: 'rgba(255, 226, 177, 0.18)', width: 1 });
      const categoryTabs = Array.isArray(view.categoryTabs) ? view.categoryTabs : [];
      const categoryRowHeight = categoryTabs.length > 1 ? 32 : 0;
      if (categoryRowHeight) {
        this.drawBuildingCategoryTabs(categoryTabs, x + 14, startY + 68, width - 28);
      }
      if (view.isEmpty) {
        this.drawText(view.emptyText, x + width / 2, startY + 104 + categoryRowHeight, { color: '#cbbd96', size: 13, align: 'center' });
        return;
      }
      const rowHeight = 174;
      const rowGap = 8;
      const firstRowY = startY + 76 + categoryRowHeight;
      let visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 8) / (rowHeight + rowGap)));
      let offset = Math.max(0, Number(options.offset) || 0);
      let maxOffset = Math.max(0, view.cards.length - visibleCount);
      if (view.cards.length > visibleCount || offset > 0) {
        visibleCount = Math.max(1, Math.floor((panelBottom - firstRowY - 42) / (rowHeight + rowGap)));
        maxOffset = Math.max(0, view.cards.length - visibleCount);
      }
      const pageCount = Math.max(1, Math.ceil(view.cards.length / visibleCount));
      const pageIndex = Math.min(Math.max(0, offset), pageCount - 1);
      offset = pageIndex * visibleCount;
      const visibleCards = view.cards.slice(offset, offset + visibleCount);
      const drawCards = (cards, cardOffset = offset) => {
        cards.forEach((card, index) => {
          const y = firstRowY + index * (rowHeight + rowGap);
          const isMuted = Boolean(card.isMuted || card.button.disabled);
          this.drawPanel(x + 10, y, width - 20, rowHeight, {
            fill: isMuted
              ? 'rgba(35, 31, 27, 0.78)'
              : this.createGradient(
                x + 10, y, x + width - 10, y + rowHeight,
                [
                  [0, 'rgba(79, 57, 38, 0.88)'],
                  [1, 'rgba(28, 22, 16, 0.86)'],
                ],
                'rgba(48, 36, 26, 0.86)',
              ),
            stroke: isMuted ? 'rgba(255, 226, 177, 0.1)' : 'rgba(255, 226, 177, 0.16)',
            radius: 8,
            inset: 'rgba(255, 231, 184, 0.07)',
          });
          if (card.art) this.drawAsset(card.art, x + 20, y + 14, 46, 46, isMuted ? 0.62 : 1);
          else this.drawText(card.icon || '', x + 43, y + 37, { size: 24, align: 'center', baseline: 'middle' });

          const textX = x + 76;
          const actionWidth = Math.min(128, Math.max(104, width - 238));
          const buttonX = x + width - actionWidth - 22;
          const textWidth = Math.max(112, buttonX - textX - 12);
          this.drawText(card.name, textX, y + 10, { size: 13, bold: true, color: '#fff1cf' });
          this.drawText(card.metaText || card.levelText, textX, y + 29, { size: 11, color: 'rgba(234, 234, 234, 0.62)' });

          this.drawBuildingInfoLine(card.currentEffectText || '当前效果：无', textX, y + 58, textWidth, { tone: 'current' });
          this.drawBuildingInfoLine(card.nextEffectText || '下一级效果：无', textX, y + 77, x + width - 98, { tone: 'next' });
          this.drawBuildingInfoLine(card.maintenanceText || '维护所需：无', textX, y + 96, x + width - 98, { tone: 'maintenance' });
          this.drawBuildingInfoLine(card.cityImpactText || '城市影响：宜居压力平稳', textX, y + 115, x + width - 98, { tone: 'impact' });

          this.drawBuildingCostChips(card.cost, buttonX, y + 9, actionWidth, 44, {
            muted: isMuted,
            resources: state.resources || {},
          });
          this.drawText(card.costTitle || '升级所需', buttonX, y + 58, {
            size: 10,
            bold: true,
            color: 'rgba(255, 226, 177, 0.68)',
          });
          this.drawBuildingActionButton(buttonX, y + rowHeight - 36, actionWidth, 26, card.button.label, card.cost, { disabled: card.button.disabled });
          this.addHitTarget(
            { x: buttonX, y: y + rowHeight - 36, width: actionWidth, height: 26 },
            { type: card.button.action === 'upgrade' ? 'upgradeBuilding' : 'buildBuilding', buildingId: card.id, disabled: card.button.disabled },
          );
        });
      };
      const cardsBottom = firstRowY + visibleCount * (rowHeight + rowGap) - rowGap;
      const transition = this.getTransitionFrame(options.buildingTransition);
      if (transition && Number(options.buildingTransition?.toOffset) === pageIndex) {
        const fromPage = Math.min(Math.max(0, Number(options.buildingTransition.fromOffset) || 0), pageCount - 1);
        const fromOffset = fromPage * visibleCount;
        const oldCards = view.cards.slice(fromOffset, fromOffset + visibleCount);
        const travel = width + 24;
        this.withSlideClip(x, firstRowY - 4, width, Math.max(rowHeight, cardsBottom - firstRowY + 8), -transition.direction * travel * transition.eased, () => {
          this.withSuppressedHitTargets(() => drawCards(oldCards, fromOffset));
        });
        this.withSlideClip(x, firstRowY - 4, width, Math.max(rowHeight, cardsBottom - firstRowY + 8), transition.direction * travel * (1 - transition.eased), () => {
          drawCards(visibleCards, offset);
        });
      } else {
        drawCards(visibleCards, offset);
      }
      if (view.cards.length > visibleCount) {
        const pagerY = panelBottom - 32;
        const buttonWidth = 68;
        const gap = 8;
        const prevX = x + width / 2 - buttonWidth - gap - 42;
        const nextX = x + width / 2 + 42 + gap;
        const canPrev = pageIndex > 0;
        const canNext = pageIndex < pageCount - 1;
        const currentPage = pageIndex + 1;
        this.drawButton(prevX, pagerY, buttonWidth, 24, '上一页', { disabled: !canPrev, size: 11, radius: 7 });
        this.drawText(`${currentPage}/${pageCount}`, x + width / 2, pagerY + 12, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.62)',
          baseline: 'middle',
          align: 'center',
        });
        this.drawButton(nextX, pagerY, buttonWidth, 24, '下一页', { disabled: !canNext, size: 11, radius: 7 });
        this.addHitTarget({ x: prevX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: -1, disabled: !canPrev });
        this.addHitTarget({ x: nextX, y: pagerY, width: buttonWidth, height: 24 }, { type: 'scrollBuildings', delta: 1, disabled: !canNext });
      }
    }

    drawBuildingCategoryTabs(tabs = [], x, y, width) {
      if (!this.ctx || !Array.isArray(tabs) || tabs.length <= 1) return;
      const gap = 5;
      const height = 26;
      const items = tabs.filter((tab) => tab && tab.id && tab.count > 0);
      if (items.length <= 1) return;
      const rawWidths = items.map((tab) => {
        const label = String(tab.label || tab.id);
        return Math.max(42, this.measureTextWidth(label, { size: 11, bold: Boolean(tab.active) }) + 22);
      });
      const totalGap = gap * Math.max(0, items.length - 1);
      const rawTotal = rawWidths.reduce((sum, value) => sum + value, 0) + totalGap;
      const scale = rawTotal > width ? Math.max(0.72, (width - totalGap) / Math.max(1, rawTotal - totalGap)) : 1;
      let cursorX = x;
      items.forEach((tab, index) => {
        const remainingItems = items.length - index - 1;
        const remainingGap = remainingItems * gap;
        const tabWidth = Math.max(36, Math.floor(rawWidths[index] * scale));
        const actualWidth = Math.max(36, Math.min(tabWidth, x + width - cursorX - remainingGap));
        const active = Boolean(tab.active);
        this.drawButton(cursorX, y, actualWidth, height, this.truncateText(tab.label || tab.id, Math.max(18, actualWidth - 12), {
          size: 11,
          bold: active,
        }), {
          active,
          size: 11,
          bold: active,
          radius: 13,
        });
        this.addHitTarget(
          { x: cursorX, y, width: actualWidth, height },
          { type: 'selectBuildingCategory', category: tab.id, disabled: active },
        );
        cursorX += actualWidth + gap;
      });
    }

    drawBuildingInfoLine(text, x, y, width, options = {}) {
      const palette = {
        current: '#f6e8c8',
        next: '#d5ffe8',
        maintenance: '#cbbd96',
        impact: '#f1c27d',
      };
      const content = this.truncateText(text || '', width, { size: 10, bold: options.tone === 'next' });
      this.drawText(content, x, y, {
        size: 10,
        bold: options.tone === 'next',
        color: palette[options.tone] || '#cbbd96',
      });
    }

    drawBuildingPlanningBadges(badges = [], x, y, width, options = {}) {
      const items = Array.isArray(badges) ? badges.slice(0, 3) : [];
      if (!items.length) return;
      const gap = 4;
      const rowGap = 3;
      const height = 17;
      const maxRows = 2;
      let cursorX = x;
      let cursorY = y;
      let row = 0;
      const palette = {
        maintenance: {
          fill: 'rgba(44, 62, 80, 0.52)',
          stroke: 'rgba(129, 178, 154, 0.24)',
          color: '#b7d4c2',
        },
        pressure: {
          fill: 'rgba(88, 58, 34, 0.52)',
          stroke: 'rgba(240, 180, 91, 0.26)',
          color: '#f1c27d',
        },
        scale: {
          fill: 'rgba(48, 68, 48, 0.5)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          color: '#9ddfb5',
        },
      };
      items.forEach((badge) => {
        const style = palette[badge.type] || palette.maintenance;
        const rawLabel = String(badge.label || '');
        if (!rawLabel) return;
        let available = x + width - cursorX;
        let label = this.truncateText(rawLabel, Math.min(82, available - 12), { size: 9, bold: true });
        let badgeWidth = Math.min(88, Math.max(38, this.measureTextWidth(label, { size: 9, bold: true }) + 12));
        if (badgeWidth > available && row < maxRows - 1) {
          row += 1;
          cursorX = x;
          cursorY += height + rowGap;
          available = width;
          label = this.truncateText(rawLabel, Math.min(82, available - 12), { size: 9, bold: true });
          badgeWidth = Math.min(88, Math.max(38, this.measureTextWidth(label, { size: 9, bold: true }) + 12));
        }
        if (available < 34) return;
        this.drawPanel(cursorX, cursorY, badgeWidth, height, {
          fill: options.muted ? 'rgba(45, 42, 38, 0.46)' : style.fill,
          stroke: options.muted ? 'rgba(255, 226, 177, 0.08)' : style.stroke,
          radius: 6,
        });
        this.drawText(label, cursorX + badgeWidth / 2, cursorY + height / 2, {
          size: 9,
          bold: true,
          color: options.muted ? '#8d8f99' : style.color,
          align: 'center',
          baseline: 'middle',
        });
        cursorX += badgeWidth + gap;
      });
    }

    resourceShortName(resource) {
      return {
        food: '食物',
        wood: '木材',
        iron: '铁矿',
        knowledge: '知识',
        stone: '石料',
        metal: '铁矿',
      }[resource] || resource;
    }

    resourceIconPath(resource) {
      return {
        food: 'assets/art/icon-food-cutout.webp',
        wood: 'assets/art/icon-wood-cutout.webp',
        iron: 'assets/art/icon-iron-cutout.webp',
        knowledge: 'assets/art/icon-knowledge-cutout.webp',
        stone: 'assets/art/icon-stone-cutout.webp',
        metal: 'assets/art/icon-iron-cutout.webp',
        soldier: 'assets/art/icon-soldier-cutout.webp',
      }[resource] || '';
    }

    buildingCostResourceAliases(resource) {
      return resource === 'iron' ? ['iron', 'metal'] : [resource];
    }

    formatBuildingCostAmount(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return String(value ?? 0);
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) return String(Math.floor(number));
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${String(scaled.toFixed(1)).replace(/\.0$/, '')}${unit.suffix}`;
    }

    getBuildingCostSlot(cost = {}, resource) {
      const aliases = this.buildingCostResourceAliases(resource);
      const parts = Array.isArray(cost?.parts) ? cost.parts : [];
      const matches = parts.filter((part) => aliases.includes(part?.resource));
      if (!matches.length) {
        return { resource, value: 0, text: '0', present: false };
      }
      if (matches.length === 1) {
        const match = matches[0];
        const value = Number(match.value) || 0;
        return {
          resource,
          value,
          text: String(match.text ?? this.formatBuildingCostAmount(value)),
          present: true,
        };
      }
      const total = matches.reduce((sum, part) => sum + (Number(part.value) || 0), 0);
      return {
        resource,
        value: total,
        text: this.formatBuildingCostAmount(total),
        present: total > 0,
      };
    }

    getOwnedBuildingResource(resources = {}, resource) {
      const aliases = this.buildingCostResourceAliases(resource);
      const key = aliases.find((alias) => resources?.[alias] !== undefined);
      return Number(key ? resources[key] : 0) || 0;
    }

    drawBuildingActionButton(x, y, width, height, label, cost = {}, options = {}) {
      const knowledge = this.getBuildingCostSlot(cost, 'knowledge');
      if (cost?.isMax || !knowledge.present || knowledge.value <= 0) {
        this.drawButton(x, y, width, height, label, { disabled: options.disabled, size: 12, radius: 8 });
        return;
      }
      this.drawPanel(x, y, width, height, {
        fill: options.disabled ? 'rgba(60, 52, 46, 0.72)' : 'rgba(50, 35, 22, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.32)',
        radius: 8,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      const amountText = this.truncateText(String(knowledge.text), Math.max(20, width * 0.32), { size: 10, bold: true });
      const amountWidth = this.measureTextWidth(amountText, { size: 10, bold: true });
      const iconSize = 13;
      const gap = 4;
      const labelMaxWidth = Math.max(28, width - amountWidth - iconSize - gap * 2 - 12);
      const labelText = this.truncateText(label, labelMaxWidth, { size: 11, bold: true });
      const labelWidth = this.measureTextWidth(labelText, { size: 11, bold: true });
      const groupWidth = labelWidth + gap + iconSize + 2 + amountWidth;
      const startX = x + Math.max(7, (width - groupWidth) / 2);
      const centerY = y + height / 2;
      const textColor = options.disabled ? '#8d8f99' : '#f6e8c8';
      this.drawText(labelText, startX, centerY, {
        color: textColor,
        size: 11,
        bold: true,
        baseline: 'middle',
      });
      const iconX = startX + labelWidth + gap;
      const iconY = y + (height - iconSize) / 2;
      if (!this.drawAsset(this.resourceIconPath('knowledge'), iconX, iconY, iconSize, iconSize, options.disabled ? 0.52 : 1)) {
        this.drawText('\u77e5', iconX + iconSize / 2, centerY, {
          color: textColor,
          size: 9,
          bold: true,
          align: 'center',
          baseline: 'middle',
        });
      }
      this.drawText(amountText, iconX + iconSize + 2, centerY, {
        color: textColor,
        size: 10,
        bold: true,
        baseline: 'middle',
      });
    }

    drawBuildingCostChips(cost = {}, x, y, width, height, options = {}) {
      if (cost?.isMax) {
        const text = cost?.text || '\u5df2\u6ee1\u7ea7';
        const fill = cost?.isMax ? 'rgba(60, 52, 46, 0.48)' : 'rgba(116, 211, 160, 0.12)';
        const stroke = cost?.isMax ? 'rgba(255, 226, 177, 0.1)' : 'rgba(116, 211, 160, 0.26)';
        this.drawPanel(x, y + 7, width, 24, { fill, stroke, radius: 7 });
        this.drawText(this.truncateText(text, width - 14, { size: 10, bold: true }), x + width / 2, y + 19, {
          size: 10,
          bold: true,
          color: cost?.isMax ? '#a0a0a0' : '#74d3a0',
          align: 'center',
          baseline: 'middle',
        });
        return;
      }

      const gap = 4;
      const chipHeight = 18;
      const chipColumns = 2;
      const chipWidth = Math.floor((width - gap * (chipColumns - 1)) / chipColumns);
      ['wood', 'iron', 'stone', 'food'].forEach((resource, index) => {
        const part = this.getBuildingCostSlot(cost, resource);
        const col = index % chipColumns;
        const row = Math.floor(index / chipColumns);
        const chipX = x + col * (chipWidth + gap);
        const chipY = y + row * (chipHeight + gap);
        const required = Number(part.value) || 0;
        const owned = this.getOwnedBuildingResource(options.resources || {}, resource);
        const insufficient = part.present && required > 0 && owned < required;
        const fill = insufficient
          ? 'rgba(116, 47, 39, 0.58)'
          : (part.present ? 'rgba(40, 48, 34, 0.62)' : 'rgba(50, 44, 36, 0.42)');
        const stroke = insufficient
          ? 'rgba(235, 116, 100, 0.46)'
          : (part.present ? 'rgba(116, 211, 160, 0.24)' : 'rgba(255, 226, 177, 0.12)');
        const textColor = insufficient ? '#ffb0a5' : (part.present ? '#f6e8c8' : '#9a927e');
        this.drawPanel(chipX, chipY, chipWidth, chipHeight, { fill, stroke, radius: 6, inset: 'rgba(255, 255, 255, 0.04)' });
        const iconPath = this.resourceIconPath(resource);
        if (!this.drawAsset(iconPath, chipX + 4, chipY + 3, 12, 12, options.muted || !part.present ? 0.5 : 1)) {
          this.drawText(this.resourceShortName(resource), chipX + 8, chipY + 9, {
            size: 8,
            bold: true,
            color: textColor,
            align: 'center',
            baseline: 'middle',
          });
        }
        const valueText = this.truncateText(String(part.text ?? required), chipWidth - 21, { size: 10, bold: true });
        this.drawText(valueText, chipX + 19, chipY + 9, {
          size: 10,
          bold: true,
          color: textColor,
          baseline: 'middle',
        });
      });
    }

    eventRowColor(tone) {
      return {
        reward: '#74d3a0',
        cost: '#f7d774',
        penalty: '#ff9aa2',
        requirement: '#ffd98a',
        time: '#f7d774',
        neutral: '#cbbd96',
      }[tone] || '#cbbd96';
    }

    drawEventDetailRow(row, x, y, width, options = {}) {
      if (!row) return 0;
      const size = options.size || 11;
      const lineHeight = options.lineHeight || 15;
      const maxLines = options.maxLines || 1;
      const labelWidth = options.labelWidth || 38;
      const label = row.label ? `${row.label}:` : '';
      this.drawText(label, x, y, {
        size,
        bold: true,
        color: this.eventRowColor(row.tone),
      });
      const textX = x + labelWidth;
      const textWidth = Math.max(24, width - labelWidth);
      if (Array.isArray(row.parts) && row.parts.length) {
        this.drawEventParts(row.parts, textX, y - 2, textWidth, { size, lineHeight, color: options.color || '#cbbd96' });
        return lineHeight;
      }
      const lines = this.wrapTextLimit(row.text || '', textWidth, maxLines, { size });
      this.drawTextLines(lines, textX, y, {
        size,
        color: row.empty ? 'rgba(203, 189, 150, 0.58)' : (options.color || '#cbbd96'),
        lineHeight,
      });
      return Math.max(lineHeight, lines.length * lineHeight);
    }

    drawEventParts(parts = [], x, y, width, options = {}) {
      const size = options.size || 10;
      const iconSize = Math.max(11, size + 2);
      const gap = 4;
      let cursorX = x;
      const baselineY = y + iconSize / 2;
      parts.forEach((part, index) => {
        if (cursorX > x + width - 8) return;
        if (index > 0) cursorX += gap + 2;
        if (part.type === 'resource') {
          const iconPath = this.resourceIconPath(part.resource);
          if (iconPath && this.drawAsset(iconPath, cursorX, y, iconSize, iconSize)) {
            cursorX += iconSize + 2;
          } else {
            const fallback = this.resourceShortName(part.resource).slice(0, 1);
            this.drawText(fallback, cursorX + iconSize / 2, baselineY, {
              size: Math.max(8, size - 1),
              bold: true,
              color: options.color || '#cbbd96',
              align: 'center',
              baseline: 'middle',
            });
            cursorX += iconSize + 2;
          }
        }
        const text = this.truncateText(part.text || '', Math.max(12, x + width - cursorX), { size, bold: true });
        this.drawText(text, cursorX, baselineY, {
          size,
          bold: part.type === 'resource',
          color: options.color || '#cbbd96',
          baseline: 'middle',
        });
        cursorX += this.measureTextWidth(text, { size, bold: part.type === 'resource' });
      });
    }

    renderEvents(state = {}, startY = 210, panelHeight = 310) {
      if (!this.presenter) return;
      const view = this.presenter.buildEventViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader(`待处理事件${view.badge.hidden ? '' : ` ${view.badge.text}`}`, x + 14, startY + 14, '');
      this.drawAsset('assets/art/icon-event-cutout.webp', x + width - 42, startY + 9, 24, 24, 0.9);
      const contentX = x + 12;
      const contentWidth = width - 24;
      const pendingTop = startY + 44;
      const historyTitleY = Math.max(pendingTop + 92, Math.min(startY + panelHeight - 128, pendingTop + 250));
      const cardHeight = 78;
      const cardGap = 8;
      const maxPendingCards = Math.max(1, Math.floor((historyTitleY - pendingTop - 10) / (cardHeight + cardGap)));

      if (view.pending.isEmpty) {
        this.drawPanel(contentX, pendingTop, contentWidth, 54, {
          fill: 'rgba(28, 22, 16, 0.58)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawText(view.pending.emptyText, x + width / 2, pendingTop + 27, {
          color: '#cbbd96',
          size: 13,
          baseline: 'middle',
          align: 'center',
        });
      } else {
        view.pending.cards.slice(0, maxPendingCards).forEach((card, index) => {
          const y = pendingTop + index * (cardHeight + cardGap);
          const isThreat = Boolean(card.classState?.['is-threat']);
          const isSpecial = Boolean(card.classState?.['is-special']);
          this.drawPanel(contentX, y, contentWidth, cardHeight, {
            fill: isThreat ? 'rgba(58, 28, 28, 0.84)' : 'rgba(28, 22, 16, 0.84)',
            stroke: isThreat
              ? 'rgba(233, 69, 96, 0.5)'
              : (isSpecial ? 'rgba(247, 215, 116, 0.48)' : 'rgba(255, 226, 177, 0.12)'),
            radius: 8,
          });
          const iconAsset = card.iconAsset || 'assets/art/icon-event-cutout.webp';
          const iconSize = 34;
          const iconX = contentX + 10;
          const iconY = y + 10;
          this.drawAsset(iconAsset, iconX, iconY, iconSize, iconSize);
          const textX = iconX + iconSize + 9;
          const textWidth = Math.max(120, contentX + contentWidth - textX - 12);
          const title = this.truncateText(card.title, textWidth, { size: 14, bold: true });
          const descriptionLines = this.wrapTextLimit(card.description, textWidth, 2, { size: 11 });
          const hint = this.truncateText(card.hint, textWidth, { size: 11 });
          this.drawText(title, textX, y + 8, { size: 14, bold: true });
          this.drawTextLines(descriptionLines, textX, y + 29, {
            color: '#aeb0b8',
            size: 11,
            lineHeight: 15,
          });
          this.drawText(hint, textX, y + cardHeight - 20, {
            color: isThreat ? '#ff9aa2' : '#f7d774',
            size: 11,
          });
          this.addHitTarget({ x: contentX, y, width: contentWidth, height: cardHeight }, { type: 'openEvent', eventId: card.id });
        });
        if (view.pending.cards.length > maxPendingCards) {
          this.drawText(`还有 ${view.pending.cards.length - maxPendingCards} 个事件`, x + width - 14, historyTitleY - 20, {
            color: 'rgba(234, 234, 234, 0.56)',
            size: 11,
            align: 'right',
          });
        }
      }

      this.drawLine(x + 14, historyTitleY - 8, x + width - 14, historyTitleY - 8, {
        color: 'rgba(240, 180, 91, 0.18)',
      });
      this.renderSectionHeader('最近事件', x + 14, historyTitleY, '');
      if (view.history.isEmpty) {
        this.drawText(view.history.emptyText, x + 14, historyTitleY + 30, { color: '#cbbd96', size: 12 });
      } else {
        const historyTop = historyTitleY + 30;
        const maxHistoryItems = Math.max(1, Math.floor((startY + panelHeight - historyTop - 10) / 38));
        view.history.items.slice(0, maxHistoryItems).forEach((item, index) => {
          const y = historyTop + index * 38;
          const isThreat = item.className === 'threat';
          this.drawPanel(contentX, y, contentWidth, 30, {
            fill: 'rgba(28, 22, 16, 0.58)',
            stroke: isThreat ? 'rgba(233, 69, 96, 0.3)' : 'rgba(116, 211, 160, 0.24)',
            radius: 7,
          });
          this.drawAsset(item.iconAsset || 'assets/art/icon-event-cutout.webp', x + 16, y + 6, 18, 18);
          this.drawText(item.title, x + 48, y + 7, { size: 12, bold: true, color: '#f6e8c8' });
          this.drawText(item.result, x + width - 24, y + 7, {
            size: 11,
            color: isThreat ? '#ff9aa2' : '#74d3a0',
            align: 'right',
          });
        });
      }
    }

    renderEventModal(state = {}, activeEventId = null) {
      if (!this.presenter || !activeEventId) return;
      const eventData = (state.eventQueue || []).find((item) => item.id === activeEventId);
      if (!eventData) return;
      const view = this.presenter.buildEventModalViewState(eventData);
      if (!view.showModal) return;

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeEvent' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const options = view.options.length ? view.options : [{
        id: view.claimButton.optionId,
        label: view.claimButton.label,
        preview: view.text.reward,
        rows: [{ label: '奖励', text: view.text.reward, tone: 'reward' }],
      }];
      const optionCount = Math.max(1, options.length);
      const panelHeight = Math.min(this.height - 96, Math.max(382, 270 + optionCount * 126));
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(48, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeEvent' });

      const descX = x + 18;
      const descWidth = panelWidth - 36;
      const modalIconSize = 30;
      const titleWidth = panelWidth - 112;
      const titleLines = this.wrapTextLimit(view.text.title, titleWidth, 2, { size: 17, bold: true });
      const titleY = y + 22;
      this.drawAsset(view.iconAsset || 'assets/art/icon-event-cutout.webp', descX, y + 17, modalIconSize, modalIconSize);
      this.drawTextLines(titleLines, descX + modalIconSize + 10, titleY, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        lineHeight: 21,
      });

      const descY = titleY + Math.max(24, titleLines.length * 21) + 10;
      const descHeight = 80;
      const descLines = this.wrapTextLimit(view.text.description, descWidth - 24, 4, { size: 13 });
      this.drawPanel(descX, descY, descWidth, descHeight, {
        fill: 'rgba(23, 18, 13, 0.36)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 9,
      });
      this.drawTextLines(descLines, descX + 12, descY + 10, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 16,
      });

      const metaRows = Array.isArray(view.metaRows) && view.metaRows.length
        ? view.metaRows
        : [{ label: optionCount > 1 ? '选项' : '奖励', text: view.text.reward, tone: optionCount > 1 ? 'neutral' : 'reward' }];
      const metaY = descY + descHeight + 8;
      const metaHeight = Math.min(54, 12 + metaRows.slice(0, 2).length * 18);
      this.drawPanel(descX, metaY, descWidth, metaHeight, {
        fill: 'rgba(23, 18, 13, 0.48)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 9,
      });
      metaRows.slice(0, 2).forEach((row, index) => {
        this.drawEventDetailRow(row, descX + 12, metaY + 8 + index * 18, descWidth - 24, {
          size: 11,
          lineHeight: 15,
          labelWidth: 38,
          maxLines: 1,
        });
      });

      const laterY = y + panelHeight - 42;
      const optionTop = metaY + metaHeight + 12;
      const optionGap = 8;
      const optionAreaHeight = Math.max(72, laterY - optionTop - 12);
      const roomyHeight = optionCount >= 4 ? 112 : 126;
      const optionHeight = Math.max(106, Math.min(roomyHeight, Math.floor((optionAreaHeight - (optionCount - 1) * optionGap) / optionCount)));
      const visibleCount = Math.max(1, Math.min(optionCount, Math.floor((optionAreaHeight + optionGap) / (optionHeight + optionGap))));
      options.slice(0, visibleCount).forEach((option, index) => {
        const optionY = optionTop + index * (optionHeight + optionGap);
        this.drawPanel(descX, optionY, descWidth, optionHeight, {
          fill: this.createGradient(
            descX, optionY, descX + descWidth, optionY + optionHeight,
            [
              [0, 'rgba(74, 52, 32, 0.96)'],
              [1, 'rgba(36, 27, 19, 0.96)'],
            ],
            'rgba(58, 42, 28, 0.96)',
          ),
          stroke: 'rgba(247, 215, 116, 0.5)',
          radius: 9,
          inset: 'rgba(255, 231, 184, 0.12)',
        });
        const label = this.truncateText(option.label || '处理事件', descWidth - 24, { size: 13, bold: true });
        this.drawText(label, descX + 12, optionY + 9, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
        });
        const rows = Array.isArray(option.rows) && option.rows.length
          ? option.rows
          : [{ label: '结果', text: option.preview || '', tone: 'neutral' }];
        const maxRows = Math.max(1, Math.floor((optionHeight - 30) / 16));
        rows.slice(0, maxRows).forEach((row, rowIndex) => {
          this.drawEventDetailRow(row, descX + 12, optionY + 30 + rowIndex * 16, descWidth - 24, {
            size: 10,
            lineHeight: 15,
            labelWidth: 36,
            maxLines: rows.length === 1 && maxRows > 1 ? 2 : 1,
          });
        });
        this.addHitTarget({ x: descX, y: optionY, width: descWidth, height: optionHeight }, {
          type: 'claimEvent',
          eventId: eventData.id,
          optionId: option.id,
        });
      });

      if (visibleCount < optionCount) {
        this.drawText(`还有 ${optionCount - visibleCount} 个选项未显示`, descX + descWidth - 2, laterY - 10, {
          size: 10,
          color: 'rgba(234, 234, 234, 0.56)',
          align: 'right',
        });
      }
      this.drawButton(descX, laterY, descWidth, 30, '稍后查看', { size: 12, radius: 8 });
      this.addHitTarget({ x: descX, y: laterY, width: descWidth, height: 30 }, { type: 'closeEvent' });
    }

    renderCivilization(state = {}, startY = 210, panelHeight = 420, options = {}) {
      if (!this.presenter || typeof this.presenter.buildCivilizationViewState !== 'function') return;
      const view = this.presenter.buildCivilizationViewState(
        state,
        options.tutorial || state.tutorial || {},
        { canOpenCivilizationTab: options.canOpenCivilizationTab !== false },
      );
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const panelBottom = startY + panelHeight;
      const compact = panelHeight < 430;
      const sectionGap = compact ? 8 : 10;
      const overviewX = x + 12;
      const overviewY = startY + 12;
      const overviewWidth = width - 24;
      const overviewHeight = panelHeight < 390 ? 128 : (panelHeight < 500 ? 136 : 148);
      const eraY = overviewY + overviewHeight + sectionGap;
      const innerBottom = panelBottom - 12;
      const availableAfterOverview = Math.max(0, innerBottom - eraY);
      const minEraHeight = compact ? 188 : 214;
      const canShowFeature = availableAfterOverview >= minEraHeight + sectionGap + 64;
      const eraHeight = canShowFeature
        ? Math.min(compact ? 244 : 300, Math.max(minEraHeight, Math.floor((availableAfterOverview - sectionGap) * 0.72)))
        : Math.max(168, availableAfterOverview);
      const featureY = eraY + eraHeight + sectionGap;
      const featureHeight = canShowFeature ? Math.max(58, innerBottom - featureY) : 0;

      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });

      this.drawPanel(overviewX, overviewY, overviewWidth, overviewHeight, {
        fill: this.createGradient(
          overviewX, overviewY, overviewX, overviewY + overviewHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', overviewX + 12, overviewY + 12, 32, 32);
      this.drawText(view.text.eraName, overviewX + 50, overviewY + 19, { size: 16, bold: true, color: '#f0b45b' });
      this.drawText(view.text.civOverviewDay, overviewX + overviewWidth - 12, overviewY + 20, {
        size: 12,
        color: '#a0a0a0',
        align: 'right',
      });
      this.drawLine(overviewX + 12, overviewY + 54, overviewX + overviewWidth - 12, overviewY + 54, {
        color: 'rgba(255, 226, 177, 0.14)',
      });

      const stats = [
        { label: '人口', value: view.text.civOverviewPop, icon: 'assets/art/icon-population-cutout.webp' },
        { label: '建筑', value: view.text.civOverviewBuildings, icon: 'assets/art/building-house-cutout.png' },
        { label: '科技', value: view.text.civOverviewTechs, icon: 'assets/art/icon-science-cutout.webp' },
        { label: '幸福度', value: view.text.civOverviewHappiness, icon: 'assets/art/icon-happiness-cutout.webp' },
      ];
      const compactOverview = overviewHeight < 140;
      const statGap = 8;
      const statLeft = overviewX + 12;
      const statRight = overviewX + overviewWidth - 12;
      const statWidth = Math.floor((statRight - statLeft - statGap) / 2);
      const statTop = overviewY + (compactOverview ? 58 : 62);
      const statBottom = overviewY + overviewHeight - 8;
      const statRowGap = compactOverview ? 5 : 7;
      const statHeight = Math.floor((statBottom - statTop - statRowGap) / 2);
      const statIconSize = compactOverview ? 20 : 26;
      stats.forEach((item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const statX = col === 0 ? statLeft : statRight - statWidth;
        const statY = row === 0 ? statTop : statBottom - statHeight;
        this.drawPanel(statX, statY, statWidth, statHeight, {
          fill: 'rgba(63, 47, 32, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.1)',
          radius: 8,
        });
        this.drawAsset(item.icon, statX + 8, statY + (statHeight - statIconSize) / 2, statIconSize, statIconSize);
        this.drawText(item.label, statX + 34, statY + (compactOverview ? 3 : 6), { size: compactOverview ? 9 : 10, color: '#a0a0a0' });
        this.drawText(String(item.value), statX + 34, statY + (compactOverview ? 16 : 21), { size: compactOverview ? 12 : 14, bold: true, color: '#74d3a0' });
      });

      const eraX = x + 12;
      const eraWidth = width - 24;
      this.drawPanel(eraX, eraY, eraWidth, eraHeight, {
        fill: this.createGradient(
          eraX, eraY, eraX, eraY + eraHeight,
          [
            [0, 'rgba(54, 40, 28, 0.92)'],
            [1, 'rgba(28, 22, 17, 0.9)'],
          ],
          'rgba(44, 32, 23, 0.9)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('时代进阶', eraX + 12, eraY + 14, '🔥');
      this.drawAsset('assets/art/icon-food-cutout.webp', eraX + eraWidth / 2 - 42, eraY + 40, 38, 38);
      this.drawText(this.truncateText(view.text.eraTargetName, eraWidth - 112, { size: 15, bold: true }), eraX + eraWidth / 2 + 4, eraY + 59, {
        size: 15,
        bold: true,
        color: '#f6e8c8',
        baseline: 'middle',
      });
      this.drawProgressBar(eraX + 12, eraY + 84, eraWidth - 24, 10, view.progress.percentage);
      this.drawText(this.truncateText(view.text.eraProgressText, eraWidth - 32, { size: 11 }), eraX + eraWidth / 2, eraY + 102, {
        size: 11,
        color: '#a0a0a0',
        align: 'center',
      });

      const conditions = view.conditions || [];
      const buttonY = eraY + eraHeight - 42;
      const conditionTop = eraY + 114;
      const conditionRowHeight = 22;
      const conditionRowGap = 5;
      const conditionRows = Math.max(
        0,
        Math.floor((buttonY - conditionTop - conditionRowHeight - 2) / (conditionRowHeight + conditionRowGap)) + 1,
      );
      const conditionWidth = Math.floor((eraWidth - 32) / 2);
      conditions.slice(0, Math.min(4, conditionRows * 2)).forEach((condition, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const itemX = eraX + 12 + col * (conditionWidth + 8);
        const itemY = conditionTop + row * (conditionRowHeight + conditionRowGap);
        this.drawPanel(itemX, itemY, conditionWidth, conditionRowHeight, {
          fill: 'rgba(63, 47, 32, 0.62)',
          stroke: condition.met ? 'rgba(78, 204, 163, 0.3)' : 'rgba(233, 69, 96, 0.15)',
          radius: 7,
        });
        this.drawText(condition.met ? '✓' : '•', itemX + 9, itemY + 11, {
          size: 12,
          bold: true,
          color: condition.met ? '#4ecca3' : '#d6b16e',
          baseline: 'middle',
        });
        this.drawText(this.truncateText(condition.name, conditionWidth - 52, { size: 11, bold: true }), itemX + 24, itemY + 6, {
          size: 11,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(condition.progressText, itemX + conditionWidth - 8, itemY + 6, {
          size: 10,
          color: condition.met ? '#4ecca3' : '#a0a0a0',
          align: 'right',
        });
      });

      const advanceLabel = this.truncateText(view.text.advanceLabel, eraWidth - 52, { size: 13, bold: true });
      this.drawButton(eraX + 12, buttonY, eraWidth - 24, 32, advanceLabel, {
        disabled: view.advanceButton.disabled,
        bold: true,
        radius: 8,
        active: !view.advanceButton.disabled,
      });
      this.addHitTarget(
        { x: eraX + 12, y: buttonY, width: eraWidth - 24, height: 32 },
        { type: 'advanceEra', disabled: view.advanceButton.disabled },
      );

      if (featureHeight > 0) {
        this.drawPanel(x + 12, featureY, width - 24, featureHeight, {
          fill: 'rgba(37, 29, 21, 0.82)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.renderSectionHeader('当前时代特性', x + 26, featureY + 14, '✓');
        const featureLineLimit = Math.max(1, Math.floor((featureHeight - 44) / 18));
        const featureLines = this.wrapTextLimit(view.text.featureDescription, width - 58, featureLineLimit, { size: 12 });
        this.drawTextLines(featureLines, x + 26, featureY + 44, {
          size: 12,
          color: '#f6e8c8',
          lineHeight: 18,
        });
      }
    }

    getTechRouteCatalog() {
      return {
        agriculture: { lane: -4, label: '农业', color: '#5fcb6b', icon: 'assets/art/tech-agriculture-cutout.png' },
        livelihood: { lane: -3, label: '民生', color: '#d9b35d', icon: 'assets/art/tech-livelihood-cutout.png' },
        administration: { lane: -2, label: '秩序', color: '#c9a47a', icon: 'assets/art/tech-administration-cutout.png' },
        knowledge: { lane: -1, label: '知识', color: '#57a6ff', icon: 'assets/art/tech-knowledge-cutout.png' },
        culture: { lane: 0, label: '文化', color: '#b48cff', icon: 'assets/art/tech-culture-cutout.png' },
        engineering: { lane: 1, label: '工程', color: '#83c8d9', icon: 'assets/art/tech-engineering-cutout.png' },
        industry: { lane: 2, label: '工业', color: '#d9904f', icon: 'assets/art/tech-industry-cutout.png' },
        exploration: { lane: 3, label: '探索', color: '#62c9a7', icon: 'assets/art/tech-exploration-cutout.png' },
        trade: { lane: 4, label: '贸易', color: '#d5c46a', icon: 'assets/art/tech-trade-cutout.png' },
        military: { lane: 5, label: '军事', color: '#e35d5d', icon: 'assets/art/tech-military-cutout.png' },
      };
    }

    getTechRouteMeta(route) {
      const catalog = this.getTechRouteCatalog();
      if (route && catalog[route]) return catalog[route];
      return { lane: 0, label: route || '路线', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' };
    }

    getTechNodeRoutes(node = {}) {
      const treeRoutes = Array.isArray(node.tree?.routes) ? node.tree.routes : [];
      const routes = treeRoutes.length ? treeRoutes : (node.route ? [node.route] : []);
      return Array.from(new Set(routes.filter(Boolean)));
    }

    getTechNodeRouteLabel(node = {}) {
      const routes = this.getTechNodeRoutes(node);
      if (!routes.length) return node.routeLabel || '路线';
      if (routes.length === 1) return node.routeLabel || this.getTechRouteMeta(routes[0]).label;
      return routes.map((route) => this.getTechRouteMeta(route).label).join('/');
    }

    getTechNodePrimaryRoute(node = {}) {
      const routes = this.getTechNodeRoutes(node);
      return node.route || routes[0] || '';
    }

    getTechNodeLane(node = {}) {
      const route = this.getTechNodePrimaryRoute(node);
      const routeLane = this.getTechRouteMeta(route).lane;
      if (node.route && Number.isFinite(routeLane)) return routeLane;
      const configuredLane = Number(node.tree?.lane);
      if (Number.isFinite(configuredLane)) return configuredLane;
      if (route && Number.isFinite(routeLane)) return routeLane;
      return 0;
    }

    drawTechRouteSegments(x, y, width, height, routes = [], alpha = 1) {
      if (!this.ctx || typeof this.ctx.fillRect !== 'function') return;
      const activeRoutes = routes.length ? routes : [''];
      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = alpha;
      const segmentWidth = width / activeRoutes.length;
      activeRoutes.forEach((route, index) => {
        this.ctx.fillStyle = this.getTechRouteMeta(route).color;
        this.ctx.fillRect(x + segmentWidth * index, y, segmentWidth + 0.5, height);
      });
      if (typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
    }

    getTechNodeColor(node = {}) {
      const routeColor = this.getTechRouteMeta(this.getTechNodePrimaryRoute(node)).color;
      if (node.researched) {
        return {
          fill: 'rgba(39, 82, 59, 0.88)',
          stroke: routeColor,
          accent: routeColor,
          text: '#f6e8c8',
          muted: 'rgba(214, 235, 203, 0.64)',
        };
      }
      if (!node.disabled) {
        return {
          fill: 'rgba(80, 54, 29, 0.94)',
          stroke: routeColor,
          accent: routeColor,
          text: '#fff2d2',
          muted: 'rgba(255, 226, 177, 0.72)',
        };
      }
      if (node.status === 'locked') {
        return {
          fill: 'rgba(28, 30, 32, 0.82)',
          stroke: 'rgba(170, 176, 184, 0.22)',
          accent: '#7d8590',
          text: '#aeb0b8',
          muted: 'rgba(174, 176, 184, 0.52)',
        };
      }
      return {
        fill: 'rgba(45, 34, 24, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.18)',
        accent: routeColor,
        text: '#ddd0ad',
        muted: 'rgba(203, 189, 150, 0.58)',
      };
    }

    renderTechNode(node, rect, options = {}) {
      const palette = this.getTechNodeColor(node);
      const routes = this.getTechNodeRoutes(node);
      const selected = Boolean(options.selected);
      const primaryRoute = this.getTechNodePrimaryRoute(node);
      const routeMeta = this.getTechRouteMeta(primaryRoute);
      const cx = Number(rect.centerX) || rect.x + rect.width / 2;
      const cy = Number(rect.centerY) || rect.y + 30;
      const iconSize = Math.min(50, Math.max(40, rect.width * 0.58));
      const iconRadius = iconSize / 2;
      const alpha = node.disabled && !node.researched ? 0.52 : 1;
      if (selected) {
        this.drawCircle(cx, cy, iconRadius + 10, {
          fill: `${routeMeta.color}22`,
          stroke: '#ffe6b5',
          width: 2,
        });
      }
      this.drawCircle(cx, cy, iconRadius + 5, {
        fill: node.researched ? 'rgba(34, 82, 58, 0.68)' : 'rgba(18, 16, 13, 0.7)',
        stroke: node.researched ? '#74d3a0' : (node.disabled ? 'rgba(174, 176, 184, 0.38)' : routeMeta.color),
        width: node.researched || selected ? 2 : 1.5,
      });
      if (!this.drawAsset(routeMeta.icon, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize, alpha)) {
        this.drawText(this.truncateText(this.getTechNodeRouteLabel(node), iconSize - 10, { size: 13, bold: true }).slice(0, 2), cx, cy, {
          size: 13,
          bold: true,
          align: 'center',
          baseline: 'middle',
          color: palette.accent,
        });
      }
      if (routes.length > 1) {
        this.drawTechRouteSegments(cx - 23, cy + iconRadius + 8, 46, 4, routes, node.disabled && !node.researched ? 0.46 : 0.92);
      }
      this.drawCircle(cx + iconRadius + 2, cy + iconRadius + 1, 5, {
        fill: node.researched ? '#74d3a0' : (!node.disabled ? '#f0b45b' : '#7d8590'),
        stroke: 'rgba(18, 16, 13, 0.86)',
        width: 1.5,
      });
      const titleWidth = Math.max(54, rect.width + 16);
      this.drawText(this.truncateText(node.title || node.name || '科技', titleWidth, { size: 10, bold: true }), cx, rect.y + rect.height - 13, {
        size: 11,
        bold: true,
        align: 'center',
        color: palette.text,
      });
      return;
    }

    renderTechDetailPanel(detail = {}, x, y, width, height) {
      const selected = detail && !detail.empty;
      const compact = width < 360;
      const iconSize = compact ? 32 : 36;
      const actionWidth = Math.min(90, Math.max(70, width * 0.22));
      const buttonX = x + width - actionWidth - 12;
      const buttonY = y + 14;
      const buttonH = 30;
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(45, 34, 24, 0.82)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      const topY = y + 12;
      this.drawAsset('assets/art/icon-science-cutout.webp', x + 12, topY + 2, iconSize, iconSize, selected ? 0.95 : 0.58);
      const textX = x + 12 + iconSize + 10;
      const contentRight = buttonX - 10;
      const contentWidth = Math.max(116, contentRight - textX);
      const titleWidth = Math.max(80, contentWidth);
      this.drawText(this.truncateText(detail.title || '选择一个科技', titleWidth, { size: 15, bold: true }), textX, y + 14, {
        size: 15,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = selected
        ? [detail.eraName, detail.routeLabel, detail.statusLabel].filter(Boolean).join(' · ')
        : (detail.statusLabel || '未选择');
      this.drawText(this.truncateText(meta, contentWidth, { size: 10, bold: true }), textX, y + 36, {
        size: 10,
        bold: true,
        color: detail.canResearch ? '#74d3a0' : '#f0b45b',
      });
      const summaryWidth = Math.max(120, width - 24);
      const summaryLines = this.wrapTextLimit(detail.summary || '点击科技节点查看效果。', summaryWidth, 1, { size: 10 });
      this.drawTextLines(summaryLines, textX, y + 54, {
        size: 10,
        color: '#cbbd96',
        lineHeight: 13,
      });
      if (selected) {
        const infoX = x + 12;
        const infoTop = y + 78;
        const infoWidth = width - 24;
        const rows = Array.isArray(detail.effectRows) && detail.effectRows.length
          ? detail.effectRows
          : [{ label: '研究后', text: detail.unlockSummary || '选择一条文明发展方向。' }];
        rows.slice(0, 2).forEach((row, index) => {
          const rowY = infoTop + index * 16;
          this.drawText(`${row.label}：`, infoX, rowY, {
            size: 10,
            bold: true,
            color: index === 0 ? '#d5ffe8' : '#f0b45b',
          });
          this.drawText(this.truncateText(row.text || '无', infoWidth - 58, { size: 10 }), infoX + 58, rowY, {
            size: 10,
            color: '#cbbd96',
          });
        });
        const prerequisiteY = y + height - 18;
        const prerequisiteText = `前置科技：${detail.prerequisiteText || '无'}`;
        this.drawText(this.truncateText(prerequisiteText, width - actionWidth - 42, { size: 10 }), infoX, prerequisiteY, { size: 10, color: '#aeb0b8' });
        this.drawText(this.truncateText(detail.pointsText || '', actionWidth + 8, { size: 10, bold: true }), buttonX + actionWidth / 2, prerequisiteY, {
          size: 10,
          bold: true,
          color: '#f0b45b',
          align: 'center',
        });
      }
      this.drawPrimaryActionButton(buttonX, buttonY, actionWidth, buttonH, detail.buttonLabel || '研究', {
        disabled: !detail.canResearch,
        size: 11,
        radius: 9,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: actionWidth, height: buttonH }, {
        type: 'research',
        techId: detail.id,
        disabled: !detail.canResearch || !detail.id,
      });
      if (!detail.canResearch && detail.disabledReason) {
        this.drawText(this.truncateText(detail.disabledReason, actionWidth + 18, { size: 9 }), buttonX + actionWidth / 2, buttonY + buttonH + 12, {
          size: 9,
          color: '#aeb0b8',
          align: 'center',
        });
      }
    }

    getTechDetailIcon(detail = {}) {
      const routes = Array.isArray(detail.routes) && detail.routes.length
        ? detail.routes
        : (detail.routeId ? [detail.routeId] : []);
      return this.getTechRouteMeta(detail.routeId || routes[0] || '').icon;
    }

    renderTechDetailModal(detail = {}) {
      if (!detail || detail.empty) return;
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeTechDetail' });
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(430, this.height - 160);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(86, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeTechDetail' });

      const iconSize = 58;
      const iconPath = this.getTechDetailIcon(detail);
      this.drawCircle(x + 45, y + 48, 34, {
        fill: 'rgba(18, 16, 13, 0.64)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        width: 1.5,
      });
      this.drawAsset(iconPath, x + 16, y + 19, iconSize, iconSize, 0.98);
      this.drawText(this.truncateText(detail.title || '科技', panelWidth - 118, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      const meta = [detail.eraName, detail.routeLabel, detail.statusLabel].filter(Boolean).join(' · ');
      this.drawText(this.truncateText(meta, panelWidth - 118, { size: 11, bold: true }), x + 84, y + 52, {
        size: 11,
        bold: true,
        color: detail.canResearch ? '#74d3a0' : '#f0b45b',
      });

      let cursorY = y + 92;
      const summaryLines = this.wrapTextLimit(detail.summary || '选择科技查看效果。', panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, {
        size: 12,
        color: '#f6e8c8',
        lineHeight: 17,
      });
      cursorY += summaryLines.length * 17 + 14;

      const rows = Array.isArray(detail.effectRows) && detail.effectRows.length
        ? detail.effectRows
        : [{ label: '研究后', text: detail.unlockSummary || '选择一条文明发展方向。' }];
      rows.slice(0, 4).forEach((row) => {
        const label = `${row.label}：`;
        this.drawText(label, x + 16, cursorY, { size: 11, bold: true, color: '#f0b45b' });
        this.ctx.font = '700 11px sans-serif';
        const labelWidth = Math.max(58, this.ctx.measureText(label).width + 2);
        const rowLines = this.wrapTextLimit(row.text || '无', panelWidth - 32 - labelWidth, 2, { size: 11 });
        this.drawTextLines(rowLines, x + 16 + labelWidth, cursorY, {
          size: 11,
          color: '#cbbd96',
          lineHeight: 15,
        });
        cursorY += Math.max(18, rowLines.length * 15 + 4);
      });

      const prereqText = `前置科技：${detail.prerequisiteText || '无'}`;
      this.drawText(this.truncateText(prereqText, panelWidth - 32, { size: 11 }), x + 16, cursorY + 4, {
        size: 11,
        color: '#aeb0b8',
      });
      cursorY += 30;

      if (!detail.canResearch && detail.disabledReason) {
        this.drawText(this.truncateText(detail.disabledReason, panelWidth - 32, { size: 11 }), x + 16, cursorY, {
          size: 11,
          color: '#d6b16e',
        });
      }
      const buttonW = Math.min(128, panelWidth - 32);
      const buttonH = 36;
      const buttonX = x + panelWidth - buttonW - 16;
      const buttonY = y + panelHeight - buttonH - 16;
      this.drawText(this.truncateText(detail.pointsText || '', panelWidth - buttonW - 44, { size: 11, bold: true }), x + 16, buttonY + 11, {
        size: 11,
        bold: true,
        color: '#f0b45b',
      });
      this.drawPrimaryActionButton(buttonX, buttonY, buttonW, buttonH, detail.buttonLabel || '研究', {
        disabled: !detail.canResearch,
        size: 13,
        radius: 8,
      });
      this.addHitTarget({ x: buttonX, y: buttonY, width: buttonW, height: buttonH }, {
        type: 'research',
        techId: detail.id,
        disabled: !detail.canResearch || !detail.id,
      });
    }

    getTechTreeLayout(view = {}, panel = {}, options = {}) {
      const tree = view.tree || {};
      const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
      const eras = (Array.isArray(tree.eras) && tree.eras.length
        ? tree.eras
        : (view.eras || []).map((era) => ({ ...era, column: era.era })))
        .slice()
        .sort((a, b) => (Number(a.column) || Number(a.era) || 0) - (Number(b.column) || Number(b.era) || 0));
      const width = Number(panel.width) || 0;
      const height = Number(panel.height) || 0;
      const panelX = Number(panel.x) || 0;
      const panelY = Number(panel.y) || 0;
      const zoom = Math.max(0.65, Math.min(1.6, Number(options.techTreeZoom) || 1));
      const routeCatalog = this.getTechRouteCatalog();
      const nodeWidth = Math.max(82, Math.min(102, width * 0.3));
      const nodeHeight = 76;
      const baseEraHeight = Math.max(280, Math.min(360, height * 0.78));
      const localRowGap = nodeHeight + 38;
      const collisionGap = 18;
      const laneGap = Math.max(nodeWidth + 42, Math.min(168, width * 0.44));
      const eraRailWidth = 58;
      const eraRailX = panelX + width - eraRailWidth - 8;
      const panelCenterX = panelX + width / 2;
      const routeEntries = Object.entries(routeCatalog);
      const fallbackRoutes = nodes.flatMap((node) => this.getTechNodeRoutes(node));
      fallbackRoutes.forEach((route) => {
        if (!routeCatalog[route]) routeEntries.push([route, this.getTechRouteMeta(route)]);
      });
      const lanes = routeEntries.map(([, meta]) => Number(meta.lane) || 0);
      nodes.forEach((node) => lanes.push(this.getTechNodeLane(node)));
      const minLane = Math.min(...lanes, 0);
      const maxLane = Math.max(...lanes, 0);
      const startY = panelY + 66;
      const minContentY = panelY + 18;
      const eraLookup = new Map(eras.map((era, index) => {
        const column = Number(era.column) || Number(era.era) || index + 1;
        return [column, { ...era, column, index }];
      }));
      const getNodeColumn = (node) => Number(node.tree?.column ?? node.era) || 1;
      const getNodeRow = (node) => Number(node.tree?.row ?? node.tree?.column ?? node.era) || getNodeColumn(node);
      const getLocalRowOffset = (node) => Math.max(0, getNodeRow(node) - getNodeColumn(node));
      const nodeColumns = nodes.map((node) => getNodeColumn(node));
      const firstColumn = nodeColumns.length ? Math.min(...nodeColumns) : (Number(eras[0]?.column ?? eras[0]?.era) || 1);
      const focusLanes = nodes
        .filter((node) => getNodeColumn(node) === firstColumn)
        .map((node) => this.getTechNodeLane(node));
      const focusLane = focusLanes.length
        ? (Math.min(...focusLanes) + Math.max(...focusLanes)) / 2
        : 0;
      const contentCenterX = panelCenterX - focusLane * laneGap;
      const laneToX = (lane) => contentCenterX + (Number(lane) || 0) * laneGap;
      const nodeRects = {};
      const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
      const nodesByColumn = new Map();
      nodes.forEach((node) => {
        const column = getNodeColumn(node);
        if (!nodesByColumn.has(column)) nodesByColumn.set(column, []);
        nodesByColumn.get(column).push(node);
      });
      let eraTopCursor = minContentY;
      const eraPositions = eras.map((era, eraIndex) => {
        const column = Number(era.column) || Number(era.era) || eraIndex + 1;
        const eraNodes = (nodesByColumn.get(column) || [])
          .slice()
          .sort((a, b) => {
            const rowA = getLocalRowOffset(a);
            const rowB = getLocalRowOffset(b);
            if (rowA !== rowB) return rowA - rowB;
            return (Number(a.tree?.lane) || 0) - (Number(b.tree?.lane) || 0);
          });
        const top = eraTopCursor;
        const placed = [];
        eraNodes.forEach((node) => {
          const localRow = getLocalRowOffset(node);
          const lane = this.getTechNodeLane(node);
          const centerX = laneToX(lane);
          let centerY = Math.max(startY, top + 92) + localRow * localRowGap;
          const makeRect = () => ({
            x: centerX - nodeWidth / 2,
            y: centerY - nodeHeight / 2,
            width: nodeWidth,
            height: nodeHeight,
          });
          let rect = makeRect();
          let guard = 0;
          const overlapsPlaced = (candidate) => placed.some((other) => (
            candidate.x < other.x + other.width + 14
            && candidate.x + candidate.width + 14 > other.x
            && candidate.y < other.y + other.height + collisionGap
            && candidate.y + candidate.height + collisionGap > other.y
          ));
          while (overlapsPlaced(rect) && guard < 24) {
            centerY += nodeHeight + collisionGap;
            rect = makeRect();
            guard += 1;
          }
          const routes = this.getTechNodeRoutes(node);
          const routeLanes = routes.length
            ? routes.map((route) => this.getTechRouteMeta(route).lane)
            : [lane];
          nodeRects[node.id] = {
            ...rect,
            width: nodeWidth,
            height: nodeHeight,
            centerX,
            centerY,
            row: getNodeRow(node),
            localRow,
            column,
            lane,
            routeLanes,
            routes,
            eraColumn: column,
          };
          placed.push(nodeRects[node.id]);
        });
        const nodesBottom = placed.length
          ? Math.max(...placed.map((rect) => rect.y + rect.height))
          : top + baseEraHeight;
        const bottom = Math.max(top + baseEraHeight, nodesBottom + 78);
        eraTopCursor = bottom;
        return {
          ...era,
          x: eraRailX,
          y: top + (bottom - top) / 2,
          top,
          bottom,
          column,
          nodes: eraNodes,
        };
      });
      const routeGuides = routeEntries.map(([route, meta]) => ({
        id: route,
        label: meta.label || route,
        color: meta.color,
        lane: Number(meta.lane) || 0,
        x: laneToX(Number(meta.lane) || 0),
      }));
      const linkPaths = nodes.flatMap((node) => (
        (node.tree?.parents || [])
          .filter((parentId) => nodeRects[parentId] && nodeRects[node.id])
          .map((parentId) => {
            const parentNode = nodesById[parentId] || {};
            const parentRect = nodeRects[parentId];
            const childRect = nodeRects[node.id];
            const parentRoutes = this.getTechNodeRoutes(parentNode);
            const childRoutes = this.getTechNodeRoutes(node);
            const sharedRoute = childRoutes.find((route) => parentRoutes.includes(route))
              || childRoutes[0]
              || parentRoutes[0]
              || '';
            const routeMeta = this.getTechRouteMeta(sharedRoute);
            const color = routeMeta.color;
            const routeX = laneToX(routeMeta.lane);
            const start = {
              x: parentRect.centerX,
              y: parentRect.centerY + Math.min(34, parentRect.height * 0.44),
            };
            const end = {
              x: childRect.centerX,
              y: childRect.centerY - Math.min(34, childRect.height * 0.44),
            };
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const signY = dy >= 0 ? 1 : -1;
            const side = Math.abs(dx) > 6
              ? Math.sign(dx)
              : ((Number(childRect.lane) || Number(parentRect.lane) || 0) >= 0 ? 1 : -1);
            const curveBend = Math.max(24, Math.min(88, Math.abs(dx) * 0.28 + laneGap * 0.16));
            const verticalBend = Math.max(42, Math.min(150, Math.abs(dy) * 0.38 + 24));
            const lanePull = Number.isFinite(routeX)
              ? Math.max(-72, Math.min(72, (routeX - (start.x + end.x) / 2) * 0.18))
              : 0;
            return {
              from: parentId,
              to: node.id,
              color,
              curve: {
                start,
                c1: {
                  x: start.x + dx * 0.16 + side * curveBend + lanePull,
                  y: start.y + signY * verticalBend,
                },
                c2: {
                  x: end.x - dx * 0.16 - side * curveBend + lanePull,
                  y: end.y - signY * verticalBend,
                },
                end,
              },
              active: Boolean(parentNode.researched && node.available),
              researched: Boolean(parentNode.researched && node.researched),
              locked: node.status === 'locked',
            };
          })
      ));
      const contentBottom = Math.max(
        minContentY + height + 1,
        ...eraPositions.map((era) => era.bottom + 42),
        ...Object.values(nodeRects).map((rect) => rect.y + rect.height + 44),
      );
      const contentLeft = Math.min(
        laneToX(minLane) - nodeWidth / 2 - 64,
        ...routeGuides.map((guide) => guide.x - 40),
        ...Object.values(nodeRects).map((rect) => rect.x - 24),
      );
      const contentRight = Math.max(
        laneToX(maxLane) + nodeWidth / 2 + 80,
        ...routeGuides.map((guide) => guide.x + 40),
        ...Object.values(nodeRects).map((rect) => rect.x + rect.width + 24),
      );
      const contentHeight = Math.max(height + 1, contentBottom - minContentY);
      const overscroll = 96;
      const innerLeft = panelX + 16;
      const innerRight = panelX + width - 16;
      const innerTop = panelY + 8;
      const innerBottom = panelY + height - 12;
      const scaleX = (value) => panelX + (value - panelX) * zoom;
      const scaleY = (value) => panelY + (value - panelY) * zoom;
      const scaledContentLeft = scaleX(contentLeft);
      const scaledContentRight = scaleX(contentRight);
      const scaledContentTop = scaleY(minContentY);
      const scaledContentBottom = scaleY(contentBottom);
      const minPanX = Math.min(-overscroll, innerRight - scaledContentRight);
      const maxPanX = Math.max(overscroll, innerLeft - scaledContentLeft);
      const minPanY = Math.min(-overscroll, innerBottom - scaledContentBottom);
      const maxPanY = Math.max(overscroll, innerTop - scaledContentTop);
      const rawPanX = Number(options.techTreePanX) || 0;
      const panX = Math.max(minPanX, Math.min(rawPanX, maxPanX));
      const rawPanY = Number(options.techTreePanY) || 0;
      const panY = Math.max(minPanY, Math.min(rawPanY, maxPanY));
      const scaledContentWidth = Math.max(1, scaledContentRight - scaledContentLeft);
      const scaledContentHeight = Math.max(1, scaledContentBottom - scaledContentTop);
      return {
        nodes,
        eras,
        eraPositions,
        nodeRects,
        panX,
        zoom,
        minPanX,
        maxPanX,
        minPanY,
        panY,
        maxPanY,
        contentHeight,
        scaledContentWidth,
        scaledContentHeight,
        contentLeft,
        contentRight,
        minContentY,
        maxContentY: minContentY + contentHeight,
        routeGuides,
        linkPaths,
        eraRailWidth,
        eraRailX,
        routeCatalog,
        laneToX,
        spineX: panelCenterX,
      };
    }

    renderTech(state = {}, startY = 210, panelHeight = 250, options = {}) {
      if (!this.presenter || typeof this.presenter.buildTechViewState !== 'function') return;
      const view = this.presenter.buildTechViewState({
        ...state,
        techUiState: {
          ...(state.techUiState || {}),
          ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
        },
        ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
      });
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      const headerHeight = 58;
      this.renderSectionHeader(view.text.title, x + 16, startY + 14, '🔩');
      this.drawText(this.truncateText(view.text.subtitle, width - 32, { size: 10 }), x + 16, startY + 36, {
        size: 10,
        color: 'rgba(234, 234, 234, 0.62)',
      });
      const pillY = startY + 14;
      const pillWidth = 68;
      [
        view.text.points,
        view.text.researched,
        view.text.available,
      ].forEach((label, index) => {
        const pillX = x + width - 12 - pillWidth * (3 - index) - 6 * (2 - index);
        this.drawPanel(pillX, pillY, pillWidth, 24, {
          fill: 'rgba(63, 47, 32, 0.78)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 8,
        });
        this.drawText(this.truncateText(label, pillWidth - 14, { size: 10, bold: index === 0 }), pillX + pillWidth / 2, pillY + 7, {
          size: 10,
          bold: index === 0,
          color: index === 0 ? '#f0b45b' : '#cbbd96',
          align: 'center',
        });
      });

      const panelY = startY + headerHeight;
      const panelBottom = startY + panelHeight - 14;
      const panelH = Math.max(116, panelBottom - panelY);
      this.drawPanel(x + 12, panelY, width - 24, panelH, {
        fill: 'rgba(28, 22, 16, 0.74)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });

      const tree = view.tree || {};
      const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
      const treeTop = panelY + 14;
      const treeBottom = startY + panelHeight - 26;
      const treeHeight = Math.max(128, treeBottom - treeTop);
      const treeX = x + 24;
      const treeWidth = width - 48;
      const treePanel = {
        x: treeX,
        y: treeTop,
        width: treeWidth,
        height: treeHeight,
      };
      let renderedCards = 0;

      if (nodes.length && treeWidth > 0) {
        const layoutInfo = this.getTechTreeLayout(view, treePanel, options);
        const {
          eraPositions,
          nodeRects,
          panX,
          minPanX,
          maxPanX,
          panY,
          minPanY,
          maxPanY,
          minContentY,
          maxContentY,
          contentLeft,
          contentRight,
          scaledContentWidth,
          scaledContentHeight,
          zoom,
          routeGuides,
          linkPaths,
          eraRailWidth,
          eraRailX,
        } = layoutInfo;
        this.lastTechTreeScroll = {
          maxPanY,
          minPanY,
          minPanX,
          maxPanX,
          panX,
          panY,
          zoom,
          panel: treePanel,
        };
        const toScreenRect = (rect = {}) => ({
          x: treeX + panX + (rect.x - treeX) * zoom,
          y: treeTop + panY + (rect.y - treeTop) * zoom,
          width: rect.width * zoom,
          height: rect.height * zoom,
        });
        const toScreenY = (value) => treeTop + panY + (value - treeTop) * zoom;
        this.withTransformedClip(treeX, treeTop, treeWidth, treeHeight, panX, panY, zoom, () => {
          eraPositions.forEach((era) => {
            this.drawPanel(contentLeft, era.top, Math.max(80, contentRight - contentLeft), era.bottom - era.top, {
              fill: era.closed ? 'rgba(42, 60, 43, 0.28)' : 'rgba(56, 44, 32, 0.28)',
              stroke: 'rgba(255, 226, 177, 0.08)',
              radius: 4,
            });
            this.drawLine(contentLeft, era.top, contentRight, era.top, {
              color: 'rgba(255, 226, 177, 0.16)',
              width: 1,
            });
          });
          routeGuides.forEach((route) => {
            this.drawLine(route.x, minContentY, route.x, maxContentY, {
              color: `${route.color}44`,
              width: 2,
            });
            this.drawText(this.truncateText(route.label, 54, { size: 10, bold: true }), route.x, minContentY + 8, {
              size: 10,
              bold: true,
              color: route.color,
              align: 'center',
            });
          });
          linkPaths.forEach((link) => {
            this.drawCurvePath(link.curve, {
              color: link.researched || link.active ? `${link.color}cc` : (link.locked ? 'rgba(174, 176, 184, 0.18)' : `${link.color}66`),
              width: link.researched || link.active ? 3 : 2,
            });
          });
          nodes.forEach((node) => {
            const rect = nodeRects[node.id];
            if (!rect) return;
            this.renderTechNode(node, rect, { selected: node.id === view.selectedTechId });
            const screenRect = toScreenRect(rect);
            if (screenRect.y + screenRect.height < treeTop || screenRect.y > treeBottom) return;
            if (screenRect.x + screenRect.width < treeX || screenRect.x > treeX + treeWidth) return;
            this.addHitTarget(
              screenRect,
              { type: 'selectTechNode', techId: node.id, dragType: 'techTreeDrag' },
            );
            renderedCards += 1;
          });
        });
        this.withTranslatedClip(treeX, treeTop, treeWidth, treeHeight, 0, 0, () => {
          eraPositions.forEach((era) => {
            const eraTopScreen = toScreenY(era.top + 10);
            const eraBottomScreen = toScreenY(era.bottom - 10);
            const eraYScreen = toScreenY(era.y);
            era.y = eraYScreen;
            this.drawPanel(eraRailX, eraTopScreen, eraRailWidth, Math.max(28, eraBottomScreen - eraTopScreen), {
              fill: 'rgba(70, 72, 74, 0.84)',
              stroke: 'rgba(255, 226, 177, 0.16)',
              radius: 7,
            });
            this.drawText(this.truncateText(era.name || `时代 ${era.era}`, eraRailWidth - 10, { size: 11, bold: true }), eraRailX + eraRailWidth / 2, era.y - 18, {
              size: 11,
              bold: true,
              color: era.closed ? '#74d3a0' : '#f0b45b',
              align: 'center',
            });
            this.drawText(this.truncateText(era.choiceText || '', eraRailWidth - 12, { size: 9 }), eraRailX + eraRailWidth / 2, era.y + 2, {
              size: 9,
              color: 'rgba(234, 234, 234, 0.64)',
              align: 'center',
            });
          });
        });
        this.addHitTarget(treePanel, { type: 'techTreeDrag', background: true });
        if (minPanX < maxPanX) {
          const trackY = treeBottom - 6;
          const contentWidth = Math.max(treeWidth, scaledContentWidth);
          const thumbW = Math.max(34, treeWidth * (treeWidth / Math.max(treeWidth, contentWidth)));
          const thumbX = treeX + (treeWidth - thumbW) * ((panX - minPanX) / Math.max(1, maxPanX - minPanX));
          this.drawPanel(treeX + 4, trackY, treeWidth - 8, 4, {
            fill: 'rgba(255, 226, 177, 0.08)',
            stroke: 'rgba(255, 226, 177, 0.08)',
            radius: 2,
          });
          this.drawPanel(thumbX, trackY - 1, thumbW, 6, {
            fill: 'rgba(240, 180, 91, 0.48)',
            stroke: 'rgba(255, 226, 177, 0.18)',
            radius: 3,
          });
        }
        if (minPanY < maxPanY) {
          const trackX = treeX + treeWidth - 6;
          const contentHeight = Math.max(treeHeight, scaledContentHeight);
          const thumbH = Math.max(28, treeHeight * (treeHeight / Math.max(treeHeight, contentHeight)));
          const thumbY = treeTop + (treeHeight - thumbH) * ((panY - minPanY) / Math.max(1, maxPanY - minPanY));
          this.drawPanel(trackX, treeTop + 4, 4, treeHeight - 8, {
            fill: 'rgba(255, 226, 177, 0.08)',
            stroke: 'rgba(255, 226, 177, 0.08)',
            radius: 2,
          });
          this.drawPanel(trackX - 1, thumbY, 6, thumbH, {
            fill: 'rgba(240, 180, 91, 0.6)',
            stroke: 'rgba(255, 226, 177, 0.22)',
            radius: 3,
          });
        }
      }

      if (!renderedCards) {
        const centerY = panelY + Math.max(66, panelH / 2 + 6);
        this.drawAsset('assets/art/icon-science-cutout.webp', x + width / 2 - 34, centerY - 52, 68, 68, 0.62);
        this.drawText(view.text.placeholder, x + width / 2, centerY + 24, {
          size: 15,
          bold: true,
          color: '#cbbd96',
          align: 'center',
        });
        this.drawText(view.text.subtitle, x + width / 2, centerY + 48, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.58)',
          align: 'center',
        });
      }
    }

    renderMilitarySubTabs(nav = {}, x, y, width) {
      const labels = { army: '军队', scout: '侦察', world: '世界' };
      const tabs = nav.views || [];
      const gap = 6;
      const tabWidth = (width - gap * Math.max(0, tabs.length - 1)) / Math.max(1, tabs.length);
      tabs.forEach((tab, index) => {
        const tabX = x + index * (tabWidth + gap);
        this.drawButton(tabX, y, tabWidth, 34, labels[tab.id] || tab.id, {
          size: 12,
          bold: true,
          radius: 9,
          disabled: tab.disabled,
          active: tab.isActive,
        });
        this.addHitTarget({ x: tabX, y, width: tabWidth, height: 34 }, {
          type: 'switchMilitaryView',
          view: tab.id,
          disabled: tab.disabled,
        });
      });
      return y + 46;
    }

    renderMilitaryArmyView(view = {}, x, y, width, height) {
      const cardHeight = Math.min(150, Math.max(126, height - 18));
      this.drawPanel(x, y, width, cardHeight, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawAsset('assets/art/icon-soldier-cutout.webp', x + 16, y + 24, 58, 72);
      const textX = x + 88;
      this.drawText('军队状态', textX, y + 16, { size: 14, bold: true, color: '#f6e8c8' });
      this.drawText(`士兵 ${view.text?.soldierCount || '0/0'}`, textX, y + 42, { size: 18, bold: true, color: '#74d3a0' });
      this.drawText(`防御 ${view.text?.militaryDefense ?? 0}`, textX, y + 68, { size: 12, color: '#cbbd96' });
      this.drawText(`可用 ${view.text?.availableSoldierCount ?? 0} · 出征中 ${view.text?.soldiersOnMission ?? 0}`, textX, y + 88, {
        size: 12,
        color: '#aeb0b8',
      });
      const progressY = y + cardHeight - 38;
      this.drawText(view.text?.soldierTrainingText || '等待兵营', x + 16, progressY - 18, { size: 12, color: '#cbbd96' });
      this.drawProgressBar(x + 16, progressY, width - 32, 12, parseFloat(view.training?.progressWidth || '0'));
    }

    getScoutButtonTone(cell = {}) {
      if (cell.status === 'ready') return { fill: 'rgba(40, 84, 62, 0.72)', stroke: 'rgba(116, 211, 160, 0.42)' };
      if (cell.status === 'active') return { fill: 'rgba(75, 58, 37, 0.66)', stroke: 'rgba(240, 180, 91, 0.28)' };
      if (cell.status === 'locked') return { fill: 'rgba(42, 40, 39, 0.62)', stroke: 'rgba(255, 255, 255, 0.08)' };
      return { fill: 'rgba(63, 47, 32, 0.78)', stroke: 'rgba(240, 180, 91, 0.25)' };
    }

    renderMilitaryScoutView(scout = {}, x, y, width, height) {
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      const statusLines = this.wrapTextLimit(scout.statusText || '', width - 28, 2, { size: 12 });
      this.drawTextLines(statusLines, x + 14, y + 14, { size: 12, color: '#cbbd96', lineHeight: 16 });

      const gridTop = y + 56;
      const reportReserve = Math.min(126, Math.max(86, height * 0.26));
      const gridSize = Math.min(width - 28, Math.max(190, Math.min(height - 82 - reportReserve, 286)));
      const gridX = x + (width - gridSize) / 2;
      this.drawPanel(gridX, gridTop, gridSize, gridSize, {
        fill: 'rgba(18, 16, 13, 0.38)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 18,
      });
      const order = ['nw', 'n', 'ne', 'w', 'center', 'e', 'sw', 's', 'se'];
      const cellsById = new Map((scout.cells || []).map((cell) => [cell.id || cell.type, cell]));
      const cellGap = 7;
      const cellSize = (gridSize - 28 - cellGap * 2) / 3;
      order.forEach((id, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const cellX = gridX + 14 + col * (cellSize + cellGap);
        const cellY = gridTop + 14 + row * (cellSize + cellGap);
        const cell = id === 'center'
          ? { type: 'center', label: '城', subLabel: '本城' }
          : cellsById.get(id);
        if (!cell) return;
        if (cell.type === 'center') {
          this.drawPanel(cellX, cellY, cellSize, cellSize, {
            fill: 'rgba(75, 49, 25, 0.82)',
            stroke: 'rgba(240, 180, 91, 0.38)',
            radius: Math.min(22, cellSize / 2),
            inset: 'rgba(255, 231, 184, 0.12)',
          });
          this.drawText(cell.label || '城', cellX + cellSize / 2, cellY + cellSize / 2 - 7, {
            size: 18,
            bold: true,
            color: '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
          this.drawText(cell.subLabel || '本城', cellX + cellSize / 2, cellY + cellSize / 2 + 14, {
            size: 10,
            color: '#a0a0a0',
            baseline: 'middle',
            align: 'center',
          });
          return;
        }
        const tone = this.getScoutButtonTone(cell);
        this.drawPanel(cellX, cellY, cellSize, cellSize, {
          fill: tone.fill,
          stroke: tone.stroke,
          radius: 12,
          inset: 'rgba(255, 231, 184, 0.05)',
        });
        this.drawText(cell.label, cellX + cellSize / 2, cellY + cellSize / 2 - 8, {
          size: 13,
          bold: true,
          color: '#f6e8c8',
          baseline: 'middle',
          align: 'center',
        });
        this.drawText(cell.actionText, cellX + cellSize / 2, cellY + cellSize / 2 + 12, {
          size: 10,
          color: cell.status === 'ready' ? '#74d3a0' : '#aeb0b8',
          baseline: 'middle',
          align: 'center',
        });
        this.addHitTarget({ x: cellX, y: cellY, width: cellSize, height: cellSize }, {
          type: cell.action === 'claim' ? 'claimScout' : 'scoutTerritory',
          value: cell.actionValue,
          direction: cell.action === 'scout' ? cell.actionValue : undefined,
          missionId: cell.action === 'claim' ? cell.actionValue : undefined,
          disabled: cell.disabled || !cell.action,
        });
      });

      const reportsY = gridTop + gridSize + 18;
      if (reportsY < y + height - 42) {
        this.renderWorldReports(scout.reports || scout.scoutReports || [], x + 14, reportsY, width - 28, y + height - reportsY - 10);
      }
    }

    renderWorldReports(reports = [], x, y, width, maxHeight) {
      this.drawText('侦察报告', x, y, { size: 13, bold: true, color: '#f6e8c8' });
      if (!reports.length) {
        this.drawTextLines(this.wrapTextLimit('暂无侦察报告。派出侦察队后，外部世界会从这里开始显现。', width, 2, { size: 11 }), x, y + 24, {
          size: 11,
          color: '#aeb0b8',
          lineHeight: 15,
        });
        return;
      }
      let cursorY = y + 24;
      reports.slice().reverse().slice(0, Math.max(1, Math.floor(maxHeight / 54))).forEach((report) => {
        this.drawPanel(x, cursorY, width, 48, {
          fill: 'rgba(0, 0, 0, 0.16)',
          stroke: 'rgba(240, 180, 91, 0.18)',
          radius: 9,
        });
        this.drawText(this.truncateText(report.title || '侦察报告', width - 20, { size: 12, bold: true }), x + 10, cursorY + 8, {
          size: 12,
          bold: true,
          color: '#f6e8c8',
        });
        this.drawText(this.truncateText(report.text || '', width - 20, { size: 11 }), x + 10, cursorY + 27, {
          size: 11,
          color: '#aeb0b8',
        });
        cursorY += 56;
      });
    }

    renderMilitaryWorldView(state = {}, x, y, width, height, options = {}) {
      const territoryState = state.territoryState || {};
      const uiState = options.territoryUiState || {};
      const summary = this.presenter.buildTerritorySummaryViewState(territoryState);
      this.drawPanel(x, y, width, height, {
        fill: 'rgba(28, 22, 17, 0.78)',
        stroke: 'rgba(255, 226, 177, 0.12)',
        radius: 10,
      });
      this.drawText(summary.text?.polityName || '未命名势力', x + 14, y + 13, { size: 14, bold: true, color: '#f0b45b' });
      this.drawText(summary.text?.territoryCount || '0/0 已控制', x + width - 14, y + 15, {
        size: 11,
        color: '#74d3a0',
        align: 'right',
      });
      if ((state.currentEra || 0) < 5) {
        this.drawTextLines(this.wrapTextLimit('进入古典时代后，外部世界将在这里逐步显现。', width - 40, 3, { size: 13 }), x + 20, y + 70, {
          size: 13,
          color: '#cbbd96',
          lineHeight: 18,
        });
        return;
      }

      const territories = territoryState.territories || [];
      const radarView = this.presenter.buildWorldRadarViewState(territories, {
        panX: uiState.worldPanX || 0,
        panY: uiState.worldPanY || 0,
      });
      const radarSize = Math.min(width - 24, Math.max(260, Math.min(height - 68, 520)));
      const radarX = x + (width - radarSize) / 2;
      const radarY = y + 46;
      this.drawPanel(radarX, radarY, radarSize, radarSize, {
        fill: this.createGradient(
          radarX, radarY, radarX + radarSize, radarY + radarSize,
          [
            [0, 'rgba(39, 56, 42, 0.78)'],
            [1, 'rgba(18, 16, 13, 0.9)'],
          ],
          'rgba(24, 30, 24, 0.86)',
        ),
        stroke: 'rgba(240, 180, 91, 0.22)',
        radius: radarSize / 2,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.addHitTarget({ x: radarX, y: radarY, width: radarSize, height: radarSize }, { type: 'worldRadarDrag', background: true });
      this.drawLine(radarX + radarSize / 2, radarY + 12, radarX + radarSize / 2, radarY + radarSize - 12, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawLine(radarX + 12, radarY + radarSize / 2, radarX + radarSize - 12, radarY + radarSize / 2, {
        color: 'rgba(240, 180, 91, 0.16)',
      });
      this.drawText('N', radarX + radarSize / 2, radarY + 12, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('S', radarX + radarSize / 2, radarY + radarSize - 22, { size: 10, color: '#d6b16e', align: 'center' });
      this.drawText('W', radarX + 12, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });
      this.drawText('E', radarX + radarSize - 18, radarY + radarSize / 2 - 5, { size: 10, color: '#d6b16e' });

      const panX = radarView.pan?.x || 0;
      const panY = radarView.pan?.y || 0;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(radarX + radarSize / 2, radarY + radarSize / 2, radarSize / 2 - 2, 0, Math.PI * 2);
      this.ctx.clip();

      radarView.sites.forEach((site) => {
        const left = Math.max(8, Math.min(92, Number(site.position?.left) || 50));
        const top = Math.max(8, Math.min(92, Number(site.position?.top) || 50));
        const siteX = radarX + radarSize * left / 100 - 18 + panX;
        const siteY = radarY + radarSize * top / 100 - 18 + panY;
        const isSelected = uiState.selectedSiteId === site.id;
        this.drawPanel(siteX, siteY, 36, 36, {
          fill: isSelected ? 'rgba(116, 211, 160, 0.3)' : 'rgba(42, 35, 24, 0.86)',
          stroke: isSelected ? 'rgba(116, 211, 160, 0.76)' : 'rgba(240, 180, 91, 0.3)',
          radius: 18,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        if (!this.drawAsset(site.art, siteX + 5, siteY + 5, 26, 26)) {
          this.drawText('●', siteX + 18, siteY + 18, {
            size: 14,
            color: site.owner === 'player' ? '#74d3a0' : '#f0b45b',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.drawText(this.truncateText(site.name || site.title || '地点', 64, { size: 9 }), siteX + 18, siteY + 39, {
          size: 9,
          color: '#eaeaea',
          align: 'center',
        });
        this.addHitTarget({ x: siteX - 6, y: siteY - 6, width: 48, height: 54 }, { type: 'openWorldSite', siteId: site.id });
      });

      this.ctx.restore();

      const resetW = 76;
      this.drawButton(radarX + radarSize - resetW - 8, radarY + 8, resetW, 28, '回到本城', { size: 11, radius: 14 });
      this.addHitTarget({ x: radarX + radarSize - resetW - 8, y: radarY + 8, width: resetW, height: 28 }, { type: 'resetWorldPan' });
    }

    renderWorldSiteAction(actionView = {}, x, y, width) {
      const buttons = actionView.buttons || [];
      if (!buttons.length) return y;
      const gap = 8;
      const buttonWidth = Math.max(72, (width - gap * (buttons.length - 1)) / Math.max(1, buttons.length));
      buttons.forEach((button, index) => {
        const buttonX = x + index * (buttonWidth + gap);
        this.drawButton(buttonX, y, buttonWidth, 34, button.label, {
          size: 12,
          radius: 8,
          disabled: button.disabled || !button.action,
          active: !button.secondary && !button.disabled && Boolean(button.action),
        });
        this.addHitTarget({ x: buttonX, y, width: buttonWidth, height: 34 }, {
          type: button.action === 'conquer' ? 'conquer' :
               button.action === 'launch-expedition' ? 'launchExpedition' :
               button.action === 'claim' ? 'claimConquest' :
               button.action === 'enter-battle' ? 'enterBattleScene' :
               button.action === 'manage-city' ? 'manageCity' :
               button.action === 'rename-city' ? 'renameCity' :
               button.action === 'open-expedition' ? 'openExpedition' :
               button.action === 'close-expedition' ? 'closeExpedition' : 'territoryAction',
          territoryId: button.territoryId,
          disabled: button.disabled || !button.action,
        });
      });
      return y + 44;
    }

    renderWorldExpeditionConfig(config = {}, x, y, width) {
      if (!config) return y;
      this.drawPanel(x, y, width, 136, {
        fill: 'rgba(0, 0, 0, 0.16)',
        stroke: 'rgba(240, 180, 91, 0.16)',
        radius: 9,
      });
      const leaderOptions = config.fields?.leader?.options || [];
      const activeLeader = leaderOptions.find((option) => option.value === config.fields?.leader?.value) || leaderOptions[0] || null;
      this.drawText(`领队 ${activeLeader?.label || '暂无可出征名人'}`, x + 12, y + 12, { size: 12, bold: true, color: '#f6e8c8' });
      const leaderY = y + 34;
      const leaderButtonWidth = Math.max(82, Math.min(118, (width - 24 - 8 * Math.max(0, leaderOptions.length - 1)) / Math.max(1, Math.min(3, leaderOptions.length || 1))));
      leaderOptions.slice(0, 3).forEach((option, index) => {
        const buttonX = x + 12 + index * (leaderButtonWidth + 8);
        const active = option.value === config.fields?.leader?.value;
        this.drawButton(buttonX, leaderY, leaderButtonWidth, 26, this.truncateText(option.label, leaderButtonWidth - 12, { size: 10 }), {
          size: 10,
          radius: 7,
          active,
          disabled: false,
        });
        this.addHitTarget({ x: buttonX, y: leaderY, width: leaderButtonWidth, height: 26 }, {
          type: 'changeExpeditionLeader',
          siteId: config.siteId,
          value: option.value,
          disabled: false,
        });
      });
      this.drawText(`出征数量 ${config.fields?.soldiers?.value || 1}`, x + 12, y + 70, { size: 12, bold: true, color: '#f6e8c8' });
      this.drawText(config.note || '', x + 12, y + 92, { size: 10, color: '#aeb0b8' });
      const value = Number(config.fields?.soldiers?.value) || 1;
      const controlsY = y + 112;
      this.drawButton(x + 12, controlsY, 34, 28, '-', { size: 14, radius: 7, disabled: value <= 1 });
      this.drawButton(x + width - 46, controlsY, 34, 28, '+', { size: 14, radius: 7 });
      this.drawButton(x + width - 132, controlsY, 78, 28, config.buttons?.launch?.label || '出发', {
        size: 12,
        radius: 7,
        disabled: config.disabled,
        active: !config.disabled,
      });
      this.addHitTarget({ x: x + 12, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: -1,
        value: Math.max(1, value - 1),
        disabled: value <= 1,
      });
      this.addHitTarget({ x: x + width - 46, y: controlsY, width: 34, height: 28 }, {
        type: 'changeExpeditionSoldiers',
        siteId: config.siteId,
        delta: 1,
        value: value + 1,
      });
      this.addHitTarget({ x: x + width - 132, y: controlsY, width: 78, height: 28 }, {
        type: 'launchExpedition',
        territoryId: config.siteId,
        disabled: config.disabled,
      });
      return y + 148;
    }

    renderWorldSiteModal(state = {}, options = {}) {
      if (!this.presenter || typeof this.presenter.buildWorldSiteDialogViewState !== 'function') return;
      const territoryState = state.territoryState || {};
      const territories = territoryState.territories || [];
      const uiState = options.territoryUiState || {};
      const view = this.presenter.buildWorldSiteDialogViewState(territories, territoryState, uiState);
      if (!view.showModal) return;
      const detail = view.details.find((item) => item.id === view.selectedSiteId);
      if (!detail) return;

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeWorldSite' });
      const layout = this.getLayout();
      const panelWidth = Math.min(layout.contentWidth - 24, 360);
      const panelHeight = Math.min(500, this.height - 150);
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });
      const closeSize = 28;
      this.drawButton(x + panelWidth - closeSize - 10, y + 10, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: x + panelWidth - closeSize - 10, y: y + 10, width: closeSize, height: closeSize }, { type: 'closeWorldSite' });

      const selectedSite = territories.find((site) => site.id === detail.id) || {};
      this.drawAsset(selectedSite.art, x + 16, y + 20, 58, 58);
      this.drawText(this.truncateText(detail.text.name || '地点', panelWidth - 112, { size: 17, bold: true }), x + 84, y + 22, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(`${detail.text.status} · ${detail.text.owner}`, x + 84, y + 50, { size: 11, color: '#aeb0b8' });
      this.drawText(`${detail.text.distance} · ${detail.text.scale} · ${detail.text.threat}`, x + 84, y + 68, { size: 11, color: '#aeb0b8' });
      let cursorY = y + 94;
      const summaryLines = this.wrapTextLimit(detail.text.summary || '无', panelWidth - 32, 3, { size: 12 });
      this.drawTextLines(summaryLines, x + 16, cursorY, { size: 12, color: '#f6e8c8', lineHeight: 17 });
      cursorY += summaryLines.length * 17 + 12;
      this.drawText(`${detail.text.defense} · ${detail.text.soldiers}`, x + 16, cursorY, { size: 12, color: '#74d3a0' });
      cursorY += 22;
      if (detail.text.march) {
        this.drawText(detail.text.march, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (detail.text.note) {
        this.drawText(detail.text.note, x + 16, cursorY, { size: 11, color: '#d6b16e' });
        cursorY += 20;
      }
      if (Array.isArray(detail.text.battleReport) && detail.text.battleReport.length) {
        detail.text.battleReport.slice(0, 3).forEach((line) => {
          const lines = this.wrapTextLimit(line, panelWidth - 32, 1, { size: 11 });
          this.drawTextLines(lines, x + 16, cursorY, { size: 11, color: '#f0b45b', lineHeight: 15 });
          cursorY += lines.length * 15 + 3;
        });
        cursorY += 6;
      }
      if (detail.action?.hint) {
        const hintLines = this.wrapTextLimit(detail.action.hint, panelWidth - 32, 2, { size: 11 });
        this.drawTextLines(hintLines, x + 16, cursorY, { size: 11, color: '#aeb0b8', lineHeight: 15 });
        cursorY += hintLines.length * 15 + 10;
      }
      cursorY = this.renderWorldSiteAction(detail.action, x + 16, cursorY, panelWidth - 32);
      if (detail.action?.expeditionConfig) {
        this.renderWorldExpeditionConfig(detail.action.expeditionConfig, x + 16, cursorY, panelWidth - 32);
      }
    }

    renderMilitary(state = {}, startY = 210, panelHeight = 310, options = {}) {
      if (!this.presenter) return;
      const nav = this.presenter.buildMilitaryNavigationViewState(state);
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      this.drawPanel(x, startY, width, panelHeight, {
        fill: 'rgba(37, 29, 21, 0.88)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.08)',
      });
      this.renderSectionHeader('军事', x + 14, startY + 14, '🛡️');
      const contentTop = this.renderMilitarySubTabs(nav, x + 12, startY + 42, width - 24);
      const viewY = contentTop;
      const viewHeight = Math.max(120, startY + panelHeight - viewY - 12);
      if (nav.activeView === 'scout') {
        this.renderMilitaryScoutView(this.presenter.buildScoutControlViewState(state), x + 12, viewY, width - 24, viewHeight);
      } else if (nav.activeView === 'world') {
        this.renderMilitaryWorldView(state, x + 12, viewY, width - 24, viewHeight, options);
      } else {
        this.renderMilitaryArmyView(this.presenter.buildMilitaryViewState(state), x + 12, viewY, width - 24, viewHeight);
      }
    }

    renderMainPanel(state = {}, activeTab = 'resources', startY = 210, availableHeight = 310, options = {}) {
      if (activeTab === 'buildings') this.renderBuildings(state, startY, availableHeight, {
        offset: options.buildingOffset,
        buildingTransition: options.buildingTransition,
        activeBuildingCategory: options.activeBuildingCategory,
      });
      else if (activeTab === 'events') this.renderEvents(state, startY, availableHeight);
      else if (activeTab === 'tech') this.renderTech(state, startY, availableHeight, options);
      else if (activeTab === 'civilization') this.renderCivilization(state, startY, availableHeight, options);
      else if (activeTab === 'military') this.renderMilitary(state, startY, availableHeight, options);
    }

    renderHudTabPage(state = {}, activeTab = 'resources', topBarBottom = 84, options = {}) {
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      if (activeTab === 'resources') {
        const populationBottom = this.renderPopulation(state, topBarBottom);
        this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: tabsTop - 8 });
      } else if (activeTab === 'buildings') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderBuildings(
          { ...state, tutorial: options.tutorial || state.tutorial || {} },
          topBarBottom,
          availableHeight,
          {
            offset: options.buildingOffset,
            buildingTransition: options.buildingTransition,
            activeBuildingCategory: options.activeBuildingCategory,
          },
        );
      } else if (activeTab === 'events') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderEvents(state, topBarBottom, availableHeight);
      } else if (activeTab === 'tech') {
        const availableHeight = Math.max(180, tabsTop - topBarBottom - 12);
        this.renderTech(state, topBarBottom, availableHeight, options);
      } else if (activeTab === 'civilization') {
        const availableHeight = Math.max(260, tabsTop - topBarBottom - 12);
        this.renderCivilization(
          state,
          topBarBottom,
          availableHeight,
          { tutorial: options.tutorial || state.tutorial || {} },
        );
      } else if (activeTab === 'military') {
        const availableHeight = Math.max(360, tabsTop - topBarBottom - 12);
        this.renderMilitary(state, topBarBottom, availableHeight, options);
      }
    }

    renderHudTabPageWithTransition(state = {}, activeTab = 'resources', topBarBottom = 84, options = {}) {
      const pageTransition = options.pageTransition || null;
      const transition = this.getTransitionFrame(pageTransition);
      const fromTab = pageTransition?.fromTab;
      const toTab = pageTransition?.toTab || activeTab;
      if (!transition || !fromTab || fromTab === activeTab || toTab !== activeTab) {
        this.renderHudTabPage(state, activeTab, topBarBottom, options);
        return;
      }
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const clipY = topBarBottom;
      const clipHeight = Math.max(120, tabsTop - clipY);
      const travel = this.width + 24;
      this.withSlideClip(0, clipY, this.width, clipHeight, -transition.direction * travel * transition.eased, () => {
        this.withSuppressedHitTargets(() => this.renderHudTabPage(state, fromTab, topBarBottom, {
          ...options,
          buildingOffset: pageTransition.fromBuildingOffset ?? options.buildingOffset,
          buildingTransition: null,
        }));
      });
      this.withSlideClip(0, clipY, this.width, clipHeight, transition.direction * travel * (1 - transition.eased), () => {
        this.renderHudTabPage(state, activeTab, topBarBottom, options);
      });
    }

    renderTabs(activeTab = 'resources', state = {}, options = {}) {
      const tabs = [
        ['resources', '主页', 'assets/art/icon-home-cutout.png'],
        ['buildings', '建造', 'assets/art/building-house-cutout.png'],
        ['tech', '科技', 'assets/art/icon-knowledge-cutout.webp'],
        ['events', '事件', 'assets/art/icon-event-cutout.webp'],
        ['civilization', '文明', 'assets/art/icon-fire-cutout.webp'],
        ['military', '军事', 'assets/art/icon-soldier-cutout.webp'],
      ];
      const layout = this.getLayout();
      const x = layout.contentX;
      const width = layout.contentWidth;
      const tabBarHeight = 58;
      const y = this.height - tabBarHeight;
      const eventBadge = this.presenter && typeof this.presenter.buildEventViewState === 'function'
        ? this.presenter.buildEventViewState(state).badge
        : { hidden: true };
      const lockById = new Map((options.tabLocks || []).map((item) => [item.id, item]));
      this.drawPanel(x, y, width, tabBarHeight, {
        fill: this.createGradient(
          x, y, x, y + tabBarHeight,
          [
            [0, 'rgba(47, 35, 25, 0.92)'],
            [1, 'rgba(23, 18, 13, 0.96)'],
          ],
          'rgba(34, 25, 18, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 0,
      });
      const tabWidth = width / tabs.length;
      tabs.forEach(([id, label, icon], index) => {
        const tabX = x + index * tabWidth;
        const isActive = id === activeTab;
        const lock = lockById.get(id) || { disabled: false, isLocked: false };
        const isLocked = Boolean(lock.disabled || lock.isLocked);
        if (isActive && this.ctx) {
          this.ctx.fillStyle = this.createGradient(
            tabX + tabWidth * 0.2, y, tabX + tabWidth * 0.8, y,
            [
              [0, '#d78332'],
              [1, '#f0b45b'],
            ],
            '#d78332',
          );
          this.ctx.fillRect(tabX + tabWidth * 0.2, y, tabWidth * 0.6, 3);
        }
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = isLocked ? 0.38 : previousAlpha;
        this.drawAsset(icon, tabX + tabWidth / 2 - (isActive ? 16 : 14), y + 7 - (isActive ? 2 : 0), isActive ? 32 : 28, isActive ? 32 : 28);
        if (typeof this.ctx?.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
        this.drawText(label, tabX + tabWidth / 2, y + 38, {
          size: 10,
          color: isLocked ? '#666' : (isActive ? '#d78332' : '#a0a0a0'),
          align: 'center',
          bold: isActive,
        });
        if (id === 'events' && !eventBadge.hidden) {
          const badgeX = tabX + tabWidth / 2 + 10;
          const badgeY = y + 6;
          this.drawPanel(badgeX, badgeY, 18, 18, {
            fill: '#e94560',
            stroke: 'rgba(255, 255, 255, 0.16)',
            radius: 9,
          });
          this.drawText(eventBadge.text, badgeX + 9, badgeY + 9, {
            size: 10,
            bold: true,
            color: '#fff',
            baseline: 'middle',
            align: 'center',
          });
        }
        this.addHitTarget({ x: tabX, y, width: tabWidth, height: tabBarHeight }, { type: 'switchTab', tab: id, disabled: isLocked });
      });
    }

    renderAdvisor(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;
      const layout = this.getLayout();
      const width = layout.contentWidth;
      const x = layout.contentX;
      const y = this.height - 132 - this.bottomSafeArea;
      this.drawPanel(x, y, width, 44, {
        fill: 'rgba(42, 35, 24, 0.94)',
        stroke: 'rgba(240, 180, 91, 0.24)',
        radius: 10,
      });
      this.drawText('顾问', x + 12, y + 13, { color: '#ffd98a', size: 14, bold: true });
      this.drawText(view.activeAdvisor.message, x + 64, y + 13, { color: '#f6e8c8', size: 12 });
    }

    renderAdvisorPanel(state = {}) {
      if (!this.presenter || typeof this.presenter.buildAdvisorViewState !== 'function') return;
      const view = this.presenter.buildAdvisorViewState(state.softGuide);
      if (view.hidden || !view.activeAdvisor) return;

      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 28);
      const panelHeight = 276;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 18);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeAdvisor' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, '×', { size: 16, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeAdvisor' });

      const portraitSize = 64;
      const portraitX = x + panelWidth / 2 - portraitSize / 2;
      const portraitY = y + 24;
      this.drawPanel(portraitX, portraitY, portraitSize, portraitSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: portraitSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('谋', x + panelWidth / 2, portraitY + portraitSize / 2, {
        size: 24,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
      this.drawText('顾问建议', x + panelWidth / 2, y + 102, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageX = x + 18;
      const messageY = y + 132;
      const messageWidth = panelWidth - 36;
      const messageHeight = 72;
      this.drawPanel(messageX, messageY, messageWidth, messageHeight, {
        fill: 'rgba(23, 18, 13, 0.42)',
        stroke: 'rgba(255, 226, 177, 0.14)',
        radius: 10,
        inset: 'rgba(255, 231, 184, 0.04)',
      });
      const lines = this.wrapText(view.text?.message || view.activeAdvisor.message, messageWidth - 24, { size: 13 })
        .slice(0, 3);
      this.drawTextLines(lines, messageX + 12, messageY + 13, {
        size: 13,
        color: '#f6e8c8',
        lineHeight: 18,
      });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const goX = x + 18;
      const dismissX = goX + buttonWidth + buttonGap;
      this.drawButton(goX, buttonY, buttonWidth, 36, '前往处理', {
        size: 13,
        bold: true,
        radius: 9,
        disabled: Boolean(view.goButton?.disabled),
        active: !view.goButton?.disabled,
      });
      this.drawButton(dismissX, buttonY, buttonWidth, 36, '稍后再说', { size: 13, radius: 9 });
      this.addHitTarget(
        { x: goX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'goToAdvisorTarget', disabled: Boolean(view.goButton?.disabled) },
      );
      this.addHitTarget({ x: dismissX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeAdvisor' });
    }

    renderNamingModal(naming = {}) {
      if (!naming || !naming.visible || !naming.view) return;
      const view = naming.view || {};
      const inputValue = String(naming.inputValue || '');
      const isSubmitting = Boolean(naming.submitting);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeNaming' });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.54)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 286;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 12);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const closeSize = 28;
      const closeX = x + panelWidth - closeSize - 10;
      const closeY = y + 10;
      this.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
      this.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeNaming' });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawText('城', x + panelWidth / 2, iconY + iconSize / 2, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });

      this.drawText(this.truncateText(view.title || '命名', panelWidth - 84, { size: 17, bold: true }), x + panelWidth / 2, y + 98, {
        size: 17,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageLines = this.wrapTextLimit(view.message || '', panelWidth - 48, 2, { size: 13 });
      this.drawTextLines(messageLines, x + 24, y + 128, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 17,
      });

      const inputX = x + 18;
      const inputY = y + 174;
      const inputWidth = panelWidth - 36;
      const inputHeight = 42;
      this.drawPanel(inputX, inputY, inputWidth, inputHeight, {
        fill: 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.24)',
        radius: 9,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      const displayValue = inputValue || view.placeholder || '请输入名称';
      this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, inputY + 21, {
        size: 14,
        color: inputValue ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: inputY, width: inputWidth, height: inputHeight }, { type: 'requestNamingInput' });

      const buttonY = y + panelHeight - 52;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const cancelX = x + 18;
      const submitX = cancelX + buttonWidth + buttonGap;
      this.drawButton(cancelX, buttonY, buttonWidth, 36, '取消', { size: 13, radius: 9 });
      this.drawButton(submitX, buttonY, buttonWidth, 36, isSubmitting ? '提交中' : '确定', {
        size: 13,
        bold: true,
        radius: 9,
        active: true,
        disabled: isSubmitting || !inputValue.trim(),
      });
      this.addHitTarget({ x: cancelX, y: buttonY, width: buttonWidth, height: 36 }, { type: 'closeNaming' });
      this.addHitTarget(
        { x: submitX, y: buttonY, width: buttonWidth, height: 36 },
        { type: 'submitNaming', disabled: isSubmitting || !inputValue.trim() },
      );
    }

    renderFloatingTexts(effects = []) {
      if (!Array.isArray(effects) || !effects.length) return;
      const layout = this.getLayout();
      const centerX = layout.contentX + layout.contentWidth / 2;
      effects.slice(0, 4).forEach((effect, index) => {
        const progress = Math.max(0, Math.min(1, Number(effect.progress) || 0));
        const previousAlpha = typeof this.ctx?.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = Math.max(0, 1 - progress);
        const y = 128 - progress * 58 - index * 22;
        const text = this.truncateText(effect.text || '', layout.contentWidth - 52, { size: 15, bold: true });
        const textWidth = Math.min(layout.contentWidth - 36, Math.max(96, this.measureTextWidth(text, { size: 15, bold: true }) + 28));
        this.drawPanel(centerX - textWidth / 2, y - 8, textWidth, 30, {
          fill: 'rgba(16, 20, 14, 0.62)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 15,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        this.drawText(text, centerX, y + 7, {
          size: 15,
          bold: true,
          color: effect.color || '#74d3a0',
          baseline: 'middle',
          align: 'center',
        });
        if (this.ctx && typeof this.ctx.globalAlpha === 'number') this.ctx.globalAlpha = previousAlpha;
      });
    }

    parsePixelValue(value) {
      if (typeof value === 'number') return value;
      const parsed = Number(String(value ?? '').replace('px', ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    easeOutCubic(value) {
      const t = Math.max(0, Math.min(1, Number(value) || 0));
      return 1 - ((1 - t) ** 3);
    }

    getTransitionFrame(transition = null) {
      if (!transition) return null;
      const startedAt = Number(transition.startedAt);
      if (!Number.isFinite(startedAt)) return null;
      const durationMs = Math.max(1, Number(transition.durationMs) || 220);
      const progress = Math.max(0, Math.min(1, (this.getNow() - startedAt) / durationMs));
      if (progress >= 1) return null;
      return {
        progress,
        eased: this.easeOutCubic(progress),
        direction: Number(transition.direction) < 0 ? -1 : 1,
      };
    }

    interpolateRect(fromRect = {}, toRect = {}, progress = 1) {
      const eased = this.easeOutCubic(progress);
      const read = (rect, key, fallback = 0) => Number(rect?.[key] ?? fallback) || 0;
      const lerp = (from, to) => from + (to - from) * eased;
      const left = lerp(read(fromRect, 'left'), read(toRect, 'left'));
      const top = lerp(read(fromRect, 'top'), read(toRect, 'top'));
      const width = lerp(read(fromRect, 'width'), read(toRect, 'width'));
      const height = lerp(read(fromRect, 'height'), read(toRect, 'height'));
      return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      };
    }

    renderTutorialHighlight(highlight = null) {
      if (!highlight || !highlight.rect || !this.presenter || !this.ctx) return;
      const now = this.getNow();
      const transition = highlight.transition || null;
      const rect = transition
        ? this.interpolateRect(
          transition.fromRect,
          transition.toRect || highlight.rect,
          (now - (Number(transition.startedAt) || now)) / Math.max(1, Number(transition.durationMs) || 260),
        )
        : highlight.rect;
      const pulse = 0.5 + Math.sin((now - (Number(highlight.pulseStartedAt) || now)) / 180) * 0.5;
      const view = this.presenter.buildTutorialHighlightViewState(rect, {
        innerWidth: this.width,
        innerHeight: this.height,
      });
      const overlay = {
        x: this.parsePixelValue(view.overlay.left),
        y: this.parsePixelValue(view.overlay.top),
        width: this.parsePixelValue(view.overlay.width),
        height: this.parsePixelValue(view.overlay.height),
      };
      const bubble = {
        x: this.parsePixelValue(view.bubble.left),
        y: this.parsePixelValue(view.bubble.top),
        width: 220,
        height: 72,
      };
      const pointer = {
        x: this.parsePixelValue(view.pointer.left),
        y: this.parsePixelValue(view.pointer.top),
      };
      this.addTutorialShield(transition?.toRect || highlight.rect || rect);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      this.ctx.fillRect(0, 0, this.width, overlay.y);
      this.ctx.fillRect(0, overlay.y + overlay.height, this.width, Math.max(0, this.height - overlay.y - overlay.height));
      this.ctx.fillRect(0, overlay.y, overlay.x, overlay.height);
      this.ctx.fillRect(overlay.x + overlay.width, overlay.y, Math.max(0, this.width - overlay.x - overlay.width), overlay.height);

      this.drawPanel(overlay.x, overlay.y, overlay.width, overlay.height, {
        fill: `rgba(255, 247, 214, ${0.07 + pulse * 0.04})`,
        stroke: `rgba(255, 215, 0, ${0.78 + pulse * 0.2})`,
        radius: 16,
        inset: 'rgba(255, 247, 214, 0.18)',
      });
      this.ctx.lineWidth = 3;
      this.roundRectPath(overlay.x, overlay.y, overlay.width, overlay.height, 16);
      this.ctx.strokeStyle = `rgba(255, 215, 0, ${0.78 + pulse * 0.2})`;
      this.ctx.stroke();
      this.ctx.lineWidth = 1;

      this.drawPanel(bubble.x, bubble.y, bubble.width, bubble.height, {
        fill: '#fff7d6',
        stroke: 'rgba(255, 215, 0, 0.38)',
        radius: 12,
        inset: 'rgba(255, 255, 255, 0.26)',
      });
      const messageLines = this.wrapTextLimit(highlight.message || '', bubble.width - 28, 3, { size: 13 });
      this.drawTextLines(messageLines, bubble.x + 14, bubble.y + 12, {
        size: 13,
        color: '#3b2f00',
        lineHeight: 19,
      });

      this.drawText('👇', pointer.x + 12, pointer.y + 13, {
        size: 24,
        baseline: 'middle',
        align: 'center',
      });
    }

    addTutorialShield(rect = {}) {
      const x = Math.max(0, Math.min(this.width, Number(rect.left ?? rect.x) || 0));
      const y = Math.max(0, Math.min(this.height, Number(rect.top ?? rect.y) || 0));
      const width = Math.max(0, Math.min(this.width - x, Number(rect.width) || 0));
      const height = Math.max(0, Math.min(this.height - y, Number(rect.height) || 0));
      const right = Math.max(x, Math.min(this.width, x + width));
      const bottom = Math.max(y, Math.min(this.height, y + height));
      const block = { type: 'blockCanvasModal' };
      [
        { x: 0, y: 0, width: this.width, height: y },
        { x: 0, y: bottom, width: this.width, height: Math.max(0, this.height - bottom) },
        { x: 0, y, width: x, height },
        { x: right, y, width: Math.max(0, this.width - right), height },
      ]
        .filter((item) => item.width > 0 && item.height > 0)
        .forEach((item) => this.addHitTarget(item, block));
    }

    drawRewardParticle(cx, cy, radius, angle, progress, index) {
      if (!this.ctx) return;
      const distance = radius * (0.44 + progress * 0.36 + (index % 3) * 0.04);
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const size = 2 + (index % 4);
      this.ctx.fillStyle = index % 2 ? 'rgba(255, 245, 190, 0.86)' : 'rgba(247, 215, 116, 0.78)';
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    renderRewardReveal(reveal = null) {
      if (!reveal || !this.ctx) return;
      const now = this.getNow();
      const startedAt = Number(reveal.createdAt) || now;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / 900));
      const pulse = 0.5 + Math.sin(now / 180) * 0.5;
      const layout = this.getLayout();
      const panelWidth = Math.min(340, layout.contentWidth - 22);
      const panelHeight = 254;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(96, (this.height - panelHeight) / 2 - 14);
      const cx = x + panelWidth / 2;
      const glowY = y + 72;

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeRewardReveal' });

      const previousAlpha = typeof this.ctx.globalAlpha === 'number' ? this.ctx.globalAlpha : 1;
      this.ctx.globalAlpha = 0.78;
      this.ctx.fillStyle = this.createGradient(
        cx - 86, glowY - 86, cx + 86, glowY + 86,
        [
          [0, 'rgba(255, 248, 189, 0.02)'],
          [0.5, `rgba(247, 215, 116, ${0.26 + pulse * 0.16})`],
          [1, 'rgba(255, 248, 189, 0.02)'],
        ],
        'rgba(247, 215, 116, 0.24)',
      );
      this.ctx.beginPath();
      this.ctx.arc(cx, glowY, 86 + pulse * 10, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = previousAlpha;

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(69, 48, 26, 0.99)'],
            [0.52, 'rgba(33, 26, 18, 0.99)'],
            [1, 'rgba(20, 18, 14, 0.99)'],
          ],
          'rgba(35, 28, 20, 0.99)',
        ),
        stroke: 'rgba(247, 215, 116, 0.52)',
        radius: 14,
        inset: 'rgba(255, 245, 190, 0.12)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const sweepWidth = 72;
      const sweepX = x - sweepWidth + (panelWidth + sweepWidth * 2) * progress;
      this.ctx.globalAlpha = 0.28;
      this.ctx.fillStyle = this.createGradient(
        sweepX, y, sweepX + sweepWidth, y,
        [
          [0, 'rgba(255, 255, 255, 0)'],
          [0.5, 'rgba(255, 255, 255, 0.82)'],
          [1, 'rgba(255, 255, 255, 0)'],
        ],
        'rgba(255, 255, 255, 0.28)',
      );
      this.ctx.fillRect(Math.max(x, sweepX), y + 1, Math.min(sweepWidth, x + panelWidth - sweepX), panelHeight - 2);
      this.ctx.globalAlpha = previousAlpha;

      for (let index = 0; index < 18; index += 1) {
        this.drawRewardParticle(cx, glowY, 94, (Math.PI * 2 * index) / 18 + now / 900, progress, index);
      }

      this.drawText(reveal.title || '获得奖励', cx, y + 30, {
        size: 20,
        bold: true,
        color: '#fff1cf',
        align: 'center',
      });
      this.drawText(reveal.subtitle || '', cx, y + 60, {
        size: 13,
        color: '#ffd98a',
        align: 'center',
      });

      const rewardText = reveal.rewardText || '';
      const rewardLines = this.wrapTextLimit(rewardText, panelWidth - 58, 3, { size: 15, bold: true });
      this.drawPanel(x + 22, y + 96, panelWidth - 44, 72, {
        fill: 'rgba(11, 18, 14, 0.42)',
        stroke: 'rgba(116, 211, 160, 0.28)',
        radius: 10,
        inset: 'rgba(116, 211, 160, 0.08)',
      });
      this.drawTextLines(rewardLines, x + 34, y + 111, {
        size: 15,
        bold: true,
        color: '#74d3a0',
        lineHeight: 22,
      });

      const buttonWidth = panelWidth - 44;
      const buttonY = y + panelHeight - 58;
      this.drawButton(x + 22, buttonY, buttonWidth, 40, '收下', {
        size: 14,
        bold: true,
        active: true,
        radius: 10,
      });
      this.addHitTarget({ x: x + 22, y: buttonY, width: buttonWidth, height: 40 }, { type: 'closeRewardReveal' });
    }

    renderLoginPanel(auth = {}) {
      const view = auth.view || {};
      if (!view.loginPanelVisible) return;
      const credentials = auth.credentials || {};
      this.setHitTargets([]);
      if (this.ctx) {
        this.ctx.fillStyle = '#14120f';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 12);
      const panelHeight = 344;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 12, iconY + 12, 34, 34);
      this.drawText('\u6587\u660e\u706b\u79cd', x + panelWidth / 2, y + 104, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const message = view.message || '';
      this.drawText(this.truncateText(message, panelWidth - 48, { size: 13 }), x + panelWidth / 2, y + 134, {
        size: 13,
        color: message ? '#e94560' : 'rgba(234, 234, 234, 0.42)',
        align: 'center',
      });

      const inputX = x + 24;
      const inputWidth = panelWidth - 48;
      const inputHeight = 42;
      const usernameY = y + 160;
      const passwordY = usernameY + 52;
      const drawInput = (fieldY, label, value, actionType, masked = false) => {
        this.drawPanel(inputX, fieldY, inputWidth, inputHeight, {
          fill: 'rgba(23, 18, 13, 0.56)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 8,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        const displayValue = value
          ? (masked ? '\u2022'.repeat(Math.min(12, String(value).length)) : value)
          : label;
        this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, fieldY + 21, {
          size: 14,
          color: value ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
          baseline: 'middle',
        });
        this.addHitTarget({ x: inputX, y: fieldY, width: inputWidth, height: inputHeight }, { type: actionType });
      };
      drawInput(usernameY, '\u7528\u6237\u540d', credentials.usernameValue || '', 'requestLoginUsername');
      drawInput(passwordY, '\u5bc6\u7801', credentials.passwordValue || '', 'requestLoginPassword', true);

      const rememberY = passwordY + 54;
      const checkboxSize = 18;
      this.drawPanel(inputX, rememberY, checkboxSize, checkboxSize, {
        fill: credentials.rememberPasswordChecked ? 'rgba(116, 211, 160, 0.68)' : 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.34)',
        radius: 5,
      });
      if (credentials.rememberPasswordChecked) {
        this.drawText('\u2713', inputX + checkboxSize / 2, rememberY + checkboxSize / 2, {
          size: 13,
          bold: true,
          color: '#0d1510',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText('\u8bb0\u4f4f\u5bc6\u7801', inputX + checkboxSize + 9, rememberY + checkboxSize / 2, {
        size: 13,
        color: '#cbbd96',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: rememberY - 6, width: 112, height: 32 }, { type: 'toggleRememberPassword' });

      const loginY = y + panelHeight - 58;
      this.drawButton(inputX, loginY, inputWidth, 40, '\u767b\u5f55', {
        size: 14,
        bold: true,
        radius: 9,
        active: true,
      });
      this.addHitTarget({ x: inputX, y: loginY, width: inputWidth, height: 40 }, { type: 'submitLogin' });
    }

    renderLoadingScreen(loading = {}) {
      if (!loading.visible) return;
      this.setHitTargets([]);
      if (this.ctx) {
        const hasBackground = this.drawCoverAsset('assets/art/civilization-bg.webp', 0, 0, this.width, this.height, 1);
        if (!hasBackground) {
          this.ctx.fillStyle = this.createGradient(
            0, 0, this.width, this.height,
            [
              [0, '#1c241b'],
              [0.48, '#44321f'],
              [1, '#11140f'],
            ],
            '#14120f',
          );
          this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.ctx.fillStyle = 'rgba(10, 10, 8, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 154;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.floor(this.height * 0.56);
      const percentage = Math.max(0, Math.min(100, Number(loading.percentage) || 0));

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.92)'],
            [1, 'rgba(19, 17, 13, 0.94)'],
          ],
          'rgba(31, 25, 18, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.3)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      const iconSize = 52;
      const iconX = x + 22;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.9)',
        stroke: 'rgba(240, 180, 91, 0.44)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 10, iconY + 10, 32, 32);
      this.drawText('\u6587\u660e\u706b\u79cd', iconX + iconSize + 14, y + 31, {
        size: 19,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(loading.message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90', iconX + iconSize + 14, y + 58, {
        size: 12,
        color: '#cbbd96',
      });

      const barX = x + 22;
      const barY = y + 98;
      const barWidth = panelWidth - 44;
      this.drawProgressBar(barX, barY, barWidth, 16, percentage);
      this.drawText(`${Math.round(percentage)}%`, x + panelWidth / 2, barY + 28, {
        size: 12,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'blockCanvasModal' });
    }

    renderHudOverlay(state = {}, options = {}) {
      const activeTab = options.activeTab || 'resources';
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clear();
      if (options.auth?.view?.loginPanelVisible) {
        this.renderLoginPanel(options.auth);
        this.endFrame(options);
        return;
      }
      if (options.loading?.visible) {
        this.renderLoadingScreen(options.loading);
        this.endFrame(options);
        return;
      }
      if (options.battleScene?.visible) {
        this.renderBattleSceneOverlay(state, options);
        this.endFrame(options);
        return;
      }
      const topBarBottom = this.renderTopBar(state);
      this.renderHudTabPageWithTransition(state, activeTab, topBarBottom, options);
      this.renderTabs(activeTab, state, options);
      if (options.showResourceDetails) {
        this.renderResourceDetailsPanel(state);
      }
      if (options.showSettings) {
        this.renderSettingsPanel();
      }
      if (options.showLogs) {
        this.renderLogsPanel(options.logs || []);
      }
      if (options.showCitySwitcher) {
        this.renderCitySwitcherMenu(state);
      }
      if (options.showAdvisor) {
        this.renderAdvisorPanel(state);
      }
      if (options.showTaskCenter) {
        this.renderTaskCenterPanel(state, options);
      }
      if (options.showGuidebook) {
        this.renderGuidebookPanel(state, options);
      }
      if (options.showFamousPersons) {
        this.renderFamousPersonsPanel(state, options);
      }
      if (options.showTalentPolicy) {
        this.renderTalentPolicyPanel(state, options);
      }
      if (options.activeEventId) {
        this.renderEventModal(state, options.activeEventId);
      }
      if (activeTab === 'tech' && (options.techDetailOpen || state.techUiState?.detailOpen)) {
        const view = this.presenter?.buildTechViewState?.({
          ...state,
          techUiState: {
            ...(state.techUiState || {}),
            ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
          },
          ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
        });
        this.renderTechDetailModal(view?.detail);
      }
      if (activeTab === 'military') {
        this.renderWorldSiteModal(state, options);
      }
      if (options.naming) {
        this.renderNamingModal(options.naming);
      }
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.endFrame(options);
    }

    renderSettingsPanel() {
      const layout = this.getLayout();
      const panelWidth = 200;
      const panelHeight = 120;
      const x = layout.contentRight - panelWidth - 8;
      const y = 62;

      // 绘制面板背景
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 10,
      });

      // 绘制标题
      this.drawText('设置', x + panelWidth / 2, y + 18, {
        size: 14,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      // 绘制分隔线
      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 28);
        this.ctx.lineTo(x + panelWidth - 10, y + 28);
        this.ctx.stroke();
      }

      // 重置游戏按钮
      const btnHeight = 36;
      const btnY1 = y + 38;
      this.drawButton(x + 10, btnY1, panelWidth - 20, btnHeight, '重置游戏', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY1, width: panelWidth - 20, height: btnHeight }, { type: 'resetGame' });

      // 退出登录按钮
      const btnY2 = btnY1 + btnHeight + 8;
      this.drawButton(x + 10, btnY2, panelWidth - 20, btnHeight, '退出登录', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY2, width: panelWidth - 20, height: btnHeight }, { type: 'logout' });

      // 面板外部点击关闭
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSettings', background: true });
    }

    renderLogsPanel(logs = []) {
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const panelHeight = 420;
      const x = (this.width - panelWidth) / 2;
      const y = (this.height - panelHeight) / 2;

      // 绘制面板背景
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 12,
      });

      // 绘制标题
      this.drawText('📜 最近请求日志', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      // 绘制关闭按钮
      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, '✕', {
        size: 14,
        radius: 6,
        active: false,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeLogs' });

      // 绘制分隔线
      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 12, y + 42);
        this.ctx.lineTo(x + panelWidth - 12, y + 42);
        this.ctx.stroke();
      }

      // 日志列表区域
      const listX = x + 12;
      const listY = y + 52;
      const listWidth = panelWidth - 24;
      const listHeight = panelHeight - 110;

      // 绘制日志列表背景
      this.drawPanel(listX, listY, listWidth, listHeight, {
        fill: 'rgba(0, 0, 0, 0.2)',
        stroke: 'rgba(255, 255, 255, 0.05)',
        radius: 8,
      });

      // 绘制日志条目
      const itemHeight = 28;
      const maxItems = Math.floor(listHeight / itemHeight);
      const displayLogs = logs.slice(0, maxItems);

      if (displayLogs.length === 0) {
        this.drawText('暂无日志', listX + listWidth / 2, listY + listHeight / 2, {
          size: 12,
          color: '#888',
          align: 'center',
        });
      } else {
        displayLogs.forEach((log, index) => {
          const itemY = listY + 6 + index * itemHeight;
          const time = log.timestamp || '';
          const method = (log.method || '') + ' ' + (log.path || '');
          const status = log.statusCode || 0;
          const isOk = status >= 200 && status < 300;
          const statusColor = isOk ? '#74d3a0' : '#ff6b6b';

          // 时间
          this.drawText(time, listX + 8, itemY + 10, { size: 10, color: '#aaa' });
          // 方法
          this.drawText(method, listX + 70, itemY + 10, { size: 10, color: '#f6e8c8' });
          // 状态码
          this.drawText(String(status), listX + listWidth - 40, itemY + 10, { size: 10, color: statusColor });
        });
      }

      // 清空日志按钮
      const clearBtnY = y + panelHeight - 48;
      this.drawButton(x + 12, clearBtnY, panelWidth - 24, 36, '清空日志', {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 12, y: clearBtnY, width: panelWidth - 24, height: 36 }, { type: 'clearLogs' });

      // 面板外部点击关闭
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeLogs', background: true });
    }

    renderResourceDetailsPanel(state = {}) {
      if (!this.presenter) return;
      const view = this.presenter.buildResourceViewState(state);
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const resourceCount = 5;
      const panelHeight = 92 + resourceCount * 86;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(76, (this.height - panelHeight) / 2 - 20);

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeResourceDetails' });

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.97)',
        stroke: 'rgba(255, 226, 177, 0.22)',
        radius: 12,
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      this.drawText('资源详情', x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, 'x', {
        size: 14,
        radius: 6,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeResourceDetails' });

      const cards = [
        {
          label: '木材',
          icon: 'assets/art/icon-wood-cutout.webp',
          value: view.text.woodDetailValue,
          lines: [`产出 ${view.text.woodDetailRate}`],
        },
        {
          label: '铁矿',
          icon: 'assets/art/icon-iron-cutout.webp',
          value: view.text.ironDetailValue,
          lines: [`产出 ${view.text.ironDetailRate}`],
        },
        {
          label: '石料',
          icon: 'assets/art/icon-stone-cutout.webp',
          value: view.text.stoneDetailValue,
          lines: [`产出 ${view.text.stoneDetailRate}`],
        },
        {
          label: '粮食',
          icon: 'assets/art/icon-food-cutout.webp',
          value: view.text.foodDetailValue,
          lines: [
            `产出 ${view.text.foodOutputRate}`,
            `消耗 ${view.text.foodConsumptionRate}`,
            `净增长 ${view.text.foodNetRate}`,
          ],
        },
        {
          label: '知识',
          icon: 'assets/art/icon-knowledge-cutout.webp',
          value: view.text.knowledgeDetailValue,
          lines: [`产出 ${view.text.knowledgeDetailRate}`],
        },
      ];

      const cardX = x + 12;
      const cardWidth = panelWidth - 24;
      cards.forEach((card, index) => {
        const cardY = y + 56 + index * 86;
        this.drawPanel(cardX, cardY, cardWidth, 74, {
          fill: 'rgba(27, 22, 17, 0.74)',
          stroke: 'rgba(255, 226, 177, 0.12)',
          radius: 10,
        });
        this.drawAsset(card.icon, cardX + 12, cardY + 19, 34, 34);
        this.drawText(card.label, cardX + 58, cardY + 12, { size: 13, bold: true, color: '#f6e8c8' });
        this.drawText(String(card.value), cardX + cardWidth - 12, cardY + 12, {
          size: 18,
          bold: true,
          color: '#74d3a0',
          align: 'right',
        });
        this.drawTextLines(card.lines, cardX + 58, cardY + 36, { size: 11, color: '#aeb0b8', lineHeight: 16 });
      });

    }

    render(state = {}, options = {}) {
      if (options.mode === 'hud') {
        this.renderHudOverlay(state, options);
        return;
      }
      const activeTab = options.activeTab || 'resources';
      this.beginFrame(options);
      this.setHitTargets([]);
      this.clear();
      if (options.auth?.view?.loginPanelVisible) {
        this.renderLoginPanel(options.auth);
        this.endFrame(options);
        return;
      }
      if (options.loading?.visible) {
        this.renderLoadingScreen(options.loading);
        this.endFrame(options);
        return;
      }
      if (options.battleScene?.visible) {
        this.renderBattleSceneOverlay(state, options);
        this.endFrame(options);
        return;
      }
      const topBarBottom = this.renderTopBar(state);
      const tabsTop = this.height - 60 - this.bottomSafeArea;
      const populationBottom = activeTab === 'resources'
        ? this.renderPopulation(state, topBarBottom)
        : topBarBottom;
      const homeFeatureBottom = activeTab === 'resources'
        ? this.renderHomeFeatureGrid(state, populationBottom, { maxBottom: tabsTop - 8 })
        : populationBottom;
      const panelTop = activeTab === 'resources' ? homeFeatureBottom : topBarBottom;
      const advisorOffset = this.presenter && typeof this.presenter.buildAdvisorViewState === 'function' && this.presenter.buildAdvisorViewState(state.softGuide).hidden ? 0 : 52;
      const availableHeight = Math.max(120, tabsTop - panelTop - 12 - advisorOffset);
      const transition = this.getTransitionFrame(options.pageTransition);
      const fromTab = options.pageTransition?.fromTab;
      const toTab = options.pageTransition?.toTab || activeTab;
      if (transition && fromTab && fromTab !== activeTab && toTab === activeTab && activeTab !== 'resources') {
        const travel = this.width + 24;
        this.withSlideClip(0, panelTop, this.width, Math.max(120, tabsTop - panelTop), -transition.direction * travel * transition.eased, () => {
          this.withSuppressedHitTargets(() => this.renderMainPanel(state, fromTab, panelTop, availableHeight, {
            ...options,
            buildingOffset: options.pageTransition.fromBuildingOffset ?? options.buildingOffset,
            buildingTransition: null,
          }));
        });
        this.withSlideClip(0, panelTop, this.width, Math.max(120, tabsTop - panelTop), transition.direction * travel * (1 - transition.eased), () => {
          this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
        });
      } else if (activeTab !== 'resources') this.renderMainPanel(state, activeTab, panelTop, availableHeight, options);
      this.renderAdvisor(state);
      this.renderTabs(activeTab, state, options);
      if (options.showResourceDetails) this.renderResourceDetailsPanel(state);
      if (options.showCitySwitcher) this.renderCitySwitcherMenu(state);
      if (options.showTaskCenter) this.renderTaskCenterPanel(state, options);
      if (options.showGuidebook) this.renderGuidebookPanel(state, options);
      if (options.showFamousPersons) this.renderFamousPersonsPanel(state, options);
      if (options.showTalentPolicy) this.renderTalentPolicyPanel(state, options);
      if (options.activeEventId) this.renderEventModal(state, options.activeEventId);
      if (activeTab === 'tech' && (options.techDetailOpen || state.techUiState?.detailOpen)) {
        const view = this.presenter?.buildTechViewState?.({
          ...state,
          techUiState: {
            ...(state.techUiState || {}),
            ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
          },
          ...(options.selectedTechId ? { selectedTechId: options.selectedTechId } : {}),
        });
        this.renderTechDetailModal(view?.detail);
      }
      if (activeTab === 'military') this.renderWorldSiteModal(state, options);
      if (options.naming) this.renderNamingModal(options.naming);
      this.renderTutorialHighlight(options.tutorialHighlight || null);
      this.renderFloatingTexts(options.floatingTexts || []);
      this.renderRewardReveal(options.rewardReveal || null);
      this.endFrame(options);
    }
  }

  global.CanvasGameRenderer = CanvasGameRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

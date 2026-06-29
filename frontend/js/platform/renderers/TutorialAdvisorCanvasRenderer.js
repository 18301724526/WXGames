(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TUTORIAL_ADVISOR_SPINE_ALPHA = 1;
  const TutorialAdvisorSpineLayoutConfig = (() => {
    if (global.TutorialAdvisorSpineLayoutConfig) return global.TutorialAdvisorSpineLayoutConfig;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TutorialAdvisorSpineLayoutConfig');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TUTORIAL_ADVISOR_SPINE_DEFAULT_VIEW = Object.freeze({
    fitPadding: 1,
    viewScale: 1,
    viewOffsetX: 0,
    viewOffsetY: 0,
  });
  const TUTORIAL_ADVISOR_SPINE_DEFAULT_CLIP = Object.freeze({
    mode: 'autoFromSkeletonBounds',
    clipPadding: 0,
  });
  const TUTORIAL_SPINE_LAYER_NAME = 'tutorialSpine';

  const CanvasLayerRegistry = (() => {
    if (global.CanvasLayerRegistry) return global.CanvasLayerRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../CanvasLayerRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class TutorialAdvisorCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get bottomSafeArea() { return Number(this.host?.bottomSafeArea) || 0; }
    get ctx() { return this.host?.ctx || null; }
    get h5Runtime() { return this.host?.h5Runtime || null; }
    get height() { return Number(this.host?.height) || 0; }
    get width() { return Number(this.host?.width) || 0; }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    ensureCanvasLayer(name = '', overrides = {}) { return this.host?.ensureCanvasLayer?.(name, overrides) || this.h5Runtime?.ensureLayerCanvas?.(name, CanvasLayerRegistry?.getLayerOptions?.(name, overrides) || overrides) || null; }
    getAsset(...args) { return this.host?.getAsset?.(...args) || null; }
    handleAssetsChanged(...args) { return this.host?.handleAssetsChanged?.(...args); }
    requestOverlayRenderFrame(...args) { return this.host?.requestOverlayRenderFrame?.(...args); }
    setCanvasLayerVisible(...args) { return this.host?.setCanvasLayerVisible?.(...args) || this.h5Runtime?.setLayerVisible?.(...args) || false; }

    disposeTutorialAdvisorSpine() {
      const existing = this.tutorialAdvisorSpine;
      if (!existing) return false;
      existing.player?.dispose?.();
      existing.player?.stop?.();
      this.tutorialAdvisorSpine = null;
      if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, false);
      else this.h5Runtime?.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, false);
      return true;
    }

    renderTutorialIntroAdvisorPortrait(x, y, width, height) {
      if (this.renderTutorialAdvisorSpineLayer(x, y, width, height)) return true;
      const image = this.getAsset('assets/art/spine/tutorial/advisor/tutorial_advisor.png');
      this.ctx.save?.();
      this.ctx.beginPath?.();
      this.ctx.rect?.(x, y, width, height);
      this.ctx.clip?.();
      if (image && typeof this.ctx.drawImage === 'function') {
        this.drawTutorialAdvisorImageCover(
          image,
          0,
          0,
          image.naturalWidth || image.width,
          Math.min(1120, image.naturalHeight || image.height),
          x,
          y,
          width,
          height,
        );
      } else {
        this.drawPanel(x + 8, y + 20, width - 16, height - 22, {
          fill: 'rgba(48, 37, 28, 0.92)',
          stroke: 'rgba(255, 218, 142, 0.28)',
          radius: 10,
        });
        this.drawText(this.t('tutorial.advisorName', {}), x + width / 2, y + height / 2, {
          size: 15,
          bold: true,
          color: '#ffd98a',
          align: 'center',
          baseline: 'middle',
        });
      }
      this.ctx.restore?.();
      return false;
    }

    normalizeSpineLayerRect(x, y, width, height) {
      const runtime = this.h5Runtime || null;
      const runtimeWidth = Math.max(1, Number(runtime?.width || this.width) || 1);
      const runtimeHeight = Math.max(1, Number(runtime?.height || this.height) || 1);
      const rect = {
        x: Math.max(0, Math.floor(Number(x) || 0)),
        y: Math.max(0, Math.floor(Number(y) || 0)),
        width: Math.max(1, Math.ceil(Number(width) || runtimeWidth)),
        height: Math.max(1, Math.ceil(Number(height) || runtimeHeight)),
      };
      rect.x = Math.min(rect.x, runtimeWidth - 1);
      rect.y = Math.min(rect.y, runtimeHeight - 1);
      rect.width = Math.max(1, Math.min(rect.width, runtimeWidth - rect.x));
      rect.height = Math.max(1, Math.min(rect.height, runtimeHeight - rect.y));
      return rect;
    }

    areSpineLayerRectsEqual(left = {}, right = {}) {
      return Math.round(Number(left?.x) || 0) === Math.round(Number(right?.x) || 0)
        && Math.round(Number(left?.y) || 0) === Math.round(Number(right?.y) || 0)
        && Math.round(Number(left?.width) || 0) === Math.round(Number(right?.width) || 0)
        && Math.round(Number(left?.height) || 0) === Math.round(Number(right?.height) || 0);
    }

    getTutorialAdvisorLayoutOptions() {
      const runtime = this.h5Runtime || null;
      return {
        width: Number(runtime?.width || this.width) || 0,
        height: Number(runtime?.height || this.height) || 0,
      };
    }

    getTutorialAdvisorSpineViewOptions(overrides = {}) {
      const source = {
        ...TUTORIAL_ADVISOR_SPINE_DEFAULT_VIEW,
        ...(TutorialAdvisorSpineLayoutConfig?.getAdvisorSpineView?.(this.getTutorialAdvisorLayoutOptions()) || {}),
        ...(this.tutorialAdvisorSpineView || {}),
        ...(overrides || {}),
      };
      return {
        fitPadding: Number(source.fitPadding) || TUTORIAL_ADVISOR_SPINE_DEFAULT_VIEW.fitPadding,
        viewScale: Math.max(0.01, Number(source.viewScale) || TUTORIAL_ADVISOR_SPINE_DEFAULT_VIEW.viewScale),
        viewOffsetX: Number(source.viewOffsetX) || 0,
        viewOffsetY: Number(source.viewOffsetY) || 0,
      };
    }

    getTutorialAdvisorSpineClipOptions(overrides = {}) {
      const source = {
        ...TUTORIAL_ADVISOR_SPINE_DEFAULT_CLIP,
        ...(TutorialAdvisorSpineLayoutConfig?.getAdvisorSpineClip?.(this.getTutorialAdvisorLayoutOptions()) || {}),
        ...(this.tutorialAdvisorSpineClip || {}),
        ...(overrides || {}),
      };
      return {
        mode: source.mode || TUTORIAL_ADVISOR_SPINE_DEFAULT_CLIP.mode,
        clipPadding: Math.max(0, Number(source.clipPadding) || 0),
      };
    }

    getSpineViewportRect(clipRect = {}, targetRect = {}) {
      const clip = this.normalizeSpineLayerRect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
      const target = this.normalizeSpineLayerRect(targetRect.x, targetRect.y, targetRect.width, targetRect.height);
      return {
        x: target.x - clip.x,
        y: target.y - clip.y,
        width: target.width,
        height: target.height,
      };
    }

    deriveSpineClipRect(targetRect = {}, bounds = null, options = {}) {
      const base = this.normalizeSpineLayerRect(targetRect.x, targetRect.y, targetRect.width, targetRect.height);
      const aspectRatio = Number(bounds?.aspectRatio || bounds?.width / Math.max(1, bounds?.height));
      const clipPadding = Math.max(0, Number(options.clipPadding) || 0);
      const withPadding = (rect = {}) => this.normalizeSpineLayerRect(
        rect.x - clipPadding,
        rect.y - clipPadding,
        rect.width + clipPadding * 2,
        rect.height + clipPadding * 2,
      );
      if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return withPadding(base);
      const baseAspect = base.width / Math.max(1, base.height);
      if (Math.abs(baseAspect - aspectRatio) < 0.015) return withPadding(base);
      if (baseAspect > aspectRatio) {
        const nextWidth = Math.max(1, Math.round(base.height * aspectRatio));
        return withPadding({
          x: base.x + Math.max(0, Math.round((base.width - nextWidth) / 2)),
          y: base.y,
          width: Math.min(base.width, nextWidth),
          height: base.height,
        });
      }
      const nextHeight = Math.max(1, Math.round(base.width / aspectRatio));
      return withPadding({
        x: base.x,
        y: base.y + Math.max(0, Math.round((base.height - nextHeight) / 2)),
        width: base.width,
        height: Math.min(base.height, nextHeight),
      });
    }

    ensureTutorialSpineLayerCanvas(rect = {}) {
      const runtime = this.h5Runtime || null;
      const canEnsureLayer = typeof this.ensureCanvasLayer === 'function'
        || typeof runtime?.ensureLayerCanvas === 'function';
      if (!canEnsureLayer || !global.SpineWebglPlayer?.isAvailable?.()) return false;
      const pixelRatio = Math.min(2, Math.max(1, Number(global.devicePixelRatio) || 1));
      const layerRect = this.normalizeSpineLayerRect(rect.x, rect.y, rect.width, rect.height);
      const overrides = {
        pixelRatio,
        rect: layerRect,
      };
      const canvas = typeof this.ensureCanvasLayer === 'function'
        ? this.ensureCanvasLayer(TUTORIAL_SPINE_LAYER_NAME, overrides)
        : runtime.ensureLayerCanvas(
          TUTORIAL_SPINE_LAYER_NAME,
          CanvasLayerRegistry?.getLayerOptions?.(TUTORIAL_SPINE_LAYER_NAME, overrides) || overrides,
        );
      return canvas ? { canvas, layerRect, pixelRatio } : null;
    }

    renderTutorialAdvisorSpineLayer(x, y, width, height) {
      const runtime = this.h5Runtime || null;
      const targetRect = this.normalizeSpineLayerRect(x, y, width, height);
      const currentBounds = this.tutorialAdvisorSpine?.bounds
        || this.tutorialAdvisorSpine?.player?.getBoundsSummary?.()
        || null;
      const clipOptions = this.getTutorialAdvisorSpineClipOptions();
      const clipRect = this.deriveSpineClipRect(targetRect, currentBounds, clipOptions);
      let existing = this.tutorialAdvisorSpine;
      if (existing?.mode === 'layer' && !this.areSpineLayerRectsEqual(existing.layerRect, clipRect)) {
        existing.player?.dispose?.();
        this.tutorialAdvisorSpine = null;
        existing = null;
      }
      const layer = this.ensureTutorialSpineLayerCanvas(clipRect);
      if (!layer) return false;
      const { canvas, layerRect, pixelRatio } = layer;
      if (!canvas) return false;
      if (canvas.style) canvas.style.opacity = String(TUTORIAL_ADVISOR_SPINE_ALPHA);
      if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, true);
      else runtime.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, true);
      const viewportRect = this.getSpineViewportRect(layerRect, targetRect);
      const viewOptions = this.getTutorialAdvisorSpineViewOptions();
      const logicalWidth = targetRect.width;
      const logicalHeight = targetRect.height;
      const active = this.tutorialAdvisorSpine;
      if (active?.mode === 'layer' && active?.player && active.canvas === canvas) {
        active.player.logicalWidth = logicalWidth;
        active.player.logicalHeight = logicalHeight;
        active.player.maxDevicePixelRatio = pixelRatio;
        active.player.setViewTransform?.({ ...viewOptions, viewportRect });
        active.targetRect = targetRect;
        active.layerRect = layerRect;
        active.viewportRect = viewportRect;
        active.player.resize?.();
        return active.player.status === 'ready' || active.player.status === 'loading';
      }
      existing?.player?.dispose?.();
      const player = new global.SpineWebglPlayer({
        canvas,
        runtime: global,
        background: null,
        ...viewOptions,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        viewportRect,
        maxDevicePixelRatio: pixelRatio,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        onBounds: (event = {}) => {
          if (!this.tutorialAdvisorSpine || this.tutorialAdvisorSpine.player !== player) return;
          this.tutorialAdvisorSpine.bounds = event.bounds || null;
          if (typeof this.requestOverlayRenderFrame === 'function') this.requestOverlayRenderFrame();
        },
        onError: () => {
          this.tutorialAdvisorSpineFailed = true;
          if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, false);
          else runtime.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, false);
        },
        onStatus: (event = {}) => {
          if (event.status === 'ready') {
            if (typeof this.requestOverlayRenderFrame === 'function') this.requestOverlayRenderFrame();
          }
        },
      });
      this.tutorialAdvisorSpine = { canvas, player, mode: 'layer', targetRect, layerRect, viewportRect };
      const loaded = player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
        antialias: true,
        ...viewOptions,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        viewportRect,
        maxDevicePixelRatio: pixelRatio,
        preserveDrawingBuffer: false,
      });
      if (!loaded) {
        this.tutorialAdvisorSpineFailed = true;
        this.tutorialAdvisorSpine = null;
        if (typeof this.setCanvasLayerVisible === 'function') this.setCanvasLayerVisible(TUTORIAL_SPINE_LAYER_NAME, false);
        else runtime.setLayerVisible?.(TUTORIAL_SPINE_LAYER_NAME, false);
        return false;
      }
      return true;
    }

    drawTutorialAdvisorImageCover(image, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (!image || typeof this.ctx?.drawImage !== 'function') return false;
      let sourceX = Number(sx) || 0;
      let sourceY = Number(sy) || 0;
      let sourceW = Math.max(1, Number(sw) || image.width || image.naturalWidth || 1);
      let sourceH = Math.max(1, Number(sh) || image.height || image.naturalHeight || 1);
      const targetW = Math.max(1, Number(dw) || 1);
      const targetH = Math.max(1, Number(dh) || 1);
      const sourceAspect = sourceW / sourceH;
      const targetAspect = targetW / targetH;
      if (sourceAspect > targetAspect) {
        const nextW = sourceH * targetAspect;
        sourceX += (sourceW - nextW) * 0.5;
        sourceW = nextW;
      } else if (sourceAspect < targetAspect) {
        const nextH = sourceW / targetAspect;
        sourceY += Math.max(0, (sourceH - nextH) * 0.08);
        sourceH = nextH;
      }
      this.ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, dx, dy, targetW, targetH);
      return true;
    }
  }

  global.TutorialAdvisorCanvasRenderer = TutorialAdvisorCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialAdvisorCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

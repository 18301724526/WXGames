(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TUTORIAL_ADVISOR_SPINE_VIEW_FOCUS = {
    centerX: 420,
    centerY: 1800,
    height: 2000,
  };
  const TUTORIAL_ADVISOR_SPINE_ALPHA = 1;

  class TutorialAdvisorCanvasRenderer {
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

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    disposeTutorialAdvisorSpine() {
      const existing = this.tutorialAdvisorSpine;
      if (!existing) return false;
      existing.player?.dispose?.();
      existing.player?.stop?.();
      this.tutorialAdvisorSpine = null;
      this.h5Runtime?.setLayerVisible?.('tutorialSpine', false);
      return true;
    }

    renderTutorialIntroAdvisorPortrait(x, y, width, height) {
      if (this.renderTutorialAdvisorSpineLayer(x, y, width, height)) return true;
      const spineFrame = this.getTutorialAdvisorSpineFrame();
      if (spineFrame && typeof this.ctx.drawImage === 'function') {
        this.ctx.save?.();
        this.ctx.beginPath?.();
        this.ctx.rect?.(x, y, width, height);
        this.ctx.clip?.();
        this.drawTutorialAdvisorImageCover(spineFrame, 0, 0, spineFrame.width, spineFrame.height, x, y, width, height);
        this.ctx.restore?.();
        return true;
      }
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
        this.drawText(this.t('tutorial.advisorName', {}, '谋士'), x + width / 2, y + height / 2, {
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

    renderTutorialAdvisorSpineLayer(x, y, width, height) {
      const runtime = this.h5Runtime || null;
      if (!runtime?.ensureLayerCanvas || !global.SpineWebglPlayer?.isAvailable?.()) return false;
      const pixelRatio = Math.min(2, Math.max(1, Number(global.devicePixelRatio) || 1));
      const layerRect = {
        x: 0,
        y: 0,
        width: Math.max(1, Math.ceil(Number(runtime.width || this.width) || Number(width) || 1)),
        height: Math.max(1, Math.ceil(Number(runtime.height || this.height) || Number(height) || 1)),
      };
      const canvas = runtime.ensureLayerCanvas('tutorialSpine', {
        contextType: 'webgl',
        zIndex: 1000,
        pixelRatio,
        rect: layerRect,
      });
      if (!canvas) return false;
      if (canvas.style) canvas.style.opacity = String(TUTORIAL_ADVISOR_SPINE_ALPHA);
      runtime.setLayerVisible?.('tutorialSpine', true);
      const metrics = runtime.getLayerMetrics?.('tutorialSpine') || {};
      const logicalWidth = metrics.width || layerRect.width;
      const logicalHeight = metrics.height || layerRect.height;
      const existing = this.tutorialAdvisorSpine;
      if (existing?.mode === 'layer' && existing?.player && existing.canvas === canvas) {
        existing.player.logicalWidth = logicalWidth;
        existing.player.logicalHeight = logicalHeight;
        existing.player.maxDevicePixelRatio = pixelRatio;
        existing.player.viewFocus = TUTORIAL_ADVISOR_SPINE_VIEW_FOCUS;
        existing.player.resize?.();
        return existing.player.status === 'ready' || existing.player.status === 'loading';
      }
      existing?.player?.dispose?.();
      const player = new global.SpineWebglPlayer({
        canvas,
        runtime: global,
        background: null,
        fitPadding: 1,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        maxDevicePixelRatio: pixelRatio,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        viewFocus: TUTORIAL_ADVISOR_SPINE_VIEW_FOCUS,
        onError: () => {
          this.tutorialAdvisorSpineFailed = true;
          runtime.setLayerVisible?.('tutorialSpine', false);
        },
        onStatus: (event = {}) => {
          if (event.status === 'ready') this.handleAssetsChanged();
        },
      });
      this.tutorialAdvisorSpine = { canvas, player, mode: 'layer' };
      const loaded = player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
        antialias: true,
        targetFps: 60,
        logicalWidth,
        logicalHeight,
        maxDevicePixelRatio: pixelRatio,
        preserveDrawingBuffer: false,
        viewFocus: TUTORIAL_ADVISOR_SPINE_VIEW_FOCUS,
      });
      if (!loaded) {
        this.tutorialAdvisorSpineFailed = true;
        this.tutorialAdvisorSpine = null;
        runtime.setLayerVisible?.('tutorialSpine', false);
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

    getTutorialAdvisorSpineFrame() {
      if (this.tutorialAdvisorSpineFailed) return null;
      const existing = this.tutorialAdvisorSpine;
      if (existing?.player?.status === 'ready' && existing.canvas) return existing.canvas;
      if (existing) return null;
      if (!global.SpineWebglPlayer?.isAvailable?.()) {
        this.tutorialAdvisorSpineFailed = true;
        return null;
      }
      const canvas = this.createTutorialSpineCanvas(288, 420);
      if (!canvas) {
        this.tutorialAdvisorSpineFailed = true;
        return null;
      }
      const player = new global.SpineWebglPlayer({
        canvas,
        runtime: global,
        background: null,
        fitPadding: 1,
        targetFps: 30,
        logicalWidth: 288,
        logicalHeight: 420,
        maxDevicePixelRatio: 1,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        viewFocus: {
          centerX: 0,
          centerY: 1080,
          height: 900,
        },
        onError: () => {
          this.tutorialAdvisorSpineFailed = true;
        },
        onStatus: (event = {}) => {
          if (event.status === 'ready') this.handleAssetsChanged();
        },
      });
      this.tutorialAdvisorSpine = { canvas, player };
      const loaded = player.load({
        assetBase: 'assets/art/spine/tutorial/advisor/',
        jsonFile: 'tutorial_advisor.json',
        atlasFile: 'tutorial_advisor.atlas',
        animationName: 'animation',
        loop: true,
        alpha: true,
        antialias: false,
        targetFps: 30,
        logicalWidth: 288,
        logicalHeight: 420,
        maxDevicePixelRatio: 1,
        preserveDrawingBuffer: true,
        viewFocus: {
          centerX: 0,
          centerY: 1080,
          height: 900,
        },
      });
      if (!loaded) {
        this.tutorialAdvisorSpineFailed = true;
        this.tutorialAdvisorSpine = null;
      }
      return null;
    }
  }

  global.TutorialAdvisorCanvasRenderer = TutorialAdvisorCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialAdvisorCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

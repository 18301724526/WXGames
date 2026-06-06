(function (global) {
  function resolveRendererDependency(globalKey, modulePath) {
    if (global[globalKey]) return global[globalKey];
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require(modulePath);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  const SharedUnitSpriteManifest = resolveRendererDependency('UnitSpriteManifest', '../../config/UnitSpriteManifest');
  const TUTORIAL_MARCH_UNIT_ID = 'spearman';
  const TUTORIAL_MARCH_UNIT_ANIMATION = 'move';
  const TUTORIAL_INTRO_DIALOGUE_LEFT = 96;
  const SharedTutorialIntroMarchModel = resolveRendererDependency('TutorialIntroMarchModel', './TutorialIntroMarchModel');
  const SharedTutorialIntroUnitRenderer = resolveRendererDependency('TutorialIntroUnitRenderer', './TutorialIntroUnitRenderer');
  const SharedTutorialIntroDialogueLayout = resolveRendererDependency('TutorialIntroDialogueLayout', './TutorialIntroDialogueLayout');
  const SharedTutorialAdvisorCanvasRenderer = resolveRendererDependency('TutorialAdvisorCanvasRenderer', './TutorialAdvisorCanvasRenderer');
  const SharedTutorialDialogueLayer = resolveRendererDependency('TutorialDialogueLayer', './TutorialDialogueLayer');
  class TutorialCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      const AdvisorRendererClass = options.advisorRendererClass || SharedTutorialAdvisorCanvasRenderer;
      this.advisorRenderer = options.advisorRenderer || (AdvisorRendererClass ? new AdvisorRendererClass({ host: this.host }) : null);
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
          if (prop === 'host' || prop === 'advisorRenderer' || prop in target) return Reflect.set(target, prop, value);
          if (target.host && prop in target.host) {
            target.host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }
    render(state = {}, options = {}) {
      return this.renderTutorialIntro(state, options);
    }

    delegateTutorialAdvisorRenderer(method, args = []) {
      const renderer = this.advisorRenderer;
      if (!renderer || typeof renderer[method] !== 'function') return undefined;
      return renderer[method](...args);
    }

    disposeTutorialAdvisorSpine(...args) {
      const result = this.delegateTutorialAdvisorRenderer('disposeTutorialAdvisorSpine', args);
      return result === undefined ? false : result;
    }

    renderTutorialIntroAdvisorPortrait(...args) {
      const result = this.delegateTutorialAdvisorRenderer('renderTutorialIntroAdvisorPortrait', args);
      return result === undefined ? false : result;
    }

    renderTutorialAdvisorSpineLayer(...args) {
      const result = this.delegateTutorialAdvisorRenderer('renderTutorialAdvisorSpineLayer', args);
      return result === undefined ? false : result;
    }

    drawTutorialAdvisorImageCover(...args) {
      const result = this.delegateTutorialAdvisorRenderer('drawTutorialAdvisorImageCover', args);
      return result === undefined ? false : result;
    }

    getTutorialAdvisorSpineFrame(...args) {
      const result = this.delegateTutorialAdvisorRenderer('getTutorialAdvisorSpineFrame', args);
      return result === undefined ? null : result;
    }

    renderTutorialIntro(state = {}, options = {}) {
      const intro = options.tutorialIntro || null;
      if (!intro?.active || !this.ctx) {
        SharedTutorialDialogueLayer?.clear?.(this, true);
        this.disposeTutorialAdvisorSpine();
        return false;
      }
      const target = this.resolveTutorialIntroTarget(intro, state, options);
      const unitTarget = this.resolveTutorialIntroUnitTarget(intro, state, options) || target;
      if (!target || !unitTarget) {
        SharedTutorialDialogueLayer?.clear?.(this, true);
        this.disposeTutorialAdvisorSpine();
        return false;
      }
      if (intro.step === 'march' || intro.step === 'entering') {
        SharedTutorialDialogueLayer?.clear?.(this, true);
        this.disposeTutorialAdvisorSpine();
        this.renderTutorialIntroMarch(intro, unitTarget);
        return true;
      }
      const message = intro.messages?.[intro.step] || '';
      this.renderTutorialIntroSpotlight(target, message, {
        showAdvisor: true,
        advisorName: intro.advisorName || '谋士',
      });
      if (intro.step === 'city' || intro.step === 'enter') this.renderTutorialIntroMarch(intro, unitTarget);
      return true;
    }

    resolveTutorialIntroTarget(intro = {}, state = {}, options = {}) {
      const capitalCityId = intro.capitalCityId || state.cityState?.capitalCityId || 'capital';
      if (intro.step === 'enter') {
        const target = this.findHitTarget('enterCity', (action) => {
          const cityId = action.cityId || action.territoryId || action.siteId || '';
          return !cityId || cityId === capitalCityId;
        });
        if (target) return this.inflateRect(target, 10);
        return null;
      }
      const hitTarget = this.findHitTarget('openWorldSite', (action) => action.siteId === capitalCityId);
      if (hitTarget) return this.inflateRect(hitTarget, intro.step === 'march' ? 0 : 12);
      const anchor = this.getWorldSiteCanvasAnchor(capitalCityId, state, options);
      if (!anchor) return null;
      return this.inflateRect(anchor.hitRect, intro.step === 'march' ? 0 : 12);
    }

    resolveTutorialIntroUnitTarget(intro = {}, state = {}, options = {}) {
      const capitalCityId = intro.capitalCityId || state.cityState?.capitalCityId || 'capital';
      const hitTarget = this.findHitTarget('openWorldSite', (action) => action.siteId === capitalCityId);
      if (hitTarget) return this.inflateRect(hitTarget, 0);
      const anchor = this.getWorldSiteCanvasAnchor(capitalCityId, state, options);
      return anchor?.hitRect ? this.inflateRect(anchor.hitRect, 0) : null;
    }

    findHitTarget(type = '', predicate = null) {
      if (!Array.isArray(this.hitTargets)) return null;
      for (let index = this.hitTargets.length - 1; index >= 0; index -= 1) {
        const target = this.hitTargets[index];
        const action = target?.action || {};
        if (action.type !== type) continue;
        if (typeof predicate === 'function' && !predicate(action)) continue;
        return target;
      }
      return null;
    }

    inflateRect(rect = {}, padding = 0) {
      const pad = Number(padding) || 0;
      const x = Number(rect.x ?? rect.left) || 0;
      const y = Number(rect.y ?? rect.top) || 0;
      const width = Number(rect.width) || 0;
      const height = Number(rect.height) || 0;
      return {
        x: x - pad,
        y: y - pad,
        width: width + pad * 2,
        height: height + pad * 2,
        action: rect.action || null,
      };
    }

    renderTutorialIntroMarch(intro = {}, target = {}) {
      if (intro.step === 'march' || intro.step === 'entering') {
        this.addHitTarget(
          { x: 0, y: 0, width: this.width, height: this.height },
          { type: 'blockCanvasModal' },
        );
      }
      const now = this.getNow();
      const startedAt = Number(intro.startedAt) || now;
      const duration = Math.max(1, Number(intro.marchDurationMs) || 2400);
      const marchProgress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      const route = intro.step === 'entering'
        ? this.getTutorialIntroEnterRoute(target, intro, now)
        : this.getTutorialIntroMarchRoute(target, intro.step === 'march' ? marchProgress : 1);
      const scaleProgress = intro.step === 'march' ? marchProgress : 1;

      this.ctx.save?.();
      this.ctx.strokeStyle = 'rgba(240, 180, 91, 0.44)';
      this.ctx.lineWidth = 2;
      if (intro.step === 'march') {
        this.ctx.beginPath?.();
        this.ctx.moveTo?.(route.start.x, route.start.y);
        this.ctx.quadraticCurveTo?.(route.control.x, route.control.y, route.end.x, route.end.y);
        this.ctx.stroke?.();
      }
      const alpha = Number.isFinite(Number(route.alpha)) ? Number(route.alpha) : 1;
      const previousAlpha = this.ctx.globalAlpha;
      if (alpha < 1 && Number.isFinite(Number(previousAlpha))) this.ctx.globalAlpha = previousAlpha * alpha;
      this.renderTutorialIntroUnit(route.x, route.y, 1 + scaleProgress * 0.12, {
        ...intro,
        freezeFrame: intro.step === 'city' || intro.step === 'enter',
      });
      if (alpha < 1 && Number.isFinite(Number(previousAlpha))) this.ctx.globalAlpha = previousAlpha;
      this.ctx.restore?.();
    }

    getTutorialIntroEnterRoute(target = {}, intro = {}, now = this.getNow()) {
      return SharedTutorialIntroMarchModel.getEnterRoute(target, intro, now, {
        width: this.width,
        height: this.height,
        bottomSafeArea: this.bottomSafeArea,
      });
    }

    easeInOutCubic(value = 0) {
      return SharedTutorialIntroMarchModel.easeInOutCubic(value);
    }

    getTutorialIntroMarchRoute(target = {}, progress = 0) {
      return SharedTutorialIntroMarchModel.getMarchRoute(target, progress, {
        width: this.width,
        height: this.height,
        bottomSafeArea: this.bottomSafeArea,
      });
    }

    normalizeMarchTargetRect(target = {}) {
      return SharedTutorialIntroMarchModel.normalizeTargetRect(target);
    }

    getTutorialIntroMarchStart(target = {}) {
      return SharedTutorialIntroMarchModel.getStartPoint(target, {
        width: this.width,
        height: this.height,
        bottomSafeArea: this.bottomSafeArea,
      });
    }

    getTutorialIntroMarchEnd(target = {}, start = {}) {
      return SharedTutorialIntroMarchModel.getEndPoint(target, start);
    }

    renderTutorialIntroUnit(x, y, scale = 1, intro = {}) {
      const framePath = this.getTutorialIntroUnitFramePath(this.getNow(), intro);
      SharedTutorialIntroUnitRenderer.renderUnit(this, x, y, scale, framePath);
    }

    getTutorialIntroUnitFramePaths() {
      return SharedTutorialIntroMarchModel.getFramePaths(
        SharedUnitSpriteManifest,
        TUTORIAL_MARCH_UNIT_ID,
        TUTORIAL_MARCH_UNIT_ANIMATION,
      );
    }

    getTutorialIntroUnitFramePath(now = this.getNow(), intro = {}) {
      return SharedTutorialIntroMarchModel.getFramePath({
        manifest: SharedUnitSpriteManifest,
        now,
        intro,
        unitId: TUTORIAL_MARCH_UNIT_ID,
        animation: TUTORIAL_MARCH_UNIT_ANIMATION,
      });
    }

    renderTutorialIntroUnitSprite(x, y, scale = 1, intro = {}) {
      const framePath = this.getTutorialIntroUnitFramePath(this.getNow(), intro);
      return SharedTutorialIntroUnitRenderer.drawSprite(this, x, y, scale, framePath);
    }

    renderTutorialIntroUnitFallback(x, y, scale = 1) {
      SharedTutorialIntroUnitRenderer.drawFallback(this, x, y, scale);
    }

    renderTutorialIntroSpotlight(target = {}, message = '', options = {}) {
      const rect = this.normalizeRect(target);
      if (!rect) return false;
      const pulse = 0.5 + Math.sin(this.getNow() / 180) * 0.5;
      this.addTutorialShield(
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
        { allowedAction: target.action || null },
      );
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
      this.ctx.fillRect(0, 0, this.width, rect.y);
      this.ctx.fillRect(0, rect.y + rect.height, this.width, Math.max(0, this.height - rect.y - rect.height));
      this.ctx.fillRect(0, rect.y, rect.x, rect.height);
      this.ctx.fillRect(rect.x + rect.width, rect.y, Math.max(0, this.width - rect.x - rect.width), rect.height);
      this.drawPanel(rect.x, rect.y, rect.width, rect.height, {
        fill: `rgba(255, 247, 214, ${0.06 + pulse * 0.04})`,
        stroke: `rgba(255, 215, 0, ${0.72 + pulse * 0.22})`,
        radius: 14,
        inset: 'rgba(255, 247, 214, 0.14)',
      });
      this.renderTutorialIntroFinger(rect.x + rect.width * 0.78, rect.y + rect.height * 0.88);
      if (options.showAdvisor) this.renderTutorialIntroDialogue(message, options.advisorName || '谋士');
      return true;
    }

    normalizeRect(rect = {}) {
      const x = Math.max(0, Math.min(this.width, Number(rect.x ?? rect.left) || 0));
      const y = Math.max(0, Math.min(this.height, Number(rect.y ?? rect.top) || 0));
      const width = Math.max(1, Math.min(this.width - x, Number(rect.width) || 0));
      const height = Math.max(1, Math.min(this.height - y, Number(rect.height) || 0));
      return { x, y, width, height };
    }

    renderTutorialIntroFinger(x, y) {
      const pulse = 0.5 + Math.sin(this.getNow() / 180) * 0.5;
      this.ctx.save?.();
      this.ctx.translate?.(x + pulse * 5, y - pulse * 7);
      this.ctx.rotate?.(-0.55);
      this.ctx.strokeStyle = `rgba(255, 226, 168, ${0.56 + pulse * 0.28})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath?.();
      this.ctx.arc?.(0, 0, 18 + pulse * 8, 0, Math.PI * 2);
      this.ctx.stroke?.();
      this.ctx.fillStyle = 'rgba(255, 235, 183, 0.96)';
      this.ctx.strokeStyle = 'rgba(80, 52, 22, 0.72)';
      this.ctx.lineWidth = 2.2;
      this.ctx.lineJoin = 'round';
      this.ctx.lineCap = 'round';
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(-5, -24);
      this.ctx.quadraticCurveTo?.(-1, -31, 6, -26);
      this.ctx.lineTo?.(12, -4);
      this.ctx.quadraticCurveTo?.(17, -9, 22, -5);
      this.ctx.quadraticCurveTo?.(26, -1, 22, 6);
      this.ctx.lineTo?.(16, 22);
      this.ctx.quadraticCurveTo?.(10, 31, -2, 29);
      this.ctx.lineTo?.(-15, 25);
      this.ctx.quadraticCurveTo?.(-22, 23, -19, 17);
      this.ctx.quadraticCurveTo?.(-15, 13, -8, 14);
      this.ctx.lineTo?.(-5, -24);
      this.ctx.closePath?.();
      this.ctx.fill?.();
      this.ctx.stroke?.();
      this.ctx.strokeStyle = 'rgba(128, 83, 34, 0.38)';
      this.ctx.lineWidth = 1.5;
      [
        [-1, -5, 3, 14],
        [6, -4, 9, 15],
        [13, 2, 12, 17],
      ].forEach((line) => {
        this.ctx.beginPath?.();
        this.ctx.moveTo?.(line[0], line[1]);
        this.ctx.lineTo?.(line[2], line[3]);
        this.ctx.stroke?.();
      });
      this.ctx.restore?.();
    }

    renderTutorialIntroDialogue(message = '', advisorName = '谋士') {
      const dialogue = SharedTutorialIntroDialogueLayout.buildDialogueLayout({
        width: this.width,
        height: this.height,
        bottomSafeArea: this.bottomSafeArea,
        layout: this.getLayout(),
        dialogueLeft: TUTORIAL_INTRO_DIALOGUE_LEFT,
      });
      const panel = dialogue.panel;
      const portrait = dialogue.portrait;
      const dialogueCtx = SharedTutorialDialogueLayer?.begin?.(this) || null;
      const renderContent = () => {
        this.renderTutorialIntroAdvisorPortrait(portrait.x, portrait.y, portrait.width, portrait.height);
        this.drawPanel(panel.x, panel.y, panel.width, panel.height, {
          fill: 'rgba(23, 17, 12, 0.94)',
          stroke: 'rgba(246, 214, 147, 0.3)',
          radius: 8,
          inset: 'rgba(255, 231, 184, 0.08)',
        });
        this.drawText(advisorName, panel.x + 24, panel.y + 24, {
          size: 14,
          bold: true,
          color: '#ffd98a',
        });
        const lines = this.wrapTextLimit(message, panel.width - 48, 3, { size: 13 });
        this.drawTextLines(lines, panel.x + 24, panel.y + 46, {
          size: 13,
          color: '#f7ecd0',
          lineHeight: 18,
        });
        this.drawText('点击继续', panel.x + panel.width - 24, panel.y + panel.height - 17, {
          size: 11,
          color: 'rgba(255, 230, 181, 0.66)',
          align: 'right',
          baseline: 'middle',
        });
      };

      if (!dialogueCtx) {
        renderContent();
        return false;
      }
      SharedTutorialDialogueLayer.withHostContext(this, dialogueCtx, renderContent);
      return true;
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
      const focusRect = transition?.toRect || highlight.rect || rect;
      this.addTutorialShield(focusRect);
      if (highlight.allowedAction) {
        this.addHitTarget(
          {
            x: Number(focusRect.left ?? focusRect.x) || overlay.x,
            y: Number(focusRect.top ?? focusRect.y) || overlay.y,
            width: Number(focusRect.width) || overlay.width,
            height: Number(focusRect.height) || overlay.height,
          },
          highlight.allowedAction,
        );
      }

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

    addTutorialShield(rect = {}, options = {}) {
      const x = Math.max(0, Math.min(this.width, Number(rect.left ?? rect.x) || 0));
      const y = Math.max(0, Math.min(this.height, Number(rect.top ?? rect.y) || 0));
      const width = Math.max(0, Math.min(this.width - x, Number(rect.width) || 0));
      const height = Math.max(0, Math.min(this.height - y, Number(rect.height) || 0));
      const right = Math.max(x, Math.min(this.width, x + width));
      const bottom = Math.max(y, Math.min(this.height, y + height));
      const block = { type: 'blockCanvasModal', allowedAction: options.allowedAction || null };
      [
        { x: 0, y: 0, width: this.width, height: y },
        { x: 0, y: bottom, width: this.width, height: Math.max(0, this.height - bottom) },
        { x: 0, y, width: x, height },
        { x: right, y, width: Math.max(0, this.width - right), height },
      ]
        .filter((item) => item.width > 0 && item.height > 0)
        .forEach((item) => this.addHitTarget(item, block));
    }
  }

  global.TutorialCanvasRenderer = TutorialCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

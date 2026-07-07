(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/system/WorldMarchSystem');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const UnitSpriteManifest = (() => {
    if (global.UnitSpriteManifest) return global.UnitSpriteManifest;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/UnitSpriteManifest');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function getCanvasIdStore() {
    if (typeof WeakMap !== 'function') return null;
    if (!global.__worldActorOverlayDiagCanvasIds) {
      global.__worldActorOverlayDiagCanvasIds = new WeakMap();
      global.__worldActorOverlayDiagCanvasIdSeq = 0;
    }
    return global.__worldActorOverlayDiagCanvasIds;
  }

  function getCanvasId(ctx = null) {
    const canvas = ctx?.canvas || null;
    if (!canvas) return '';
    const existing = canvas._layerName
      || canvas.dataset?.canvasLayer
      || canvas.id
      || '';
    if (existing) return existing;
    const canvasIds = getCanvasIdStore();
    if (!canvasIds) return '';
    if (!canvasIds.has(canvas)) {
      global.__worldActorOverlayDiagCanvasIdSeq = (Number(global.__worldActorOverlayDiagCanvasIdSeq) || 0) + 1;
      canvasIds.set(canvas, `canvas#${global.__worldActorOverlayDiagCanvasIdSeq}`);
    }
    return canvasIds.get(canvas);
  }

  function getActorScreenCoordSource(actor = {}) {
    if (actor.current) return { source: 'current', coord: actor.current };
    if (actor.origin) return { source: 'origin', coord: actor.origin };
    return { source: 'none', coord: {} };
  }

  class WorldActorCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.worldMapRenderState = options.worldMapRenderState || this.host?.worldMapRenderState || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    addHitTarget(...args) {
      return this.host?.addHitTarget?.(...args);
    }

    getAsset(...args) {
      return this.host?.getAsset?.(...args);
    }

    getNow(...args) {
      return this.host?.getNow?.(...args);
    }

    getActorScreenPoint(actor = {}, viewport = {}, geometry = {}) {
      if (!WorldMarchSystem?.getTileScreenCenter) return { x: 0, y: 0 };
      const selected = getActorScreenCoordSource(actor);
      const point = WorldMarchSystem.getTileScreenCenter(selected.coord, viewport, geometry);
      return point;
    }

    getActorTargetScreenPoint(actor = {}, viewport = {}, geometry = {}) {
      if (!WorldMarchSystem?.getTileScreenCenter) return { x: 0, y: 0 };
      return WorldMarchSystem.getTileScreenCenter(actor.target || actor.current || {}, viewport, geometry);
    }

    getActorFrameNowMs(options = {}) {
      const optionNow = options.epochNowMs ?? options.nowMs ?? options.serverNowMs;
      const resolvedOptionNow = Number(optionNow);
      if (Number.isFinite(resolvedOptionNow)) return resolvedOptionNow;
      const hostNow = Number(this.getNow?.());
      return Number.isFinite(hostNow) ? hostNow : Date.now();
    }

    getActorFramePath(actor = {}, options = {}) {
      const unitKey = actor.unitKey || UnitSpriteManifest?.DEFAULT_MARCH_UNIT_KEY || 'scout_squad_default';
      const animationId = actor.status === 'idle' ? 'move' : (actor.animationId || 'move');
      const frames = UnitSpriteManifest?.getFramePaths?.(unitKey, animationId) || [];
      if (!frames.length) return '';
      if (actor.status === 'idle') return frames[0];
      const frameMs = UnitSpriteManifest?.getFrameDurationMs?.(unitKey, animationId) || 80;
      const nowMs = this.getActorFrameNowMs(options);
      return frames[Math.floor(Number(nowMs) / Math.max(1, frameMs)) % frames.length] || frames[0];
    }

    getActorRenderCtx(options = {}) {
      return options?.ctx || this.worldMapRenderState?.worldActorOverlayTargetCtx || this.ctx || null;
    }

    getActorOverlayDiag(options = {}) {
      return options.worldActorOverlayDiag || null;
    }

    withActorRenderCtx(ctx = null, callback = null) {
      const renderState = this.worldMapRenderState;
      const previousCtx = renderState?.worldActorOverlayTargetCtx || null;
      if (renderState) renderState.worldActorOverlayTargetCtx = ctx || null;
      try {
        return typeof callback === 'function' ? callback() : false;
      } finally {
        if (renderState) renderState.worldActorOverlayTargetCtx = previousCtx;
      }
    }

    getActorRenderHost(ctx = null) {
      if (!ctx) return this;
      const renderHost = Object.create(this);
      Object.defineProperties(renderHost, {
        ctx: {
          configurable: true,
          value: ctx,
        },
        roundRectPath: {
          configurable: true,
          value(x, y, width, height, radius = 8) {
            ctx.beginPath?.();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(x, y, width, height, radius);
            } else {
              ctx.rect?.(x, y, width, height);
            }
          },
        },
      });
      return renderHost;
    }

    drawMarchArrow(from = {}, to = {}, options = {}) {
      const ctx = this.getActorRenderCtx(options);
      if (!ctx) return false;
      const dx = Number(to.x) - Number(from.x);
      const dy = Number(to.y) - Number(from.y);
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length < 8) return false;
      const diag = this.getActorOverlayDiag(options);
      if (diag) diag.arrowCanvasId = getCanvasId(ctx);
      const ux = dx / length;
      const uy = dy / length;
      const endX = Number(to.x) - ux * 14;
      const endY = Number(to.y) - uy * 14;
      const arrowSize = 10;
      ctx.save?.();
      ctx.strokeStyle = 'rgba(76, 232, 132, 0.88)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath?.();
      ctx.moveTo?.(Number(from.x), Number(from.y) - 5);
      ctx.lineTo?.(endX, endY - 5);
      ctx.stroke?.();
      ctx.fillStyle = 'rgba(76, 232, 132, 0.92)';
      ctx.beginPath?.();
      ctx.moveTo?.(endX + ux * arrowSize, endY + uy * arrowSize - 5);
      ctx.lineTo?.(endX - ux * arrowSize - uy * arrowSize * 0.65, endY - uy * arrowSize + ux * arrowSize * 0.65 - 5);
      ctx.lineTo?.(endX - ux * arrowSize + uy * arrowSize * 0.65, endY - uy * arrowSize - ux * arrowSize * 0.65 - 5);
      ctx.closePath?.();
      ctx.fill?.();
      ctx.restore?.();
      return true;
    }

    drawActorUnit(actor = {}, point = {}, viewport = {}, options = {}) {
      const ctx = this.getActorRenderCtx(options);
      const framePath = this.getActorFramePath(actor, options);
      const scale = Math.max(0.32, Math.min(0.62, (Number(viewport.scale) || 1) * 0.92));
      const unitRenderer = global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('tutorialIntroUnitRenderer')
        || this.host?.constructor?.getTutorialIntroUnitRenderer?.()
        || this.constructor.getTutorialIntroUnitRenderer?.();
      if (unitRenderer?.renderUnit) {
        return unitRenderer.renderUnit(this.getActorRenderHost(ctx), point.x, point.y + 6 * scale, scale, framePath);
      }
      const asset = framePath ? this.getAsset?.(framePath) : null;
      if (!asset || !ctx?.drawImage) return false;
      const width = 68 * scale;
      const height = 86 * scale;
      ctx.drawImage(asset, point.x - width / 2, point.y - height + 10 * scale, width, height);
      return true;
    }

    // The world-actor spine renderer (a single-context multi-skeleton webgl layer) is an
    // optional plugin resolved from the renderer dependency registry. When absent, every
    // actor draws through the 2D sprite path — so this seam is fully removable.
    getWorldActorSpineRenderer() {
      // Explicit override (tests / future dependency injection) wins.
      const override = global.WorldMapRendererDependencyRegistry?.getRendererDependency?.('worldActorSpineRenderer');
      if (override) return override;
      // The shell owns the stateful spine layer renderer. The render host chain that reaches it is
      // deeply nested (WorldActorCanvasRenderer -> WorldMapCanvasRenderer -> H5CanvasGameRenderer
      // -> shell) and its exact shape depends on which composition built this instance, so walk
      // the .host/.shell hops and return the first host that resolves a non-null renderer.
      let node = this.host;
      for (let hops = 0; node && hops < 8; hops += 1) {
        if (node !== this && typeof node.getWorldActorSpineRenderer === 'function') {
          const resolved = node.getWorldActorSpineRenderer();
          if (resolved) return resolved;
        }
        node = node.shell || node.host || null;
      }
      return null;
    }

    getActorRenderScale(viewport = {}) {
      return Math.max(0.32, Math.min(0.62, (Number(viewport.scale) || 1) * 0.92));
    }

    // One-shot observability for the "still 2D" class of bug: if the world actor spine renderer
    // never resolves through the host chain, log the exact chain once (browser only) so the break
    // is visible without a debugger. Silent when the renderer resolves (the healthy case).
    probeWorldActorSpineWiring(spine) {
      if (spine || global.__worldActorSpineProbe || typeof global.window === 'undefined') return;
      global.__worldActorSpineProbe = 1;
      const chain = [];
      let node = this.host;
      for (let hops = 0; node && hops < 8; hops += 1) {
        chain.push(node.constructor?.name || typeof node);
        node = node.shell || node.host || null;
      }
      console.info(`[spine-probe] world actor spine renderer NULL — host chain: ${chain.join(' -> ') || '(no host)'}`);
    }

    buildActorSpineFrame(actor = {}, point = {}, viewport = {}) {
      return {
        id: actor.id || actor.missionId || '',
        unitKey: actor.unitKey || UnitSpriteManifest?.DEFAULT_MARCH_UNIT_KEY || 'scout_squad_default',
        facing: actor.facing || '',
        status: actor.status || 'active',
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
        scale: this.getActorRenderScale(viewport),
      };
    }

    renderActors(actors = [], viewport = {}, geometry = {}, options = {}) {
      const ctx = this.getActorRenderCtx(options);
      const diag = this.getActorOverlayDiag(options);
      if (diag) diag.drawnCanvasId = getCanvasId(ctx);
      const spine = this.getWorldActorSpineRenderer();
      this.probeWorldActorSpineWiring(spine);
      if (!Array.isArray(actors) || !actors.length) {
        spine?.syncActors?.([], viewport);
        return false;
      }
      let rendered = false;
      const spineFrames = [];
      actors.forEach((actor) => {
        const point = this.getActorScreenPoint(actor, viewport, geometry);
        const targetPoint = this.getActorTargetScreenPoint(actor, viewport, geometry);
        const actorRenderOptions = { ...options, ctx };
        if (actor.status === 'active') this.drawMarchArrow(point, targetPoint, actorRenderOptions);
        if (spine?.canRenderActor?.(actor)) {
          spineFrames.push(this.buildActorSpineFrame(actor, point, viewport));
          rendered = true;
        } else if (this.drawActorUnit(actor, point, viewport, actorRenderOptions)) {
          rendered = true;
        }
        this.addActorHitTarget(actor, point);
      });
      if (spine?.syncActors?.(spineFrames, viewport)) spine.renderFrame?.();
      return rendered;
    }

    addActorHitTarget(actor = {}, point = {}) {
      const size = 42;
      this.addHitTarget?.({
        x: point.x - size / 2,
        y: point.y - size / 2 - 16,
        width: size,
        height: size,
      }, {
        type: 'selectWorldActor',
        actorId: actor.id,
        missionId: actor.missionId,
        inputSurface: 'worldMap',
        ...(actor.combatTarget ? {
          combatEncounterId: actor.combatTarget.encounterId,
          combatTarget: actor.combatTarget,
        } : {}),
      });
      return true;
    }

    addActorHitTargets(actors = [], viewport = {}, geometry = {}) {
      if (!Array.isArray(actors) || !actors.length) return false;
      actors.forEach((actor) => this.addActorHitTarget(actor, this.getActorScreenPoint(actor, viewport, geometry)));
      return true;
    }
  }

  global.WorldActorCanvasRenderer = WorldActorCanvasRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldActorCanvasRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

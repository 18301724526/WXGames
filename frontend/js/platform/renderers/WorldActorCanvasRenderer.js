(function (global) {
  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/WorldMarchSystem');
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

  function getDiagObjectId(value = null) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return '';
    if (typeof WeakMap !== 'function') return '';
    if (!global.__actorPickingDiagObjectIds) {
      global.__actorPickingDiagObjectIds = new WeakMap();
      global.__actorPickingDiagObjectIdSeq = 0;
    }
    if (!global.__actorPickingDiagObjectIds.has(value)) {
      global.__actorPickingDiagObjectIdSeq = (Number(global.__actorPickingDiagObjectIdSeq) || 0) + 1;
      global.__actorPickingDiagObjectIds.set(value, `obj#${global.__actorPickingDiagObjectIdSeq}`);
    }
    return global.__actorPickingDiagObjectIds.get(value);
  }

  function summarizeObjectRef(value = null) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return { present: false, id: '', constructorName: '' };
    }
    return {
      present: true,
      id: getDiagObjectId(value),
      constructorName: value.constructor?.name || '',
    };
  }

  function summarizeHitTargetStore(value = null) {
    const hitTargets = value?.hitTargets;
    const isArray = Array.isArray(hitTargets);
    return {
      object: summarizeObjectRef(value),
      hitTargetsIsArray: isArray,
      hitTargetsLength: isArray ? hitTargets.length : null,
      selectWorldActorCount: isArray
        ? hitTargets.filter((target) => target?.action?.type === 'selectWorldActor').length
        : null,
    };
  }

  function isActorPickingDiagEnabled() {
    if (global.__actorPickingDiag === true) return true;
    try {
      const params = new URL(global.location?.href || '').searchParams;
      const value = params.get('actorPickingDiag') || params.get('worldActorPickingDiag');
      if (value !== null) return value !== '0' && value !== 'false' && value !== 'off';
    } catch (_) {}
    try {
      const value = global.localStorage?.getItem?.('actorPickingDiag');
      return value === '1' || value === 'true' || value === 'on';
    } catch (_) {}
    return false;
  }

  function summarizeCoord(coord = null) {
    if (!coord || typeof coord !== 'object') return null;
    return {
      x: coord.x ?? null,
      y: coord.y ?? null,
      q: coord.q ?? null,
      r: coord.r ?? null,
      tileId: coord.tileId || coord.id || '',
    };
  }

  function getActorScreenCoordSource(actor = {}) {
    if (actor.current) return { source: 'current', coord: actor.current };
    if (actor.origin) return { source: 'origin', coord: actor.origin };
    return { source: 'none', coord: {} };
  }

  function logActorPickingDiag(stage = '', detail = {}) {
    if (!isActorPickingDiagEnabled()) return null;
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...detail,
    };
    try {
      global.console?.log?.('[ActorPickingDiag]', stage, payload);
    } catch (_) {}
    return payload;
  }

  class WorldActorCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    get __worldActorOverlayActiveDiag() {
      return this.host?.__worldActorOverlayActiveDiag;
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
      logActorPickingDiag('worldActorRenderer:getActorScreenPoint', {
        actorId: actor.id || actor.actorId || actor.missionId || '',
        missionId: actor.missionId || '',
        status: actor.status || '',
        selectedSource: selected.source,
        selectedCoord: summarizeCoord(selected.coord),
        current: summarizeCoord(actor.current),
        position: summarizeCoord(actor.position),
        origin: summarizeCoord(actor.origin),
        target: summarizeCoord(actor.target),
        point: {
          x: Number(point.x),
          y: Number(point.y),
        },
      });
      return point;
    }

    getActorTargetScreenPoint(actor = {}, viewport = {}, geometry = {}) {
      if (!WorldMarchSystem?.getTileScreenCenter) return { x: 0, y: 0 };
      return WorldMarchSystem.getTileScreenCenter(actor.target || actor.current || {}, viewport, geometry);
    }

    getActorFramePath(actor = {}) {
      const unitKey = actor.unitKey || 'scout_squad_default';
      const animationId = actor.status === 'idle' ? 'move' : (actor.animationId || 'move');
      const frames = UnitSpriteManifest?.getFramePaths?.(unitKey, animationId) || [];
      if (!frames.length) return '';
      if (actor.status === 'idle') return frames[0];
      const frameMs = UnitSpriteManifest?.getFrameDurationMs?.(unitKey, animationId) || 80;
      const nowMs = this.getNow?.() || Date.now();
      return frames[Math.floor(Number(nowMs) / Math.max(1, frameMs)) % frames.length] || frames[0];
    }

    getActorRenderCtx(options = {}) {
      return options?.ctx || this.__worldActorOverlayTargetCtx || this.ctx || null;
    }

    withActorRenderCtx(ctx = null, callback = null) {
      const hadOwnCtx = Object.prototype.hasOwnProperty.call(this, '__worldActorOverlayTargetCtx');
      const previousCtx = this.__worldActorOverlayTargetCtx;
      if (ctx) this.__worldActorOverlayTargetCtx = ctx;
      try {
        return typeof callback === 'function' ? callback() : false;
      } finally {
        if (hadOwnCtx) {
          this.__worldActorOverlayTargetCtx = previousCtx;
        } else {
          delete this.__worldActorOverlayTargetCtx;
        }
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
      const diag = this.__worldActorOverlayActiveDiag;
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
      const framePath = this.getActorFramePath(actor);
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

    renderActors(actors = [], viewport = {}, geometry = {}, options = {}) {
      const ctx = this.getActorRenderCtx(options);
      const diag = this.__worldActorOverlayActiveDiag;
      if (diag) diag.drawnCanvasId = getCanvasId(ctx);
      if (!Array.isArray(actors) || !actors.length) return false;
      let rendered = false;
      actors.forEach((actor) => {
        const point = this.getActorScreenPoint(actor, viewport, geometry);
        const targetPoint = this.getActorTargetScreenPoint(actor, viewport, geometry);
        if (actor.status === 'active') this.drawMarchArrow(point, targetPoint, { ctx });
        if (this.drawActorUnit(actor, point, viewport, { ctx })) rendered = true;
        this.addActorHitTarget(actor, point);
      });
      return rendered;
    }

    addActorHitTarget(actor = {}, point = {}) {
      const size = 42;
      const hostBefore = summarizeHitTargetStore(this.host);
      const selfBefore = summarizeHitTargetStore(this);
      logActorPickingDiag('worldActorRenderer:addActorHitTarget', {
        actorId: actor.id || actor.actorId || actor.missionId || '',
        missionId: actor.missionId || '',
        status: actor.status || '',
        self: summarizeObjectRef(this),
        host: summarizeObjectRef(this.host),
        hostWorldActorLayerRenderer: summarizeObjectRef(this.host?.worldActorLayerRenderer),
        hostIsSelf: this.host === this,
        hostWorldActorLayerRendererIsSelf: this.host?.worldActorLayerRenderer === this,
        hostHitTargetStoreBefore: hostBefore,
        selfHitTargetStoreBefore: selfBefore,
        current: summarizeCoord(actor.current),
        position: summarizeCoord(actor.position),
        origin: summarizeCoord(actor.origin),
        target: summarizeCoord(actor.target),
        selectedSource: getActorScreenCoordSource(actor).source,
        selectedCoord: summarizeCoord(getActorScreenCoordSource(actor).coord),
        point: {
          x: Number(point.x),
          y: Number(point.y),
        },
        targetBox: {
          x: point.x - size / 2,
          y: point.y - size / 2 - 16,
          width: size,
          height: size,
        },
      });
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
      });
      logActorPickingDiag('worldActorRenderer:addActorHitTarget:afterWrite', {
        actorId: actor.id || actor.actorId || actor.missionId || '',
        missionId: actor.missionId || '',
        status: actor.status || '',
        self: summarizeObjectRef(this),
        host: summarizeObjectRef(this.host),
        hostWorldActorLayerRenderer: summarizeObjectRef(this.host?.worldActorLayerRenderer),
        hostIsSelf: this.host === this,
        hostWorldActorLayerRendererIsSelf: this.host?.worldActorLayerRenderer === this,
        hostHitTargetStoreBefore: hostBefore,
        hostHitTargetStoreAfter: summarizeHitTargetStore(this.host),
        selfHitTargetStoreBefore: selfBefore,
        selfHitTargetStoreAfter: summarizeHitTargetStore(this),
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

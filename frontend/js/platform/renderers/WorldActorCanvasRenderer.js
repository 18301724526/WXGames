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

  class WorldActorCanvasRenderer {
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
      });
    }

    getActorScreenPoint(actor = {}, viewport = {}, geometry = {}) {
      if (!WorldMarchSystem?.getTileScreenCenter) return { x: 0, y: 0 };
      const current = actor.current || actor.origin || {};
      return WorldMarchSystem.getTileScreenCenter(current, viewport, geometry);
    }

    getActorTargetScreenPoint(actor = {}, viewport = {}, geometry = {}) {
      if (!WorldMarchSystem?.getTileScreenCenter) return { x: 0, y: 0 };
      return WorldMarchSystem.getTileScreenCenter(actor.target || actor.current || {}, viewport, geometry);
    }

    getActorFramePath(actor = {}) {
      const unitKey = actor.unitKey || 'scout_squad_default';
      const animationId = actor.animationId || 'move';
      const frames = UnitSpriteManifest?.getFramePaths?.(unitKey, animationId) || [];
      if (!frames.length) return '';
      const frameMs = UnitSpriteManifest?.getFrameDurationMs?.(unitKey, animationId) || 80;
      const nowMs = this.getNow?.() || Date.now();
      return frames[Math.floor(Number(nowMs) / Math.max(1, frameMs)) % frames.length] || frames[0];
    }

    drawMarchArrow(from = {}, to = {}) {
      if (!this.ctx) return false;
      const dx = Number(to.x) - Number(from.x);
      const dy = Number(to.y) - Number(from.y);
      const length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length < 8) return false;
      const ux = dx / length;
      const uy = dy / length;
      const endX = Number(to.x) - ux * 14;
      const endY = Number(to.y) - uy * 14;
      const arrowSize = 10;
      this.ctx.save?.();
      this.ctx.strokeStyle = 'rgba(76, 232, 132, 0.88)';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(Number(from.x), Number(from.y) - 5);
      this.ctx.lineTo?.(endX, endY - 5);
      this.ctx.stroke?.();
      this.ctx.fillStyle = 'rgba(76, 232, 132, 0.92)';
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(endX + ux * arrowSize, endY + uy * arrowSize - 5);
      this.ctx.lineTo?.(endX - ux * arrowSize - uy * arrowSize * 0.65, endY - uy * arrowSize + ux * arrowSize * 0.65 - 5);
      this.ctx.lineTo?.(endX - ux * arrowSize + uy * arrowSize * 0.65, endY - uy * arrowSize - ux * arrowSize * 0.65 - 5);
      this.ctx.closePath?.();
      this.ctx.fill?.();
      this.ctx.restore?.();
      return true;
    }

    drawActorUnit(actor = {}, point = {}, viewport = {}) {
      const framePath = this.getActorFramePath(actor);
      const scale = Math.max(0.32, Math.min(0.62, (Number(viewport.scale) || 1) * 0.92));
      const unitRenderer = this.host?.constructor?.getTutorialIntroUnitRenderer?.() || this.constructor.getTutorialIntroUnitRenderer?.();
      if (unitRenderer?.renderUnit) {
        return unitRenderer.renderUnit(this, point.x, point.y + 6 * scale, scale, framePath);
      }
      const asset = framePath ? this.getAsset?.(framePath) : null;
      if (!asset || !this.ctx?.drawImage) return false;
      const width = 68 * scale;
      const height = 86 * scale;
      this.ctx.drawImage(asset, point.x - width / 2, point.y - height + 10 * scale, width, height);
      return true;
    }

    renderActors(actors = [], viewport = {}, geometry = {}) {
      if (!Array.isArray(actors) || !actors.length) return false;
      let rendered = false;
      actors.forEach((actor) => {
        const point = this.getActorScreenPoint(actor, viewport, geometry);
        const targetPoint = this.getActorTargetScreenPoint(actor, viewport, geometry);
        if (actor.status === 'active') this.drawMarchArrow(point, targetPoint);
        if (this.drawActorUnit(actor, point, viewport)) rendered = true;
        this.addActorHitTarget(actor, point);
      });
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

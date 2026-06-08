(function (global) {
  class WorldMapScoutRenderer {
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
          if (prop === 'host' || prop in target) return Reflect.set(target, prop, value, receiver);
          const host = target.host;
          if (host) {
            host[prop] = value;
            return true;
          }
          target[prop] = value;
          return true;
        },
      });
    }

    getWorldTime() {
      return this.host?.constructor?.getWorldTime?.() || null;
    }

    getUnitSpriteManifest() {
      return this.host?.constructor?.getUnitSpriteManifest?.() || null;
    }

    getTutorialIntroUnitRenderer() {
      return this.host?.constructor?.getTutorialIntroUnitRenderer?.() || null;
    }

    renderWorldScoutRoutes(tileMapView = {}, viewport = {}) {
      const geometry = tileMapView.geometry || {};
      (tileMapView.activeScouts || []).forEach((mission) => {
        const points = (mission.route || []).map((step) => this.getWorldTileScreenCenter(step, viewport, geometry));
        if (points.length >= 2) {
          this.drawPolyline(points, {
            color: mission.status === 'ready' ? 'rgba(116, 211, 160, 0.72)' : 'rgba(240, 180, 91, 0.78)',
            width: 2,
          });
        }
        points.forEach((point, index) => {
          const step = mission.route[index] || {};
          const fill = step.revealed ? 'rgba(116, 211, 160, 0.84)' : 'rgba(240, 180, 91, 0.52)';
          this.drawPanel(point.x - 4, point.y - 4, 8, 8, {
            fill,
            stroke: 'rgba(11, 18, 14, 0.54)',
            radius: 4,
          });
        });
      });
    }

    getWorldScoutUnitRoutePoints(mission = {}, viewport = {}, geometry = {}) {
      const route = Array.isArray(mission.route) ? mission.route : [];
      const origin = mission.origin && typeof mission.origin === 'object' ? mission.origin : null;
      const path = origin ? [origin, ...route] : route;
      return path.map((step) => this.getWorldTileScreenCenter(step, viewport, geometry));
    }

    getWorldScoutUnitProgress(mission = {}) {
      if (!mission || mission.status !== 'active') return null;
      const route = Array.isArray(mission.route) ? mission.route : [];
      if (!route.length) return null;
      const worldTime = this.getWorldTime();
      const startedAtMs = worldTime?.toEpochMs?.(mission.startedAt, Number.NaN) ?? new Date(mission.startedAt).getTime();
      if (!Number.isFinite(startedAtMs)) return null;
      const nowMs = this.getEpochNowMs();
      const stepDurationMs = Math.max(1000, Number(mission.stepDurationSeconds) * 1000 || 10000);
      const totalDurationMs = Math.max(stepDurationMs, stepDurationMs * route.length);
      const elapsed = Math.max(0, Number(nowMs) - startedAtMs);
      return Math.max(0, Math.min(1, elapsed / totalDurationMs));
    }

    getWorldScoutUnitPoint(mission = {}, viewport = {}, geometry = {}) {
      const progress = this.getWorldScoutUnitProgress(mission);
      if (progress === null) return null;
      const points = this.getWorldScoutUnitRoutePoints(mission, viewport, geometry);
      if (points.length < 2) return null;
      const scaled = progress * (points.length - 1);
      const index = Math.min(points.length - 2, Math.floor(scaled));
      const localT = Math.max(0, Math.min(1, scaled - index));
      const from = points[index];
      const to = points[index + 1];
      return {
        x: from.x + (to.x - from.x) * localT,
        y: from.y + (to.y - from.y) * localT,
        progress,
      };
    }

    getWorldScoutUnitFramePath(mission = {}) {
      const manifest = this.getUnitSpriteManifest();
      if (!manifest?.getFramePaths) return '';
      const frames = manifest.getFramePaths('spearman', 'move');
      if (!frames.length) return '';
      const frameMs = manifest.getFrameDurationMs?.('spearman', 'move') || 80;
      const nowMs = this.getNow?.() || Date.now();
      return frames[Math.floor(Number(nowMs) / Math.max(1, frameMs)) % frames.length] || frames[0];
    }

    renderWorldScoutUnitsLegacy(tileMapView = {}, viewport = {}) {
      const unitRenderer = this.getTutorialIntroUnitRenderer();
      if (!unitRenderer?.renderUnit) return false;
      const geometry = tileMapView.geometry || {};
      let rendered = false;
      (tileMapView.activeScouts || []).forEach((mission) => {
        if (mission.kind !== 'worldExplore' || mission.status !== 'active') return;
        const point = this.getWorldScoutUnitPoint(mission, viewport, geometry);
        if (!point) return;
        const scale = Math.max(0.32, Math.min(0.62, (Number(viewport.scale) || 1) * 0.92));
        const framePath = this.getWorldScoutUnitFramePath(mission);
        unitRenderer.renderUnit(this.host || this, point.x, point.y + 6 * scale, scale, framePath);
        rendered = true;
      });
      return rendered;
    }
  }

  global.WorldMapScoutRenderer = WorldMapScoutRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapScoutRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

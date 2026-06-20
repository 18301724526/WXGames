(function (global) {
  class WorldMapScoutRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    get ctx() {
      return this.host?.ctx;
    }

    getWorldTileScreenCenter(...args) {
      return this.host?.getWorldTileScreenCenter?.(...args);
    }

    getActorRouteMission(actor = {}, tileMapView = {}) {
      const actorKeys = [actor.missionId, actor.id].map((key) => String(key || '')).filter(Boolean);
      if (!actorKeys.length) return null;
      return (Array.isArray(tileMapView.activeScouts) ? tileMapView.activeScouts : [])
        .find((mission) => actorKeys.includes(String(mission?.id || ''))) || null;
    }

    getRemainingRouteSteps(actor = {}, mission = {}) {
      const path = this.getRoutePath(actor, mission);
      const standingIndex = this.getRouteStandingIndex(actor, path);
      return standingIndex >= 0 ? path.slice(standingIndex + 1) : [];
    }

    getRoutePath(actor = {}, mission = {}) {
      const route = Array.isArray(actor.route) && actor.route.length
        ? actor.route
        : (Array.isArray(mission.route) ? mission.route : []);
      const origin = actor.origin || mission.origin || actor.position || actor.current || null;
      if (!origin || !route.length) return [];
      return [origin, ...route];
    }

    getRouteStandingIndex(actor = {}, path = []) {
      if (!path.length) return -1;
      const progress = actor.progress || {};
      const segmentIndex = Math.max(0, Math.floor(Number(actor.current?.segmentIndex ?? progress.segmentIndex ?? 0) || 0));
      const segmentProgress = Math.max(0, Math.min(1, Number(actor.current?.segmentProgress ?? progress.segmentProgress ?? 0) || 0));
      return Math.min(path.length - 1, segmentIndex + (segmentProgress >= 0.999 ? 1 : 0));
    }

    getWorldScoutRoutePoints(actor = {}, mission = {}, viewport = {}, geometry = {}) {
      if (actor.status !== 'active') return [];
      const path = this.getRoutePath(actor, mission);
      const standingIndex = this.getRouteStandingIndex(actor, path);
      const routeSteps = standingIndex >= 0 ? path.slice(standingIndex) : [];
      if (routeSteps.length < 2) return [];
      const points = routeSteps.map((step) => this.getWorldTileScreenCenter(step, viewport, geometry));
      return points.filter((point) => (
        point
        && Number.isFinite(Number(point.x))
        && Number.isFinite(Number(point.y))
      ));
    }

    drawDashedScoutRoute(points = [], options = {}) {
      if (!this.ctx || points.length < 2) return false;
      this.ctx.save?.();
      const previousDash = this.ctx.getLineDash?.() || [];
      const previousOffset = this.ctx.lineDashOffset || 0;
      const previousCap = this.ctx.lineCap;
      const previousJoin = this.ctx.lineJoin;
      if (this.ctx.setLineDash) this.ctx.setLineDash(options.dash || [10, 8]);
      this.ctx.lineDashOffset = 0;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = options.shadowColor || 'rgba(11, 18, 14, 0.66)';
      this.ctx.lineWidth = Math.max(1, Number(options.width) || 3) + 2;
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.ctx.lineTo?.(point.x, point.y));
      this.ctx.stroke?.();
      this.ctx.strokeStyle = options.color || 'rgba(92, 236, 145, 0.86)';
      this.ctx.lineWidth = Math.max(1, Number(options.width) || 3);
      this.ctx.beginPath?.();
      this.ctx.moveTo?.(points[0].x, points[0].y);
      points.slice(1).forEach((point) => this.ctx.lineTo?.(point.x, point.y));
      this.ctx.stroke?.();
      if (this.ctx.setLineDash) this.ctx.setLineDash(previousDash);
      this.ctx.lineDashOffset = previousOffset;
      this.ctx.lineCap = previousCap;
      this.ctx.lineJoin = previousJoin;
      this.ctx.restore?.();
      return true;
    }

    renderWorldScoutRoutes(tileMapView = {}, viewport = {}, actors = []) {
      const geometry = tileMapView.geometry || viewport.geometry || {};
      let rendered = false;
      (Array.isArray(actors) ? actors : []).forEach((actor) => {
        const mission = this.getActorRouteMission(actor, tileMapView) || {};
        const points = this.getWorldScoutRoutePoints(actor, mission, viewport, geometry);
        if (this.drawDashedScoutRoute(points)) rendered = true;
      });
      return rendered;
    }

  }

  global.WorldMapScoutRenderer = WorldMapScoutRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapScoutRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

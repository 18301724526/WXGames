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

  }

  global.WorldMapScoutRenderer = WorldMapScoutRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapScoutRenderer;
})(typeof window !== 'undefined' ? window : globalThis);

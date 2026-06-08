(function (global) {
  class WorldMapRenderUtilityFacade {
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

    drawIsoDiamond(cx, cy, width, height, options = {}) {
      if (!this.ctx) return false;
      this.ctx.fillStyle = options.fill || 'rgba(71, 97, 67, 0.72)';
      this.ctx.strokeStyle = options.stroke || 'rgba(255, 226, 177, 0.14)';
      this.ctx.lineWidth = options.width || 1;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, cy - height * 0.5);
      this.ctx.lineTo(cx + width * 0.5, cy);
      this.ctx.lineTo(cx, cy + height * 0.5);
      this.ctx.lineTo(cx - width * 0.5, cy);
      if (typeof this.ctx.closePath === 'function') this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      return true;
    }

    getFallbackTerrainFill(terrain = 'plains') {
      const fills = {
        capital: 'rgba(98, 124, 76, 0.94)',
        plains: 'rgba(90, 122, 70, 0.9)',
        forest: 'rgba(45, 91, 63, 0.94)',
        hills: 'rgba(126, 114, 75, 0.92)',
        mountain: 'rgba(104, 104, 96, 0.94)',
        waste: 'rgba(112, 96, 78, 0.9)',
        desert: 'rgba(165, 132, 78, 0.9)',
        river: 'rgba(54, 116, 139, 0.92)',
        ocean: 'rgba(35, 87, 120, 0.94)',
      };
      return fills[terrain] || fills.plains;
    }

    hashString(input) {
      let hash = 2166136261;
      const text = String(input);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }

    random01(seed, q, r, salt) {
      return this.hashString(`${seed || 'scout-tile-v1'}|${q}|${r}|${salt}`) / 4294967295;
    }
  }

  global.WorldMapRenderUtilityFacade = WorldMapRenderUtilityFacade;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRenderUtilityFacade;
})(typeof window !== 'undefined' ? window : globalThis);

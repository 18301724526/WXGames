(function (global) {
  class WorldRadarPresenter {
    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static getWorldRadarPosition(site, maxDistance) {
      const rx = Number(site.relativeX ?? site.x ?? 0);
      const ry = Number(site.relativeY ?? site.y ?? 0);
      const offset = this.relativeVisualOffset(rx, ry, site.id || '');
      const x = rx + offset.x;
      const y = ry + offset.y;
      const distance = Math.max(0, Math.hypot(x, y));
      const normalized = Math.sqrt(Math.min(1, distance / Math.max(1, maxDistance)));
      const radius = distance > 0 ? 12 + normalized * 30 : 0;
      const angle = Math.atan2(y, x || 0.0001);
      return {
        x,
        y,
        distance,
        angle,
        radius,
      };
    }

    static relativeVisualOffset(x, y, seedHint = '') {
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const seed = Math.abs((x * 92821) + (y * 68917) + String(seedHint).length * 131);
      const distance = Math.max(1, Math.max(Math.abs(x), Math.abs(y)));
      const lateralX = (this.seededNoise(seed + 11) - 0.5) * 0.44;
      const lateralY = (this.seededNoise(seed + 23) - 0.5) * 0.44;
      const radial = (this.seededNoise(seed + 37) - 0.5) * 0.22;
      return {
        x: this.roundOffset(lateralX + (x / distance) * radial),
        y: this.roundOffset(lateralY + (y / distance) * radial),
      };
    }

    static seededNoise(seed) {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    }

    static roundOffset(value) {
      return Math.round(value * 100) / 100;
    }

    static measureWorldRadarSpacing(candidate, placed) {
      if (!placed.length) return Infinity;
      return placed.reduce((best, existing) => Math.min(
        best,
        Math.hypot(candidate.left - existing.left, candidate.top - existing.top),
      ), Infinity);
    }

    static resolveWorldRadarPosition(anchor, placed) {
      if (anchor.distance === 0) return { left: 50, top: 50 };
      const angleOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];
      const radiusOffsets = [0, 2.5, -2, 5, -3.5, 7];
      const minSpacing = 9.5;
      let bestCandidate = null;

      for (const radiusOffset of radiusOffsets) {
        for (const angleOffset of angleOffsets) {
          const candidateAngle = anchor.angle + angleOffset * (Math.PI / 18);
          const candidateRadius = Math.max(10, Math.min(40, anchor.radius + radiusOffset + Math.abs(angleOffset) * 0.2));
          const candidate = {
            left: 50 + Math.cos(candidateAngle) * candidateRadius,
            top: 50 + Math.sin(candidateAngle) * candidateRadius,
          };
          if (candidate.left < 8 || candidate.left > 92 || candidate.top < 8 || candidate.top > 92) continue;
          const spacing = this.measureWorldRadarSpacing(candidate, placed);
          if (spacing >= minSpacing) return candidate;
          if (!bestCandidate || spacing > bestCandidate.spacing) {
            bestCandidate = { ...candidate, spacing };
          }
        }
      }

      return bestCandidate || {
        left: Math.max(8, Math.min(92, 50 + Math.cos(anchor.angle) * anchor.radius)),
        top: Math.max(8, Math.min(92, 50 + Math.sin(anchor.angle) * anchor.radius)),
      };
    }

    static buildWorldRadarLayout(territories = []) {
      const maxDistance = Math.max(
        1,
        ...territories.map((site) => Math.hypot(
          Number(site.relativeX ?? site.x ?? 0),
          Number(site.relativeY ?? site.y ?? 0),
        )),
      );
      const sorted = [...territories].sort((a, b) => {
        if (a.id === 'capital') return -1;
        if (b.id === 'capital') return 1;
        const aAnchor = this.getWorldRadarPosition(a, maxDistance);
        const bAnchor = this.getWorldRadarPosition(b, maxDistance);
        return aAnchor.distance - bAnchor.distance || aAnchor.angle - bAnchor.angle || String(a.id).localeCompare(String(b.id));
      });
      const placed = [];
      const layout = new Map();

      sorted.forEach((site) => {
        const anchor = this.getWorldRadarPosition(site, maxDistance);
        const resolved = this.resolveWorldRadarPosition(anchor, placed);
        const position = {
          left: resolved.left.toFixed(2),
          top: resolved.top.toFixed(2),
        };
        placed.push({
          id: site.id,
          left: Number(position.left),
          top: Number(position.top),
        });
        layout.set(site.id, position);
      });

      return layout;
    }

    static getWorldMapSignature(territories = []) {
      return JSON.stringify((territories || []).map((site) => ({
        id: site.id,
        x: site.x,
        y: site.y,
        relativeX: site.relativeX ?? null,
        relativeY: site.relativeY ?? null,
        visualOffset: site.visualOffset || null,
        status: site.status,
        owner: site.owner,
        type: site.type,
        art: site.art,
        name: site.cityName || site.naturalName,
      })));
    }

    static buildWorldRadarViewState(territories = [], options = {}) {
      const layout = this.buildWorldRadarLayout(territories);
      return {
        signature: this.getWorldMapSignature(territories),
        pan: {
          x: this.toNumber(options.panX),
          y: this.toNumber(options.panY),
        },
        sites: territories.map((site) => {
          const position = layout.get(site.id) || { left: '50.00', top: '50.00' };
          return {
            id: site.id || '',
            status: site.status || '',
            owner: site.owner || '',
            type: site.type || '',
            title: site.naturalName || '',
            art: site.art || '',
            alt: site.naturalName || '',
            name: site.cityName || site.naturalName || '',
            position,
          };
        }),
      };
    }
  }

  global.WorldRadarPresenter = WorldRadarPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldRadarPresenter;
})(typeof window !== 'undefined' ? window : globalThis);

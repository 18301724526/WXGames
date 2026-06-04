(function (global) {
  const TUTORIAL_MARCH_UNIT_FRAME_PATHS = Array.from({ length: 11 }, (_, index) => (
    `assets/art/%E5%A3%AB%E5%85%B5/%E7%A7%BB%E5%8A%A8/${String(index + 1).padStart(3, '0')}.png`
  ));

  const BASE_PRELOAD_ASSET_PATHS = [
    'assets/art/civilization-bg.webp',
    'assets/art/icon-home-cutout.png',
    'assets/art/icon-fire-cutout.webp',
    'assets/art/icon-wood-cutout.webp',
    'assets/art/icon-iron-cutout.webp',
    'assets/art/icon-stone-cutout.webp',
    'assets/art/icon-food-cutout.webp',
    'assets/art/icon-knowledge-cutout.webp',
    'assets/art/icon-population-cutout.webp',
    'assets/art/icon-happiness-cutout.webp',
    'assets/art/icon-farmer-cutout.webp',
    'assets/art/icon-scholar-cutout.webp',
    'assets/art/icon-craftsman-cutout.webp',
    'assets/art/icon-science-cutout.webp',
    'assets/art/icon-soldier-cutout.webp',
    'assets/art/icon-event-cutout.webp',
    'assets/art/tech-agriculture-cutout.png',
    'assets/art/tech-livelihood-cutout.png',
    'assets/art/tech-administration-cutout.png',
    'assets/art/tech-knowledge-cutout.png',
    'assets/art/tech-culture-cutout.png',
    'assets/art/tech-engineering-cutout.png',
    'assets/art/tech-industry-cutout.png',
    'assets/art/tech-exploration-cutout.png',
    'assets/art/tech-trade-cutout.png',
    'assets/art/tech-military-cutout.png',
    'assets/art/building-house-cutout.png',
    'assets/art/building-farm-cutout.png',
    'assets/art/building-lumbermill-cutout.png',
    'assets/art/building-barracks-cutout.png',
    'assets/art/building-academy-cutout.png',
    'assets/art/building-workshop-cutout.png',
    'assets/art/building-temple-cutout.png',
    'assets/art/building-watchtower-cutout.png',
    'assets/art/world-site-camp-cutout.png',
    'assets/art/world-site-city-cutout.png',
    'assets/art/world-site-outpost-cutout.png',
    'assets/art/world-site-ruins-cutout.png',
    'assets/art/world-site-town-cutout.png',
    ...TUTORIAL_MARCH_UNIT_FRAME_PATHS,
    'assets/art/spine/tutorial/advisor/tutorial_advisor.png',
    'assets/art/battle/battlefield-forest-camp.png',
  ];

  class CanvasPreloadAssetManifest {
    static getTutorialMarchUnitFramePaths() {
      return [...TUTORIAL_MARCH_UNIT_FRAME_PATHS];
    }

    static getBasePreloadAssetPaths() {
      return [...BASE_PRELOAD_ASSET_PATHS];
    }

    static getBattleUnitFramePaths(rendererClass) {
      if (!rendererClass || typeof rendererClass.getBattleUnitFramePaths !== 'function') return [];
      return rendererClass.getBattleUnitFramePaths();
    }

    static getFamousPortraitLayerPaths(layout = {}) {
      return Object.values(layout.layers || {})
        .map((layer) => layer?.file)
        .filter(Boolean)
        .map((file) => `assets/art/famous-person/layers/${file}`);
    }

    static getTileMapPreloadAssetPaths(manifest = {}) {
      return manifest.getPreloadAssetPaths?.() || [];
    }

    static getPreloadAssetPaths(options = {}) {
      const rendererClass = options.rendererClass || null;
      const tileMapManifest = options.tileMapManifest || {};
      const famousPortraitLayout = options.famousPortraitLayout || {};
      return [
        ...this.getBasePreloadAssetPaths(),
        ...this.getTileMapPreloadAssetPaths(tileMapManifest),
        ...this.getBattleUnitFramePaths(rendererClass),
        ...this.getFamousPortraitLayerPaths(famousPortraitLayout),
      ];
    }
  }

  global.CanvasPreloadAssetManifest = CanvasPreloadAssetManifest;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanvasPreloadAssetManifest;
  }
})(typeof window !== 'undefined' ? window : globalThis);

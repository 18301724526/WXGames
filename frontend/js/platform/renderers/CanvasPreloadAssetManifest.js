(function (global) {
  const SharedAssetKeyRegistry = (() => {
    if (global.AssetKeyRegistry) return global.AssetKeyRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/AssetKeyRegistry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const SharedUnitSpriteManifest = (() => {
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
  const TUTORIAL_MARCH_UNIT_ID = 'tutorial_intro_soldier';
  const WORLD_SCOUT_UNIT_ID = 'scout_squad_default';
  const TUTORIAL_MARCH_UNIT_ANIMATION = 'move';
  const BASE_PRELOAD_ASSET_KEYS = Object.freeze([
    'background:civilization',
    'ui:icon:home',
    'ui:icon:fire',
    'ui:icon:wood',
    'ui:icon:iron',
    'ui:icon:stone',
    'ui:icon:food',
    'ui:icon:knowledge',
    'ui:icon:population',
    'ui:icon:happiness',
    'ui:icon:farmer',
    'ui:icon:scholar',
    'ui:icon:craftsman',
    'ui:icon:science',
    'ui:icon:soldier',
    'ui:icon:event',
    'ui-hud:icon:capital',
    'ui-hud:icon:tasks',
    'ui-hud:icon:tech',
    'ui-hud:icon:civilization',
    'ui-hud:icon:famous',
    'ui-hud:icon:more',
    'ui-hud:icon:settings',
    'ui-hud:icon:subcity',
    'ui-hud:icon:event',
    'ui-hud:icon:account',
    'ui-hud:icon:signal',
    'ui-hud:icon:squad',
    'ui-hud:plate:top',
    'ui-hud:resource:food',
    'ui-hud:resource:wood',
    'ui-hud:resource:stone',
    'ui-hud:resource:iron',
    'ui-hud:resource:knowledge',
    'ui-hud:resource:population',
    'ui-hud:dock:badge-round',
    'ui-hud:dock:button-cell',
    'ui-hud:dock-icon:capital',
    'ui-hud:dock-icon:tasks',
    'ui-hud:dock-icon:tech',
    'ui-hud:dock-icon:civilization',
    'ui-hud:dock-icon:famous',
    'ui-hud:dock-icon:settings',
    'ui-hud:float-icon:subcity',
    'ui-hud:float-icon:event',
    'ui-hud:float-icon:account',
    'ui-hud:squad-crest:1',
    'ui-hud:squad-crest:2',
    'ui-hud:squad-crest:3',
    'tech:route:agriculture',
    'tech:route:livelihood',
    'tech:route:administration',
    'tech:route:knowledge',
    'tech:route:culture',
    'tech:route:engineering',
    'tech:route:industry',
    'tech:route:exploration',
    'tech:route:trade',
    'tech:route:military',
    'building:house',
    'building:farm',
    'building:lumbermill',
    'building:barracks',
    'building:academy',
    'building:workshop',
    'building:temple',
    'building:watchtower',
    'world-site:camp',
    'world-site:city',
    'world-site:outpost',
    'world-site:ruins',
    'world-site:town',
    'spine:tutorial-advisor:texture',
    'battle:background:forest-camp',
  ]);

  function getTutorialMarchUnitFramePaths() {
    return SharedUnitSpriteManifest?.getFramePaths?.(TUTORIAL_MARCH_UNIT_ID, TUTORIAL_MARCH_UNIT_ANIMATION) || [];
  }

  function getWorldScoutUnitFramePaths() {
    return SharedUnitSpriteManifest?.getFramePaths?.(WORLD_SCOUT_UNIT_ID, 'move') || [];
  }

  const FALLBACK_BASE_PRELOAD_ASSET_PATHS = Object.freeze([
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
    'assets/art/ui-hud/hud-icon-capital.png',
    'assets/art/ui-hud/hud-icon-tasks.png',
    'assets/art/ui-hud/hud-icon-tech.png',
    'assets/art/ui-hud/hud-icon-civilization.png',
    'assets/art/ui-hud/hud-icon-famous.png',
    'assets/art/ui-hud/hud-icon-more.png',
    'assets/art/ui-hud/hud-icon-settings.png',
    'assets/art/ui-hud/hud-icon-subcity.png',
    'assets/art/ui-hud/hud-icon-event.png',
    'assets/art/ui-hud/hud-icon-account.png',
    'assets/art/ui-hud/hud-icon-signal.png',
    'assets/art/ui-hud/hud-icon-squad.png',
    'assets/art/ui-hud/hud-plate-top.png',
    'assets/art/ui-hud/hud-resource-food.png',
    'assets/art/ui-hud/hud-resource-wood.png',
    'assets/art/ui-hud/hud-resource-stone.png',
    'assets/art/ui-hud/hud-resource-iron.png',
    'assets/art/ui-hud/hud-resource-knowledge.png',
    'assets/art/ui-hud/hud-resource-population.png',
    'assets/art/ui-hud/hud-dock-badge-round.png',
    'assets/art/ui-hud/hud-dock-icon-capital.png',
    'assets/art/ui-hud/hud-dock-icon-tasks.png',
    'assets/art/ui-hud/hud-dock-icon-tech.png',
    'assets/art/ui-hud/hud-dock-icon-civilization.png',
    'assets/art/ui-hud/hud-dock-icon-famous.png',
    'assets/art/ui-hud/hud-dock-icon-settings.png',
    'assets/art/ui-hud/hud-float-icon-subcity.png',
    'assets/art/ui-hud/hud-float-icon-event.png',
    'assets/art/ui-hud/hud-float-icon-account.png',
    'assets/art/ui-hud/hud-squad-crest-1.png',
    'assets/art/ui-hud/hud-squad-crest-2.png',
    'assets/art/ui-hud/hud-squad-crest-3.png',
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
    'assets/art/spine/tutorial/advisor/tutorial_advisor.png',
    'assets/art/battle/battlefield-forest-camp.png',
  ]);

  function uniquePaths(paths = []) {
    return Array.from(new Set((Array.isArray(paths) ? paths : []).filter(Boolean)));
  }

  function getBaseStaticPreloadAssetPaths() {
    const paths = SharedAssetKeyRegistry?.getAssetPaths?.(BASE_PRELOAD_ASSET_KEYS) || [];
    return paths.length ? paths : [...FALLBACK_BASE_PRELOAD_ASSET_PATHS];
  }

  class CanvasPreloadAssetManifest {
    static getBasePreloadAssetKeys() {
      return [...BASE_PRELOAD_ASSET_KEYS];
    }

    static getTutorialMarchUnitFramePaths() {
      return getTutorialMarchUnitFramePaths();
    }

    static getWorldScoutUnitFramePaths() {
      return getWorldScoutUnitFramePaths();
    }

    static getBasePreloadAssetPaths() {
      return uniquePaths([
        ...getBaseStaticPreloadAssetPaths(),
        ...getTutorialMarchUnitFramePaths(),
        ...getWorldScoutUnitFramePaths(),
      ]);
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

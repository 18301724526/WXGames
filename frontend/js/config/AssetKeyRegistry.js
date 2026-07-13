(function (global) {
  const ASSET_KEY_REGISTRY_VERSION = 'asset-key-registry-v1';
  const DEFAULT_PRELOAD_GROUP = 'base';

  function normalizeKey(value = '') {
    return String(value || '').trim();
  }

  function asset(key, group, path, preloadGroups = [DEFAULT_PRELOAD_GROUP]) {
    return Object.freeze({
      key: normalizeKey(key),
      group: normalizeKey(group || 'misc'),
      path: normalizeKey(path),
      preloadGroups: Object.freeze(Array.from(new Set((preloadGroups || []).map(normalizeKey).filter(Boolean)))),
    });
  }

  const ASSET_DEFINITIONS = Object.freeze([
    asset('background:civilization', 'background', 'assets/art/civilization-bg.webp'),

    asset('ui:icon:home', 'ui', 'assets/art/icon-home-cutout.png'),
    asset('ui:icon:fire', 'ui', 'assets/art/icon-fire-cutout.webp'),
    asset('ui:icon:wood', 'ui', 'assets/art/icon-wood-cutout.webp'),
    asset('ui:icon:iron', 'ui', 'assets/art/icon-iron-cutout.webp'),
    asset('ui:icon:stone', 'ui', 'assets/art/icon-stone-cutout.webp'),
    asset('ui:icon:food', 'ui', 'assets/art/icon-food-cutout.webp'),
    asset('ui:icon:knowledge', 'ui', 'assets/art/icon-knowledge-cutout.webp'),
    asset('ui:icon:population', 'ui', 'assets/art/icon-population-cutout.webp'),
    asset('ui:icon:happiness', 'ui', 'assets/art/icon-happiness-cutout.webp'),
    asset('ui:icon:farmer', 'ui', 'assets/art/icon-farmer-cutout.webp'),
    asset('ui:icon:scholar', 'ui', 'assets/art/icon-scholar-cutout.webp'),
    asset('ui:icon:craftsman', 'ui', 'assets/art/icon-craftsman-cutout.webp'),
    asset('ui:icon:science', 'ui', 'assets/art/icon-science-cutout.webp'),
    asset('ui:icon:soldier', 'ui', 'assets/art/icon-soldier-cutout.webp'),
    asset('ui:icon:event', 'ui', 'assets/art/icon-event-cutout.webp'),
    asset('ui-hud:icon:capital', 'ui', 'assets/art/ui-hud/hud-icon-capital.png'),
    asset('ui-hud:icon:tasks', 'ui', 'assets/art/ui-hud/hud-icon-tasks.png'),
    asset('ui-hud:icon:tech', 'ui', 'assets/art/ui-hud/hud-icon-tech.png'),
    asset('ui-hud:icon:civilization', 'ui', 'assets/art/ui-hud/hud-icon-civilization.png'),
    asset('ui-hud:icon:famous', 'ui', 'assets/art/ui-hud/hud-icon-famous.png'),
    asset('ui-hud:icon:more', 'ui', 'assets/art/ui-hud/hud-icon-more.png'),
    asset('ui-hud:icon:settings', 'ui', 'assets/art/ui-hud/hud-icon-settings.png'),
    asset('ui-hud:icon:subcity', 'ui', 'assets/art/ui-hud/hud-icon-subcity.png'),
    asset('ui-hud:icon:event', 'ui', 'assets/art/ui-hud/hud-icon-event.png'),
    asset('ui-hud:icon:account', 'ui', 'assets/art/ui-hud/hud-icon-account.png'),
    asset('ui-hud:icon:signal', 'ui', 'assets/art/ui-hud/hud-icon-signal.png'),
    asset('ui-hud:icon:squad', 'ui', 'assets/art/ui-hud/hud-icon-squad.png'),
    asset('ui-hud:plate:top', 'ui', 'assets/art/ui-hud/hud-plate-top.png'),
    asset('ui-hud:resource:food', 'ui', 'assets/art/ui-hud/hud-resource-food.png'),
    asset('ui-hud:resource:wood', 'ui', 'assets/art/ui-hud/hud-resource-wood.png'),
    asset('ui-hud:resource:stone', 'ui', 'assets/art/ui-hud/hud-resource-stone.png'),
    asset('ui-hud:resource:iron', 'ui', 'assets/art/ui-hud/hud-resource-iron.png'),
    asset('ui-hud:resource:knowledge', 'ui', 'assets/art/ui-hud/hud-resource-knowledge.png'),
    asset('ui-hud:resource:population', 'ui', 'assets/art/ui-hud/hud-resource-population.png'),
    asset('ui-hud:dock:badge-round', 'ui', 'assets/art/ui-hud/hud-dock-badge-round.png'),
    asset('ui-hud:dock:button-cell', 'ui', 'assets/art/ui-hud/hud-dock-button-cell.png'),
    asset('ui-hud:dock-icon:capital', 'ui', 'assets/art/ui-hud/hud-dock-icon-capital.png'),
    asset('ui-hud:dock-icon:tasks', 'ui', 'assets/art/ui-hud/hud-dock-icon-tasks.png'),
    asset('ui-hud:dock-icon:tech', 'ui', 'assets/art/ui-hud/hud-dock-icon-tech.png'),
    asset('ui-hud:dock-icon:civilization', 'ui', 'assets/art/ui-hud/hud-dock-icon-civilization.png'),
    asset('ui-hud:dock-icon:famous', 'ui', 'assets/art/ui-hud/hud-dock-icon-famous.png'),
    asset('ui-hud:dock-icon:settings', 'ui', 'assets/art/ui-hud/hud-dock-icon-settings.png'),
    asset('ui-hud:float-icon:subcity', 'ui', 'assets/art/ui-hud/hud-float-icon-subcity.png'),
    asset('ui-hud:float-icon:event', 'ui', 'assets/art/ui-hud/hud-float-icon-event.png'),
    asset('ui-hud:float-icon:account', 'ui', 'assets/art/ui-hud/hud-float-icon-account.png'),
    asset('ui-hud:squad-crest:1', 'ui', 'assets/art/ui-hud/hud-squad-crest-1.png'),
    asset('ui-hud:squad-crest:2', 'ui', 'assets/art/ui-hud/hud-squad-crest-2.png'),
    asset('ui-hud:squad-crest:3', 'ui', 'assets/art/ui-hud/hud-squad-crest-3.png'),

    asset('tech:route:agriculture', 'tech', 'assets/art/tech-agriculture-cutout.png'),
    asset('tech:route:livelihood', 'tech', 'assets/art/tech-livelihood-cutout.png'),
    asset('tech:route:administration', 'tech', 'assets/art/tech-administration-cutout.png'),
    asset('tech:route:knowledge', 'tech', 'assets/art/tech-knowledge-cutout.png'),
    asset('tech:route:culture', 'tech', 'assets/art/tech-culture-cutout.png'),
    asset('tech:route:engineering', 'tech', 'assets/art/tech-engineering-cutout.png'),
    asset('tech:route:industry', 'tech', 'assets/art/tech-industry-cutout.png'),
    asset('tech:route:exploration', 'tech', 'assets/art/tech-exploration-cutout.png'),
    asset('tech:route:trade', 'tech', 'assets/art/tech-trade-cutout.png'),
    asset('tech:route:military', 'tech', 'assets/art/tech-military-cutout.png'),

    asset('building:house', 'building', 'assets/art/building-house-cutout.png'),
    asset('building:farm', 'building', 'assets/art/building-farm-cutout.png'),
    asset('building:lumbermill', 'building', 'assets/art/building-lumbermill-cutout.png'),
    asset('building:barracks', 'building', 'assets/art/building-barracks-cutout.png'),
    asset('building:academy', 'building', 'assets/art/building-academy-cutout.png'),
    asset('building:workshop', 'building', 'assets/art/building-workshop-cutout.png'),
    asset('building:temple', 'building', 'assets/art/building-temple-cutout.png'),
    asset('building:watchtower', 'building', 'assets/art/building-watchtower-cutout.png'),

    asset('world-site:camp', 'world-site', 'assets/art/world-site-camp-cutout.png'),
    asset('world-site:city', 'world-site', 'assets/art/world-site-city-cutout.png'),
    asset('world-site:outpost', 'world-site', 'assets/art/world-site-outpost-cutout.png'),
    asset('world-site:ruins', 'world-site', 'assets/art/world-site-ruins-cutout.png'),
    asset('world-site:town', 'world-site', 'assets/art/world-site-town-cutout.png'),

    asset('battle:background:forest-camp', 'battle', 'assets/art/battle/battlefield-forest-camp.png'),
  ]);

  function normalizeDefinition(definition = {}) {
    const normalized = asset(
      definition.key,
      definition.group || 'misc',
      definition.path,
      Array.isArray(definition.preloadGroups) ? definition.preloadGroups : [],
    );
    return normalized.key && normalized.path ? normalized : null;
  }

  function unique(values = []) {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      const normalized = normalizeKey(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function createRegistry(definitions = ASSET_DEFINITIONS) {
    const definitionByKey = new Map();
    const orderedKeys = [];

    (Array.isArray(definitions) ? definitions : []).forEach((definition) => {
      const normalized = normalizeDefinition(definition);
      if (!normalized) return;
      if (!definitionByKey.has(normalized.key)) orderedKeys.push(normalized.key);
      definitionByKey.set(normalized.key, normalized);
    });

    const normalizedDefinitions = Object.freeze(orderedKeys.map((key) => definitionByKey.get(key)));
    const keys = Object.freeze(normalizedDefinitions.map((definition) => definition.key));
    const groupKeys = new Map();
    const preloadKeys = new Map();

    normalizedDefinitions.forEach((definition) => {
      const groupList = groupKeys.get(definition.group) || [];
      groupList.push(definition.key);
      groupKeys.set(definition.group, groupList);

      definition.preloadGroups.forEach((group) => {
        const groupList = preloadKeys.get(group) || [];
        groupList.push(definition.key);
        preloadKeys.set(group, groupList);
      });
    });

    function getAssetDefinition(key = '') {
      return definitionByKey.get(normalizeKey(key)) || null;
    }

    function getAssetPath(key = '', fallbackPath = '') {
      return getAssetDefinition(key)?.path || normalizeKey(fallbackPath);
    }

    function getAssetPaths(assetKeys = [], options = {}) {
      const fallbackByKey = options.fallbackByKey && typeof options.fallbackByKey === 'object'
        ? options.fallbackByKey
        : {};
      const paths = (Array.isArray(assetKeys) ? assetKeys : [])
        .map((key) => getAssetPath(key, fallbackByKey[key] || ''))
        .filter(Boolean);
      return options.dedupe === false ? paths : unique(paths);
    }

    function getPreloadAssetKeys(group = DEFAULT_PRELOAD_GROUP) {
      return [...(preloadKeys.get(normalizeKey(group || DEFAULT_PRELOAD_GROUP)) || [])];
    }

    function getPreloadAssetPaths(group = DEFAULT_PRELOAD_GROUP) {
      return getAssetPaths(getPreloadAssetKeys(group));
    }

    function getGroupAssetKeys(group = '') {
      return [...(groupKeys.get(normalizeKey(group)) || [])];
    }

    return Object.freeze({
      version: ASSET_KEY_REGISTRY_VERSION,
      definitions: normalizedDefinitions,
      keys,
      getAssetDefinition,
      getAssetPath,
      getAssetPaths,
      getPreloadAssetKeys,
      getPreloadAssetPaths,
      getGroupAssetKeys,
    });
  }

  const defaultRegistry = createRegistry(ASSET_DEFINITIONS);

  const AssetKeyRegistry = Object.freeze({
    version: ASSET_KEY_REGISTRY_VERSION,
    definitions: defaultRegistry.definitions,
    keys: defaultRegistry.keys,
    createRegistry,
    extend(extraDefinitions = []) {
      return createRegistry([...ASSET_DEFINITIONS, ...(Array.isArray(extraDefinitions) ? extraDefinitions : [])]);
    },
    getAssetDefinition: defaultRegistry.getAssetDefinition,
    getAssetPath: defaultRegistry.getAssetPath,
    getAssetPaths: defaultRegistry.getAssetPaths,
    getPreloadAssetKeys: defaultRegistry.getPreloadAssetKeys,
    getPreloadAssetPaths: defaultRegistry.getPreloadAssetPaths,
    getGroupAssetKeys: defaultRegistry.getGroupAssetKeys,
  });

  global.AssetKeyRegistry = AssetKeyRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = AssetKeyRegistry;
})(typeof window !== 'undefined' ? window : globalThis);

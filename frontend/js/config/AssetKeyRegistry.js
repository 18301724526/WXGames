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

    asset('spine:tutorial-advisor:texture', 'tutorial', 'assets/art/spine/tutorial/advisor/tutorial_advisor.png'),
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

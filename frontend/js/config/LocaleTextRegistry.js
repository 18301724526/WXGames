(function (global) {
  const LOCALE_TEXT_REGISTRY_VERSION = 'locale-text-registry-v1';
  const DEFAULT_LOCALE = 'zh-CN';

  function freezeCatalog(catalog = {}) {
    return Object.freeze({ ...(catalog || {}) });
  }

  const CATALOGS = Object.freeze({
    'zh-CN': freezeCatalog({
      'common.close.short': 'x',
      'world.targetPicker.title': '选择目标',
      'world.targetPicker.kind.actor': '部队',
      'world.targetPicker.kind.site': '城池',
      'world.targetPicker.kind.generic': '目标',
      'world.targetPicker.candidateFallback': '目标',
      'world.march.target.unknownTerrain': '未知',
      'world.march.target.genericTerrain': '地形',
      'world.march.target.unknownTitle': '未知区域',
      'world.march.target.knownSubtitle': '已侦明地形',
      'world.march.target.unknownSubtitle': '派遣队伍揭开迷雾',
      'world.march.command.march': '行军',
      'world.march.formationPicker.title': '选择出征队伍',
      'world.march.formation.defaultName': '队伍{index}',
      'world.march.formation.empty': '未编队',
      'world.march.formation.busy': '行军中',
      'world.march.formation.start': '出征',
      'world.march.actor.defaultScout': '侦察队',
      'world.march.actor.return': '回城',
      'world.march.actor.stop': '停止',
      'world.combat.hostileForce.title': '敌军',
      'world.combat.hostileForce.subtitle': '敌方部队',
      'world.combat.hostileForce.soldierCount': '{soldiers} 名士兵',
      'world.combat.attack': '进攻',
      'world.map.polity.unnamed': '未命名政体',
      'world.map.territory.controlledFallback': '{controlled}/{total} 已控制',
      'world.map.homeButton': '回中',
      'world.map.tileCount': '{count} 格',
      'world.map.emptyExploration': '派遣侦察队揭开外部世界。',
      'world.site.defaultName': '地点',
      'world.site.owner.playerShort': '己',
      'world.site.owner.neutralShort': '中',
    }),
    'en-US': freezeCatalog({
      'common.close.short': 'x',
      'world.targetPicker.title': 'Choose Target',
      'world.targetPicker.kind.actor': 'Unit',
      'world.targetPicker.kind.site': 'City',
      'world.targetPicker.kind.generic': 'Target',
      'world.targetPicker.candidateFallback': 'Target',
      'world.march.target.unknownTerrain': 'Unknown',
      'world.march.target.genericTerrain': 'Terrain',
      'world.march.target.unknownTitle': 'Unknown Area',
      'world.march.target.knownSubtitle': 'Terrain scouted',
      'world.march.target.unknownSubtitle': 'Send a unit to reveal the fog',
      'world.march.command.march': 'March',
      'world.march.formationPicker.title': 'Choose Formation',
      'world.march.formation.defaultName': 'Formation {index}',
      'world.march.formation.empty': 'Empty',
      'world.march.formation.busy': 'Marching',
      'world.march.formation.start': 'Deploy',
      'world.march.actor.defaultScout': 'Scout',
      'world.march.actor.return': 'Return',
      'world.march.actor.stop': 'Stop',
      'world.combat.hostileForce.title': 'Hostile Force',
      'world.combat.hostileForce.subtitle': 'Hostile force',
      'world.combat.hostileForce.soldierCount': '{soldiers} soldiers',
      'world.combat.attack': 'Attack',
      'world.map.polity.unnamed': 'Unnamed polity',
      'world.map.territory.controlledFallback': '{controlled}/{total} controlled',
      'world.map.homeButton': 'Home',
      'world.map.tileCount': '{count} tiles',
      'world.map.emptyExploration': 'Send scouts to reveal the outer world here.',
      'world.site.defaultName': 'Site',
      'world.site.owner.playerShort': 'P',
      'world.site.owner.neutralShort': 'N',
    }),
  });

  function normalizeKey(value = '') {
    return String(value || '').trim();
  }

  function normalizeLocaleForCatalogs(value = DEFAULT_LOCALE, catalogs = CATALOGS) {
    const raw = String(value || '')
      .trim()
      .replace(/_/g, '-');
    const lower = raw.toLowerCase();
    if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower === 'zh-hans-cn') {
      return 'zh-CN';
    }
    if (lower === 'en' || lower === 'en-us') return 'en-US';
    return Object.prototype.hasOwnProperty.call(catalogs, raw) ? raw : DEFAULT_LOCALE;
  }

  function normalizeCatalogs(catalogs = CATALOGS) {
    const result = {};
    Object.entries(catalogs || {}).forEach(([locale, catalog]) => {
      const normalizedLocale = normalizeLocaleForCatalogs(locale, catalogs);
      result[normalizedLocale] = freezeCatalog(catalog);
    });
    return Object.freeze(result);
  }

  function createRegistry(catalogs = CATALOGS, options = {}) {
    const normalizedCatalogs = normalizeCatalogs(catalogs);
    const defaultLocale = normalizeLocaleForCatalogs(
      options.defaultLocale || DEFAULT_LOCALE,
      normalizedCatalogs,
    );
    const supportedLocales = Object.freeze(Object.keys(normalizedCatalogs));

    function normalizeLocale(locale = defaultLocale) {
      return normalizeLocaleForCatalogs(locale, normalizedCatalogs);
    }

    function getCatalog(locale = defaultLocale) {
      return normalizedCatalogs[normalizeLocale(locale)] || normalizedCatalogs[defaultLocale] || {};
    }

    function getText(key = '', locale = defaultLocale) {
      const normalizedKey = normalizeKey(key);
      if (!normalizedKey) return null;
      const catalog = getCatalog(locale);
      if (Object.prototype.hasOwnProperty.call(catalog, normalizedKey)) {
        return catalog[normalizedKey];
      }
      const fallbackCatalog = getCatalog(defaultLocale);
      return Object.prototype.hasOwnProperty.call(fallbackCatalog, normalizedKey)
        ? fallbackCatalog[normalizedKey]
        : null;
    }

    function hasKey(key = '', locale = defaultLocale) {
      const normalizedKey = normalizeKey(key);
      return Object.prototype.hasOwnProperty.call(getCatalog(locale), normalizedKey);
    }

    function getMissingKeys(referenceLocale = defaultLocale) {
      const reference = getCatalog(referenceLocale);
      const referenceKeys = Object.keys(reference);
      return Object.freeze(
        Object.fromEntries(
          supportedLocales.map((locale) => [
            locale,
            Object.freeze(referenceKeys.filter((key) => !hasKey(key, locale))),
          ]),
        ),
      );
    }

    return Object.freeze({
      version: LOCALE_TEXT_REGISTRY_VERSION,
      defaultLocale,
      supportedLocales,
      catalogs: normalizedCatalogs,
      getCatalog,
      getMissingKeys,
      getText,
      hasKey,
      normalizeLocale,
    });
  }

  const defaultRegistry = createRegistry(CATALOGS);

  const LocaleTextRegistry = Object.freeze({
    version: LOCALE_TEXT_REGISTRY_VERSION,
    DEFAULT_LOCALE,
    CATALOGS,
    createRegistry,
    defaultLocale: defaultRegistry.defaultLocale,
    supportedLocales: defaultRegistry.supportedLocales,
    getCatalog: defaultRegistry.getCatalog,
    getMissingKeys: defaultRegistry.getMissingKeys,
    getText: defaultRegistry.getText,
    hasKey: defaultRegistry.hasKey,
    normalizeLocale: defaultRegistry.normalizeLocale,
  });

  global.LocaleTextRegistry = LocaleTextRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = LocaleTextRegistry;
})(typeof window !== 'undefined' ? window : globalThis);

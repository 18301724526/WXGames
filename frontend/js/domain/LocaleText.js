(function (global) {
  const LocaleTextRegistry = (() => {
    if (global.LocaleTextRegistry) return global.LocaleTextRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../config/LocaleTextRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const LOCALE_STORAGE_KEY = 'wxgame_locale';
  let activeLocale = '';

  function normalizeLocale(value = '') {
    return (
      LocaleTextRegistry?.normalizeLocale?.(value) || LocaleTextRegistry?.DEFAULT_LOCALE || 'zh-CN'
    );
  }

  function readStoredLocale() {
    try {
      return global.localStorage?.getItem?.(LOCALE_STORAGE_KEY) || '';
    } catch (_error) {
      return '';
    }
  }

  function writeStoredLocale(locale = '') {
    try {
      global.localStorage?.setItem?.(LOCALE_STORAGE_KEY, locale);
    } catch (_error) {
      // Ignore storage failures; language selection still works in memory.
    }
  }

  function readBrowserLocale() {
    return global.navigator?.language || global.navigator?.languages?.[0] || '';
  }

  function getLocale(options = {}) {
    if (options.locale) return normalizeLocale(options.locale);
    if (activeLocale) return normalizeLocale(activeLocale);
    const globalLocale = global.__wxgameLocale || '';
    if (globalLocale) return normalizeLocale(globalLocale);
    return normalizeLocale(readStoredLocale() || readBrowserLocale());
  }

  function setLocale(locale = '') {
    activeLocale = normalizeLocale(locale);
    global.__wxgameLocale = activeLocale;
    writeStoredLocale(activeLocale);
    return activeLocale;
  }

  function interpolate(template = '', params = {}) {
    return String(template || '').replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key) => {
      if (!Object.prototype.hasOwnProperty.call(params || {}, key)) return match;
      const value = params[key];
      return value === null || value === undefined ? '' : String(value);
    });
  }

  function t(key = '', params = {}, options = {}) {
    const locale = getLocale(options);
    const template = LocaleTextRegistry?.getText?.(key, locale);
    if (template === null || template === undefined) return options.fallback ?? String(key || '');
    return interpolate(template, params);
  }

  function createTranslator(options = {}) {
    return (key = '', params = {}, overrides = {}) => t(key, params, { ...options, ...overrides });
  }

  const LocaleText = Object.freeze({
    version: 'locale-text-v1',
    createTranslator,
    getLocale,
    getMissingKeys: LocaleTextRegistry?.getMissingKeys || (() => Object.freeze({})),
    getSupportedLocales: () => [...(LocaleTextRegistry?.supportedLocales || [])],
    interpolate,
    normalizeLocale,
    setLocale,
    t,
    translate: t,
  });

  global.LocaleText = LocaleText;
  if (typeof module !== 'undefined' && module.exports) module.exports = LocaleText;
})(typeof window !== 'undefined' ? window : globalThis);

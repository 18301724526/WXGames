(function (global) {
  // Resolved at call time (not module load) to stay immune to script load order.
  function resolveLocaleText() {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  // Canonical display order for known resources; unknown positive keys are appended after.
  const RESOURCE_KEYS = ['food', 'wood', 'iron', 'knowledge', 'stone', 'metal'];

  function translate(key, params, options = {}) {
    const localeText = resolveLocaleText();
    return localeText ? localeText.t(key, params, options) : (options.fallback ?? key);
  }

  // Localize a structured reward { food: 120, knowledge: 5 } into "粮食+120 / 知识+5",
  // or the empty-reward label when there is nothing positive to show. Used by every
  // reward display (task list, claim toast, reward reveal) so the server's pre-baked
  // English rewardText never needs to be shown.
  function formatResources(resources = {}) {
    const safe = resources && typeof resources === 'object' ? resources : {};
    const keys = RESOURCE_KEYS.filter((key) => Number(safe[key]) > 0);
    for (const key of Object.keys(safe)) {
      if (!RESOURCE_KEYS.includes(key) && Number(safe[key]) > 0) keys.push(key);
    }
    // Unknown reward fields (new backend reward types) fall back to the raw field
    // name instead of leaking the bare `resource.*` key.
    const parts = keys.map(
      (key) => `${translate(`resource.${key}`, {}, { fallback: key })}+${safe[key]}`,
    );
    return parts.length ? parts.join(' / ') : translate('task.reward.none');
  }

  // True when a structured reward actually carries something to show.
  function hasResources(resources = {}) {
    const safe = resources && typeof resources === 'object' ? resources : {};
    return Object.keys(safe).some((key) => Number(safe[key]) > 0);
  }

  const RewardText = Object.freeze({ RESOURCE_KEYS, formatResources, hasResources });

  global.RewardText = RewardText;
  if (typeof module !== 'undefined' && module.exports) module.exports = RewardText;
})(typeof window !== 'undefined' ? window : globalThis);

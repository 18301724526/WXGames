(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class ShellPresenter {
    static POPULATION_PER_OFFICIAL = 100;

    static toNumber(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    static toInteger(value, fallback = 0) {
      return Math.floor(this.toNumber(value, fallback));
    }

    static t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    static trimDecimal(value) {
      const text = `${value}`;
      return text.endsWith('.0') ? text.slice(0, -2) : text;
    }

    static formatCompactNumber(value, options = {}) {
      const number = this.toNumber(value);
      const floorSmall = options.floorSmall !== false;
      const sign = number < 0 ? '-' : '';
      const abs = Math.abs(number);
      if (abs < 1000) {
        return floorSmall ? Math.floor(number) : this.trimDecimal(Math.round(number * 100) / 100);
      }
      const units = [
        { value: 1_000_000_000_000, suffix: 'T' },
        { value: 1_000_000_000, suffix: 'G' },
        { value: 1_000_000, suffix: 'M' },
        { value: 1_000, suffix: 'k' },
      ];
      const unit = units.find((item) => abs >= item.value) || units[units.length - 1];
      const scaled = Math.floor((abs / unit.value) * 10) / 10;
      return `${sign}${this.trimDecimal(scaled.toFixed(1))}${unit.suffix}`;
    }

    static formatResourceAmount(value) {
      return this.formatCompactNumber(value, { floorSmall: true });
    }

    static formatRate(value) {
      const number = this.toNumber(value);
      return `${number >= 0 ? '+' : ''}${this.formatCompactNumber(number, { floorSmall: false })}/s`;
    }

    static toDisplayPopulation(officials) {
      return this.toInteger(officials) * this.POPULATION_PER_OFFICIAL;
    }

    static formatNegativeRate(value) {
      return `-${this.formatCompactNumber(Math.abs(this.toNumber(value)), { floorSmall: false })}/s`;
    }

    static buildAuthCredentialViewState(credentials = {}) {
      const rememberPasswordChecked = Boolean(credentials.rememberEnabled);
      return {
        rememberPasswordChecked,
        usernameValue: credentials.rememberedUsername || credentials.username || '',
        passwordValue: '',
      };
    }

    static buildAuthShellViewState(options = {}) {
      const authenticated = Boolean(options.authenticated);
      return {
        loginPanelVisible: !authenticated,
        appVisible: authenticated,
        message: authenticated ? '' : (options.message || ''),
      };
    }

    static buildTabNavigationViewState(state = {}, options = {}) {
      const requestedTab = options.requestedTab || state.currentTab || 'resources';
      const activeTab = requestedTab === 'territory' ? 'military' : requestedTab;
      const tabs = ['resources', 'civilization', 'buildings', 'events', 'military'];
      const pages = ['resources', 'civilization', 'buildings', 'events', 'military'];
      return {
        activeTab,
        requestedTab,
        tabs: tabs.map((id) => ({
          id,
          isActive: id === activeTab,
        })),
        pages: pages.map((id) => ({
          id,
          isActive: id === activeTab,
        })),
      };
    }

    static hasWorldTileMap(state = {}) {
      const tiles = state?.territoryState?.worldMap?.tiles;
      return Array.isArray(tiles) && tiles.length > 0;
    }

    static canUseMapHome() {
      return true;
    }

    static resolveMapHomeViewState(state = {}, options = {}) {
      const requestedTab = options.requestedTab || options.activeTab || state.currentTab || 'resources';
      const activeTab = requestedTab === 'territory' ? 'military' : requestedTab;
      const requestedMilitaryView = ['army', 'scout', 'world', 'veteranCamp'].includes(options.militaryView)
        ? options.militaryView
        : (['army', 'scout', 'world', 'veteranCamp'].includes(state.militaryView) ? state.militaryView : 'army');
      const canUseMapHome = this.canUseMapHome(state);
      const homeRequested = !requestedTab || requestedTab === 'resources' || requestedTab === 'territory';
      const forceMapHome = Boolean(options.forceMapHome || options.isMapHome);
      const militaryMapRequested = requestedTab === 'military'
        && (forceMapHome || requestedMilitaryView === 'world');
      const shouldUseMapHome = canUseMapHome
        && options.allowDefaultMapHome !== false
        && (forceMapHome || homeRequested || militaryMapRequested);
      const resolvedActiveTab = shouldUseMapHome ? 'military' : activeTab;
      const resolvedMilitaryView = shouldUseMapHome ? 'world' : requestedMilitaryView;
      return {
        activeTab: resolvedActiveTab,
        requestedTab,
        militaryView: resolvedMilitaryView,
        isMapHome: shouldUseMapHome,
        canUseMapHome,
      };
    }

    static buildTabLockViewState(tabs = [], canOpenTab = () => true) {
      return tabs.map((tab) => {
        const id = tab.id || tab.tabId || '';
        const allowed = Boolean(canOpenTab(id));
        return {
          id,
          disabled: !allowed,
          isLocked: !allowed,
        };
      });
    }

    static buildNamingPromptViewState(prompt = {}) {
      const type = prompt?.type || '';
      return {
        title: prompt?.title || this.t('shell.naming.title'),
        message: prompt?.message || '',
        placeholder: type === 'polity'
          ? this.t('shell.naming.placeholder.polity')
          : this.t('shell.naming.placeholder.city'),
        maxLength: 12,
        key: `${type}:${prompt?.territoryId || 'polity'}`,
        prompt: prompt || null,
      };
    }

    static buildRecentLogViewState(entries = []) {
      const items = (entries || []).slice(0, 20).map((entry) => ({
        text: typeof entry === 'string' ? entry : (entry?.text ?? ''),
      }));
      return {
        isEmpty: items.length === 0,
        emptyText: this.t('common.log.empty'),
        items,
      };
    }

    static buildRequestLogViewState(logs = []) {
      const items = (logs || []).slice(0, 20).map((log) => {
        const statusCode = this.toInteger(log.statusCode);
        return {
          timestamp: log.timestamp || '',
          endpoint: `${log.method || ''} ${log.path || ''}`.trim(),
          statusCode,
          durationText: `${this.toInteger(log.duration)}ms`,
          isError: statusCode >= 400 || statusCode === 0,
        };
      });
      return {
        isEmpty: items.length === 0,
        emptyText: this.t('common.requestLog.empty'),
        items,
      };
    }

    static buildTerritorySummaryViewState(territoryState = {}) {
      const polityName = territoryState.polity?.name || territoryState.polity?.capitalCityName || this.t('world.map.polity.unnamed');
      return {
        text: {
          polityName,
          territoryCount: this.t('world.map.territory.controlledFallback', {
            controlled: territoryState.occupiedCount || 0,
            total: territoryState.discoveredCount || 0,
          }),
        },
      };
    }
  }

  global.ShellPresenter = ShellPresenter;
  if (typeof module !== 'undefined' && module.exports) module.exports = ShellPresenter;
})(typeof window !== 'undefined' ? window : globalThis);

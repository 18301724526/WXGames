(function (global) {
  // Descriptor table only. Runtime support and dispatch stay in
  // CanvasActionDispatchRegistry; this file is not the panel module registry.
  const CUSTOM_DESCRIPTORS = new Map();

  const FAMOUS_PANEL_KEY = 'famousPersons';

  const DESCRIPTORS = Object.freeze({
    openFamousPersons: Object.freeze({
      type: 'openFamousPersons',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'open',
      dirty: ['modal'],
      hooks: Object.freeze({
        beforeOpen: ['tutorialCanOpenTab'],
        veto: ['tutorialVetoFeedback'],
        afterOpen: ['tutorialOnOpened', 'tutorialRefreshNow', 'tutorialRefreshNextTick'],
      }),
    }),
    closeFamousPersons: Object.freeze({
      type: 'closeFamousPersons',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'close',
      dirty: ['modal'],
      hooks: Object.freeze({
        afterClose: ['tutorialOnClosed', 'tutorialRefreshNow', 'tutorialRefreshNextTick'],
      }),
    }),
    changeFamousPersonsPage: Object.freeze({
      type: 'changeFamousPersonsPage',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'action',
      actionName: 'changePage',
      dirty: ['modal'],
    }),
    openFamousPersonDetail: Object.freeze({
      type: 'openFamousPersonDetail',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'action',
      actionName: 'openDetail',
      dirty: ['modal'],
      hooks: Object.freeze({
        afterAction: ['tutorialOnDetailOpened', 'tutorialRefreshNow', 'tutorialRefreshNextTick'],
      }),
    }),
    closeFamousPersonDetail: Object.freeze({
      type: 'closeFamousPersonDetail',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'action',
      actionName: 'closeDetail',
      dirty: ['modal'],
      hooks: Object.freeze({
        afterAction: ['tutorialRefreshNow', 'tutorialRefreshNextTick'],
      }),
    }),
    showFamousSkillTooltip: Object.freeze({
      type: 'showFamousSkillTooltip',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'action',
      actionName: 'showTooltip',
      dirty: ['modal'],
    }),
    clearFamousSkillTooltip: Object.freeze({
      type: 'clearFamousSkillTooltip',
      panelKey: FAMOUS_PANEL_KEY,
      operation: 'action',
      actionName: 'clearTooltip',
      dirty: ['modal'],
    }),
  });

  const PANEL_OUTSIDE_CLOSE_ACTIONS = Object.freeze({
    [FAMOUS_PANEL_KEY]: 'closeFamousPersons',
  });

  function cloneDescriptor(descriptor = null) {
    if (!descriptor) return null;
    return {
      ...descriptor,
      dirty: Array.isArray(descriptor.dirty) ? [...descriptor.dirty] : [],
      hooks: descriptor.hooks ? { ...descriptor.hooks } : undefined,
    };
  }

  function resolve(action = {}) {
    const type = action?.type || '';
    if (type === 'panelOutsideClick') {
      const panelKey = action.panelKey || '';
      if (!PANEL_OUTSIDE_CLOSE_ACTIONS[panelKey]) return null;
      return {
        type,
        panelKey,
        operation: 'outsideClick',
        closeActionType: PANEL_OUTSIDE_CLOSE_ACTIONS[panelKey],
        dirty: ['modal'],
      };
    }
    return cloneDescriptor(CUSTOM_DESCRIPTORS.get(type) || DESCRIPTORS[type] || null);
  }

  function has(action = {}) {
    return Boolean(resolve(action));
  }

  function supportedActions() {
    return Array.from(new Set([
      ...Object.keys(DESCRIPTORS),
      ...Array.from(CUSTOM_DESCRIPTORS.keys()),
      'panelOutsideClick',
    ]));
  }

  function register(panelKey = '', descriptor = {}) {
    const type = descriptor?.type || '';
    if (!type) return false;
    CUSTOM_DESCRIPTORS.set(type, {
      ...descriptor,
      panelKey: descriptor.panelKey || panelKey,
    });
    return true;
  }

  const api = {
    resolve,
    has,
    supportedActions,
    register,
  };

  global.CanvasPanelActionRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);


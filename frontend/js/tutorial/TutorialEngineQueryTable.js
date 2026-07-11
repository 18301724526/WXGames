(function (global) {
  const QUERY_DEFINITIONS = Object.freeze({
    isTaskCenterOpen: Object.freeze({
      hostMethod: 'isTaskCenterOpen',
      justification: 'One step selects openTaskCenter or claimTaskReward from modal state; a fixed step and target cannot encode both branches.',
    }),
    isCommandPanelOpen: Object.freeze({
      hostMethod: 'isCommandPanelOpen',
      justification: 'One step must stop requesting a named panel after it opens; a fixed step and target do not encode the active panel state.',
    }),
  });

  class TutorialEngineQueryTable {
    constructor(options = {}) {
      this.context = options.context || options.host || null;
    }

    has(queryName = '') {
      return Object.prototype.hasOwnProperty.call(QUERY_DEFINITIONS, queryName);
    }

    invoke(queryName = '', ...args) {
      const definition = QUERY_DEFINITIONS[queryName];
      if (!definition) {
        throw new TypeError(`TutorialEngineQueryTable unknown query: ${queryName}`);
      }
      const method = this.context?.[definition.hostMethod];
      if (typeof method !== 'function') {
        throw new TypeError(`TutorialEngineQueryTable missing host method: ${definition.hostMethod}`);
      }
      return Boolean(method.apply(this.context, args));
    }
  }

  function create(options = {}) {
    return new TutorialEngineQueryTable(options);
  }

  const api = {
    QUERY_DEFINITIONS,
    TutorialEngineQueryTable,
    create,
  };

  global.TutorialEngineQueryTable = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

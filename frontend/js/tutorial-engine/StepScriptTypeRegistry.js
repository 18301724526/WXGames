(function (global) {
  function copyData(value) {
    if (Array.isArray(value)) return value.map(copyData);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyData(entry)]));
  }

  function queryMatches(ctx, condition = {}) {
    if (!ctx || typeof ctx.queries !== 'function') {
      throw new TypeError(`StepScript query unavailable: ${condition.query || ''}`);
    }
    const actual = ctx.queries(condition.query, ...(condition.args || []));
    const expected = Object.prototype.hasOwnProperty.call(condition, 'equals')
      ? condition.equals
      : true;
    return Object.is(actual, expected);
  }

  function matchesWhen(when, ctx) {
    if (when === undefined || when === null || when === true) return true;
    if (when === false) return false;
    if (!when || typeof when !== 'object' || Array.isArray(when)) {
      throw new TypeError('StepScript when must be declarative data');
    }
    if (Array.isArray(when.all)) return when.all.every((condition) => matchesWhen(condition, ctx));
    if (Array.isArray(when.any)) return when.any.some((condition) => matchesWhen(condition, ctx));
    if (when.not !== undefined) return !matchesWhen(when.not, ctx);
    if (typeof when.query === 'string' && when.query) return queryMatches(ctx, when);
    throw new TypeError('StepScript when is missing a supported condition');
  }

  function highlightInstruction(script = {}, clause = {}) {
    return {
      type: 'highlightActionWait',
      target: String(clause.target || script.target || ''),
      messageKey: String(clause.messageKey || script.messageKey || ''),
      eventName: String(clause.eventName || script.eventName || ''),
      panel: String(clause.panel || script.panel || ''),
    };
  }

  function evaluateHighlightActionWait(script = {}, ctx = null) {
    const clauses = Array.isArray(script.clauses) ? script.clauses : [script];
    const clause = clauses.find((candidate) => matchesWhen(candidate?.when, ctx));
    if (!clause) return { matchedRuleId: '', instructions: [] };
    return {
      matchedRuleId: String(clause.ruleId || script.ruleId || ''),
      instructions: [highlightInstruction(script, clause)],
    };
  }

  function evaluateEnsureSurfaceThenHighlight(script = {}, ctx = null) {
    if (!matchesWhen(script.when, ctx)) return { matchedRuleId: '', instructions: [] };
    return {
      matchedRuleId: String(script.ruleId || ''),
      instructions: [{
        type: 'ensureSurfaceThenHighlight',
        panel: String(script.panel || ''),
        target: String(script.target || ''),
        messageKey: String(script.messageKey || ''),
        eventName: String(script.eventName || ''),
      }],
    };
  }

  function evaluateWaitEventThenNext(script = {}, ctx = null) {
    if (!matchesWhen(script.when, ctx)) return { matchedRuleId: '', instructions: [] };
    return {
      matchedRuleId: String(script.ruleId || ''),
      instructions: [{
        type: 'waitEventThenNext',
        eventName: String(script.eventName || ''),
        nextStep: String(script.nextStep || ''),
      }],
    };
  }

  const SCRIPT_TYPES = Object.freeze({
    highlightActionWait: evaluateHighlightActionWait,
    ensureSurfaceThenHighlight: evaluateEnsureSurfaceThenHighlight,
    waitEventThenNext: evaluateWaitEventThenNext,
  });

  const SCRIPT_TYPE_NAMES = Object.freeze(Object.keys(SCRIPT_TYPES));

  function get(scriptType = '') {
    return SCRIPT_TYPES[scriptType] || null;
  }

  const api = {
    SCRIPT_TYPES,
    SCRIPT_TYPE_NAMES,
    copyData,
    get,
    matchesWhen,
  };

  global.TutorialStepScriptTypeRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

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

  function resolveOrderedTarget(ctx, clause = {}) {
    if (!ctx || typeof ctx.resolveTarget !== 'function') {
      throw new TypeError(`StepScript target resolver unavailable: ${clause.target || ''}`);
    }
    const resolution = ctx.resolveTarget('resolveStepScriptTarget', {
      target: String(clause.target || ''),
      targetArgs: copyData(clause.targetArgs || {}),
      action: copyData(clause.action || {}),
    });
    return resolution === true || resolution?.available === true;
  }

  function cursorMatches(clause = {}, runtime = {}) {
    const clauseCursor = String(clause.cursor || '');
    return !clauseCursor || clauseCursor === String(runtime.cursor || '');
  }

  function orderedTargetInstruction(clause = {}) {
    return {
      type: 'orderedTargetFlow',
      target: String(clause.target || ''),
      targetArgs: copyData(clause.targetArgs || {}),
      action: copyData(clause.action || {}),
      messageKey: String(clause.messageKey || ''),
      eventName: String(clause.eventName || ''),
      eventFilter: copyData(clause.eventFilter || {}),
      nextCursor: String(clause.nextCursor || ''),
      nextStep: String(clause.nextStep || ''),
    };
  }

  function evaluateOrderedTargetFlow(script = {}, ctx = null, runtime = {}) {
    const clauses = Array.isArray(script.clauses) ? script.clauses : [];
    const clause = clauses.find((candidate) => (
      cursorMatches(candidate, runtime) && resolveOrderedTarget(ctx, candidate)
    ));
    if (clause) {
      return {
        matchedRuleId: String(clause.ruleId || script.ruleId || ''),
        instructions: [orderedTargetInstruction(clause)],
      };
    }
    const nextStep = String(script.nextStep || '');
    return {
      matchedRuleId: String(script.ruleId || ''),
      instructions: nextStep ? [{ type: 'nextStep', nextStep }] : [],
    };
  }

  function matchesEventFilter(expected, actual) {
    if (expected === undefined) return true;
    if (!expected || typeof expected !== 'object') return Object.is(actual, expected);
    if (!actual || typeof actual !== 'object') return false;
    if (Array.isArray(expected)) {
      return Array.isArray(actual)
        && expected.length === actual.length
        && expected.every((entry, index) => matchesEventFilter(entry, actual[index]));
    }
    return Object.entries(expected).every(([key, value]) => (
      matchesEventFilter(value, actual[key])
    ));
  }

  function matchOrderedTargetFlowEvent(script = {}, eventName = '', payload = {}, runtime = {}) {
    const clauses = Array.isArray(script.clauses) ? script.clauses : [];
    const clause = clauses.find((candidate) => (
      cursorMatches(candidate, runtime)
      && String(candidate.eventName || '') === String(eventName || '')
      && matchesEventFilter(candidate.eventFilter, payload)
    ));
    if (!clause) return null;
    return {
      matchedRuleId: String(clause.ruleId || script.ruleId || ''),
      nextCursor: String(clause.nextCursor || ''),
      nextStep: String(clause.nextStep || ''),
    };
  }

  const SCRIPT_TYPES = Object.freeze({
    highlightActionWait: evaluateHighlightActionWait,
    ensureSurfaceThenHighlight: evaluateEnsureSurfaceThenHighlight,
    waitEventThenNext: evaluateWaitEventThenNext,
    orderedTargetFlow: evaluateOrderedTargetFlow,
  });

  const EVENT_MATCHERS = Object.freeze({
    orderedTargetFlow: matchOrderedTargetFlowEvent,
  });

  const SCRIPT_TYPE_NAMES = Object.freeze(Object.keys(SCRIPT_TYPES));

  function get(scriptType = '') {
    return SCRIPT_TYPES[scriptType] || null;
  }

  function matchEvent(scriptType = '', script = {}, eventName = '', payload = {}, runtime = {}) {
    return EVENT_MATCHERS[scriptType]?.(script, eventName, payload, runtime) || null;
  }

  const api = {
    SCRIPT_TYPES,
    SCRIPT_TYPE_NAMES,
    copyData,
    get,
    matchEvent,
    matchesEventFilter,
    matchesWhen,
  };

  global.TutorialStepScriptTypeRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

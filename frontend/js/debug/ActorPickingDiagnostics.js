(function (global) {
  let preferenceProvider = null;

  function setPreferenceProvider(provider = null) {
    preferenceProvider = provider && typeof provider === 'object' ? provider : null;
    return preferenceProvider;
  }

  function readProviderFlag(methodName = '') {
    try {
      const reader = preferenceProvider?.[methodName];
      return typeof reader === 'function' ? reader() === true : false;
    } catch (_error) {
      return false;
    }
  }

  function isEnabled() {
    return global.__actorPickingDiag === true || readProviderFlag('isEnabled');
  }

  function isVerbose() {
    return global.__actorPickingDiagVerbose === true || readProviderFlag('isVerbose');
  }

  function getRecentEvents(limit = 20) {
    const events = Array.isArray(global.__actorPickingDiagEvents)
      ? global.__actorPickingDiagEvents
      : [];
    return events.slice(Math.max(0, events.length - limit));
  }

  function createTapTraceId(now = Date.now()) {
    const sequence = (Number(global.__actorPickingDiagTapSequence) || 0) + 1;
    global.__actorPickingDiagTapSequence = sequence;
    return `tap-${now}-${sequence}`;
  }

  function log(stage = '', detail = {}, options = {}) {
    if (!isEnabled()) return null;
    const tapTraceId = detail?.tapTraceId || global.__actorPickingDiagActiveTapTraceId || '';
    const payload = {
      at: new Date().toISOString(),
      stage,
      ...(tapTraceId ? { tapTraceId } : {}),
      ...detail,
    };
    try {
      if (payload.tapTraceId) global.__actorPickingDiagActiveTapTraceId = payload.tapTraceId;
      const events = global.__actorPickingDiagEvents || [];
      const signature = options.signature || '';
      const effectiveSignature =
        signature && payload.tapTraceId ? `${payload.tapTraceId}|${signature}` : signature;
      global.__actorPickingDiagLastSignatureByStage =
        global.__actorPickingDiagLastSignatureByStage || {};
      if (
        effectiveSignature &&
        events.length &&
        global.__actorPickingDiagLastSignatureByStage[stage] === effectiveSignature
      ) {
        return null;
      }
      if (effectiveSignature)
        global.__actorPickingDiagLastSignatureByStage[stage] = effectiveSignature;
      events.push(payload);
      while (events.length > 160) events.shift();
      global.__actorPickingDiagEvents = events;
      global.__actorPickingDiagLastByStage = global.__actorPickingDiagLastByStage || {};
      global.__actorPickingDiagLastByStage[stage] = payload;
    } catch (_error) {
      return payload;
    }
    try {
      if (isVerbose()) global.console?.log?.('[ActorPickingDiagVerbose]', JSON.stringify(payload));
    } catch (_error) {
      // Ignore diagnostic console failures.
    }
    return payload;
  }

  const api = Object.freeze({
    createTapTraceId,
    getRecentEvents,
    isEnabled,
    isVerbose,
    log,
    setPreferenceProvider,
  });

  global.ActorPickingDiagnostics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

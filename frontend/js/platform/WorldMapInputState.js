(function (global) {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function createWorldMapInputState(initial = {}) {
    return {
      hitTargets: toArray(initial.hitTargets),
      baseHitTargets: toArray(initial.baseHitTargets),
      lastHitTargetSync: initial.lastHitTargetSync || null,
      hitTargetSyncSequence: Number(initial.hitTargetSyncSequence) || 0,
      inputEpoch: Number(initial.inputEpoch) || 0,
      inputSequence: Number(initial.inputSequence) || 0,
      lastPickingSignature: initial.lastPickingSignature || '',
      pickingSnapshot: initial.pickingSnapshot || null,
      lastInputIntent: initial.lastInputIntent || null,
    };
  }

  function getHitTargets(inputState = null) {
    if (!inputState) return [];
    if (!Array.isArray(inputState.hitTargets)) inputState.hitTargets = [];
    return inputState.hitTargets;
  }

  function setHitTargets(inputState = null, targets = []) {
    if (!inputState) return [];
    inputState.hitTargets = toArray(targets);
    return inputState.hitTargets;
  }

  function getBaseHitTargets(inputState = null) {
    if (!inputState) return [];
    if (!Array.isArray(inputState.baseHitTargets)) inputState.baseHitTargets = [];
    return inputState.baseHitTargets;
  }

  function setBaseHitTargets(inputState = null, targets = []) {
    if (!inputState) return [];
    inputState.baseHitTargets = toArray(targets);
    return inputState.baseHitTargets;
  }

  function getLastHitTargetSync(inputState = null) {
    return inputState?.lastHitTargetSync || null;
  }

  function setLastHitTargetSync(inputState = null, sync = null) {
    if (!inputState) return null;
    inputState.lastHitTargetSync = sync || null;
    return inputState.lastHitTargetSync;
  }

  function getHitTargetSyncSequence(inputState = null) {
    return Number(inputState?.hitTargetSyncSequence) || 0;
  }

  function nextHitTargetSyncSequence(inputState = null) {
    if (!inputState) return 0;
    inputState.hitTargetSyncSequence = getHitTargetSyncSequence(inputState) + 1;
    return inputState.hitTargetSyncSequence;
  }

  function resetHitTargetState(inputState = null) {
    if (!inputState) return null;
    inputState.hitTargets = [];
    inputState.baseHitTargets = [];
    inputState.lastHitTargetSync = null;
    inputState.hitTargetSyncSequence = 0;
    return inputState;
  }

  function nextInputSequence(inputState = null) {
    if (!inputState) return 0;
    inputState.inputSequence = (Number(inputState.inputSequence) || 0) + 1;
    return inputState.inputSequence;
  }

  function getInputEpoch(inputState = null) {
    return Number(inputState?.inputEpoch) || 0;
  }

  function nextInputEpoch(inputState = null) {
    if (!inputState) return 0;
    inputState.inputEpoch = getInputEpoch(inputState) + 1;
    return inputState.inputEpoch;
  }

  function resetPickingState(inputState = null) {
    if (!inputState) return null;
    inputState.inputEpoch = 0;
    inputState.lastPickingSignature = '';
    inputState.pickingSnapshot = null;
    return inputState;
  }

  function clearPickingSnapshot(inputState = null) {
    if (!inputState) return null;
    inputState.lastPickingSignature = '';
    inputState.pickingSnapshot = null;
    return inputState;
  }

  function getPickingSnapshot(inputState = null) {
    return inputState?.pickingSnapshot || null;
  }

  function getLastPickingSignature(inputState = null) {
    return inputState?.lastPickingSignature || '';
  }

  function setPickingSnapshot(inputState = null, signature = '', snapshot = null) {
    if (!inputState) return null;
    inputState.lastPickingSignature = signature || '';
    inputState.pickingSnapshot = snapshot || null;
    return inputState.pickingSnapshot;
  }

  function setLastInputIntent(inputState = null, intent = null) {
    if (!inputState) return null;
    inputState.lastInputIntent = intent || null;
    return inputState.lastInputIntent;
  }

  function getLastInputIntent(inputState = null) {
    return inputState?.lastInputIntent || null;
  }

  function resetWorldMapInputState(inputState = null, options = {}) {
    if (!inputState) return null;
    resetHitTargetState(inputState);
    resetPickingState(inputState);
    inputState.lastInputIntent = null;
    if (options.resetInputSequence === true) inputState.inputSequence = 0;
    return inputState;
  }

  function commitHitTargetSync(inputState = null, payload = {}) {
    if (!inputState) return { hitTargets: [], sync: null };
    const baseHitTargets = setBaseHitTargets(inputState, payload.baseHitTargets);
    const hitTargets = setHitTargets(inputState, payload.hitTargets);
    const sequence = nextHitTargetSyncSequence(inputState);
    const sync = setLastHitTargetSync(inputState, {
      actorTargetCount: Number(payload.actorTargetCount) || 0,
      baseHitTargetCount: baseHitTargets.length,
      hitTargetCount: hitTargets.length,
      mapTargetCount: Number(payload.mapTargetCount) || 0,
      preserved: Boolean(payload.preserved),
      sequence,
      sourceHitTargetCount: Number(payload.sourceHitTargetCount) || 0,
      viewportOffsetX: Number(payload.viewportOffsetX) || 0,
      viewportOffsetY: Number(payload.viewportOffsetY) || 0,
    });
    return { hitTargets, sync };
  }

  const api = {
    clearPickingSnapshot,
    commitHitTargetSync,
    createWorldMapInputState,
    getBaseHitTargets,
    getHitTargets,
    getHitTargetSyncSequence,
    getInputEpoch,
    getLastHitTargetSync,
    getLastInputIntent,
    getLastPickingSignature,
    getPickingSnapshot,
    nextHitTargetSyncSequence,
    nextInputEpoch,
    nextInputSequence,
    resetHitTargetState,
    resetPickingState,
    resetWorldMapInputState,
    setBaseHitTargets,
    setHitTargets,
    setLastHitTargetSync,
    setLastInputIntent,
    setPickingSnapshot,
  };

  global.WorldMapInputState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

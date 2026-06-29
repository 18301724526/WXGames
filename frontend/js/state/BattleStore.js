(function (global) {
  'use strict';

  // state/BattleStore.js -- the single source of truth for the battle overlays.
  //
  // Two facts live here and nowhere else:
  //   - battleScene: the turn-card replay overlay (scalars + the report JSON blob).
  //   - entityBattle: the live mass-melee session object. The store holds the SAME
  //     reference the app steps every tick (the renderer mutates entityBattle._viewFit
  //     during draw), so this is a single owned object, NOT a frozen second copy.
  //
  // deriveActiveOverlay is a pure function so the precedence rule (entityBattle wins
  // over battleScene) has one definition. Reads never clone -- callers that need a
  // serializable snapshot go through the RendererSnapshotBoundary which clones once.

  const state = {
    battleScene: null,
    entityBattle: null,
  };

  // Pure: given the two visibility flags, which overlay is on top.
  function deriveActiveOverlay(battleSceneVisible, entityBattleVisible) {
    if (entityBattleVisible) return 'entityBattle';
    if (battleSceneVisible) return 'battleScene';
    return 'none';
  }

  function normalizeBattleScene(scene) {
    if (!scene || typeof scene !== 'object') return null;
    return {
      visible: scene.visible !== false,
      report: scene.report || null,
      turnIndex: Math.max(0, Number(scene.turnIndex) || 0),
      startedAt: Number(scene.startedAt) || 0,
      turnStartedAt: Number(scene.turnStartedAt) || 0,
      turnDurationMs: Math.max(0, Number(scene.turnDurationMs) || 0),
    };
  }

  // --- commands (the only write entry points) ---

  function openBattleScene(scene) {
    state.battleScene = normalizeBattleScene(scene);
    return state.battleScene;
  }

  function updateBattleScene(patchOrScene = {}) {
    const current = state.battleScene || {};
    state.battleScene = normalizeBattleScene({ ...current, ...(patchOrScene || {}) });
    return state.battleScene;
  }

  function closeBattleScene() {
    state.battleScene = null;
    return null;
  }

  function openEntityBattle(session) {
    state.entityBattle = session && typeof session === 'object' ? session : null;
    return state.entityBattle;
  }

  function closeEntityBattle() {
    state.entityBattle = null;
    return null;
  }

  // --- queries (read-only, never clone) ---

  function getBattleScene() {
    return state.battleScene;
  }

  function getEntityBattle() {
    return state.entityBattle;
  }

  function getActiveOverlay() {
    return deriveActiveOverlay(
      Boolean(state.battleScene?.visible),
      Boolean(state.entityBattle?.visible),
    );
  }

  // Renderer-facing read: the battle facts the snapshot boundary clones once.
  function getBattleFacts() {
    return {
      battleScene: state.battleScene,
      entityBattle: state.entityBattle,
      activeOverlay: getActiveOverlay(),
    };
  }

  function debugView() {
    return {
      battleScene: state.battleScene ? { ...state.battleScene } : null,
      entityBattle: state.entityBattle,
      activeOverlay: getActiveOverlay(),
    };
  }

  const api = Object.freeze({
    deriveActiveOverlay,
    openBattleScene,
    updateBattleScene,
    closeBattleScene,
    openEntityBattle,
    closeEntityBattle,
    getBattleScene,
    getEntityBattle,
    getActiveOverlay,
    getBattleFacts,
    debugView,
  });

  global.BattleStore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

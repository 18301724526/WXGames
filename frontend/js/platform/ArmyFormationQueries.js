// ArmyFormationQueries -- SHAPE-A (stateless, host-passing) read-only army-formation
// queries, extracted from CanvasGameApp (god-file re-decomposition slice 5).
//
// This is the first real App/Shell dedup: CanvasGameApp read `this.state` while
// CanvasGameShell overrode getArmyFormation to read `this.lastGame.state`. Both now go
// through host.getState() (PRE-1: StateWriter.getStateHost resolves app->this.state,
// shell->lastGame.state), so ONE implementation serves both and the shell drops its
// divergent getArmyFormation override, inheriting the app's delegator.
//
// Per-method cityId fallbacks are preserved verbatim: getArmyFormation and
// getArmyFormationReserveSoldiers include the `cityState.activeCityId` fallback;
// getArmyFormationEditablePool intentionally does not (matches the original bodies).
(function (global) {
  function getArmyFormation(host, cityId, slot) {
    const state = host?.getState?.() || {};
    const targetCityId = cityId || state.activeCityId || state.cityState?.activeCityId || 'capital';
    const targetSlot = Math.max(1, Math.min(3, Number(slot) || 1));
    const formations = state.military?.formations || {};
    const cityFormations = Array.isArray(formations[targetCityId]) ? formations[targetCityId] : [];
    return (
      cityFormations.find((item) => Number(item?.slot) === targetSlot) ||
      cityFormations[targetSlot - 1] ||
      null
    );
  }

  function getArmyFormationSoldierCap(host, cityId, slot) {
    const formation = getArmyFormation(host, cityId, slot);
    return Math.max(0, Math.floor(Number(formation?.maxSoldiersPerMember) || 1000));
  }

  function getArmyFormationReserveSoldiers(host, cityId) {
    const state = host?.getState?.() || {};
    const targetCityId = cityId || state.activeCityId || state.cityState?.activeCityId || 'capital';
    const cityMilitary = state.cities?.[targetCityId]?.military || state.military || {};
    return Math.max(0, Math.floor(Number(cityMilitary.soldiers) || 0));
  }

  function getArmyFormationEditablePool(host, editor = {}) {
    const state = host?.getState?.() || {};
    const cityId = editor.cityId || state.activeCityId || 'capital';
    const slot = Math.max(1, Math.min(3, Number(editor.slot) || 1));
    const formation = getArmyFormation(host, cityId, slot) || {};
    const previousAssigned = host.sumArmyFormationAssignments(formation.soldierAssignments || {});
    return previousAssigned + getArmyFormationReserveSoldiers(host, cityId);
  }

  const api = Object.freeze({
    getArmyFormation,
    getArmyFormationSoldierCap,
    getArmyFormationReserveSoldiers,
    getArmyFormationEditablePool,
  });
  global.ArmyFormationQueries = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

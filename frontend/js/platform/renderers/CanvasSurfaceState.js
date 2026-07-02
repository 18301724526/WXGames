(function (global) {
  function createCanvasSurfaceState(initial = {}) {
    return {
      hitTargets: Array.isArray(initial.hitTargets) ? initial.hitTargets : [],
      hoverPoint: initial.hoverPoint || null,
      famousSkillHitTargets: Array.isArray(initial.famousSkillHitTargets)
        ? initial.famousSkillHitTargets
        : [],
      activeFamousSkillTooltip: initial.activeFamousSkillTooltip || null,
      pinnedFamousSkillTooltip: initial.pinnedFamousSkillTooltip || null,
      suppressHitTargets: Boolean(initial.suppressHitTargets),
      lastRenderOptions: initial.lastRenderOptions || null,
      frameNow: Number(initial.frameNow) || 0,
      epochNowMs: initial.epochNowMs,
      serverNowMs: initial.serverNowMs,
      fpsLastFrameAt: Number(initial.fpsLastFrameAt) || 0,
      fpsLastPaintAt: Number(initial.fpsLastPaintAt) || 0,
      fpsLastPaintedValue: Number(initial.fpsLastPaintedValue) || 0,
      fpsSamples: Array.isArray(initial.fpsSamples) ? initial.fpsSamples : [],
      currentFps: Number(initial.currentFps) || 0,
    };
  }

  function getHitTargets(surfaceState = null) {
    if (!surfaceState) return [];
    if (!Array.isArray(surfaceState.hitTargets)) surfaceState.hitTargets = [];
    return surfaceState.hitTargets;
  }

  function setHitTargets(surfaceState = null, targets = []) {
    if (!surfaceState) return [];
    surfaceState.hitTargets = Array.isArray(targets) ? targets : [];
    return surfaceState.hitTargets;
  }

  function appendHitTarget(surfaceState = null, target = null) {
    if (!surfaceState || !target) return false;
    getHitTargets(surfaceState).push(target);
    return true;
  }

  function getHoverPoint(surfaceState = null) {
    return surfaceState?.hoverPoint || null;
  }

  function setHoverPoint(surfaceState = null, point = null) {
    if (!surfaceState) return null;
    surfaceState.hoverPoint = point || null;
    return surfaceState.hoverPoint;
  }

  function setFamousSkillTooltips(surfaceState = null, patch = {}) {
    if (!surfaceState || !patch || typeof patch !== 'object') return false;
    if (Object.prototype.hasOwnProperty.call(patch, 'active')) {
      surfaceState.activeFamousSkillTooltip = patch.active || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'pinned')) {
      surfaceState.pinnedFamousSkillTooltip = patch.pinned || null;
    }
    return true;
  }

  function clearFamousSkillTooltips(surfaceState = null) {
    if (!surfaceState) return false;
    const changed = Boolean(
      surfaceState.hoverPoint
      || surfaceState.activeFamousSkillTooltip
      || surfaceState.pinnedFamousSkillTooltip,
    );
    surfaceState.hoverPoint = null;
    surfaceState.activeFamousSkillTooltip = null;
    surfaceState.pinnedFamousSkillTooltip = null;
    return changed;
  }

  function setSuppressHitTargets(surfaceState = null, suppressed = false) {
    if (!surfaceState) return false;
    surfaceState.suppressHitTargets = Boolean(suppressed);
    return surfaceState.suppressHitTargets;
  }

  const api = {
    appendHitTarget,
    clearFamousSkillTooltips,
    createCanvasSurfaceState,
    getHitTargets,
    getHoverPoint,
    setFamousSkillTooltips,
    setHitTargets,
    setHoverPoint,
    setSuppressHitTargets,
  };

  global.CanvasSurfaceState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

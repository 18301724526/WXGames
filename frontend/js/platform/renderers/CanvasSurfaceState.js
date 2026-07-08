(function (global) {
  const HIT_TARGET_POOLS = Object.freeze(['base', 'modal', 'guide']);
  const HIT_TARGET_POOL_SET = new Set(HIT_TARGET_POOLS);

  function normalizeHitTargetPool(pool = 'base') {
    const key = String(pool || 'base');
    return HIT_TARGET_POOL_SET.has(key) ? key : 'base';
  }

  function createInitialHitTargetPools(initial = {}) {
    const sourcePools = initial.hitTargetPools && typeof initial.hitTargetPools === 'object'
      ? initial.hitTargetPools
      : null;
    const baseTargets = sourcePools
      ? sourcePools.base
      : initial.hitTargets;
    return {
      base: Array.isArray(baseTargets) ? baseTargets : [],
      modal: Array.isArray(sourcePools?.modal) ? sourcePools.modal : [],
      guide: Array.isArray(sourcePools?.guide) ? sourcePools.guide : [],
    };
  }

  function syncMergedHitTargets(surfaceState = null) {
    if (!surfaceState) return [];
    const pools = ensureHitTargetPools(surfaceState);
    const base = pools.base || [];
    const modal = pools.modal || [];
    const guide = pools.guide || [];
    surfaceState.hitTargets = modal.length || guide.length
      ? [...base, ...modal, ...guide]
      : base;
    return surfaceState.hitTargets;
  }

  function createCanvasSurfaceState(initial = {}) {
    const hitTargetPools = createInitialHitTargetPools(initial);
    const state = {
      hitTargets: hitTargetPools.base,
      hitTargetPools,
      activeHitTargetPool: normalizeHitTargetPool(initial.activeHitTargetPool),
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
    syncMergedHitTargets(state);
    return state;
  }

  function ensureHitTargetPools(surfaceState = null) {
    if (!surfaceState) return { base: [], modal: [], guide: [] };
    if (!surfaceState.hitTargetPools || typeof surfaceState.hitTargetPools !== 'object') {
      surfaceState.hitTargetPools = {
        base: Array.isArray(surfaceState.hitTargets) ? surfaceState.hitTargets : [],
        modal: [],
        guide: [],
      };
    }
    HIT_TARGET_POOLS.forEach((pool) => {
      if (!Array.isArray(surfaceState.hitTargetPools[pool])) surfaceState.hitTargetPools[pool] = [];
    });
    surfaceState.activeHitTargetPool = normalizeHitTargetPool(surfaceState.activeHitTargetPool);
    return surfaceState.hitTargetPools;
  }

  function getActiveHitTargetPool(surfaceState = null) {
    if (!surfaceState) return 'base';
    return normalizeHitTargetPool(surfaceState.activeHitTargetPool);
  }

  function setActiveHitTargetPool(surfaceState = null, pool = 'base') {
    if (!surfaceState) return 'base';
    surfaceState.activeHitTargetPool = normalizeHitTargetPool(pool);
    ensureHitTargetPools(surfaceState);
    return surfaceState.activeHitTargetPool;
  }

  function getHitTargets(surfaceState = null, pool = null) {
    if (!surfaceState) return [];
    const pools = ensureHitTargetPools(surfaceState);
    if (pool !== null && pool !== undefined) return pools[normalizeHitTargetPool(pool)];
    return syncMergedHitTargets(surfaceState);
  }

  function setHitTargets(surfaceState = null, targets = [], pool = null) {
    if (!surfaceState) return [];
    const pools = ensureHitTargetPools(surfaceState);
    const key = pool === null || pool === undefined ? getActiveHitTargetPool(surfaceState) : normalizeHitTargetPool(pool);
    pools[key] = Array.isArray(targets) ? targets : [];
    return syncMergedHitTargets(surfaceState);
  }

  function appendHitTarget(surfaceState = null, target = null, pool = null) {
    if (!surfaceState || !target) return false;
    const pools = ensureHitTargetPools(surfaceState);
    const key = pool === null || pool === undefined ? getActiveHitTargetPool(surfaceState) : normalizeHitTargetPool(pool);
    pools[key].push(target);
    syncMergedHitTargets(surfaceState);
    return true;
  }

  function clearHitTargetPool(surfaceState = null, pool = 'base') {
    if (!surfaceState) return [];
    const pools = ensureHitTargetPools(surfaceState);
    pools[normalizeHitTargetPool(pool)] = [];
    return syncMergedHitTargets(surfaceState);
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
      surfaceState.hoverPoint ||
      surfaceState.activeFamousSkillTooltip ||
      surfaceState.pinnedFamousSkillTooltip,
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
    clearHitTargetPool,
    createCanvasSurfaceState,
    ensureHitTargetPools,
    getActiveHitTargetPool,
    getHitTargets,
    normalizeHitTargetPool,
    getHoverPoint,
    setFamousSkillTooltips,
    setActiveHitTargetPool,
    setHitTargets,
    setHoverPoint,
    setSuppressHitTargets,
    syncMergedHitTargets,
    HIT_TARGET_POOLS,
  };

  global.CanvasSurfaceState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

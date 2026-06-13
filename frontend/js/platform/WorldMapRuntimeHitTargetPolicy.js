(function (global) {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function collectRendererHitTargets(renderer = {}) {
    const groups = collectRendererHitTargetGroups(renderer);
    return groups.sourceTargets;
  }

  function collectRendererHitTargetGroups(renderer = {}) {
    const mapTargets = toArray(renderer?.hitTargets);
    const actorTargets = toArray(renderer?.worldActorLayerRenderer?.hitTargets);
    return {
      actorTargets,
      mapTargets,
      sourceTargets: [
        ...mapTargets,
        ...actorTargets,
      ],
    };
  }

  function shouldPreserveOnEmpty(options = {}) {
    return Boolean(options.preserveOnEmpty
      && toArray(options.sourceTargets).length === 0
      && toArray(options.previousBaseHitTargets).length > 0);
  }

  function isActorLayerTarget(target = {}, actorActionTypes = null) {
    const type = target?.action?.type;
    if (!type) return false;
    if (actorActionTypes && actorActionTypes.size > 0) return actorActionTypes.has(type);
    return type === 'selectWorldActor';
  }

  function getActorActionTypes(actorTargets = []) {
    const types = new Set();
    toArray(actorTargets).forEach((target) => {
      const type = target?.action?.type;
      if (type) types.add(type);
    });
    if (!types.size) types.add('selectWorldActor');
    return types;
  }

  function isStableMapLayerTarget(target = {}) {
    const type = target?.action?.type;
    if (!type) return false;
    return type === 'worldMapDrag'
      || type === 'selectWorldMarchTarget'
      || type === 'openWorldSite'
      || type === 'enterCity';
  }

  function withoutPreviousActorLayerTargets(previousBaseHitTargets = [], actorTargets = []) {
    const actorActionTypes = getActorActionTypes(actorTargets);
    return toArray(previousBaseHitTargets)
      .filter((target) => !isActorLayerTarget(target, actorActionTypes));
  }

  function hasStableMapLayerTarget(targets = []) {
    return toArray(targets).some(isStableMapLayerTarget);
  }

  function resolveBaseHitTargets(options = {}) {
    const hasLayerGroups = Array.isArray(options.mapTargets) || Array.isArray(options.actorTargets);
    const previousBaseHitTargets = toArray(options.previousBaseHitTargets);
    const mapTargets = toArray(options.mapTargets);
    const actorTargets = toArray(options.actorTargets);
    if (hasLayerGroups && options.preserveOnEmpty && mapTargets.length === 0 && previousBaseHitTargets.length > 0) {
      return {
        preserved: true,
        targets: [
          ...withoutPreviousActorLayerTargets(previousBaseHitTargets, actorTargets),
          ...actorTargets,
        ],
      };
    }
    if (
      hasLayerGroups
      && options.preserveOnEmpty
      && mapTargets.length > 0
      && previousBaseHitTargets.length > 0
      && hasStableMapLayerTarget(previousBaseHitTargets)
      && !hasStableMapLayerTarget(mapTargets)
    ) {
      return {
        preserved: true,
        targets: [
          ...withoutPreviousActorLayerTargets(previousBaseHitTargets, actorTargets),
          ...actorTargets,
        ],
      };
    }
    if (shouldPreserveOnEmpty(options)) return { preserved: true, targets: previousBaseHitTargets.slice() };
    return {
      preserved: false,
      targets: toArray(options.sourceTargets).slice(),
    };
  }

  const WorldMapRuntimeHitTargetPolicy = Object.freeze({
    collectRendererHitTargetGroups,
    collectRendererHitTargets,
    getActorActionTypes,
    hasStableMapLayerTarget,
    isActorLayerTarget,
    isStableMapLayerTarget,
    resolveBaseHitTargets,
    shouldPreserveOnEmpty,
    withoutPreviousActorLayerTargets,
  });

  global.WorldMapRuntimeHitTargetPolicy = WorldMapRuntimeHitTargetPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapRuntimeHitTargetPolicy;
})(typeof window !== 'undefined' ? window : globalThis);

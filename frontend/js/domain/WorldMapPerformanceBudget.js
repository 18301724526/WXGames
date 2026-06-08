(function (global) {
  const DEFAULT_BUDGETS = Object.freeze({
    visibilityTiles: 5000,
    entityTiles: 5000,
    renderTiles: 5000,
    actors: 500,
    sites: 1000,
    missions: 1000,
    serializableBytes: 512 * 1024,
  });

  function toInteger(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
  }

  function readCount(source = {}, keys = []) {
    for (const key of keys) {
      const value = source?.counts?.[key] ?? source?.[key]?.length ?? source?.[key];
      if (Number.isFinite(Number(value))) return toInteger(value);
    }
    return 0;
  }

  function hasObjectMap(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function createCheck(key, ok, actual, budget, detail = '') {
    return Object.freeze({
      key,
      ok: ok === true,
      actual,
      budget,
      detail,
    });
  }

  function getSerializableSizeBytes(value) {
    try {
      return JSON.stringify(value || {}).length;
    } catch (error) {
      return Infinity;
    }
  }

  function createReport(checks = [], meta = {}) {
    const failed = checks.filter((check) => !check.ok);
    return Object.freeze({
      ok: failed.length === 0,
      failedKeys: Object.freeze(failed.map((check) => check.key)),
      checks: Object.freeze(checks),
      meta: Object.freeze({ ...(meta || {}) }),
    });
  }

  function assertReport(report, message = 'World map performance budget exceeded') {
    if (report?.ok) return report;
    const failed = (report?.checks || [])
      .filter((check) => !check.ok)
      .map((check) => `${check.key} actual=${check.actual} budget=${check.budget}`)
      .join('; ');
    throw new Error(`${message}: ${failed}`);
  }

  function checkVisibilitySnapshot(snapshot = {}, budgets = DEFAULT_BUDGETS) {
    const tileCount = toInteger(snapshot.tileIds?.length ?? snapshot.counts?.tiles ?? 0);
    const checks = [
      createCheck('visibility.tile-count', tileCount <= budgets.visibilityTiles, tileCount, budgets.visibilityTiles),
      createCheck('visibility.parallel-levels', (snapshot.levels?.length || 0) === tileCount, snapshot.levels?.length || 0, tileCount),
      createCheck('visibility.parallel-coordinates-q', (snapshot.q?.length || 0) === tileCount, snapshot.q?.length || 0, tileCount),
      createCheck('visibility.parallel-coordinates-r', (snapshot.r?.length || 0) === tileCount, snapshot.r?.length || 0, tileCount),
      createCheck('visibility.index-map', hasObjectMap(snapshot.indexById), hasObjectMap(snapshot.indexById) ? 1 : 0, 1),
      createCheck('visibility.no-entry-objects', !Object.prototype.hasOwnProperty.call(snapshot, 'entries'), 0, 0),
    ];
    return createReport(checks, { snapshot: 'visibility', signature: snapshot.signature || '' });
  }

  function checkEntitySnapshot(snapshot = {}, budgets = DEFAULT_BUDGETS) {
    const tileCount = readCount(snapshot, ['tiles']);
    const siteCount = readCount(snapshot, ['sites']);
    const missionCount = readCount(snapshot, ['missions']);
    const actorCount = readCount(snapshot, ['actors']);
    const checks = [
      createCheck('entity.tile-count', tileCount <= budgets.entityTiles, tileCount, budgets.entityTiles),
      createCheck('entity.site-count', siteCount <= budgets.sites, siteCount, budgets.sites),
      createCheck('entity.mission-count', missionCount <= budgets.missions, missionCount, budgets.missions),
      createCheck('entity.actor-count', actorCount <= budgets.actors, actorCount, budgets.actors),
      createCheck('entity.index-tiles', hasObjectMap(snapshot.indexById?.tiles), hasObjectMap(snapshot.indexById?.tiles) ? 1 : 0, 1),
      createCheck('entity.no-nested-entity-map', !Object.prototype.hasOwnProperty.call(snapshot, 'entitiesById'), 0, 0),
    ];
    return createReport(checks, { snapshot: 'entity', signature: snapshot.signature || '' });
  }

  function checkRenderSnapshot(snapshot = {}, budgets = DEFAULT_BUDGETS) {
    const tileCount = readCount(snapshot, ['tiles']);
    const actorCount = readCount(snapshot, ['actors']);
    const serializable = typeof snapshot.toSerializable === 'function'
      ? snapshot.toSerializable()
      : snapshot.serializable || null;
    const serializableSize = serializable ? getSerializableSizeBytes(serializable) : 0;
    const checks = [
      createCheck('render.tile-count', tileCount <= budgets.renderTiles, tileCount, budgets.renderTiles),
      createCheck('render.actor-count', actorCount <= budgets.actors, actorCount, budgets.actors),
      createCheck('render.no-tile-copy-in-serializable', !serializable || !Object.prototype.hasOwnProperty.call(serializable, 'tileMapView'), 0, 0),
      createCheck('render.serializable-size', serializableSize <= budgets.serializableBytes, serializableSize, budgets.serializableBytes),
    ];
    return createReport(checks, { snapshot: 'render', signature: snapshot.signature || '' });
  }

  function combineReports(reports = [], meta = {}) {
    const checks = [];
    (Array.isArray(reports) ? reports : []).forEach((report) => {
      checks.push(...(report?.checks || []));
    });
    return createReport(checks, meta);
  }

  const WorldMapPerformanceBudget = Object.freeze({
    DEFAULT_BUDGETS,
    assertReport,
    checkEntitySnapshot,
    checkRenderSnapshot,
    checkVisibilitySnapshot,
    combineReports,
    createReport,
    getSerializableSizeBytes,
  });

  global.WorldMapPerformanceBudget = WorldMapPerformanceBudget;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMapPerformanceBudget;
})(typeof window !== 'undefined' ? window : globalThis);

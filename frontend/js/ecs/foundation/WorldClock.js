(function (global) {
  const EcsCoreBoundary = (() => {
    if (global.EcsCoreBoundary) return global.EcsCoreBoundary;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../core/EcsCoreBoundary');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  if (!EcsCoreBoundary) {
    throw new Error('WorldClock requires EcsCoreBoundary and bitecs primitives');
  }

  const {
    Types,
    addComponent,
    addEntity,
    createWorld,
    defineComponent,
    defineQuery,
    hasComponent,
  } = EcsCoreBoundary;

  if (!Types || !defineComponent || !defineQuery || !createWorld || !addEntity || !addComponent) {
    throw new Error('WorldClock requires the approved BitECS primitive surface');
  }

  const EPOCH_SECONDS_THRESHOLD = 1000000000;
  const EPOCH_MILLISECONDS_THRESHOLD = 1000000000000;

  const Clock = defineComponent({
    serverEpochAtSyncMs: Types.f64,
    clientMonoAtSyncMs: Types.f64,
    lastSyncedAtEpochMs: Types.f64,
    epochNowMs: Types.f64,
    elapsedMs: Types.f64,
    synced: Types.ui8,
  });

  const clockQuery = defineQuery([Clock]);

  function toNumber(value, fallback = Number.NaN) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toEpochMs(value, fallback = Number.NaN) {
    if (value === null || value === undefined || value === '') return fallback;
    if (value instanceof Date) {
      const stamp = value.getTime();
      return Number.isFinite(stamp) ? stamp : fallback;
    }
    if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
      const number = Number(value);
      if (Number.isFinite(number)) {
        if (Math.abs(number) >= EPOCH_MILLISECONDS_THRESHOLD) return number;
        if (Math.abs(number) >= EPOCH_SECONDS_THRESHOLD) return number * 1000;
      }
    }
    const stamp = new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }

  function getMonotonicNow(runtime = null) {
    const perfNow = runtime?.performance?.now?.() ?? global.performance?.now?.();
    if (Number.isFinite(Number(perfNow))) return Number(perfNow);
    return Date.now();
  }

  function extractClockPayloadTime(payload = {}) {
    if (!payload || typeof payload !== 'object') return {};
    return {
      serverTime: payload.serverTime
        ?? payload.authority?.serverTime
        ?? payload.authority?.command?.serverTime
        ?? payload.timeline?.serverTime
        ?? payload.details?.serverTime
        ?? payload.details?.timeline?.serverTime
        ?? payload.gameState?.serverTime
        ?? payload.state?.serverTime,
      serverNowMs: payload.nowMs
        ?? payload.timeline?.nowMs
        ?? payload.details?.timeline?.nowMs
        ?? payload.gameState?.nowMs
        ?? payload.state?.nowMs,
    };
  }

  function initializeClockComponent(clockWorld, options = {}) {
    const entity = clockWorld.clockEntity;
    Clock.serverEpochAtSyncMs[entity] = Number.NaN;
    Clock.clientMonoAtSyncMs[entity] = Number.NaN;
    Clock.lastSyncedAtEpochMs[entity] = Number.NaN;
    Clock.epochNowMs[entity] = Number.NaN;
    Clock.elapsedMs[entity] = 0;
    Clock.synced[entity] = 0;
    runClockSyncSystem(clockWorld, options);
  }

  function createClockWorld(options = {}) {
    const world = createWorld();
    const clockEntity = addEntity(world);
    addComponent(world, Clock, clockEntity);
    const clockWorld = {
      world,
      clockEntity,
      runtime: options.runtime || null,
    };
    initializeClockComponent(clockWorld, options);
    return clockWorld;
  }

  function getClockEntity(clockWorld = null) {
    if (!clockWorld?.world) return null;
    if (
      Number.isInteger(clockWorld.clockEntity)
      && hasComponent(clockWorld.world, Clock, clockWorld.clockEntity)
    ) {
      return clockWorld.clockEntity;
    }
    const matches = clockQuery(clockWorld.world);
    return matches.length ? matches[0] : null;
  }

  function runClockSyncSystem(clockWorld = null, options = {}) {
    const entity = getClockEntity(clockWorld);
    if (!Number.isInteger(entity)) return false;
    if (options.runtime) clockWorld.runtime = options.runtime;
    const payloadTimes = extractClockPayloadTime(options);
    const serverEpochMs = toEpochMs(
      options.serverTime
        ?? options.serverNowMs
        ?? options.epochNowMs
        ?? options.nowEpochMs
        ?? payloadTimes.serverTime
        ?? payloadTimes.serverNowMs,
      Number.NaN,
    );
    if (!Number.isFinite(serverEpochMs)) return false;
    const clientMonoMs = Number.isFinite(Number(options.clientMonoMs))
      ? Number(options.clientMonoMs)
      : getMonotonicNow(clockWorld.runtime);
    Clock.serverEpochAtSyncMs[entity] = serverEpochMs;
    Clock.clientMonoAtSyncMs[entity] = clientMonoMs;
    Clock.lastSyncedAtEpochMs[entity] = Date.now();
    Clock.elapsedMs[entity] = 0;
    Clock.epochNowMs[entity] = serverEpochMs;
    Clock.synced[entity] = 1;
    return true;
  }

  function runClockAdvanceSystem(clockWorld = null) {
    const entity = getClockEntity(clockWorld);
    if (!Number.isInteger(entity) || !Clock.synced[entity]) return false;
    const elapsedMs = Math.max(0, getMonotonicNow(clockWorld.runtime) - Clock.clientMonoAtSyncMs[entity]);
    Clock.elapsedMs[entity] = elapsedMs;
    Clock.epochNowMs[entity] = Clock.serverEpochAtSyncMs[entity] + elapsedMs;
    return true;
  }

  function getClockSnapshot(clockWorld = null, fallback = Date.now()) {
    const entity = getClockEntity(clockWorld);
    if (!Number.isInteger(entity) || !Clock.synced[entity]) {
      return Object.freeze({
        entity,
        synced: false,
        epochNowMs: toEpochMs(fallback, Date.now()),
        elapsedMs: 0,
        serverEpochAtSyncMs: Number.NaN,
        clientMonoAtSyncMs: Number.NaN,
        lastSyncedAtEpochMs: Number.NaN,
      });
    }
    runClockAdvanceSystem(clockWorld);
    return Object.freeze({
      entity,
      synced: true,
      epochNowMs: Clock.epochNowMs[entity],
      elapsedMs: Clock.elapsedMs[entity],
      serverEpochAtSyncMs: Clock.serverEpochAtSyncMs[entity],
      clientMonoAtSyncMs: Clock.clientMonoAtSyncMs[entity],
      lastSyncedAtEpochMs: Clock.lastSyncedAtEpochMs[entity],
    });
  }

  function isClockWorld(value = null) {
    return Boolean(
      value
      && typeof value === 'object'
      && value.world
      && Number.isInteger(value.clockEntity)
      && hasComponent(value.world, Clock, value.clockEntity),
    );
  }

  function getClockWorld(source = {}) {
    if (isClockWorld(source)) return source;
    if (isClockWorld(source?.clockWorld)) return source.clockWorld;
    if (isClockWorld(source?.worldClock)) return source.worldClock;
    if (isClockWorld(source?.host?.worldClock)) return source.host.worldClock;
    if (isClockWorld(source?.runtime?.worldClock)) return source.runtime.worldClock;
    if (isClockWorld(global.__WorldClockShared)) return global.__WorldClockShared;
    return null;
  }

  function getShared(options = {}) {
    const current = global.__WorldClockShared;
    if (isClockWorld(current)) {
      if (options.runtime && current.runtime !== options.runtime) current.runtime = options.runtime;
      runClockSyncSystem(current, options);
      return current;
    }
    const clockWorld = createClockWorld(options);
    global.__WorldClockShared = clockWorld;
    return clockWorld;
  }

  function createWorldClock(options = {}) {
    return createClockWorld(options);
  }

  function updateFromPayload(clockWorld = null, payload = {}) {
    if (!payload || typeof payload !== 'object') return false;
    return runClockSyncSystem(clockWorld, payload);
  }

  function getEpochNowMs(source = {}, fallback = Date.now()) {
    const clockWorld = getClockWorld(source);
    if (clockWorld && Clock.synced[clockWorld.clockEntity]) {
      return getClockSnapshot(clockWorld, fallback).epochNowMs;
    }
    const parsedFallback = toEpochMs(fallback, Number.NaN);
    if (Number.isFinite(parsedFallback)) return parsedFallback;
    return arguments.length >= 2 ? Number.NaN : Date.now();
  }

  function sync(source = {}, payload = {}) {
    const clockWorld = getClockWorld(source)
      || getShared({ runtime: source?.runtime || source });
    const synced = updateFromPayload(clockWorld, payload);
    if (source && typeof source === 'object' && !source.worldClock) source.worldClock = clockWorld;
    return synced;
  }

  const api = {
    Clock,
    EPOCH_MILLISECONDS_THRESHOLD,
    EPOCH_SECONDS_THRESHOLD,
    clockQuery,
    createClockWorld,
    createWorldClock,
    getClock: getClockWorld,
    getClockEntity,
    getClockWorld,
    getClockSnapshot,
    getEpochNowMs,
    getShared,
    isClockWorld,
    runClockAdvanceSystem,
    runClockSyncSystem,
    sync,
    toEpochMs,
    toNumber,
    updateFromPayload,
  };

  global.WorldClock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

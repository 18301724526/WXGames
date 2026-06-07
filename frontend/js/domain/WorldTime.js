(function (global) {
  const EPOCH_SECONDS_THRESHOLD = 1000000000;
  const EPOCH_MILLISECONDS_THRESHOLD = 1000000000000;

  function isNumericString(value) {
    return typeof value === 'string' && value.trim() !== '' && /^-?\d+(\.\d+)?$/.test(value.trim());
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toEpochMs(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    if (value instanceof Date) {
      const stamp = value.getTime();
      return Number.isFinite(stamp) ? stamp : fallback;
    }
    if (typeof value === 'number' || isNumericString(value)) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.abs(number) < EPOCH_MILLISECONDS_THRESHOLD ? number * 1000 : number;
    }
    const stamp = new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : fallback;
  }

  function toEpochNowMs(value, fallback = Date.now()) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    if (Number.isFinite(number)) {
      if (Math.abs(number) >= EPOCH_MILLISECONDS_THRESHOLD) return number;
      if (Math.abs(number) >= EPOCH_SECONDS_THRESHOLD) return number * 1000;
      return fallback;
    }
    return toEpochMs(value, fallback);
  }

  function getEpochNowMs(source = {}, fallback = Date.now()) {
    const candidates = [
      source?.epochNowMs,
      source?.serverNowMs,
      source?.nowEpochMs,
      source?.lastRenderOptions?.epochNowMs,
      source?.lastRenderOptions?.serverNowMs,
      source?.host?.epochNowMs,
      source?.host?.serverNowMs,
      source?.host?.nowEpochMs,
      source?.host?.lastRenderOptions?.epochNowMs,
      source?.host?.lastRenderOptions?.serverNowMs,
    ];
    for (const candidate of candidates) {
      const stamp = toEpochNowMs(candidate, Number.NaN);
      if (Number.isFinite(stamp)) return stamp;
    }
    const frameNowCandidates = [
      typeof source?.getNow === 'function' ? source.getNow() : undefined,
      typeof source?.host?.getNow === 'function' ? source.host.getNow() : undefined,
      source?.lastRenderOptions?.now,
      source?.host?.lastRenderOptions?.now,
    ];
    for (const candidate of frameNowCandidates) {
      const number = Number(candidate);
      if (Number.isFinite(number) && Math.abs(number) >= EPOCH_MILLISECONDS_THRESHOLD) return number;
    }
    return toEpochNowMs(fallback, Date.now());
  }

  function getRemainingSeconds(mission = {}, nowMs = Date.now()) {
    if (!mission || mission.status === 'ready') return 0;
    const resolvedNowMs = toEpochNowMs(nowMs, Date.now());
    const nextStepAtMs = toEpochMs(mission.nextStepAt, Number.NaN);
    if (Number.isFinite(nextStepAtMs)) {
      return Math.max(0, Math.ceil((nextStepAtMs - resolvedNowMs) / 1000));
    }
    const completesAtMs = toEpochMs(mission.completesAt, Number.NaN);
    if (Number.isFinite(completesAtMs)) {
      return Math.max(0, Math.ceil((completesAtMs - resolvedNowMs) / 1000));
    }
    const rawRemaining = Number(mission.remainingSeconds);
    if (!Number.isFinite(rawRemaining)) return 0;
    if (Math.abs(rawRemaining) >= EPOCH_MILLISECONDS_THRESHOLD) {
      return Math.max(0, Math.ceil((rawRemaining - resolvedNowMs) / 1000));
    }
    if (Math.abs(rawRemaining) >= EPOCH_SECONDS_THRESHOLD) {
      return Math.max(0, Math.ceil((rawRemaining * 1000 - resolvedNowMs) / 1000));
    }
    return Math.max(0, Math.ceil(rawRemaining));
  }

  const WorldTime = {
    EPOCH_SECONDS_THRESHOLD,
    EPOCH_MILLISECONDS_THRESHOLD,
    getEpochNowMs,
    getRemainingSeconds,
    toEpochMs,
    toEpochNowMs,
    toNumber,
  };

  global.WorldTime = WorldTime;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTime;
})(typeof window !== 'undefined' ? window : globalThis);

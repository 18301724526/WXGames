(function (global) {
  const SignatureHash = (() => {
    if (global.SignatureHash) return global.SignatureHash;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../shared/SignatureHash');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const STATUS_UNKNOWN = 'unknown';
  const STATUS_OK = 'ok';
  const STATUS_WARN = 'warn';
  const STATUS_BAD = 'bad';

  const DEFAULT_OVERLAY_KEYS = Object.freeze(['fps', 'worldMapBake', 'visibility', 'inputTrace']);

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function normalizeOverlayKeys(keys = DEFAULT_OVERLAY_KEYS) {
    const source = Array.isArray(keys) && keys.length ? keys : DEFAULT_OVERLAY_KEYS;
    const seen = new Set();
    const result = [];
    source.forEach((key) => {
      const normalized = String(key || '').trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      result.push(normalized);
    });
    return result;
  }

  function readFps(input = {}) {
    const value = input.fps
      ?? input.frameMetrics?.fps
      ?? input.renderer?.currentFps
      ?? input.surface?.currentFps
      ?? null;
    const fps = toInteger(value, 0);
    let status = STATUS_UNKNOWN;
    if (fps >= 55) status = STATUS_OK;
    else if (fps >= 30) status = STATUS_WARN;
    else if (fps > 0) status = STATUS_BAD;
    return {
      key: 'fps',
      label: 'FPS',
      value: fps > 0 ? String(fps) : '--',
      status,
      details: {
        fps,
        sampleCount: Math.max(0, toInteger(input.renderer?.fpsSamples?.length ?? input.surface?.fpsSamples?.length, 0)),
      },
    };
  }

  function readWorldMapBake(input = {}) {
    const runtime = input.worldMapRuntime || input.mapRuntime || {};
    const hasRuntime = Boolean(input.worldMapRuntime || input.mapRuntime);
    const hasBakedMapLayer = Boolean(runtime.hasBakedMapLayer);
    const mapBakeDirty = Boolean(runtime.mapBakeDirty);
    const status = !hasRuntime
      ? STATUS_UNKNOWN
      : (!hasBakedMapLayer || mapBakeDirty ? STATUS_WARN : STATUS_OK);
    const value = !hasRuntime ? 'missing' : (!hasBakedMapLayer ? 'unbaked' : (mapBakeDirty ? 'dirty' : 'clean'));
    return {
      key: 'worldMapBake',
      label: 'Map Bake',
      value,
      status,
      details: {
        hasBakedMapLayer,
        mapBakeDirty,
        signatureLength: String(runtime.lastMapDataSignature || '').length,
        hitTargetCount: Array.isArray(runtime.hitTargets) ? runtime.hitTargets.length : 0,
        cameraX: toNumber(runtime.camera?.x, 0),
        cameraY: toNumber(runtime.camera?.y, 0),
        bakedCameraX: toNumber(runtime.bakedCamera?.x, 0),
        bakedCameraY: toNumber(runtime.bakedCamera?.y, 0),
      },
    };
  }

  function readVisibility(input = {}) {
    const snapshot = input.visibilitySnapshot || input.entitySnapshot?.visibility || input.fogVisualSnapshot || null;
    const counts = snapshot?.counts || {};
    const hasSnapshot = Boolean(snapshot);
    return {
      key: 'visibility',
      label: 'Visibility',
      value: hasSnapshot
        ? `U${toInteger(counts.unknown, 0)} E${toInteger(counts.explored, 0)} V${toInteger(counts.visible, 0)} C${toInteger(counts.controlled, 0)}`
        : 'missing',
      status: hasSnapshot ? STATUS_OK : STATUS_UNKNOWN,
      details: {
        unknown: toInteger(counts.unknown, 0),
        explored: toInteger(counts.explored, 0),
        visible: toInteger(counts.visible, 0),
        controlled: toInteger(counts.controlled, 0),
        signature: snapshot?.signature || '',
      },
    };
  }

  function readInputTrace(input = {}) {
    const trace = input.inputTrace || {};
    const action = input.lastInputAction || input.action || trace.lastAction || trace.action || null;
    const point = input.lastInputPoint || trace.lastPoint || null;
    return {
      key: 'inputTrace',
      label: 'Input',
      value: action?.type || 'idle',
      status: action?.type ? STATUS_OK : STATUS_UNKNOWN,
      details: {
        actionType: action?.type || '',
        disabled: Boolean(action?.disabled),
        background: Boolean(action?.background),
        targetQ: action?.targetQ ?? null,
        targetR: action?.targetR ?? null,
        x: point ? toNumber(point.x, 0) : null,
        y: point ? toNumber(point.y, 0) : null,
      },
    };
  }

  const ROW_BUILDERS = Object.freeze({
    fps: readFps,
    worldMapBake: readWorldMapBake,
    visibility: readVisibility,
    inputTrace: readInputTrace,
  });

  function createAccumulator() {
    return {
      schema: 'debug-overlay-snapshot-v1',
      keys: [],
      labels: [],
      values: [],
      statuses: [],
      details: [],
      indexByKey: Object.create(null),
      counts: {
        total: 0,
        ok: 0,
        warn: 0,
        bad: 0,
        unknown: 0,
      },
      signature: '',
      _hash: SignatureHash.FNV_OFFSET_BASIS,
    };
  }

  function countStatus(counts, status = STATUS_UNKNOWN) {
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    else counts.unknown += 1;
  }

  function appendRow(accumulator, row = {}) {
    const key = String(row.key || '').trim();
    if (!key || accumulator.indexByKey[key] !== undefined) return accumulator;
    const status = row.status || STATUS_UNKNOWN;
    accumulator.indexByKey[key] = accumulator.keys.length;
    accumulator.keys.push(key);
    accumulator.labels.push(row.label || key);
    accumulator.values.push(String(row.value ?? ''));
    accumulator.statuses.push(status);
    accumulator.details.push(row.details && typeof row.details === 'object' ? { ...row.details } : {});
    accumulator.counts.total += 1;
    countStatus(accumulator.counts, status);
    accumulator._hash = hashStep(accumulator._hash, key);
    accumulator._hash = hashStep(accumulator._hash, row.value);
    accumulator._hash = hashStep(accumulator._hash, status);
    return accumulator;
  }

  function finalizeSnapshot(accumulator) {
    accumulator.signature = `${accumulator.keys.length}:${(accumulator._hash >>> 0).toString(16)}`;
    delete accumulator._hash;
    return accumulator;
  }

  function createSnapshot(input = {}, options = {}) {
    const overlayKeys = normalizeOverlayKeys(options.overlayKeys || options.enabledOverlayKeys || DEFAULT_OVERLAY_KEYS);
    const accumulator = createAccumulator();
    overlayKeys.forEach((key) => {
      const builder = ROW_BUILDERS[key];
      if (!builder) return;
      appendRow(accumulator, builder(input, options));
    });
    return finalizeSnapshot(accumulator);
  }

  function getRow(snapshot = {}, keyOrIndex = '') {
    const index = Number.isFinite(Number(keyOrIndex))
      ? toInteger(keyOrIndex, -1)
      : snapshot.indexByKey?.[String(keyOrIndex)];
    if (index === undefined || index < 0 || index >= (snapshot.keys?.length || 0)) return null;
    return {
      key: snapshot.keys[index],
      label: snapshot.labels?.[index] || snapshot.keys[index],
      value: snapshot.values?.[index] || '',
      status: snapshot.statuses?.[index] || STATUS_UNKNOWN,
      details: { ...(snapshot.details?.[index] || {}) },
    };
  }

  function toRows(snapshot = {}) {
    const rows = [];
    const length = Array.isArray(snapshot.keys) ? snapshot.keys.length : 0;
    for (let i = 0; i < length; i += 1) rows.push(getRow(snapshot, i));
    return rows;
  }

  function toSerializable(snapshot = {}) {
    return {
      schema: snapshot.schema || 'debug-overlay-snapshot-v1',
      keys: Array.isArray(snapshot.keys) ? [...snapshot.keys] : [],
      labels: Array.isArray(snapshot.labels) ? [...snapshot.labels] : [],
      values: Array.isArray(snapshot.values) ? [...snapshot.values] : [],
      statuses: Array.isArray(snapshot.statuses) ? [...snapshot.statuses] : [],
      details: Array.isArray(snapshot.details) ? snapshot.details.map((detail) => ({ ...(detail || {}) })) : [],
      indexByKey: { ...(snapshot.indexByKey || {}) },
      counts: { ...(snapshot.counts || {}) },
      signature: snapshot.signature || '',
    };
  }

  const api = {
    DEFAULT_OVERLAY_KEYS,
    STATUS_UNKNOWN,
    STATUS_OK,
    STATUS_WARN,
    STATUS_BAD,
    ROW_BUILDERS,
    createSnapshot,
    getRow,
    normalizeOverlayKeys,
    readFps,
    readInputTrace,
    readVisibility,
    readWorldMapBake,
    toRows,
    toSerializable,
  };

  global.DebugOverlaySnapshot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

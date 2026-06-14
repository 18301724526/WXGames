(function (global) {
  const STORAGE_KEY = 'clientOperationLog';
  const URL_KEYS = ['clientOperationLog', 'operationLog', 'opLog'];
  const DEFAULT_MAX_ENTRIES = 800;
  const DEFAULT_PERSIST_LIMIT = 400;
  const DEFAULT_FLUSH_INTERVAL_MS = 1000;
  const DEFAULT_SAMPLE_INTERVAL_MS = 120;
  const MAX_STRING_LENGTH = 240;
  const MAX_ARRAY_LENGTH = 12;
  const MAX_OBJECT_KEYS = 24;
  const MAX_DEPTH = 4;
  const DEFAULT_UPLOAD_REASON = 'manual-debug';

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round(toNumber(value, 0) * factor) / factor;
  }

  function safeIso(timestampMs) {
    try {
      return new Date(timestampMs).toISOString();
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function formatFileTimestamp(timestampMs) {
    return safeIso(timestampMs)
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
      .replace('T', '-');
  }

  function sanitizeFilenamePart(value, fallback = 'anonymous') {
    const text = String(value || '').trim();
    const sanitized = text.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
    return sanitized || fallback;
  }

  function createRunId(runtime = global) {
    const seed = [
      runtime?.location?.pathname || '',
      runtime?.location?.search || '',
      runtime?.Date?.now?.() || Date.now(),
      Math.random().toString(36).slice(2),
    ].join('|');
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `run-${(hash >>> 0).toString(36)}`;
  }

  function readUrlFlag(runtime = global) {
    try {
      const search = runtime?.location?.search || '';
      if (!search) return null;
      const params = new URLSearchParams(search);
      for (const key of URL_KEYS) {
        if (!params.has(key)) continue;
        const value = String(params.get(key) || '1').toLowerCase();
        return !['0', 'false', 'off', 'no'].includes(value);
      }
    } catch (_) {}
    return null;
  }

  function readStorageFlag(runtime = global) {
    try {
      const value = runtime?.localStorage?.getItem?.(STORAGE_KEY);
      if (value === null || value === undefined || value === '') return true;
      return !['0', 'false', 'off', 'no'].includes(String(value).toLowerCase());
    } catch (_) {
      return true;
    }
  }

  function resolveEnabled(runtime = global, explicit = undefined) {
    if (explicit !== undefined) return Boolean(explicit);
    const urlFlag = readUrlFlag(runtime);
    if (urlFlag !== null) {
      try {
        if (urlFlag) runtime?.localStorage?.setItem?.(STORAGE_KEY, '1');
        else runtime?.localStorage?.setItem?.(STORAGE_KEY, '0');
      } catch (_) {}
      return urlFlag;
    }
    return readStorageFlag(runtime);
  }

  function sanitize(value, depth = 0, seen = new Set()) {
    if (value === null || value === undefined) return value;
    const type = typeof value;
    if (type === 'string') return value.slice(0, MAX_STRING_LENGTH);
    if (type === 'number') return Number.isFinite(value) ? round(value) : String(value);
    if (type === 'boolean') return value;
    if (type === 'function') return '[function]';
    if (type !== 'object') return String(value).slice(0, MAX_STRING_LENGTH);
    if (typeof value.then === 'function') return 'promise';
    if (seen.has(value)) return '[circular]';
    if (depth >= MAX_DEPTH) return '[max-depth]';
    seen.add(value);
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitize(item, depth + 1, seen));
      if (value.length > MAX_ARRAY_LENGTH) items.push(`...+${value.length - MAX_ARRAY_LENGTH}`);
      seen.delete(value);
      return items;
    }
    const output = {};
    const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
    keys.forEach((key) => {
      output[key] = sanitize(value[key], depth + 1, seen);
    });
    if (Object.keys(value).length > MAX_OBJECT_KEYS) {
      output.__truncatedKeys = Object.keys(value).length - MAX_OBJECT_KEYS;
    }
    seen.delete(value);
    return output;
  }

  function summarizePoint(point = {}) {
    if (!point || typeof point !== 'object') return null;
    const summary = {
      x: round(point.x ?? point.clientX),
      y: round(point.y ?? point.clientY),
    };
    if (point.pointerId !== undefined) summary.pointerId = point.pointerId;
    if (point.dx !== undefined || point.deltaX !== undefined) summary.dx = round(point.dx ?? point.deltaX);
    if (point.dy !== undefined || point.deltaY !== undefined) summary.dy = round(point.dy ?? point.deltaY);
    return summary;
  }

  function summarizeAction(action = null) {
    if (!action || typeof action !== 'object') return null;
    const summary = {
      type: action.type || '',
    };
    [
      'phase',
      'siteId',
      'territoryId',
      'cityId',
      'tileId',
      'actorId',
      'missionId',
      'tab',
      'view',
      'source',
      'action',
    ].forEach((key) => {
      if (action[key] !== undefined && action[key] !== '') summary[key] = action[key];
    });
    if (action.targetQ !== undefined || action.q !== undefined) summary.targetQ = Number(action.targetQ ?? action.q);
    if (action.targetR !== undefined || action.r !== undefined) summary.targetR = Number(action.targetR ?? action.r);
    if (action.formationSlot !== undefined || action.slot !== undefined) summary.formationSlot = Number(action.formationSlot ?? action.slot);
    if (action.background !== undefined) summary.background = Boolean(action.background);
    if (action.disabled !== undefined) summary.disabled = Boolean(action.disabled);
    return sanitize(summary);
  }

  function summarizeUiState(uiState = {}) {
    if (!uiState || typeof uiState !== 'object') return {};
    const target = uiState.worldMarchTarget || null;
    return sanitize({
      selectedSiteId: uiState.selectedSiteId || '',
      selectedWorldActorId: uiState.selectedWorldActorId || '',
      worldPanX: round(uiState.worldPanX || 0),
      worldPanY: round(uiState.worldPanY || 0),
      worldMarchTarget: target ? {
        tileId: target.tileId || '',
        q: Number(target.q ?? target.targetQ ?? 0),
        r: Number(target.r ?? target.targetR ?? 0),
        pickerOpen: Boolean(target.pickerOpen),
        known: target.known,
      } : null,
      expeditionConfigSiteId: uiState.expeditionConfigSiteId || '',
    });
  }

  function summarizeCamera(camera = {}) {
    if (!camera || typeof camera !== 'object') return null;
    return {
      x: round(camera.x || 0),
      y: round(camera.y || 0),
    };
  }

  function summarizeInputIntent(intent = null) {
    if (!intent || typeof intent !== 'object') return null;
    return sanitize({
      schema: intent.schema || '',
      kind: intent.kind || '',
      source: intent.source || '',
      inputId: intent.inputId || '',
      clientSequence: intent.clientSequence,
      points: intent.points || {},
      action: summarizeAction(intent.action),
      target: intent.target || {},
      picking: intent.picking || null,
      view: intent.view || {},
      diagnostics: intent.diagnostics || {},
    });
  }

  class ClientOperationLog {
    constructor(options = {}) {
      this.runtime = options.runtime || global;
      this.storage = options.storage || this.runtime?.sessionStorage || null;
      this.enabled = resolveEnabled(this.runtime, options.enabled);
      this.maxEntries = Math.max(1, Math.floor(toNumber(options.maxEntries, DEFAULT_MAX_ENTRIES)));
      this.persistLimit = Math.max(0, Math.floor(toNumber(options.persistLimit, DEFAULT_PERSIST_LIMIT)));
      this.flushIntervalMs = Math.max(0, toNumber(options.flushIntervalMs, DEFAULT_FLUSH_INTERVAL_MS));
      this.defaultSampleIntervalMs = Math.max(0, toNumber(options.defaultSampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS));
      this.entries = [];
      this.seq = 0;
      this.runId = String(options.runId || createRunId(this.runtime));
      this.lastFlushAt = 0;
      this.sampledAt = new Map();
      this.uploader = typeof options.uploader === 'function' ? options.uploader : null;
      this.loadPersisted();
    }

    nowMs() {
      const perfNow = this.runtime?.performance?.now?.();
      return Number.isFinite(Number(perfNow)) ? Number(perfNow) : Date.now();
    }

    wallNowMs() {
      const value = this.runtime?.Date?.now?.();
      return Number.isFinite(Number(value)) ? Number(value) : Date.now();
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      try {
        this.runtime?.localStorage?.setItem?.(STORAGE_KEY, this.enabled ? '1' : '0');
      } catch (_) {}
      return this.enabled;
    }

    loadPersisted() {
      if (!this.storage?.getItem) return false;
      try {
        const raw = this.storage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (parsed?.runId !== this.runId) {
          this.storage.removeItem?.(STORAGE_KEY);
          return false;
        }
        const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        this.entries = entries.filter((entry) => entry?.runId === this.runId).slice(-this.maxEntries);
        this.seq = this.entries.reduce((max, entry) => Math.max(max, Number(entry.seq) || 0), 0);
        return true;
      } catch (_) {
        return false;
      }
    }

    flush(force = false) {
      if (!this.persistLimit || !this.storage?.setItem) return false;
      const now = this.nowMs();
      if (!force && this.flushIntervalMs && now - this.lastFlushAt < this.flushIntervalMs) return false;
      this.lastFlushAt = now;
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify({
          schema: 'client-operation-log-v1',
          runId: this.runId,
          savedAt: safeIso(this.wallNowMs()),
          entries: this.entries.slice(-this.persistLimit),
        }));
        return true;
      } catch (_) {
        return false;
      }
    }

    record(type, detail = {}, options = {}) {
      if (!this.enabled) return null;
      const eventType = String(type || '').trim();
      if (!eventType) return null;
      const entry = {
        seq: ++this.seq,
        runId: this.runId,
        at: safeIso(this.wallNowMs()),
        atMs: round(this.nowMs()),
        type: eventType,
        detail: sanitize(detail || {}),
      };
      this.entries.push(entry);
      if (this.entries.length > this.maxEntries) {
        this.entries.splice(0, this.entries.length - this.maxEntries);
      }
      this.flush(Boolean(options.flush));
      return entry;
    }

    recordSampled(type, key, detail = {}, intervalMs = this.defaultSampleIntervalMs) {
      const sampleKey = `${type}:${String(key || 'default')}`;
      const now = this.nowMs();
      const hasPrevious = this.sampledAt.has(sampleKey);
      const previous = hasPrevious ? this.sampledAt.get(sampleKey) : 0;
      if (hasPrevious && intervalMs > 0 && now - previous < intervalMs) return null;
      this.sampledAt.set(sampleKey, now);
      return this.record(type, detail);
    }

    getEntries() {
      return this.entries.map((entry) => ({
        ...entry,
        detail: sanitize(entry.detail || {}),
      }));
    }

    getRecent(limit = 80) {
      return this.getEntries().slice(-Math.max(0, Math.floor(toNumber(limit, 80))));
    }

    clear() {
      this.entries = [];
      this.seq = 0;
      this.sampledAt.clear();
      try {
        this.storage?.removeItem?.(STORAGE_KEY);
      } catch (_) {}
      return true;
    }

    setUploader(uploader) {
      this.uploader = typeof uploader === 'function' ? uploader : null;
      return Boolean(this.uploader);
    }

    buildSnapshot(options = {}) {
      const limit = options.limit === undefined ? this.maxEntries : options.limit;
      const entries = this.getRecent(limit);
      const location = this.runtime?.location || {};
      return {
        schema: 'client-operation-log-v1',
        runId: this.runId,
        exportedAt: safeIso(this.wallNowMs()),
        reason: String(options.reason || DEFAULT_UPLOAD_REASON).slice(0, 120),
        entryCount: entries.length,
        page: sanitize({
          pathname: location.pathname || '',
          hash: location.hash || '',
          userAgent: this.runtime?.navigator?.userAgent || '',
        }),
        entries,
      };
    }

    async upload(options = {}) {
      const uploader = options.uploader || this.uploader;
      if (typeof uploader !== 'function') {
        return {
          success: false,
          error: 'CLIENT_OPERATION_LOG_UPLOADER_MISSING',
          message: 'Client operation log uploader is not configured',
        };
      }
      return uploader(this.buildSnapshot(options));
    }

    buildFileName(options = {}) {
      let playerLabel = options.playerId || options.username || '';
      if (!playerLabel) {
        try {
          playerLabel = this.runtime?.localStorage?.getItem?.('cf_username') || '';
        } catch (_) {}
      }
      return `wxgame-oplog-${sanitizeFilenamePart(playerLabel)}-${formatFileTimestamp(this.wallNowMs())}.json`;
    }

    download(options = {}) {
      const fileName = options.fileName || this.buildFileName(options);
      const text = JSON.stringify(this.buildSnapshot({
        ...options,
        reason: options.reason || 'local-download',
      }), null, 2);
      const runtime = this.runtime || global;
      const doc = runtime?.document || null;
      const BlobCtor = runtime?.Blob || global?.Blob;
      const urlApi = runtime?.URL || global?.URL;
      if (!doc?.createElement || typeof BlobCtor !== 'function' || !urlApi?.createObjectURL) {
        return {
          success: false,
          error: 'CLIENT_OPERATION_LOG_DOWNLOAD_UNSUPPORTED',
          fileName,
          text,
        };
      }
      const blob = new BlobCtor([text], { type: 'application/json;charset=utf-8' });
      const url = urlApi.createObjectURL(blob);
      try {
        const link = doc.createElement('a');
        link.href = url;
        link.download = fileName;
        link.rel = 'noopener';
        const parent = doc.body || doc.documentElement;
        parent?.appendChild?.(link);
        link.click?.();
        link.remove?.();
        return {
          success: true,
          fileName,
          entryCount: this.getRecent(options.limit === undefined ? this.maxEntries : options.limit).length,
        };
      } finally {
        const revoke = () => urlApi.revokeObjectURL?.(url);
        if (typeof runtime?.setTimeout === 'function') runtime.setTimeout(revoke, 0);
        else revoke();
      }
    }

    exportText(limit = this.maxEntries) {
      return JSON.stringify(this.buildSnapshot({ limit, reason: 'manual-export' }), null, 2);
    }
  }

  const existing = global.ClientOperationLog;
  const logger = existing && typeof existing.record === 'function'
    ? existing
    : new ClientOperationLog({ runtime: global });

  logger.summarizeAction = summarizeAction;
  logger.summarizeCamera = summarizeCamera;
  logger.summarizeInputIntent = summarizeInputIntent;
  logger.summarizePoint = summarizePoint;
  logger.summarizeUiState = summarizeUiState;
  logger.sanitize = sanitize;

  global.ClientOperationLog = logger;
  global.ClientOperationLogClass = ClientOperationLog;
  if (typeof module !== 'undefined' && module.exports) module.exports = ClientOperationLog;
})(typeof window !== 'undefined' ? window : globalThis);

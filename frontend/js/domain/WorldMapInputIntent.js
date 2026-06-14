(function (global) {
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  const SCHEMA = 'world-map-input-intent-v1';

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round(toNumber(value, 0) * factor) / factor;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function tileId(q, r) {
    if (TileCoord?.tileId) return TileCoord.tileId(q, r);
    return `tile_${toInteger(q)}_${toInteger(r)}`;
  }

  function normalizeTileEvidence(source = {}) {
    if (!source || typeof source !== 'object') return null;
    const qValue = source.targetQ ?? source.q ?? source.x;
    const rValue = source.targetR ?? source.r ?? source.y;
    if (qValue === undefined || rValue === undefined) return null;
    const coord = TileCoord?.normalizeCoord
      ? TileCoord.normalizeCoord({
        x: source.x ?? source.targetQ ?? source.q,
        y: source.y ?? source.targetR ?? source.r,
      })
      : null;
    const q = coord ? coord.x : toInteger(qValue);
    const r = coord ? coord.y : toInteger(rValue);
    return {
      tileId: coord?.tileId || tileId(q, r),
      targetQ: q,
      targetR: r,
    };
  }

  function summarizePoint(point = {}) {
    if (!point || typeof point !== 'object') return null;
    const summary = {
      x: round(point.x ?? point.clientX),
      y: round(point.y ?? point.clientY),
    };
    if (point.pointerId !== undefined) summary.pointerId = point.pointerId;
    return summary;
  }

  function copyString(value, maxLength = 96) {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value).slice(0, maxLength);
  }

  function sanitizeInputId(value) {
    const text = copyString(value, 80);
    if (!text) return '';
    return text.replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 64);
  }

  function stableHash(value = '') {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeClientSequence(value, fallback = 0) {
    const sequence = toInteger(value, fallback);
    return Number.isFinite(sequence) && sequence > 0 ? sequence : undefined;
  }

  function createInputId(options = {}) {
    const explicit = sanitizeInputId(options.inputId);
    if (explicit) return explicit;
    const sequence = normalizeClientSequence(options.clientSequence, 0) || 0;
    const action = summarizeAction(options.action || null);
    const picking = summarizePicking(options.pickingSnapshot || null);
    const physical = summarizePoint(options.physicalPoint || options.point || {});
    const layer = summarizePoint(options.layerPoint || options.physicalPoint || options.point || {});
    const hash = stableHash(JSON.stringify({
      source: options.source || 'worldMapRuntime',
      sequence,
      action,
      picking,
      physical,
      layer,
    }));
    return `wmi_${sequence || 'na'}_${hash}`.slice(0, 64);
  }

  function summarizeAction(action = null) {
    if (!action || typeof action !== 'object' || !action.type) return null;
    const summary = { type: String(action.type).slice(0, 80) };
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
      'inputSurface',
    ].forEach((key) => {
      const value = copyString(action[key]);
      if (value !== undefined) summary[key] = value;
    });
    if (action.targetQ !== undefined || action.q !== undefined) summary.targetQ = toInteger(action.targetQ ?? action.q);
    if (action.targetR !== undefined || action.r !== undefined) summary.targetR = toInteger(action.targetR ?? action.r);
    const tile = normalizeTileEvidence(summary);
    if (tile) {
      summary.tileId = tile.tileId;
      summary.targetQ = tile.targetQ;
      summary.targetR = tile.targetR;
    }
    if (action.background !== undefined) summary.background = Boolean(action.background);
    if (action.known !== undefined) summary.known = Boolean(action.known);
    if (action.disabled !== undefined) summary.disabled = Boolean(action.disabled);
    return summary;
  }

  function summarizeTarget(action = null) {
    const summary = summarizeAction(action);
    if (!summary) return { kind: 'none' };
    if (summary.siteId || summary.cityId || summary.territoryId) {
      return {
        kind: 'site',
        siteId: summary.siteId || summary.cityId || summary.territoryId,
      };
    }
    if (summary.actorId || summary.missionId) {
      return {
        kind: 'actor',
        actorId: summary.actorId || '',
        missionId: summary.missionId || '',
      };
    }
    if (summary.tileId || summary.targetQ !== undefined || summary.targetR !== undefined) {
      const target = { kind: 'tile' };
      if (summary.tileId) target.tileId = summary.tileId;
      if (summary.targetQ !== undefined) target.targetQ = summary.targetQ;
      if (summary.targetR !== undefined) target.targetR = summary.targetR;
      return target;
    }
    return { kind: summary.type || 'action' };
  }

  function summarizeCounts(counts = {}) {
    if (!counts || typeof counts !== 'object') return null;
    return {
      sites: Math.max(0, toInteger(counts.sites, 0)),
      actors: Math.max(0, toInteger(counts.actors, 0)),
      targets: Math.max(0, toInteger(counts.targets, 0)),
    };
  }

  function summarizePicking(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    return {
      schema: copyString(snapshot.schema, 80) || '',
      inputEpoch: Math.max(0, toInteger(snapshot.inputEpoch, 0)),
      signature: copyString(snapshot.signature, 160) || '',
      counts: summarizeCounts(snapshot.counts || {}),
    };
  }

  function getContextFrame(context = {}) {
    return context?.frame
      || context?.renderSnapshot?.frame
      || context?.viewport?.frame
      || null;
  }

  function getContextViewport(context = {}) {
    return context?.viewport
      || context?.renderSnapshot?.viewport
      || null;
  }

  function summarizeFrame(frame = null) {
    if (!frame || typeof frame !== 'object') return null;
    return {
      x: round(frame.x),
      y: round(frame.y),
      width: round(frame.width),
      height: round(frame.height),
    };
  }

  function summarizeViewport(viewport = null) {
    if (!viewport || typeof viewport !== 'object') return null;
    return {
      originX: round(viewport.originX),
      originY: round(viewport.originY),
      panX: round(viewport.panX),
      panY: round(viewport.panY),
      scale: round(viewport.scale, 4),
    };
  }

  function summarizeCamera(camera = {}) {
    if (!camera || typeof camera !== 'object') return null;
    return {
      x: round(camera.x),
      y: round(camera.y),
    };
  }

  function summarizeDiagnostics(diagnostics = {}) {
    const output = {};
    if (diagnostics.hitTargetCount !== undefined) {
      output.hitTargetCount = Math.max(0, toInteger(diagnostics.hitTargetCount, 0));
    }
    if (diagnostics.dragLayerOffset && typeof diagnostics.dragLayerOffset === 'object') {
      output.dragLayerOffset = {
        x: round(diagnostics.dragLayerOffset.x),
        y: round(diagnostics.dragLayerOffset.y),
      };
    }
    return output;
  }

  function summarizePoints(points = {}) {
    const output = {};
    const physical = summarizePoint(points.physical || null);
    const layer = summarizePoint(points.layer || null);
    if (physical) output.physical = physical;
    if (layer) output.layer = layer;
    return output;
  }

  function summarizeTargetInput(target = {}) {
    if (!target || typeof target !== 'object') return { kind: 'none' };
    const summary = {
      kind: copyString(target.kind, 32) || 'none',
    };
    const tileId = copyString(target.tileId);
    const siteId = copyString(target.siteId);
    const actorId = copyString(target.actorId);
    const missionId = copyString(target.missionId);
    if (tileId !== undefined) summary.tileId = tileId;
    if (siteId !== undefined) summary.siteId = siteId;
    if (actorId !== undefined) summary.actorId = actorId;
    if (missionId !== undefined) summary.missionId = missionId;
    if (target.targetQ !== undefined || target.q !== undefined) summary.targetQ = toInteger(target.targetQ ?? target.q);
    if (target.targetR !== undefined || target.r !== undefined) summary.targetR = toInteger(target.targetR ?? target.r);
    const tile = normalizeTileEvidence(summary);
    if (tile) {
      summary.tileId = tile.tileId;
      summary.targetQ = tile.targetQ;
      summary.targetR = tile.targetR;
    }
    return summary;
  }

  function summarizeView(view = {}) {
    if (!view || typeof view !== 'object') return {};
    return {
      frame: summarizeFrame(view.frame || null),
      viewport: summarizeViewport(view.viewport || null),
      camera: summarizeCamera(view.camera || null),
    };
  }

  function createTapIntent(options = {}) {
    const action = summarizeAction(options.action || null);
    const context = options.context || {};
    const clientSequence = normalizeClientSequence(options.clientSequence, 0);
    const intent = {
      schema: SCHEMA,
      kind: 'tap',
      source: copyString(options.source, 80) || 'worldMapRuntime',
      inputId: createInputId({
        ...options,
        action,
      }),
      clientSequence,
      points: {
        physical: summarizePoint(options.physicalPoint || options.point || {}),
        layer: summarizePoint(options.layerPoint || options.physicalPoint || options.point || {}),
      },
      action,
      target: summarizeTarget(action),
      picking: summarizePicking(options.pickingSnapshot || null),
      view: {
        frame: summarizeFrame(getContextFrame(context)),
        viewport: summarizeViewport(getContextViewport(context)),
        camera: summarizeCamera(options.camera || {}),
      },
      diagnostics: summarizeDiagnostics(options.diagnostics || {}),
    };
    return toSerializable(intent);
  }

  function stripEmpty(value) {
    if (Array.isArray(value)) return value.map(stripEmpty);
    if (!value || typeof value !== 'object') return value;
    const output = {};
    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined) return;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const stripped = stripEmpty(item);
        if (Object.keys(stripped).length > 0) output[key] = stripped;
        return;
      }
      output[key] = item;
    });
    return output;
  }

  function toSerializable(intent = {}) {
    return stripEmpty({
      schema: intent.schema || SCHEMA,
      kind: intent.kind || 'tap',
      source: copyString(intent.source, 80) || 'worldMapRuntime',
      inputId: sanitizeInputId(intent.inputId),
      clientSequence: normalizeClientSequence(intent.clientSequence, 0),
      points: summarizePoints(intent.points || {}),
      action: summarizeAction(intent.action || null),
      target: summarizeTargetInput(intent.target || { kind: 'none' }),
      picking: summarizePicking(intent.picking || null),
      view: summarizeView(intent.view || {}),
      diagnostics: summarizeDiagnostics(intent.diagnostics || {}),
    });
  }

  function getSerializableSizeBytes(intent = {}) {
    const json = JSON.stringify(toSerializable(intent));
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(json, 'utf8');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).length;
    return json.length;
  }

  const api = {
    SCHEMA,
    createTapIntent,
    getSerializableSizeBytes,
    summarizeAction,
    summarizePoint,
    summarizePicking,
    summarizeTarget,
    toSerializable,
  };

  global.WorldMapInputIntent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

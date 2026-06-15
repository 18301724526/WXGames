(function (global) {
  const TILE_RENDER_DIFF_LIMIT = 16;
  const TILE_RENDER_SAMPLE_LIMIT = 8;
  const TILE_RENDER_SNAPSHOT_INTERVAL_MS = 1000;

  function stableList(value = []) {
    return (Array.isArray(value) ? value : [])
      .filter(Boolean)
      .map(String)
      .sort();
  }

  function hashText(text = '') {
    let hash = 2166136261;
    const source = String(text || '');
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function summarizeTemplateAssets(tile = {}) {
    return (Array.isArray(tile.templateAssets) ? tile.templateAssets : [])
      .map((asset) => [
        asset.templateType || asset.type || '',
        asset.key || asset.name || asset.path || '',
        asset.path || '',
      ].filter(Boolean).join(':'))
      .filter(Boolean)
      .sort();
  }

  function getTileRenderSignature(tile = {}) {
    const site = tile.site || null;
    return [
      `terrain=${tile.terrain || ''}`,
      `asset=${tile.terrainAsset || ''}`,
      `water=${tile.waterAsset || tile.water?.asset || tile.water?.kind || ''}`,
      `templates=${summarizeTemplateAssets(tile).join(',')}`,
      `river=${stableList(tile.riverPorts).join(',')}`,
      `ocean=${stableList(tile.oceanTemplates).join(',')}`,
      `transition=${tile.transitionKey || ''}`,
      `visibility=${tile.visibility || ''}`,
      `visible=${tile.visible !== false ? 1 : 0}`,
      `discovered=${tile.discovered !== false ? 1 : 0}`,
      `renderReady=${tile.renderReady ? 1 : 0}`,
      `renderOnly=${tile.renderOnly ? 1 : 0}`,
      `site=${tile.siteId || ''}:${site?.id || ''}:${site?.type || ''}:${site?.status || ''}:${site?.owner || ''}:${site?.art || ''}`,
    ].join('|');
  }

  function summarizeTileEntry(tile = {}, normalizeCoord) {
    const coord = normalizeCoord(tile);
    const signature = getTileRenderSignature(tile);
    return {
      tileId: coord.tileId,
      q: coord.q,
      r: coord.r,
      signature,
      signatureHash: hashText(signature),
    };
  }

  function summarizeEntries(tiles = [], normalizeCoord) {
    return (Array.isArray(tiles) ? tiles : [])
      .map((tile) => summarizeTileEntry(tile, normalizeCoord))
      .sort((a, b) => a.q - b.q || a.r - b.r || a.tileId.localeCompare(b.tileId));
  }

  function summarizeContext(context = {}, drawTileCount = 0) {
    return {
      version: context.version || 0,
      rawTileCount: context.rawTileCount || 0,
      plannedTileCount: context.plannedTileCount || 0,
      plannedSiteCount: context.plannedSiteCount || 0,
      mergedTileCount: context.mergedTileCount || 0,
      drawTileCount,
      activeScouts: (Array.isArray(context.activeScouts) ? context.activeScouts : [])
        .slice(0, 4)
        .map((mission) => [
          mission.id || '',
          mission.status || '',
          mission.position?.tileId || '',
          Array.isArray(mission.route) ? mission.route.length : 0,
        ].join(':')),
    };
  }

  function formatEntry(entry = {}) {
    return {
      tileId: entry.tileId,
      q: entry.q,
      r: entry.r,
      signatureHash: entry.signatureHash,
      signature: entry.signature,
    };
  }

  function createState() {
    return {
      initialized: false,
      byId: new Map(),
      snapshotHash: '',
    };
  }

  function record(drawTiles = [], options = {}) {
    const logger = options.logger || global.ClientOperationLog;
    if (!logger || logger.enabled === false || (typeof logger.record !== 'function' && typeof logger.recordSampled !== 'function')) return;
    const normalizeCoord = typeof options.normalizeCoord === 'function'
      ? options.normalizeCoord
      : (tile) => ({ tileId: tile.id || '', q: tile.q || 0, r: tile.r || 0 });
    const state = options.state || createState();
    const entries = summarizeEntries(drawTiles, normalizeCoord);
    const nextById = new Map(entries.map((entry) => [entry.tileId, entry]));
    const snapshotHash = hashText(entries.map((entry) => `${entry.tileId}:${entry.signatureHash}`).join('|'));
    const contextSummary = summarizeContext(options.context || {}, entries.length);

    if (state.snapshotHash !== snapshotHash && typeof logger.recordSampled === 'function') {
      logger.recordSampled('worldMap:tileRenderSnapshot', 'tileRenderSnapshot', {
        ...contextSummary,
        signatureHash: snapshotHash,
        sample: entries.slice(0, TILE_RENDER_SAMPLE_LIMIT).map(formatEntry),
      }, TILE_RENDER_SNAPSHOT_INTERVAL_MS);
    }

    if (state.initialized && state.snapshotHash !== snapshotHash && typeof logger.record === 'function') {
      const changed = [];
      const added = [];
      const removed = [];
      entries.forEach((entry) => {
        const previous = state.byId.get(entry.tileId);
        if (!previous) {
          added.push(entry);
          return;
        }
        if (previous.signatureHash !== entry.signatureHash || previous.signature !== entry.signature) {
          changed.push({
            tileId: entry.tileId,
            q: entry.q,
            r: entry.r,
            beforeHash: previous.signatureHash,
            afterHash: entry.signatureHash,
            before: previous.signature,
            after: entry.signature,
          });
        }
      });
      state.byId.forEach((previous, tileId) => {
        if (!nextById.has(tileId)) removed.push(previous);
      });
      if (changed.length || added.length || removed.length) {
        logger.record('worldMap:tileRenderDiff', {
          ...contextSummary,
          previousSignatureHash: state.snapshotHash,
          signatureHash: snapshotHash,
          changedCount: changed.length,
          addedCount: added.length,
          removedCount: removed.length,
          changed: changed.slice(0, TILE_RENDER_DIFF_LIMIT),
          added: added.slice(0, TILE_RENDER_SAMPLE_LIMIT).map(formatEntry),
          removed: removed.slice(0, TILE_RENDER_SAMPLE_LIMIT).map(formatEntry),
        });
      }
    }

    state.initialized = true;
    state.byId = nextById;
    state.snapshotHash = snapshotHash;
  }

  const WorldTileMapRenderDiagnostics = Object.freeze({
    createState,
    getTileRenderSignature,
    hashText,
    record,
  });

  global.WorldTileMapRenderDiagnostics = WorldTileMapRenderDiagnostics;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldTileMapRenderDiagnostics;
})(typeof window !== 'undefined' ? window : globalThis);

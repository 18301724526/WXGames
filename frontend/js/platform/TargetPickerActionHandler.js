// TargetPickerActionHandler owns the world target-picker action cluster
// (open/choose/close of the multi-candidate tile picker) extracted from
// CanvasActionController in slice 11 of the god-file re-decomposition.
// SHAPE: plain class composed by CanvasActionController in its constructor;
// `core` is the controller (dispatch via core.handle, refreshWorldMarchLayer,
// shared territory ui-state), `helpers` are the controller-module helpers that
// are also used by code that stayed behind. Shared pure helpers (t, clonePlain,
// openTargetPickerSnapshot) are borrowed from WorldMarchActionHandler statics
// so each body exists in exactly one file. Bodies are verbatim relocations.
(function (global) {
  var WorldMarchActionHandlerBase = global.WorldMarchActionHandler;
  if (typeof module !== 'undefined' && module.exports && !WorldMarchActionHandlerBase) {
    WorldMarchActionHandlerBase = require('./WorldMarchActionHandler');
  }
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    try {
      if (typeof require === 'function') return require('../ecs/foundation/TileCoord');
    } catch (_error) {
      // Optional dependency in browser bundles.
    }
    return null;
  })();
  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    try {
      if (typeof require === 'function') return require('./CanvasModalSnapshotAdapter');
    } catch (_error) {
      // Optional adapter in standalone action tests.
    }
    return null;
  })();

  const t = WorldMarchActionHandlerBase.t;
  const clonePlain = WorldMarchActionHandlerBase.clonePlain;
  const openTargetPickerSnapshot = WorldMarchActionHandlerBase.openTargetPickerSnapshot;

  function getTargetPickerSnapshot(host) {
    if (typeof host?.getTargetPickerSnapshot === 'function') return host.getTargetPickerSnapshot();
    return CanvasModalSnapshotAdapter?.getTargetPickerSnapshot?.(host) || null;
  }

  function sanitizeWorldTargetCandidate(candidate = {}, index = 0) {
    const action = clonePlain(candidate.action || {});
    if (!action?.type) return null;
    return {
      id: String(
        candidate.id ||
          action.siteId ||
          action.cityId ||
          action.territoryId ||
          action.actorId ||
          action.missionId ||
          `target-${index}`,
      ),
      index,
      kind: candidate.kind || (action.type === 'selectWorldActor' ? 'actor' : 'site'),
      label: String(
        candidate.label ||
          action.actorName ||
          action.siteName ||
          action.cityName ||
          action.siteId ||
          action.actorId ||
          t('common.target'),
      ),
      subtitle: String(candidate.subtitle || action.statusLabel || action.ownerLabel || ''),
      tileId: candidate.tileId || action.tileId || '',
      q: candidate.q,
      r: candidate.r,
      action,
    };
  }

  function sanitizeWorldTargetPicker(action = {}) {
    const candidates = (Array.isArray(action.candidates) ? action.candidates : [])
      .map((candidate, index) => sanitizeWorldTargetCandidate(candidate, index))
      .filter(Boolean);
    if (!candidates.length) return null;
    const q = Math.floor(Number(action.q ?? action.targetQ ?? candidates[0]?.q));
    const r = Math.floor(Number(action.r ?? action.targetR ?? candidates[0]?.r));
    const coord =
      Number.isFinite(q) && Number.isFinite(r)
        ? TileCoord?.normalizeCoord?.({ q, r, tileId: action.tileId }) || {
            q,
            r,
            tileId: action.tileId || `${q},${r}`,
          }
        : { q: undefined, r: undefined, tileId: action.tileId || candidates[0]?.tileId || '' };
    return {
      tileId: coord.tileId || action.tileId || candidates[0]?.tileId || '',
      q: coord.q,
      r: coord.r,
      anchorX: Number.isFinite(Number(action.anchorX)) ? Number(action.anchorX) : undefined,
      anchorY: Number.isFinite(Number(action.anchorY)) ? Number(action.anchorY) : undefined,
      candidates,
    };
  }

  class TargetPickerActionHandler {
    constructor(options = {}) {
      this.core = options.core || null;
      this.helpers = options.helpers || {};
    }

    openWorldTargetPicker(action) {
      const picker = sanitizeWorldTargetPicker(action);
      if (!picker) return false;
      const game = this.core.getGameHost();
      game?.territoryController?.closeSiteDialog?.({ render: false });
      const uiState = this.core.getSharedTerritoryUiState();
      if (!openTargetPickerSnapshot(this.core.host, { pickerKind: 'worldTargetPicker', picker }))
        return false;
      // The candidate picker supersedes any pending march target.
      uiState.worldMarchTarget = null;
      uiState.selectedWorldActorId = '';
      uiState.selectedWorldMissionId = '';
      uiState.selectedSiteId = '';
      uiState.expeditionConfigSiteId = '';
      return this.core.refreshWorldMarchLayer(action);
    }

    chooseWorldTarget(action, meta = {}) {
      const picker = getTargetPickerSnapshot(this.core.host)?.picker || {};
      const candidates = Array.isArray(picker.candidates) ? picker.candidates : [];
      const candidate =
        candidates.find((item) => String(item.id) === String(action.targetId || action.id || '')) ||
        candidates[Math.max(0, Math.floor(Number(action.index) || 0))] ||
        null;
      const nextAction = candidate?.action || action.action || null;
      if (!nextAction?.type || nextAction.type === 'chooseWorldTarget') return false;
      this.helpers.closeTargetPickerSnapshot(this.core.host);
      if (typeof this.core.handle === 'function') return this.core.handle(nextAction, meta);
      const handler = this.core[`handle_${nextAction.type}`];
      return typeof handler === 'function' ? handler.call(this.core, nextAction, meta) : false;
    }

    closeWorldTargetPicker(action) {
      this.helpers.closeTargetPickerSnapshot(this.core.host);
      return this.core.refreshWorldMarchLayer(action);
    }
  }

  global.TargetPickerActionHandler = TargetPickerActionHandler;
  if (typeof module !== 'undefined' && module.exports) module.exports = TargetPickerActionHandler;
})(typeof globalThis !== 'undefined' ? globalThis : window);

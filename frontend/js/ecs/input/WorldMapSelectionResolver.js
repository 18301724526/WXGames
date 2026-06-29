(function (global) {
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../foundation/TileCoord');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const WORLD_ENTITY_ACTIONS = Object.freeze([
    'openWorldSite',
    'selectWorldActor',
  ]);
  const WORLD_ENTITY_ACTION_SET = new Set(WORLD_ENTITY_ACTIONS);
  const KIND_PRIORITY = Object.freeze({
    site: 30,
    actor: 20,
    city: 30,
  });

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function parseTileId(tileId = '') {
    const match = String(tileId || '').match(/^tile_(-?\d+)_(-?\d+)$/);
    if (!match) return null;
    return {
      q: Number(match[1]),
      r: Number(match[2]),
      x: Number(match[1]),
      y: Number(match[2]),
      tileId: TileCoord.tileId(Number(match[1]), Number(match[2])),
    };
  }

  function normalizeCoord(source = {}, fallback = {}) {
    const fromTileId = parseTileId(source.tileId || source.id || fallback.tileId || fallback.id || '');
    const hasAxis = source.x !== undefined || source.q !== undefined || fallback.x !== undefined || fallback.q !== undefined;
    if (!hasAxis && fromTileId) return fromTileId;
    return TileCoord.normalizeCoord(source, fallback);
  }

  function hasCoordEvidence(source = {}) {
    if (!source || typeof source !== 'object') return false;
    if (parseTileId(source.tileId || source.id || '')) return true;
    const hasX = source.x !== undefined || source.q !== undefined;
    const hasY = source.y !== undefined || source.r !== undefined;
    return hasX && hasY;
  }

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    const output = {};
    Object.entries(value).forEach(([key, next]) => {
      if (typeof next !== 'function') output[key] = clonePlain(next);
    });
    return output;
  }

  function isWorldEntityAction(action = {}) {
    return Boolean(action?.type && WORLD_ENTITY_ACTION_SET.has(action.type));
  }

  function getActionEntityId(action = {}) {
    return action.siteId || action.territoryId || action.cityId || action.actorId || action.missionId || action.tileId || '';
  }

  function inferKind(action = {}, target = {}) {
    if (target.kind === 'actor' || action.type === 'selectWorldActor') return 'actor';
    if (target.kind === 'site' || action.type === 'openWorldSite') return 'site';
    return target.kind || 'target';
  }

  function getCandidateLabel(kind = '', action = {}, target = {}) {
    if (target.label) return String(target.label);
    if (action.label) return String(action.label);
    if (kind === 'actor') return action.actorName || action.formationLabel || action.missionId || action.actorId || t('world.targetPicker.actor.default');
    if (kind === 'site') return action.siteName || action.cityName || action.name || action.siteId || action.cityId || t('world.targetPicker.site.player');
    return action.type || t('world.targetPicker.kind.generic');
  }

  function getCandidateSubtitle(kind = '', action = {}, target = {}) {
    if (target.subtitle) return String(target.subtitle);
    if (action.subtitle) return String(action.subtitle);
    if (kind === 'actor') return action.statusLabel || action.status || t('world.targetPicker.actor.activeSubtitle');
    if (kind === 'site') return action.ownerLabel || action.owner || t('world.targetPicker.site.neutral');
    return '';
  }

  function getCandidateCoord(action = {}, target = {}, fallback = {}) {
    const coordSources = [
      target.coord,
      target.tile,
      target.current,
      action.coord,
      action.tile,
      action.current,
      {
        q: action.targetQ ?? action.q,
        r: action.targetR ?? action.r,
        tileId: action.tileId,
      },
      fallback,
    ].filter(Boolean);
    let coord = null;
    for (const source of coordSources) {
      if (!hasCoordEvidence(source)) continue;
      const next = normalizeCoord(source, coord || fallback || {});
      if (Number.isFinite(Number(next.q)) && Number.isFinite(Number(next.r))) {
        coord = next;
        break;
      }
    }
    return coord || null;
  }

  function getTargetAnchor(target = {}) {
    const x = target.anchorX ?? target.x + toNumber(target.width) / 2;
    const y = target.anchorY ?? target.y + toNumber(target.height) / 2;
    return Number.isFinite(Number(x)) && Number.isFinite(Number(y))
      ? { x: Number(x), y: Number(y) }
      : null;
  }

  function createCandidate(target = {}, index = 0, options = {}) {
    const action = target.action || target;
    if (!isWorldEntityAction(action)) return null;
    const kind = inferKind(action, target);
    const coord = getCandidateCoord(action, target, options.tile || {});
    const id = String(target.id || getActionEntityId(action) || `${kind}-${index}`);
    return {
      id,
      kind,
      label: getCandidateLabel(kind, action, target),
      subtitle: getCandidateSubtitle(kind, action, target),
      tileId: coord?.tileId || action.tileId || options.tile?.tileId || '',
      q: coord?.q,
      r: coord?.r,
      priority: toNumber(target.priority, KIND_PRIORITY[kind] || 0),
      action: clonePlain(action),
      anchor: getTargetAnchor(target),
    };
  }

  function uniqueCandidates(candidates = []) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      if (!candidate?.action?.type) return false;
      const key = [
        candidate.kind || '',
        candidate.action.type || '',
        candidate.action.siteId || candidate.action.cityId || candidate.action.territoryId || '',
        candidate.action.actorId || candidate.action.missionId || '',
        candidate.tileId || '',
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sortCandidates(candidates = []) {
    return candidates.slice().sort((a, b) => (
      toNumber(b.priority, 0) - toNumber(a.priority, 0)
      || (KIND_PRIORITY[b.kind] || 0) - (KIND_PRIORITY[a.kind] || 0)
      || String(a.label || '').localeCompare(String(b.label || ''))
    ));
  }

  function normalizeCandidates(targets = [], options = {}) {
    return sortCandidates(uniqueCandidates((Array.isArray(targets) ? targets : [])
      .map((target, index) => createCandidate(target, index, options))
      .filter(Boolean)));
  }

  function resolveSharedTile(candidates = [], fallback = {}) {
    const first = candidates.find((candidate) => hasCoordEvidence(candidate));
    if (first) return normalizeCoord(first, fallback);
    return hasCoordEvidence(fallback) ? normalizeCoord(fallback, {}) : {};
  }

  function resolveAnchor(candidates = [], point = {}) {
    const anchored = candidates.find((candidate) => candidate?.anchor);
    if (anchored?.anchor) return anchored.anchor;
    const x = Number(point.x);
    const y = Number(point.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  function createPickerAction(candidates = [], options = {}) {
    const normalized = normalizeCandidates(candidates, options);
    if (normalized.length <= 1) return normalized[0]?.action || null;
    const tile = resolveSharedTile(normalized, options.tile || {});
    const anchor = resolveAnchor(normalized, options.point || {});
    return {
      type: 'openWorldTargetPicker',
      tileId: tile.tileId,
      q: tile.q,
      r: tile.r,
      anchorX: anchor?.x,
      anchorY: anchor?.y,
      candidates: normalized.map((candidate, index) => ({
        ...candidate,
        index,
        anchor: undefined,
      })),
    };
  }

  function resolveCandidates(candidates = [], options = {}) {
    const normalized = normalizeCandidates(candidates, options);
    if (normalized.length === 0) return null;
    if (normalized.length === 1) return normalized[0].action;
    return createPickerAction(normalized, options);
  }

  const api = {
    WORLD_ENTITY_ACTIONS,
    createCandidate,
    createPickerAction,
    isWorldEntityAction,
    normalizeCandidates,
    normalizeCoord,
    resolveCandidates,
    t,
  };

  global.WorldMapSelectionResolver = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

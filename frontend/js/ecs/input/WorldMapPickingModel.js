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

  const WorldMarchSystem = (() => {
    if (global.WorldMarchSystem) return global.WorldMarchSystem;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../system/WorldMarchSystem');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../foundation/TileCoord');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const WorldMapSelectionResolver = (() => {
    if (global.WorldMapSelectionResolver) return global.WorldMapSelectionResolver;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./WorldMapSelectionResolver');
      } catch (_error) {
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

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function toInteger(value, fallback = 0) {
    return Math.floor(toNumber(value, fallback));
  }

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function getActorTargetCoordSource(actor = {}) {
    if (actor.current) return { source: 'current', coord: actor.current };
    if (actor.position) return { source: 'position', coord: actor.position };
    if (actor.origin) return { source: 'origin', coord: actor.origin };
    return { source: 'none', coord: {} };
  }

  function normalizeCoord(source = {}, fallback = {}) {
    return TileCoord.normalizeCoord(source, fallback);
  }

  function readStableAxis(source = {}, primaryKey = 'x', aliasKey = 'q', fallback = '') {
    return source?.[primaryKey] !== undefined
      ? source[primaryKey]
      : (source?.[aliasKey] ?? fallback);
  }

  function hashStep(hash, value) {
    return SignatureHash.hashStep(hash, value);
  }

  function containsPoint(target = {}, point = {}) {
    const x = Number(point.x);
    const y = Number(point.y);
    return Boolean(
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= toNumber(target.x) &&
      x <= toNumber(target.x) + toNumber(target.width) &&
      y >= toNumber(target.y) &&
      y <= toNumber(target.y) + toNumber(target.height),
    );
  }

  function getTileMapView(context = {}) {
    return context?.tileMapView || context?.renderSnapshot?.tileMapView || {};
  }

  function getViewport(context = {}) {
    return context?.viewport || context?.renderSnapshot?.viewport || {};
  }

  function getGeometry(context = {}) {
    const tileMapView = getTileMapView(context);
    return (
      context?.geometry ||
      context?.renderSnapshot?.geometry ||
      tileMapView?.geometry ||
      getViewport(context)?.geometry ||
      {}
    );
  }

  function getFrame(context = {}) {
    return context?.frame || context?.renderSnapshot?.frame || context?.viewport?.frame || {};
  }

  function getTileScreenCenter(tile = {}, viewport = {}, geometry = {}) {
    if (WorldMarchSystem?.getTileScreenCenter) {
      return WorldMarchSystem.getTileScreenCenter(tile, viewport, geometry);
    }
    const stepX = toNumber(geometry.stepX, 96);
    const stepY = toNumber(geometry.stepY, 48);
    const q = toNumber(tile.q ?? tile.x, 0);
    const r = toNumber(tile.r ?? tile.y, 0);
    return {
      x:
        toNumber(viewport.originX) +
        toNumber(viewport.panX) +
        (q - r) * stepX * toNumber(viewport.scale, 1),
      y:
        toNumber(viewport.originY) +
        toNumber(viewport.panY) +
        (q + r) * stepY * toNumber(viewport.scale, 1),
    };
  }

  function getActors(context = {}) {
    if (Array.isArray(context?.actors)) return context.actors;
    if (Array.isArray(context?.renderSnapshot?.actors)) return context.renderSnapshot.actors;
    return [];
  }

  function getSiteFromTile(tile = {}, siteById = new Map()) {
    if (tile?.site?.id) return tile.site;
    if (tile?.siteId && siteById.has(String(tile.siteId))) return siteById.get(String(tile.siteId));
    return null;
  }

  function getSiteId(tile = {}, site = null) {
    return site?.id || tile?.siteId || tile?.site?.id || '';
  }

  function createSiteTarget(tile = {}, site = null, context = {}) {
    const viewport = getViewport(context);
    const geometry = getGeometry(context);
    const coord = normalizeCoord(tile);
    const center = getTileScreenCenter(tile, viewport, geometry);
    const scale = Math.max(0.05, toNumber(viewport.scale, 1));
    const tileWidth = Math.max(1, toNumber(geometry.tileWidth, 192) * scale);
    const tileHeight = Math.max(1, toNumber(geometry.tileHeight, 96) * scale);
    const drawW = tileWidth * toNumber(site?.scale, 0.46);
    const drawH = drawW * (88 / 96);
    const baseX = center.x + toNumber(site?.offset?.x, 0) * scale;
    const baseY = center.y + toNumber(site?.offset?.y, 0) * scale - tileHeight * 0.16;
    const drawX = baseX - drawW * 0.5;
    const drawY = baseY - drawH * 0.86;
    const siteId = getSiteId(tile, site);
    if (!siteId) return null;
    return {
      x: drawX - 8,
      y: drawY - 8,
      width: drawW + 16,
      height: drawH + 26,
      priority: 20,
      kind: 'site',
      label:
        site?.cityName ||
        site?.naturalName ||
        site?.name ||
        site?.title ||
        (site?.owner === 'player'
          ? t('world.targetPicker.site.player')
          : t('world.targetPicker.site.neutral')),
      subtitle:
        site?.owner === 'player'
          ? t('world.targetPicker.site.playerSubtitle')
          : site?.owner === 'neutral'
            ? t('world.targetPicker.site.neutralSubtitle')
            : t('world.targetPicker.site.worldSubtitle'),
      action: {
        type: 'openWorldSite',
        siteId,
        tileId: coord.tileId,
        siteName: site?.cityName || site?.naturalName || site?.name || site?.title || '',
        owner: site?.owner || '',
      },
    };
  }

  function createActorTarget(actor = {}, context = {}) {
    const selected = getActorTargetCoordSource(actor);
    const current = selected.coord;
    if (
      !Number.isFinite(Number(current.q ?? current.x)) ||
      !Number.isFinite(Number(current.r ?? current.y))
    )
      return null;
    const point = getTileScreenCenter(current, getViewport(context), getGeometry(context));
    const size = 42;
    const actorId = actor.id || actor.actorId || actor.missionId || '';
    const missionId = actor.missionId || actor.id || '';
    if (!actorId && !missionId) return null;
    return {
      x: point.x - size / 2,
      y: point.y - size / 2 - 16,
      width: size,
      height: size,
      priority: 10,
      kind: 'actor',
      label:
        actor.formation?.label ||
        actor.formation?.name ||
        actor.name ||
        actor.label ||
        t('world.targetPicker.actor.default'),
      subtitle:
        actor.status === 'active'
          ? t('world.targetPicker.actor.activeSubtitle')
          : t('world.targetPicker.actor.idleSubtitle'),
      current,
      action: {
        type: 'selectWorldActor',
        actorId,
        missionId,
        actorName:
          actor.formation?.label || actor.formation?.name || actor.name || actor.label || '',
        status: actor.status || '',
        ...(actor.combatTarget
          ? {
              combatEncounterId: actor.combatTarget.encounterId,
              combatTarget: actor.combatTarget,
            }
          : {}),
      },
    };
  }

  function createSiteTargets(context = {}) {
    const tileMapView = getTileMapView(context);
    const sites = Array.isArray(tileMapView.sites) ? tileMapView.sites : [];
    const siteById = new Map(
      sites.filter((site) => site?.id).map((site) => [String(site.id), site]),
    );
    return (Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [])
      .map((tile) => createSiteTarget(tile, getSiteFromTile(tile, siteById), context))
      .filter(Boolean);
  }

  function createActorTargets(context = {}) {
    return getActors(context)
      .map((actor) => createActorTarget(actor, context))
      .filter(Boolean);
  }

  function targetSignature(target = {}) {
    const action = target.action || {};
    return [
      target.kind || '',
      action.type || '',
      action.siteId || '',
      action.actorId || '',
      action.missionId || '',
      action.tileId || '',
      Math.round(toNumber(target.x) * 10) / 10,
      Math.round(toNumber(target.y) * 10) / 10,
      Math.round(toNumber(target.width) * 10) / 10,
      Math.round(toNumber(target.height) * 10) / 10,
    ].join(':');
  }

  function buildSignature(context = {}) {
    const tileMapView = getTileMapView(context);
    const viewport = getViewport(context);
    const geometry = getGeometry(context);
    const frame = getFrame(context);
    const tiles = Array.isArray(tileMapView.tiles) ? tileMapView.tiles : [];
    const actors = getActors(context);
    let hash = SignatureHash.FNV_OFFSET_BASIS;
    [
      tileMapView.signature || '',
      tileMapView.version || 0,
      tileMapView.seed || '',
      tiles.length,
      actors.length,
      Math.round(toNumber(viewport.originX) * 10) / 10,
      Math.round(toNumber(viewport.originY) * 10) / 10,
      Math.round(toNumber(viewport.panX) * 10) / 10,
      Math.round(toNumber(viewport.panY) * 10) / 10,
      Math.round(toNumber(viewport.scale, 1) * 1000),
      Math.round(toNumber(frame.x) * 10) / 10,
      Math.round(toNumber(frame.y) * 10) / 10,
      Math.round(toNumber(frame.width) * 10) / 10,
      Math.round(toNumber(frame.height) * 10) / 10,
      toNumber(geometry.tileWidth, 192),
      toNumber(geometry.tileHeight, 96),
      toNumber(geometry.stepX, 96),
      toNumber(geometry.stepY, 48),
      toNumber(geometry.anchorY, 0.5),
    ].forEach((part) => {
      hash = hashStep(hash, part);
    });
    tiles.forEach((tile) => {
      const coord = normalizeCoord(tile);
      [
        coord.tileId || '',
        coord.x,
        coord.y,
        tile?.siteId || '',
        tile?.site?.id || '',
        tile?.site?.type || '',
        tile?.site?.owner || '',
        tile?.site?.scale || '',
        tile?.site?.offset?.x || 0,
        tile?.site?.offset?.y || 0,
      ].forEach((part) => {
        hash = hashStep(hash, part);
      });
    });
    actors.forEach((actor) => {
      const current = actor?.current || actor?.position || actor?.origin || {};
      const coord = normalizeCoord(current);
      [
        actor?.id || '',
        actor?.actorId || '',
        actor?.missionId || '',
        actor?.status || '',
        readStableAxis(current, 'x', 'q'),
        readStableAxis(current, 'y', 'r'),
        coord.tileId || '',
      ].forEach((part) => {
        hash = hashStep(hash, part);
      });
    });
    (Array.isArray(tileMapView.sites) ? tileMapView.sites : []).forEach((site) => {
      [
        site?.id || '',
        site?.type || '',
        site?.owner || '',
        site?.status || '',
        site?.scale || '',
        site?.offset?.x || 0,
        site?.offset?.y || 0,
      ].forEach((part) => {
        hash = hashStep(hash, part);
      });
    });
    return `${tileMapView.version || 0}:${tiles.length}:${actors.length}:${(hash >>> 0).toString(16)}`;
  }

  function createSnapshot(context = {}, options = {}) {
    const siteTargets = createSiteTargets(context);
    const actorTargets = createActorTargets(context);
    const targets = [...siteTargets, ...actorTargets];
    const signature = options.signature || buildSignature(context);
    return {
      schema: 'world-map-picking-snapshot-v1',
      inputEpoch: Math.max(0, toInteger(options.inputEpoch, 0)),
      signature,
      frame: { ...getFrame(context) },
      targets,
      counts: {
        sites: siteTargets.length,
        actors: actorTargets.length,
        targets: targets.length,
      },
    };
  }

  function isWorldSiteAction(action = {}) {
    return action?.type === 'openWorldSite' || action?.type === 'enterCity';
  }

  function resolveCandidates(point = {}, snapshot = {}, options = {}) {
    const targets = Array.isArray(snapshot?.targets) ? snapshot.targets : [];
    const matches = [];
    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (!target?.action || !containsPoint(target, point)) continue;
      matches.push({ ...target, index });
    }
    if (WorldMapSelectionResolver?.normalizeCandidates) {
      return WorldMapSelectionResolver.normalizeCandidates(matches, {
        point,
        tile: options.tile || {},
      });
    }
    return matches;
  }

  function resolveAction(point = {}, snapshot = {}) {
    const candidates = resolveCandidates(point, snapshot);
    if (WorldMapSelectionResolver?.resolveCandidates) {
      const resolved = WorldMapSelectionResolver.resolveCandidates(candidates, { point });
      if (resolved) return resolved;
    }
    const matches = candidates.map((target, index) => ({ target, index }));
    const site = matches.find(({ target }) => isWorldSiteAction(target.action));
    if (site) return site.target.action;
    const top = matches.sort(
      (a, b) =>
        toNumber(b.target.priority, 0) - toNumber(a.target.priority, 0) || b.index - a.index,
    )[0];
    return top?.target?.action || null;
  }

  const api = {
    buildSignature,
    containsPoint,
    createActorTargets,
    createSiteTargets,
    createSnapshot,
    resolveCandidates,
    resolveAction,
    targetSignature,
    t,
  };

  global.WorldMapPickingModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

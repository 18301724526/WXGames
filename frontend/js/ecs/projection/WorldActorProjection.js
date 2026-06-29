(function (global) {
  const ProgressSnapshot = (() => {
    if (global.WorldMarchProgressSnapshot) return global.WorldMarchProgressSnapshot;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../system/WorldMarchProgressSnapshot');
      } catch (error) {
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
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  function coordKey(coord = {}) {
    if (!coord || typeof coord !== 'object') return '0:0';
    return TileCoord.normalizeCoord(coord).tileId;
  }

  function isSameCoord(a = {}, b = {}) {
    return coordKey(a) === coordKey(b);
  }

  function getHomeCoord(row = {}) {
    return row.homeOrigin || row.formation?.homeOrigin || row.origin || {};
  }

  function getProjectionKind(row = {}) {
    if (row.status === 'active') {
      return 'worldRoute';
    }
    if (row.status !== 'idle') {
      return '';
    }
    if (row.rawStatus && row.rawStatus !== 'idle' && row.mode !== 'manual') {
      return '';
    }
    const current = row.current || row.position || row.target || {};
    const homeCoord = getHomeCoord(row);
    const result = isSameCoord(current, homeCoord) ? 'garrisonedAtHome' : 'parkedAwayFromHome';
    return result;
  }

  function shouldRenderWorldActor(row = {}) {
    const kind = getProjectionKind(row);
    return kind === 'worldRoute' || kind === 'parkedAwayFromHome';
  }

  function projectActorFromProgress(row = {}) {
    if (!shouldRenderWorldActor(row)) return null;
    const actor = ProgressSnapshot?.buildActorFromProgress
      ? ProgressSnapshot.buildActorFromProgress(row)
      : null;
    if (!actor) return null;
    return {
      ...actor,
      projection: {
        kind: getProjectionKind(row),
        source: 'WorldActorProjection',
      },
    };
  }

  function normalizeCombatEncounterCoord(encounter = {}) {
    return TileCoord.normalizeCoord(encounter);
  }

  function projectActorFromCombatEncounter(encounter = {}) {
    if (!encounter || typeof encounter !== 'object' || encounter.status !== 'active') return null;
    const current = normalizeCombatEncounterCoord(encounter);
    const id = encounter.id || `combat_${current.tileId}`;
    // A localized nameKey from the backend wins over the raw (often English) name, so the
    // renderer translates it; only fall back to showing the literal name when no key exists.
    const encounterNameKey = String(encounter.nameKey || '').trim();
    const hasEncounterName = !encounterNameKey && Boolean(String(encounter.name || '').trim());
    const displayName = hasEncounterName ? encounter.name : '';
    const resolvedNameKey =
      encounterNameKey || (hasEncounterName ? '' : 'world.combat.hostileForce.title');
    return {
      id,
      actorId: id,
      type: 'hostileForce',
      kind: 'worldCombatEncounter',
      status: 'idle',
      unitKey: encounter.unitKey || 'hostile_squad_default',
      animationId: 'move',
      name: displayName,
      label: displayName,
      nameKey: resolvedNameKey,
      labelKey: resolvedNameKey,
      current,
      target: current,
      origin: current,
      combatTarget: {
        encounterId: id,
        q: current.q,
        r: current.r,
        tileId: current.tileId,
        name: displayName,
        nameKey: resolvedNameKey,
        terrain: encounter.terrain || encounter.battleTarget?.tile?.terrain || '',
        defender: encounter.defender || encounter.battleTarget?.defender || null,
        battleTarget: encounter.battleTarget || null,
      },
      projection: {
        kind: 'combatEncounter',
        source: 'WorldActorProjection',
      },
    };
  }

  function getCombatEncounters(input = {}) {
    const explorer = input?.worldExplorerState || input || {};
    const combat = explorer.combat || {};
    return Array.isArray(combat.activeEncounters) ? combat.activeEncounters : [];
  }

  function getRows(input = {}, options = {}) {
    if (Array.isArray(input.rows)) return input.rows;
    if (input.schema === 'world-march-progress-snapshot-v1') return input.missions || [];
    if (!ProgressSnapshot?.createSnapshot) return [];
    return ProgressSnapshot.createSnapshot(input, options).missions || [];
  }

  function projectWorldActors(input = {}, options = {}) {
    return [
      ...getRows(input, options).map(projectActorFromProgress).filter(Boolean),
      ...getCombatEncounters(input).map(projectActorFromCombatEncounter).filter(Boolean),
    ];
  }

  const api = {
    coordKey,
    getProjectionKind,
    isSameCoord,
    projectActorFromProgress,
    projectActorFromCombatEncounter,
    projectWorldActors,
    shouldRenderWorldActor,
  };

  global.WorldActorProjection = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

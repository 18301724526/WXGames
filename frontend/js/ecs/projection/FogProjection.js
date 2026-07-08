'use strict';

// Fog render projection. PURE: given the per-frame inputs it computes the renderer
// context + visibility snapshot fresh and returns them. It owns NO state (the old
// FogOwner "owner" object was just this return value wrapped in ensure/get accessors).
// Single responsibility: turn fog inputs -> renderer context. One file to read.

const SCHEMA = 'fog-projection-v1';

function cloneArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function resolveDependency(options = {}, optionKey = '', globalKey = '') {
  if (options.dependencies?.[optionKey]) return options.dependencies[optionKey];
  if (options[optionKey]) return options[optionKey];
  if (typeof globalThis !== 'undefined' && globalThis[globalKey]) return globalThis[globalKey];
  return null;
}

function resolveFogDependencies(options = {}) {
  return {
    visibilityModel: resolveDependency(options, 'visibilityModel', 'WorldMapVisibilityModel'),
    fogVisualSnapshot: resolveDependency(options, 'fogVisualSnapshot', 'WorldFogVisualSnapshot'),
    worldMarchSystem: resolveDependency(options, 'worldMarchSystem', 'WorldMarchSystem'),
    fogRevealModel: resolveDependency(options, 'fogRevealModel', 'FogRevealModel'),
  };
}

function resolveEpochNowMs(input = {}, options = {}) {
  const value = options.epochNowMs ?? options.nowMs ?? options.serverNowMs ?? input.epochNowMs;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function requireEpochNowMs(input = {}, options = {}) {
  const nowMs = resolveEpochNowMs(input, options);
  if (!Number.isFinite(nowMs)) {
    throw new Error(
      'FogProjection requires a finite epochNowMs (pass options.epochNowMs from WorldClock); ' +
        'fog reveal is a function of time and must never fall back to stale data',
    );
  }
  return nowMs;
}

// Mission facts for the reveal projection: current explorer state plus the tile-map view
// scouts. Time-derived fields are NOT read from these objects — only route facts are.
function collectRevealMissions(input = {}) {
  const worldExplorerState = input.worldExplorerState || input.state?.worldExplorerState || {};
  const byId = new Map();
  const append = (mission) => {
    if (!mission || typeof mission !== 'object') return;
    const id = String(mission.id || mission.missionId || `mission-${byId.size}`);
    byId.set(id, { ...(byId.get(id) || {}), ...mission });
  };
  (Array.isArray(input.tileMapView?.activeScouts) ? input.tileMapView.activeScouts : []).forEach(
    append,
  );
  (Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions : []).forEach(append);
  append(worldExplorerState.activeMission);
  (Array.isArray(worldExplorerState.idleMissions) ? worldExplorerState.idleMissions : []).forEach(
    append,
  );
  return [...byId.values()];
}

function buildVisibilityActors(
  input = {},
  options = {},
  dependencies = resolveFogDependencies(options),
) {
  const nowMs = requireEpochNowMs(input, options);
  if (!dependencies.worldMarchSystem?.buildActors) {
    throw new Error(
      'FogProjection requires WorldMarchSystem.buildActors (load WorldMarchSystem.js first); ' +
        'fog actors must be projected fresh, never read from cached render snapshots',
    );
  }
  const worldExplorerState = input.worldExplorerState || input.state?.worldExplorerState || {};
  const fromExplorer = dependencies.worldMarchSystem.buildActors(worldExplorerState, { nowMs });
  if (Array.isArray(fromExplorer) && fromExplorer.length) return fromExplorer;
  const activeScouts = input.tileMapView?.activeScouts || [];
  const fromTileMap = dependencies.worldMarchSystem.buildActors(
    { missions: activeScouts },
    { nowMs },
  );
  return Array.isArray(fromTileMap) ? fromTileMap : [];
}

function buildRevealSnapshot(
  input = {},
  options = {},
  dependencies = resolveFogDependencies(options),
) {
  const nowMs = requireEpochNowMs(input, options);
  if (!dependencies.fogRevealModel?.createSnapshot) {
    throw new Error(
      'FogProjection requires FogRevealModel (load FogRevealModel.js first); ' +
        'reveal strength must be projected for the current instant on every frame',
    );
  }
  return dependencies.fogRevealModel.createSnapshot(collectRevealMissions(input), nowMs);
}

function buildVisibilitySnapshot(
  input = {},
  options = {},
  dependencies = resolveFogDependencies(options),
) {
  if (!dependencies.visibilityModel?.createSnapshot) return null;
  const tileMapView = input.tileMapView || input.renderSnapshot?.tileMapView || {};
  return dependencies.visibilityModel.createSnapshot(
    {
      territoryState: input.territoryState || input.state?.territoryState || {},
      worldMap: {
        ...(input.worldMap || input.state?.territoryState?.worldMap || tileMapView || {}),
        tiles: Array.isArray(input.tiles)
          ? input.tiles
          : Array.isArray(tileMapView.tiles)
            ? tileMapView.tiles
            : [],
      },
      worldExplorerState: input.worldExplorerState || input.state?.worldExplorerState || {},
      missions: input.missions,
    },
    options.visibilityOptions || options,
  );
}

// Pure projection: inputs -> { schema, epochNowMs, visibilitySnapshot, fogVisualSnapshot,
// rendererContext, signature }. The caller reads .rendererContext directly (no owner wrapper).
function createFogProjection(input = {}, options = {}) {
  const dependencies = resolveFogDependencies(options);
  const epochNowMs = requireEpochNowMs(input, options);
  const renderSnapshot = input.renderSnapshot || null;
  const tileMapView = input.tileMapView || renderSnapshot?.tileMapView || {};
  const viewport = input.viewport || renderSnapshot?.viewport || {};
  const frame = input.frame || renderSnapshot?.frame || {};
  const geometry =
    input.geometry || renderSnapshot?.geometry || tileMapView.geometry || viewport.geometry || {};
  const explicitEntries = cloneArray(input.entries);
  const visibilitySnapshot = buildVisibilitySnapshot(
    {
      ...input,
      tileMapView,
      renderSnapshot,
    },
    options,
    dependencies,
  );
  const visibilityActors = buildVisibilityActors(
    {
      ...input,
      tileMapView,
      renderSnapshot,
    },
    options,
    dependencies,
  );
  const revealSnapshot = buildRevealSnapshot(
    {
      ...input,
      tileMapView,
      renderSnapshot,
    },
    options,
    dependencies,
  );
  const fogVisualSnapshot = dependencies.fogVisualSnapshot?.createSnapshot
    ? dependencies.fogVisualSnapshot.createSnapshot(
        {
          ...input,
          tileMapView,
          viewport,
          frame,
          geometry,
          renderSnapshot,
          visibilitySnapshot,
        },
        options,
      )
    : null;
  const rendererContext =
    fogVisualSnapshot && dependencies.fogVisualSnapshot?.toRendererContext
      ? dependencies.fogVisualSnapshot.toRendererContext(fogVisualSnapshot, options)
      : null;
  const projection = Object.freeze({
    schema: SCHEMA,
    epochNowMs,
    visibilitySnapshot,
    fogVisualSnapshot,
    revealSnapshot,
    rendererContext: rendererContext
      ? Object.freeze({
          ...rendererContext,
          entries: explicitEntries.length ? explicitEntries : cloneArray(rendererContext.entries),
          geometry,
          renderSnapshot,
          epochNowMs,
          actors: cloneArray(input.actors),
          visibilityActors,
          revealSnapshot,
          tileMapView: {
            ...(rendererContext.tileMapView || {}),
            sites: Array.isArray(tileMapView.sites)
              ? tileMapView.sites
              : Array.isArray(rendererContext.tileMapView?.sites)
                ? rendererContext.tileMapView.sites
                : [],
          },
        })
      : null,
    signature: [
      fogVisualSnapshot?.signature || '',
      visibilitySnapshot?.signature || '',
      revealSnapshot?.signature || '',
      visibilityActors.length,
      explicitEntries.length || rendererContext?.entries?.length || 0,
    ].join(':'),
  });
  globalThis.WorldMarchTrace?.logDedup?.('fog:projection', {
    epochNowMs,
    signature: projection.signature,
    actors: visibilityActors.length,
    revealSources: revealSnapshot?.q?.length || 0,
  });
  return projection;
}

const api = Object.freeze({
  SCHEMA,
  createFogProjection,
  resolveFogDependencies,
});

if (typeof globalThis !== 'undefined') globalThis.EcsFogProjection = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

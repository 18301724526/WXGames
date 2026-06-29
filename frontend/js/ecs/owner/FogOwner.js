'use strict';

const SCHEMA = 'fog-owner-v1';

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
  };
}

function resolveEpochNowMs(input = {}, options = {}) {
  const value = options.epochNowMs ?? options.nowMs ?? options.serverNowMs ?? input.epochNowMs;
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function buildVisibilityActors(
  input = {},
  options = {},
  dependencies = resolveFogDependencies(options),
) {
  if (Array.isArray(input.visibilityActors) && input.visibilityActors.length) {
    return input.visibilityActors;
  }
  const nowMs = resolveEpochNowMs(input, options);
  const worldExplorerState = input.worldExplorerState || input.state?.worldExplorerState || {};
  const fromExplorer = dependencies.worldMarchSystem?.buildActors
    ? dependencies.worldMarchSystem.buildActors(worldExplorerState, { nowMs })
    : [];
  if (Array.isArray(fromExplorer) && fromExplorer.length) return fromExplorer;
  const activeScouts = input.tileMapView?.activeScouts || [];
  const fromTileMap = dependencies.worldMarchSystem?.buildActors
    ? dependencies.worldMarchSystem.buildActors({ missions: activeScouts }, { nowMs })
    : [];
  if (Array.isArray(fromTileMap) && fromTileMap.length) return fromTileMap;
  if (Array.isArray(input.renderSnapshot?.actors)) return input.renderSnapshot.actors;
  return [];
}

function buildVisibilitySnapshot(
  input = {},
  options = {},
  dependencies = resolveFogDependencies(options),
) {
  if (input.visibilitySnapshot && typeof input.visibilitySnapshot === 'object') {
    return input.visibilitySnapshot;
  }
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

function createFogOwner(input = {}, options = {}) {
  const dependencies = resolveFogDependencies(options);
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
  const owner = Object.freeze({
    schema: SCHEMA,
    epochNowMs: resolveEpochNowMs(input, options),
    visibilitySnapshot,
    fogVisualSnapshot,
    rendererContext: rendererContext
      ? Object.freeze({
          ...rendererContext,
          entries: explicitEntries.length ? explicitEntries : cloneArray(rendererContext.entries),
          geometry,
          renderSnapshot,
          epochNowMs: resolveEpochNowMs(input, options),
          actors: cloneArray(input.actors),
          visibilityActors,
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
      visibilityActors.length,
      explicitEntries.length || rendererContext?.entries?.length || 0,
    ].join(':'),
  });
  return owner;
}

function ensureFogOwner(owner = null) {
  return owner?.schema === SCHEMA ? owner : createFogOwner();
}

function getFogSnapshot(owner = null) {
  return ensureFogOwner(owner);
}

function getFogRendererContext(owner = null) {
  return ensureFogOwner(owner).rendererContext || null;
}

const api = Object.freeze({
  SCHEMA,
  createFogOwner,
  getFogSnapshot,
  getFogRendererContext,
  resolveFogDependencies,
});

if (typeof globalThis !== 'undefined') globalThis.EcsFogOwner = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

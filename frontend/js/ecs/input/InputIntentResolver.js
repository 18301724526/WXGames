'use strict';

// Batch 4 input-intent resolver. PURE: it maps a PhysicalIntent + a mode
// snapshot to a RoutedIntent using ONLY the ModeResolver routing booleans. No
// host reads, no DOM, no renderer/hit-testing — those stay in the routers.
//
// Route precedence is kind-aware to faithfully match the existing routers:
//   - entity-battle is always checked first;
//   - for a drag/tap, tech-tree is preferred over world-map (handleDrag order);
//   - for a gesture, world-map is preferred over tech-tree (handleGesture tries
//     the world-map pinch before tech-tree zoom);
//   - otherwise the implicit `city` base mode is the fallback route.

const ModeResolver = (() => {
  if (typeof require === 'function') return require('../mode/ModeResolver');
  return globalThis.EcsModeResolver;
})();

const InputIntent = (() => {
  if (typeof require === 'function') return require('./InputIntent');
  return globalThis.EcsInputIntent;
})();

const { INPUT_ROUTES, INTENT_KINDS, createRoutedIntent } = InputIntent || {};
const { isEntityBattleActive, canRouteTechTree, canRouteWorldMap } = ModeResolver || {};

function prefersWorldBeforeTech(kind) {
  return kind === INTENT_KINDS.GESTURE;
}

// Decide the covered-mode route from a mode snapshot alone.
function routeForSnapshot(snapshot = {}, kind = '') {
  if (isEntityBattleActive(snapshot)) return INPUT_ROUTES.ENTITY_BATTLE;
  if (prefersWorldBeforeTech(kind)) {
    if (canRouteWorldMap(snapshot)) return INPUT_ROUTES.WORLD_MAP;
    if (canRouteTechTree(snapshot)) return INPUT_ROUTES.TECH_TREE;
  } else {
    if (canRouteTechTree(snapshot)) return INPUT_ROUTES.TECH_TREE;
    if (canRouteWorldMap(snapshot)) return INPUT_ROUTES.WORLD_MAP;
  }
  return INPUT_ROUTES.CITY;
}

// Resolve a physical intent against a mode snapshot. Returns null when no
// snapshot is available so callers fall back to their legacy mode branches.
function resolveInputIntent(physicalIntent = {}, snapshot = null) {
  if (!snapshot) return null;
  const kind = String(physicalIntent.kind || '');
  const route = routeForSnapshot(snapshot, kind);
  return createRoutedIntent({ route, kind });
}

const api = Object.freeze({
  resolveInputIntent,
  routeForSnapshot,
});

if (typeof globalThis !== 'undefined') globalThis.EcsInputIntentResolver = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

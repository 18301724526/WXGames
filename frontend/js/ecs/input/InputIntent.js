'use strict';

// Batch 4 input-intent vocabulary. Pure, serializable shapes only: this file is
// scanned by the ECS boundary guard, so it must contain no classes, no `new`
// (except Error), and no DOM/Event/Promise references. The routers translate a
// raw pointer/gesture event into a PhysicalIntent, the resolver turns that plus
// a mode snapshot into a RoutedIntent, and the router maps the route back to a
// platform action object. Vocabulary lives here so both stay in sync.

const INTENT_KINDS = Object.freeze({
  DRAG: 'drag',
  GESTURE: 'gesture',
  TAP: 'tap',
});

const INTENT_PHASES = Object.freeze({
  START: 'start',
  MOVE: 'move',
  END: 'end',
  CANCEL: 'cancel',
});

// Covered-mode routes Batch 4 owns. Panel/modal routing stays in the routers.
const INPUT_ROUTES = Object.freeze({
  ENTITY_BATTLE: 'entity-battle',
  TECH_TREE: 'tech-tree',
  WORLD_MAP: 'world-map',
  CITY: 'city',
});

const KIND_VALUES = Object.freeze(Object.values(INTENT_KINDS));
const ROUTE_VALUES = Object.freeze(Object.values(INPUT_ROUTES));

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizePointer(pointer) {
  if (!pointer || typeof pointer !== 'object') return null;
  return Object.freeze({ x: toFiniteNumber(pointer.x), y: toFiniteNumber(pointer.y) });
}

function normalizeGesture(gesture) {
  if (!gesture || typeof gesture !== 'object') return null;
  return Object.freeze({
    type: String(gesture.type || ''),
    phase: gesture.phase ? String(gesture.phase) : '',
  });
}

// Build a frozen, serializable description of a raw physical input. The resolver
// does NOT read pointer/gesture coordinates to decide a route (that stays purely
// mode-snapshot driven); they are carried for completeness and future use.
function createPhysicalIntent(input = {}) {
  return Object.freeze({
    kind: String(input.kind || ''),
    phase: input.phase ? String(input.phase) : '',
    pointer: normalizePointer(input.pointer),
    gesture: normalizeGesture(input.gesture),
  });
}

// Build a frozen routed intent. `action` is an optional platform action hint;
// routers normally construct their own action object from the route + kind.
function createRoutedIntent(input = {}) {
  return Object.freeze({
    route: String(input.route || ''),
    kind: input.kind ? String(input.kind) : '',
    action:
      input.action && typeof input.action === 'object' ? Object.freeze({ ...input.action }) : null,
  });
}

function isCoveredRoute(route) {
  return ROUTE_VALUES.includes(route);
}

const api = Object.freeze({
  INTENT_KINDS,
  INTENT_PHASES,
  INPUT_ROUTES,
  KIND_VALUES,
  ROUTE_VALUES,
  createPhysicalIntent,
  createRoutedIntent,
  isCoveredRoute,
});

if (typeof globalThis !== 'undefined') globalThis.EcsInputIntent = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

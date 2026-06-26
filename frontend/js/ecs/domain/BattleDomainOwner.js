'use strict';

const SCHEMA = 'battle-domain-v1';

function cloneSerializable(value, seen = []) {
  if (typeof value === 'function' || typeof value === 'undefined') return null;
  if (value == null) return null;
  if (Array.isArray(value))
    return Object.freeze(value.map((item) => cloneSerializable(item, seen)));
  if (typeof value === 'object') {
    if (seen.includes(value)) return null;
    const nextSeen = seen.concat(value);
    const copy = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        const next = value[key];
        if (typeof next === 'function' || typeof next === 'undefined') return;
        copy[key] = cloneSerializable(next, nextSeen);
      });
    return Object.freeze(copy);
  }
  return value;
}

function normalizeBattleScene(scene = null) {
  if (!scene || typeof scene !== 'object') return null;
  return Object.freeze({
    visible: scene.visible !== false,
    report: cloneSerializable(scene.report || null),
    turnIndex: Math.max(0, Number(scene.turnIndex) || 0),
    startedAt: Number(scene.startedAt) || 0,
    turnStartedAt: Number(scene.turnStartedAt) || 0,
    turnDurationMs: Math.max(0, Number(scene.turnDurationMs) || 0),
  });
}

function normalizeEntityBattle(session = null) {
  if (!session || typeof session !== 'object') return null;
  return cloneSerializable(session);
}

function activeOverlayFor(battleScene = null, entityBattle = null) {
  if (entityBattle?.visible) return 'entityBattle';
  if (battleScene?.visible) return 'battleScene';
  return 'none';
}

function makeOwner({ battleScene = null, entityBattle = null } = {}) {
  const normalizedBattleScene = normalizeBattleScene(battleScene);
  const normalizedEntityBattle = normalizeEntityBattle(entityBattle);
  return Object.freeze({
    schema: SCHEMA,
    battleScene: normalizedBattleScene,
    entityBattle: normalizedEntityBattle,
    activeOverlay: activeOverlayFor(normalizedBattleScene, normalizedEntityBattle),
  });
}

function createBattleDomainOwner(initial = {}) {
  return makeOwner(initial);
}

function ensureBattleDomainOwner(owner = null) {
  return owner?.schema === SCHEMA ? owner : createBattleDomainOwner();
}

function openBattleScene(owner, scene) {
  const base = ensureBattleDomainOwner(owner);
  return makeOwner({ battleScene: scene, entityBattle: base.entityBattle });
}

function updateBattleScene(owner, patchOrScene = {}) {
  const base = ensureBattleDomainOwner(owner);
  const current = base.battleScene || {};
  return makeOwner({
    battleScene: { ...current, ...(patchOrScene || {}) },
    entityBattle: base.entityBattle,
  });
}

function closeBattleScene(owner) {
  const base = ensureBattleDomainOwner(owner);
  return makeOwner({ battleScene: null, entityBattle: base.entityBattle });
}

function openEntityBattle(owner, session) {
  const base = ensureBattleDomainOwner(owner);
  return makeOwner({ battleScene: base.battleScene, entityBattle: session });
}

function updateEntityBattle(owner, patchOrSession = {}) {
  const base = ensureBattleDomainOwner(owner);
  const current = base.entityBattle || {};
  return makeOwner({
    battleScene: base.battleScene,
    entityBattle: { ...current, ...(patchOrSession || {}) },
  });
}

function closeEntityBattle(owner) {
  const base = ensureBattleDomainOwner(owner);
  return makeOwner({ battleScene: base.battleScene, entityBattle: null });
}

function getBattleDomainSnapshot(owner) {
  return ensureBattleDomainOwner(owner);
}

const api = Object.freeze({
  SCHEMA,
  closeBattleScene,
  closeEntityBattle,
  createBattleDomainOwner,
  getBattleDomainSnapshot,
  openBattleScene,
  openEntityBattle,
  updateBattleScene,
  updateEntityBattle,
});

if (typeof globalThis !== 'undefined') globalThis.EcsBattleDomainOwner = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

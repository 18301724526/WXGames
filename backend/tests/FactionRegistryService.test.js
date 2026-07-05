const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { FactionRepository } = require('../repositories/FactionRepository');
const { createFactionRegistryService } = require('../services/faction/FactionRegistryService');
const factionCore = require('../../shared/faction/factionCore');

function setup() {
  const db = new Database(':memory:');
  const factionRepo = new FactionRepository(db);
  factionRepo.init();
  const registry = createFactionRegistryService({ factionRepo });
  return { factionRepo, registry };
}

test('player faction is materialized from the gameState (polity), never stored', () => {
  const { registry } = setup();
  const gameState = { playerId: 'p1', polity: { name: '大梁', color: '#d9a441', capitalCityName: '汴京' } };
  const pf = registry.getPlayerFaction(gameState);
  assert.equal(pf.id, 'player_p1');
  assert.equal(pf.kind, 'player');
  assert.equal(pf.name, '大梁');
  assert.equal(pf.homePlayerId, 'p1');
  assert.equal(pf.lifecycle.state, 'alive');
});

test('getFaction resolves own player faction from gameState, others from the shared repo', () => {
  const { factionRepo, registry } = setup();
  factionRepo.upsertFaction({ id: 'ai_wei', kind: 'ai', name: '魏' });
  const gameState = { playerId: 'p1', polity: { name: '大梁' } };
  assert.equal(registry.getFaction('player_p1', gameState).name, '大梁'); // own -> materialized
  assert.equal(registry.getFaction('ai_wei', gameState).name, '魏'); // shared -> repo
  assert.equal(registry.getFaction('player_p2', gameState), null); // another player -> not in repo (projection later)
});

test('getAllFactions merges the player faction with all shared factions', () => {
  const { factionRepo, registry } = setup();
  factionRepo.upsertFaction({ id: 'ai_wei', kind: 'ai', name: '魏' });
  factionRepo.upsertFaction({ id: 'neutral_bandits', kind: 'neutral', name: '山贼' });
  const all = registry.getAllFactions({ playerId: 'p1', polity: { name: '大梁' } });
  assert.deepEqual(all.map((f) => f.id).sort(), ['ai_wei', 'neutral_bandits', 'player_p1']);
});

test('getAliveFactions excludes collapsed/rebuilding factions', () => {
  const { factionRepo, registry } = setup();
  factionRepo.upsertFaction({ id: 'ai_wei', kind: 'ai', name: '魏' });
  factionRepo.upsertFaction(factionCore.markCollapsed({ id: 'ai_shu', kind: 'ai', name: '蜀' }, 'conquered', 'now'));
  const gameState = { playerId: 'p1', polity: { name: '大梁' } };
  const alive = registry.getAliveFactions(gameState).map((f) => f.id).sort();
  assert.deepEqual(alive, ['ai_wei', 'player_p1']); // 蜀 collapsed, excluded
});

test('getAiFactions / getNeutralFactions split by kind', () => {
  const { factionRepo, registry } = setup();
  factionRepo.upsertFaction({ id: 'ai_wei', kind: 'ai', name: '魏' });
  factionRepo.upsertFaction({ id: 'neutral_x', kind: 'neutral', name: '独立' });
  assert.equal(registry.getAiFactions().length, 1);
  assert.equal(registry.getNeutralFactions().length, 1);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { WorldPeopleRepository } = require('../repositories/WorldPeopleRepository');
const { createWorldPeopleRegistryService } = require('../services/person/WorldPeopleRegistryService');
const factionCore = require('../../shared/faction/factionCore');

function setup() {
  const db = new Database(':memory:');
  const worldPeopleRepo = new WorldPeopleRepository(db);
  worldPeopleRepo.init();
  const svc = createWorldPeopleRegistryService({ worldPeopleRepo });
  return { worldPeopleRepo, svc };
}

const GAME_STATE = {
  playerId: 'p1',
  famousPeople: [
    { id: 'my_1', name: '主公亲信甲', attributes: { charisma: 70 } },
    { id: 'my_2', name: '主公亲信乙' },
  ],
};

test('materializePlayerRoster stamps the player factionId + backfills social (read-equivalent)', () => {
  const { svc } = setup();
  const roster = svc.materializePlayerRoster(GAME_STATE);
  assert.equal(roster.length, 2);
  assert.equal(roster[0].name, '主公亲信甲'); // original fields kept
  assert.equal(roster[0].factionId, factionCore.playerFactionId('p1'));
  assert.ok(roster[0].personality); // social backfilled
});

test('getPerson resolves own roster first, then the shared table', () => {
  const { worldPeopleRepo, svc } = setup();
  worldPeopleRepo.upsertPerson({ id: 'wp_ronin', name: '在野武将' });
  assert.equal(svc.getPerson('my_1', GAME_STATE).name, '主公亲信甲'); // own
  assert.equal(svc.getPerson('wp_ronin', GAME_STATE).name, '在野武将'); // shared
  assert.equal(svc.getPerson('nobody', GAME_STATE), null);
});

test('getPeopleByFaction: own faction -> roster; AI faction -> shared officers', () => {
  const { worldPeopleRepo, svc } = setup();
  worldPeopleRepo.upsertPerson({ id: 'wei_1', name: '张辽', factionId: 'ai_wei' });
  const own = svc.getPeopleByFaction(factionCore.playerFactionId('p1'), GAME_STATE);
  assert.deepEqual(own.map((p) => p.id).sort(), ['my_1', 'my_2']);
  const wei = svc.getPeopleByFaction('ai_wei', GAME_STATE);
  assert.deepEqual(wei.map((p) => p.id), ['wei_1']);
});

test('getRoninPeople is the shared unaffiliated pool; getAllPeople is the union', () => {
  const { worldPeopleRepo, svc } = setup();
  worldPeopleRepo.upsertPerson({ id: 'wp_ronin', name: '在野' });
  worldPeopleRepo.upsertPerson({ id: 'wei_1', name: '张辽', factionId: 'ai_wei' });
  assert.deepEqual(svc.getRoninPeople().map((p) => p.id), ['wp_ronin']);
  const all = svc.getAllPeople(GAME_STATE).map((p) => p.id).sort();
  assert.deepEqual(all, ['my_1', 'my_2', 'wei_1', 'wp_ronin']);
});

// Regression H2: if a person id exists in BOTH the shared table and the player roster (e.g. the
// mid-recruitment window), getAllPeople must return that identity ONCE, with the authoritative player
// roster copy winning — never twice with conflicting factionId.
test('getAllPeople dedups a person present in both roster and shared table (roster wins)', () => {
  const { worldPeopleRepo, svc } = setup();
  worldPeopleRepo.upsertPerson({ id: 'my_1', name: '共享幽灵副本' }); // ronin copy of a roster member's id
  const all = svc.getAllPeople(GAME_STATE);
  const dupes = all.filter((p) => p.id === 'my_1');
  assert.equal(dupes.length, 1); // exactly once
  assert.equal(dupes[0].factionId, factionCore.playerFactionId('p1')); // roster copy wins
  assert.equal(dupes[0].name, '主公亲信甲'); // the roster person, not the shared ghost
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { WorldPeopleRepository } = require('../repositories/WorldPeopleRepository');
const factionCore = require('../../shared/faction/factionCore');
const ConfigTables = require('../config/ConfigTables');

const NATURES = ConfigTables.getRows('personality_natures');

function freshRepo() {
  const db = new Database(':memory:');
  const repo = new WorldPeopleRepository(db);
  repo.init();
  return repo;
}

test('upsert + get round-trips a person and backfills its social fields (single source)', () => {
  const repo = freshRepo();
  const saved = repo.upsertPerson({ id: 'wp_1', name: '赵云', attributes: { charisma: 80 } }, '2026-01-01T00:00:00Z');
  assert.equal(saved.name, '赵云');
  assert.ok(NATURES.some((n) => n.natureId === saved.personality.nature)); // social backfilled
  assert.equal(saved.factionId, null); // 在野 by default
  const got = repo.getPerson('wp_1');
  assert.equal(got.name, '赵云');
  assert.equal(got.attributes.charisma, 80);
  assert.deepEqual(got.personality, saved.personality); // deterministic round-trip
});

test('getRoninPeople returns only the unaffiliated, getPeopleByFaction only that faction', () => {
  const repo = freshRepo();
  repo.upsertPerson({ id: 'wp_ronin_a', name: '甲' }); // 在野
  repo.upsertPerson({ id: 'wp_ronin_b', name: '乙' }); // 在野
  repo.upsertPerson({ id: 'wp_wei_1', name: '张辽', factionId: factionCore.aiFactionId('wei') });

  const ronin = repo.getRoninPeople().map((p) => p.id).sort();
  assert.deepEqual(ronin, ['wp_ronin_a', 'wp_ronin_b']);
  const wei = repo.getPeopleByFaction('ai_wei').map((p) => p.id);
  assert.deepEqual(wei, ['wp_wei_1']);
  assert.equal(repo.getAllPeople().length, 3);
});

test('recruiting a ronin into an AI faction moves them off the ronin pool', () => {
  const repo = freshRepo();
  repo.upsertPerson({ id: 'wp_2', name: '太史慈' });
  assert.equal(repo.getRoninPeople().length, 1);
  const person = repo.getPerson('wp_2');
  repo.upsertPerson({ ...person, factionId: 'ai_wu' });
  assert.equal(repo.getRoninPeople().length, 0);
  assert.equal(repo.getPeopleByFaction('ai_wu').length, 1);
});

test('player-owned people are rejected — they live in game_states.famousPeople', () => {
  const repo = freshRepo();
  assert.throws(
    () => repo.upsertPerson({ id: 'wp_3', name: '关羽', factionId: factionCore.playerFactionId('p1') }),
    /player-owned people live in game_states/,
  );
});

test('deletePerson removes the row (used when a captive joins a player)', () => {
  const repo = freshRepo();
  repo.upsertPerson({ id: 'wp_4', name: '甘宁' });
  repo.deletePerson('wp_4');
  assert.equal(repo.getPerson('wp_4'), null);
});

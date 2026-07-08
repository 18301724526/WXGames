const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const { FactionRepository } = require('../repositories/FactionRepository');
const factionCore = require('../../shared/faction/factionCore');

function freshRepo() {
  const db = new Database(':memory:');
  const repo = new FactionRepository(db);
  repo.init();
  return repo;
}

test('upsert + get round-trips an AI faction (JSON blob authoritative, columns mirror)', () => {
  const repo = freshRepo();
  const saved = repo.upsertFaction({
    id: factionCore.aiFactionId('wei'),
    kind: 'ai',
    name: '魏',
    color: '#3355aa',
    rulerPersonId: 'wp_1',
    treasury: { food: 800, wood: 0 }, // 0 dropped by normalize
    tech: { era: 3 },
    aiProfile: { archetype: 'expansionist' },
  }, '2026-01-01T00:00:00Z');
  assert.equal(saved.kind, 'ai');
  const got = repo.getFaction('ai_wei');
  assert.equal(got.name, '魏');
  assert.deepEqual(got.treasury, { food: 800 });
  assert.equal(got.tech.era, 3);
  assert.equal(got.lifecycle.state, 'alive');
});

test('getFactionsByKind + getAliveFactions filter via the mirror columns', () => {
  const repo = freshRepo();
  repo.upsertFaction({ id: 'ai_wei', kind: 'ai', name: '魏' });
  repo.upsertFaction({ id: 'ai_wu', kind: 'ai', name: '吴' });
  repo.upsertFaction({ id: 'neutral_bandits', kind: 'neutral', name: '山贼' });
  repo.upsertFaction(factionCore.markCollapsed({ id: 'ai_shu', kind: 'ai', name: '蜀' }, 'conquered', 'now'));

  assert.equal(repo.getAllFactions().length, 4);
  assert.equal(repo.getFactionsByKind('ai').length, 3);
  assert.equal(repo.getFactionsByKind('neutral').length, 1);
  const alive = repo.getAliveFactions().map((f) => f.id).sort();
  assert.deepEqual(alive, ['ai_wei', 'ai_wu', 'neutral_bandits']); // collapsed 蜀 excluded
});

test('upsert overwrites; lifecycle column tracks state changes', () => {
  const repo = freshRepo();
  repo.upsertFaction({ id: 'ai_wu', kind: 'ai', name: '吴' });
  assert.equal(repo.getAliveFactions().length, 1);
  repo.upsertFaction(factionCore.markRebuilding(repo.getFaction('ai_wu'), 'camp_1', 'now'));
  assert.equal(repo.getAliveFactions().length, 0); // rebuilding is not alive
  assert.equal(repo.getFaction('ai_wu').lifecycle.state, 'rebuilding');
});

test('player factions are rejected — they live in game_states, not the shared table', () => {
  const repo = freshRepo();
  assert.throws(
    () => repo.upsertFaction({ id: factionCore.playerFactionId('p1'), kind: 'player', name: '大梁' }),
    /player factions live in game_states/,
  );
});

test('deleteFaction removes the row', () => {
  const repo = freshRepo();
  repo.upsertFaction({ id: 'ai_wei', kind: 'ai', name: '魏' });
  repo.deleteFaction('ai_wei');
  assert.equal(repo.getFaction('ai_wei'), null);
});

// Regression C3: a later upsert that omits createdAt must not clobber the stored createdAt to null.
test('upsertFaction preserves an existing createdAt when the incoming faction omits it', () => {
  const repo = freshRepo();
  repo.upsertFaction({ id: 'ai_wu', kind: 'ai', name: '吴', createdAt: '2026-01-01T00:00:00Z' });
  // a partial-ish later write (e.g. a lifecycle flip authored without re-reading) omits createdAt
  repo.upsertFaction({ id: 'ai_wu', kind: 'ai', name: '吴' });
  assert.equal(repo.getFaction('ai_wu').createdAt, '2026-01-01T00:00:00Z');
});

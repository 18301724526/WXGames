const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./factionCore');

test('id namespace: player/ai/neutral prefixes round-trip + classify', () => {
  assert.equal(core.playerFactionId('p123'), 'player_p123');
  assert.equal(core.aiFactionId('wei'), 'ai_wei');
  assert.equal(core.neutralFactionId('site_5_3'), 'neutral_site_5_3');
  assert.equal(core.kindOf('player_p123'), 'player');
  assert.equal(core.kindOf('ai_wei'), 'ai');
  assert.equal(core.kindOf('neutral_site_5_3'), 'neutral');
  assert.ok(core.isPlayerFaction('player_p123'));
  assert.ok(core.isAiFaction('ai_wei'));
  assert.ok(core.isNeutralFaction('neutral_x'));
  assert.equal(core.playerIdOfFaction('player_p123'), 'p123');
  assert.equal(core.playerIdOfFaction('ai_wei'), null);
  // neutral key may itself contain underscores -> only the first splits.
  assert.deepEqual(core.parseFactionId('neutral_site_5_3'), { kind: 'neutral', key: 'site_5_3' });
});

test('normalizeFaction: player gets homePlayerId + faction-level treasury, no cities[]/officers[]', () => {
  const f = core.normalizeFaction({ id: 'player_p1', kind: 'player', name: '大梁', treasury: { food: 500, wood: -3 } });
  assert.equal(f.kind, 'player');
  assert.equal(f.homePlayerId, 'p1');
  assert.deepEqual(f.treasury, { food: 500 }); // negative dropped
  assert.equal(f.tech, null); // player tech stays gameState.techs
  assert.ok(!('cities' in f) && !('officers' in f)); // derived by query, never stored
  assert.equal(f.lifecycle.state, 'alive');
});

test('normalizeFaction: AI carries tech profile + aiProfile; homePlayerId null', () => {
  const f = core.normalizeFaction({ id: 'ai_wei', kind: 'ai', tech: { era: 3 }, aiProfile: { archetype: 'expansionist' } });
  assert.equal(f.homePlayerId, null);
  assert.deepEqual(f.tech, { era: 3 });
  assert.equal(f.aiProfile.archetype, 'expansionist');
});

test('relationToViewer: self / neutral / other (diplomacy layers on top)', () => {
  assert.equal(core.relationToViewer('player_p1', 'player_p1'), 'self');
  assert.equal(core.relationToViewer('neutral_x', 'player_p1'), 'neutral');
  assert.equal(core.relationToViewer('ai_wei', 'player_p1'), 'other');
});

test('lifecycle: canAct only while alive; collapse / 首都失守 rebuilding / revive', () => {
  const f = core.normalizeFaction({ id: 'ai_wu', kind: 'ai' });
  assert.equal(core.canAct(f), true);
  const collapsed = core.markCollapsed(f, 'conquered', '2026-01-01T00:00:00Z');
  assert.equal(collapsed.lifecycle.state, 'collapsed');
  assert.equal(collapsed.lifecycle.collapsedReason, 'conquered');
  assert.equal(core.canAct(collapsed), false);
  // 首都失守 -> rebuilding on a temp camp (player not eliminated).
  const rebuilding = core.markRebuilding(core.normalizeFaction({ id: 'player_p1', kind: 'player' }), 'camp_99', 'now');
  assert.equal(rebuilding.lifecycle.state, 'rebuilding');
  assert.equal(rebuilding.lifecycle.rebuildCampId, 'camp_99');
  assert.equal(core.canAct(rebuilding), false);
  const revived = core.markAlive(rebuilding, 'now');
  assert.equal(revived.lifecycle.state, 'alive');
  assert.equal(revived.lifecycle.rebuildCampId, null);
  assert.equal(core.canAct(revived), true);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const GameActionRegistry = require('../actions/GameActionRegistry');
const {
  COMMAND_OWNER_RULES,
  createRepositoryOwnerResolver,
  inspectCommandOwners,
  listDeclaredCommandTypes,
  resolveCommandOwners,
} = require('../application/commands/CommandOwnerResolver');
const { GAME_ACTIONS, SERVER_WRITE_ENTRIES } = require('../../scripts/command-owner-step1/inventories');

const ROUTE_ONLY_COMMAND_TYPES = Object.freeze([
  'clientEventIngest',
  'clientOperationLogIngest',
  'configReleasePublish',
  'configReleaseRollback',
  'heartbeat',
  'heartbeatMarchSettlement',
  'opsLoginAudit',
  'opsMaintenanceSet',
  'opsRestartAccepted',
  'playerLogin',
  'playerReset',
  'worldMarchClientReportIngest',
  'worldWorkerRuntimeTick',
]);

function envelope(type, payload = {}, playerId = 'player-1') {
  return { type, action: type, playerId, payload };
}

function payloadFor(type) {
  if (type === 'startConquest' || type === 'claimConquest' || type === 'renameCity') {
    return { territoryId: 'territory-1' };
  }
  if (type === 'startWorldCombat' || type === 'resolveWorldCombat') return { encounterId: 'encounter-1' };
  return {};
}

test('CommandOwnerResolver declarations exhaust every current game action', () => {
  const routedActions = [...GameActionRegistry.listActions(), 'claimTaskReward', 'startWorldCombat', 'resolveWorldCombat']
    .sort();
  const inventoriedActions = GAME_ACTIONS.map(({ action }) => action).sort();

  assert.deepEqual(routedActions, inventoriedActions);
  inventoriedActions.forEach((type) => assert.ok(COMMAND_OWNER_RULES[type], type));
});

test('CommandOwnerResolver declarations cover every route-only Step1 command type', () => {
  const inventoriedTypes = new Set(SERVER_WRITE_ENTRIES.flatMap(({ commandType }) => (
    String(commandType || '').split('|').filter(Boolean)
  )));
  [
    'heartbeatMarchSettlement',
    'worldMarchClientReportIngest',
    'playerLogin',
    'playerReset',
    'opsLoginAudit',
    'opsMaintenanceSet',
    'opsRestartAccepted',
    'clientEventIngest',
    'clientOperationLogIngest',
    'configReleasePublish',
    'configReleaseRollback',
    'worldWorkerPlayerTick',
    'worldWorkerPersonUpdate',
    'worldWorkerDiplomacyTick',
  ].forEach((type) => assert.ok(inventoriedTypes.has(type), type));
  ROUTE_ONLY_COMMAND_TYPES.forEach((type) => assert.ok(COMMAND_OWNER_RULES[type], type));
  assert.deepEqual(listDeclaredCommandTypes(), Object.keys(COMMAND_OWNER_RULES).sort());
});

test('CommandOwnerResolver resolves every current game action to one primary owner key', () => {
  GAME_ACTIONS.forEach(({ action }) => {
    const result = resolveCommandOwners(envelope(action, payloadFor(action)));
    assert.equal(result.status, 'resolved', action);
    assert.ok(result.ownerKey, action);
    assert.equal(result.ownerKeys.includes(result.ownerKey), true, action);
  });
});

test('CommandOwnerResolver uses canonical sorted multi-owner keys for contested targets', () => {
  assert.deepEqual(
    resolveCommandOwners(envelope('startConquest', { territoryId: 'territory-1' })),
    {
      schema: 'command-owner-resolution-v1',
      status: 'resolved',
      commandType: 'startConquest',
      ownerKey: 'territory:territory-1',
      ownerKeys: [
        'player:player-1',
        'territory-owner:player-1',
        'territory:territory-1',
      ],
      targetField: 'territoryId',
      ruleKind: 'shared',
    },
  );
  const combat = resolveCommandOwners(envelope('startWorldCombat', { combatEncounterId: 'encounter-1' }));
  assert.equal(combat.ownerKey, 'encounter:encounter-1');
  assert.deepEqual(combat.ownerKeys, ['encounter:encounter-1', 'player:player-1']);

  const canonical = resolveCommandOwners(envelope(
    'startWorldCombat',
    { encounterId: 'A-encounter' },
    'z-player',
  ));
  assert.deepEqual(canonical.ownerKeys, ['encounter:A-encounter', 'player:z-player']);

  const reset = resolveCommandOwners(envelope('playerReset'));
  assert.equal(reset.ownerKey, 'player:player-1');
  assert.deepEqual(reset.ownerKeys, ['player:player-1', 'territory-owner:player-1']);
});

test('CommandOwnerResolver includes the canonical territory owner collection from repository lookup', () => {
  const resolver = createRepositoryOwnerResolver({
    getSharedWorldTerritory(territoryId) {
      assert.equal(territoryId, 'territory-owned');
      return { id: territoryId, ownerPlayerId: 'current-owner' };
    },
  });
  const result = resolver(envelope(
    'claimConquest',
    { territoryId: 'territory-owned' },
    'contender',
  ));

  assert.equal(result.ownerKey, 'territory:territory-owned');
  assert.deepEqual(result.ownerKeys, [
    'player:contender',
    'territory-owner:contender',
    'territory-owner:current-owner',
    'territory:territory-owned',
  ]);
});

test('CommandOwnerResolver rejects missing shared ids without falling back to player ownership', () => {
  assert.throws(
    () => resolveCommandOwners(envelope('startConquest')),
    (error) => error.code === 'OWNER_TARGET_MISSING_TERRITORY_ID',
  );
  assert.throws(
    () => resolveCommandOwners(envelope('startWorldCombat', { missionId: 'march-1' })),
    (error) => error.code === 'OWNER_TARGET_ENCOUNTER_ID_MISSING',
  );
  assert.throws(
    () => resolveCommandOwners(envelope('resolveWorldCombat', { battleId: 'battle-1' })),
    (error) => error.code === 'OWNER_TARGET_BATTLE_ENCOUNTER_UNRESOLVED',
  );
});

test('CommandOwnerResolver makes march to encounter handoff explicit when the id is present', () => {
  const privateMarch = resolveCommandOwners(envelope('startWorldMarch', { targetQ: 1, targetR: 0 }));
  assert.equal(privateMarch.ownerKey, 'player:player-1');
  assert.deepEqual(privateMarch.ownerKeys, ['player:player-1']);

  const encounterMarch = resolveCommandOwners(envelope('startWorldMarch', {
    targetQ: 1,
    targetR: 0,
    encounterId: 'encounter-1',
  }));
  assert.equal(encounterMarch.ownerKey, 'encounter:encounter-1');
  assert.deepEqual(encounterMarch.ownerKeys, ['encounter:encounter-1', 'player:player-1']);
});

test('CommandOwnerResolver resolves march encounter ids from a read-only repository lookup', () => {
  const calls = [];
  const resolver = createRepositoryOwnerResolver({
    worldEncounterRepo: {
      getActiveEncounterAt(coord, options) {
        calls.push({ coord, options });
        return { id: 'encounter-by-tile' };
      },
    },
  });
  const result = resolver(envelope('startWorldMarch', { targetQ: 4.8, targetR: -1.2 }));

  assert.equal(result.ownerKey, 'encounter:encounter-by-tile');
  assert.deepEqual(result.ownerKeys, ['encounter:encounter-by-tile', 'player:player-1']);
  assert.equal(result.targetId, 'encounter-by-tile');
  assert.equal(result.lookupPerformed, true);
  assert.deepEqual(calls, [{
    coord: { q: 4, r: -2 },
    options: { refreshRespawns: false, projectRespawns: true },
  }]);
});

test('CommandOwnerResolver resolves split worker commands to explicit owners', () => {
  const player = resolveCommandOwners(envelope('worldWorkerPlayerTick', {
    encounterIds: ['encounter-b', 'encounter-a', 'encounter-b'],
  }));
  assert.equal(player.ownerKey, 'player:player-1');
  assert.deepEqual(player.ownerKeys, [
    'encounter:encounter-a',
    'encounter:encounter-b',
    'player:player-1',
  ]);

  const person = resolveCommandOwners(envelope(
    'worldWorkerPersonUpdate',
    {
      playerIds: ['player-b', 'player-a'],
      personIds: ['person-b', 'person-a'],
    },
    'system:world-worker',
  ));
  assert.equal(person.ownerKey, 'world-social:global');
  assert.deepEqual(person.ownerKeys, [
    'person:person-a',
    'person:person-b',
    'player:player-a',
    'player:player-b',
    'world-social:global',
  ]);

  const diplomacy = resolveCommandOwners(envelope(
    'worldWorkerDiplomacyTick',
    { pairId: 'faction-a__faction-b' },
    'system:world-worker',
  ));
  assert.equal(diplomacy.ownerKey, 'diplomacy:faction-a__faction-b');
  assert.deepEqual(diplomacy.ownerKeys, ['diplomacy:faction-a__faction-b']);
});

test('CommandOwnerResolver reports the unsplit worker writer as an honest blocker', () => {
  const result = inspectCommandOwners(envelope('worldWorkerRuntimeTick'));

  assert.equal(result.status, 'blocked');
  assert.equal(result.error, 'OWNER_WORKER_COMMAND_SPLIT_REQUIRED');
  assert.deepEqual(result.ownerKeys, []);
});

test('CommandOwnerResolver rejects commands missing a declaration or player identity', () => {
  assert.throws(
    () => resolveCommandOwners(envelope('missingCommand')),
    (error) => error.code === 'OWNER_DECLARATION_MISSING',
  );
  assert.throws(
    () => resolveCommandOwners(envelope('research', {}, '')),
    (error) => error.code === 'OWNER_PLAYER_ID_MISSING',
  );
  assert.equal(resolveCommandOwners(envelope('playerLogin', { username: 'test1' }, '')).ownerKey, 'player:test1');
});

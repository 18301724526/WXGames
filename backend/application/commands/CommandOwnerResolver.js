'use strict';

const { normalizeCommandType } = require('./CommandEnvelope');

const PLAYER_COMMAND_TYPES = Object.freeze([
  'acceptFamousPerson',
  'advanceEra',
  'applyTalentPolicy',
  'assign',
  'assignFamousAttributePoint',
  'build',
  'claimEvent',
  'claimTaskReward',
  'deleteTalentPolicy',
  'dismissFamousPersonCandidate',
  'heartbeat',
  'heartbeatMarchSettlement',
  'renameCity',
  'renamePolity',
  'research',
  'resolveCapture',
  'returnWorldMarch',
  'saveTalentPolicy',
  'seekFamousPerson',
  'setArmyFormation',
  'stopWorldMarch',
  'switchCity',
  'tutorialAdvance',
  'upgrade',
  'veteranCampUpgrade',
  'veteranCampWithdraw',
  'worldMarchClientReportIngest',
]);

class CommandOwnerResolutionError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'CommandOwnerResolutionError';
    this.code = code;
    this.status = 400;
    Object.assign(this, detail);
  }
}

function playerRule() {
  return Object.freeze({ kind: 'player' });
}

const COMMAND_OWNER_RULES = {
  ...Object.fromEntries(PLAYER_COMMAND_TYPES.map((type) => [type, playerRule()])),
  playerLogin: Object.freeze({ kind: 'player-identity', fields: ['username'] }),
  playerReset: playerRule(),
  startConquest: Object.freeze({
    kind: 'shared',
    prefix: 'territory',
    fields: ['territoryId'],
    missingTargetError: 'OWNER_TARGET_MISSING_TERRITORY_ID',
    includePlayer: true,
  }),
  claimConquest: Object.freeze({
    kind: 'shared',
    prefix: 'territory',
    fields: ['territoryId'],
    missingTargetError: 'OWNER_TARGET_MISSING_TERRITORY_ID',
    includePlayer: true,
  }),
  startWorldMarch: Object.freeze({
    kind: 'player-encounter-handoff',
    fields: ['encounterId', 'combatEncounterId'],
  }),
  startWorldCombat: Object.freeze({
    kind: 'shared',
    prefix: 'encounter',
    fields: ['encounterId', 'combatEncounterId'],
    missingTargetError: 'OWNER_TARGET_ENCOUNTER_ID_MISSING',
    includePlayer: true,
  }),
  resolveWorldCombat: Object.freeze({
    kind: 'shared',
    prefix: 'encounter',
    fields: ['encounterId', 'combatEncounterId'],
    missingTargetError: 'OWNER_TARGET_BATTLE_ENCOUNTER_UNRESOLVED',
    includePlayer: true,
  }),
  clientEventIngest: Object.freeze({ kind: 'constant', ownerKey: 'diagnostic:anonymous' }),
  clientOperationLogIngest: Object.freeze({ kind: 'diagnostic-player' }),
  opsLoginAudit: Object.freeze({ kind: 'constant', ownerKey: 'ops:global' }),
  opsMaintenanceSet: Object.freeze({ kind: 'constant', ownerKey: 'ops:global' }),
  opsRestartAccepted: Object.freeze({ kind: 'constant', ownerKey: 'ops:global' }),
  configReleasePublish: Object.freeze({ kind: 'constant', ownerKey: 'config:gameplay' }),
  configReleaseRollback: Object.freeze({ kind: 'constant', ownerKey: 'config:gameplay' }),
  worldWorkerPlayerTick: Object.freeze({
    kind: 'player-with-encounters',
    fields: ['encounterIds'],
  }),
  worldWorkerPersonUpdate: Object.freeze({
    kind: 'shared',
    prefix: 'person',
    fields: ['personId'],
    missingTargetError: 'OWNER_TARGET_PERSON_ID_MISSING',
  }),
  worldWorkerDiplomacyTick: Object.freeze({
    kind: 'shared',
    prefix: 'diplomacy',
    fields: ['pairId'],
    missingTargetError: 'OWNER_TARGET_DIPLOMACY_PAIR_MISSING',
  }),
  worldWorkerRuntimeTick: Object.freeze({
    kind: 'split-required',
    missingTargetError: 'OWNER_WORKER_COMMAND_SPLIT_REQUIRED',
  }),
};
Object.freeze(COMMAND_OWNER_RULES);

function cleanOwnerPart(value) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9:._-]/g, '_').slice(0, 160);
}

function missing(code, type, fields = []) {
  throw new CommandOwnerResolutionError(code, `Owner target is missing for ${type}`, {
    commandType: type,
    requiredFields: fields,
  });
}

function requirePlayerId(envelope, type) {
  const playerId = cleanOwnerPart(envelope.playerId);
  if (!playerId) missing('OWNER_PLAYER_ID_MISSING', type, ['playerId']);
  return `player:${playerId}`;
}

function readTarget(payload = {}, fields = []) {
  for (const field of fields) {
    const value = cleanOwnerPart(payload[field]);
    if (value) return { field, value };
  }
  return null;
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function resolveEncounterHandoffTarget(envelope = {}, options = {}) {
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {};
  const explicit = readTarget(payload, ['encounterId', 'combatEncounterId']);
  if (explicit) return { ...explicit, lookupPerformed: false };
  if (typeof options.lookupEncounterByCoordinate !== 'function') return null;
  const rawQ = payload.targetQ ?? payload.q ?? payload.x;
  const rawR = payload.targetR ?? payload.r ?? payload.y;
  if (!Number.isFinite(Number(rawQ)) || !Number.isFinite(Number(rawR))) {
    return { field: '', value: '', lookupPerformed: true };
  }
  const encounter = options.lookupEncounterByCoordinate({
    q: Math.floor(Number(rawQ)),
    r: Math.floor(Number(rawR)),
  });
  return {
    field: encounter?.id ? 'lookup:targetCoordinate' : '',
    value: cleanOwnerPart(encounter?.id),
    lookupPerformed: true,
  };
}

function resolveCommandOwners(envelope = {}, options = {}) {
  const type = normalizeCommandType(envelope.type || envelope.action);
  const rule = COMMAND_OWNER_RULES[type];
  if (!rule) {
    throw new CommandOwnerResolutionError(
      'OWNER_DECLARATION_MISSING',
      `No owner declaration for ${type || 'unknown command'}`,
      { commandType: type },
    );
  }
  const payload = envelope.payload && typeof envelope.payload === 'object' ? envelope.payload : {};
  let ownerKey = '';
  let ownerKeys = [];
  let targetField = '';
  let targetId = '';
  let lookupPerformed = false;

  if (rule.kind === 'player') {
    ownerKey = requirePlayerId(envelope, type);
    ownerKeys = [ownerKey];
  } else if (rule.kind === 'player-identity') {
    const target = readTarget(payload, rule.fields);
    if (!target) missing('OWNER_PLAYER_ID_MISSING', type, rule.fields);
    targetField = target.field;
    ownerKey = `player:${target.value}`;
    ownerKeys = [ownerKey];
  } else if (rule.kind === 'shared') {
    const target = readTarget(payload, rule.fields);
    if (!target) missing(rule.missingTargetError, type, rule.fields);
    targetField = target.field;
    targetId = target.value;
    ownerKey = `${rule.prefix}:${target.value}`;
    ownerKeys = uniqueSorted([
      rule.includePlayer ? requirePlayerId(envelope, type) : '',
      ownerKey,
    ]);
  } else if (rule.kind === 'player-encounter-handoff') {
    const playerKey = requirePlayerId(envelope, type);
    const target = resolveEncounterHandoffTarget(envelope, options);
    targetField = target?.field || '';
    targetId = target?.value || '';
    lookupPerformed = Boolean(target?.lookupPerformed);
    ownerKey = targetId ? `encounter:${targetId}` : playerKey;
    ownerKeys = uniqueSorted([playerKey, targetId ? ownerKey : '']);
  } else if (rule.kind === 'player-with-encounters') {
    ownerKey = requirePlayerId(envelope, type);
    const encounterIds = Array.isArray(payload.encounterIds)
      ? payload.encounterIds.map(cleanOwnerPart).filter(Boolean)
      : [];
    ownerKeys = uniqueSorted([
      ownerKey,
      ...encounterIds.map((encounterId) => `encounter:${encounterId}`),
    ]);
  } else if (rule.kind === 'diagnostic-player') {
    const playerId = cleanOwnerPart(envelope.playerId);
    if (!playerId) missing('OWNER_PLAYER_ID_MISSING', type, ['playerId']);
    ownerKey = `diagnostic:${playerId}`;
    ownerKeys = [ownerKey];
  } else if (rule.kind === 'constant') {
    ownerKey = rule.ownerKey;
    ownerKeys = [ownerKey];
  } else if (rule.kind === 'split-required') {
    missing(rule.missingTargetError, type, ['explicit per-mutation owner command']);
  }

  return {
    schema: 'command-owner-resolution-v1',
    status: 'resolved',
    commandType: type,
    ownerKey,
    ownerKeys,
    targetField,
    ...(rule.kind === 'player-encounter-handoff' ? { targetId, lookupPerformed } : {}),
    ruleKind: rule.kind,
  };
}

function inspectCommandOwners(envelope = {}, resolver = resolveCommandOwners) {
  try {
    return resolver(envelope);
  } catch (error) {
    if (!(error instanceof CommandOwnerResolutionError)) throw error;
    return {
      schema: 'command-owner-resolution-v1',
      status: 'blocked',
      commandType: error.commandType || normalizeCommandType(envelope.type || envelope.action),
      ownerKey: '',
      ownerKeys: [],
      error: error.code,
      message: error.message,
      requiredFields: error.requiredFields || [],
    };
  }
}

function createRepositoryOwnerResolver(repository = {}) {
  return (envelope = {}) => resolveCommandOwners(envelope, {
    lookupEncounterByCoordinate: (coord) => (
      repository.worldEncounterRepo?.getActiveEncounterAt?.(coord, { refreshRespawns: false })
      || null
    ),
  });
}

function listDeclaredCommandTypes() {
  return Object.keys(COMMAND_OWNER_RULES).sort();
}

module.exports = {
  COMMAND_OWNER_RULES,
  CommandOwnerResolutionError,
  PLAYER_COMMAND_TYPES,
  createRepositoryOwnerResolver,
  inspectCommandOwners,
  listDeclaredCommandTypes,
  resolveCommandOwners,
};

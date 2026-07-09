'use strict';

const crypto = require('node:crypto');

const COMMAND_SCHEMA = 'game-command-v1';
const CLIENT_IDEMPOTENT = 'client-idempotent';
const SERVER_FALLBACK_ID = 'server-fallback-id';
const ENVELOPE_FIELDS = new Set([
  'clientCommand',
  'clientRequestId',
  'commandId',
  'idempotencyKey',
  'requestId',
]);
const TRACE_ONLY_FIELDS = new Set(['debugTrace', 'worldMarchTrace']);
const TYPE_ALIASES = Object.freeze({
  BuildBuilding: 'build',
});
let fallbackSequence = 0;

class CommandEnvelopeError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'CommandEnvelopeError';
    this.code = code;
    this.status = 400;
    Object.assign(this, detail);
  }
}

function cleanText(value, fallback = '', maxLength = 160) {
  if (value === null || value === undefined) return fallback;
  return (
    String(value)
      .trim()
      .replace(/[^a-zA-Z0-9:._-]/g, '_')
      .slice(0, maxLength) || fallback
  );
}

function readHeader(req = {}, name = '') {
  const direct = req.get?.(name);
  if (direct) return direct;
  const lower = name.toLowerCase();
  return req.headers?.[lower] || req.headers?.[name] || '';
}

function createFallbackRequestId() {
  fallbackSequence += 1;
  return `server-${Date.now()}-${fallbackSequence}`;
}

function normalizeCommandType(value) {
  const type = cleanText(value, '', 120);
  return TYPE_ALIASES[type] || type;
}

function removeUndefined(value) {
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = removeUndefined(value[key]);
    return result;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(removeUndefined(value));
}

function digestPayload(payload = {}) {
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function stripEnvelopeFields(body = {}) {
  return Object.keys(body).reduce((result, key) => {
    if (!ENVELOPE_FIELDS.has(key) && !TRACE_ONLY_FIELDS.has(key) && key !== 'action') {
      result[key] = body[key];
    }
    return result;
  }, {});
}

function buildCommandPayload(type, body = {}, options = {}) {
  if (options.payload && typeof options.payload === 'object') return removeUndefined(options.payload);
  const payload = stripEnvelopeFields(body && typeof body === 'object' ? body : {});
  switch (normalizeCommandType(type)) {
    case 'build':
    case 'upgrade': {
      const buildingId = payload.buildingId || payload.buildingType || payload.target || '';
      delete payload.buildingType;
      delete payload.target;
      return removeUndefined({ ...payload, buildingId });
    }
    case 'assign': {
      const job = payload.job || payload.target || '';
      delete payload.target;
      return removeUndefined({ ...payload, job });
    }
    case 'playerLogin':
    case 'opsLoginAudit':
      return removeUndefined({ username: payload.username || '' });
    default:
      return removeUndefined(payload);
  }
}

function readConsistentIdentifier(body = {}, nested = {}, field) {
  const topLevel = cleanText(body[field], '');
  const nestedValue = cleanText(nested[field], '');
  if (topLevel && nestedValue && topLevel !== nestedValue) {
    throw new CommandEnvelopeError(
      'COMMAND_ENVELOPE_IDENTIFIER_MISMATCH',
      `${field} does not match clientCommand.${field}`,
      { field, topLevel, nested: nestedValue },
    );
  }
  return topLevel || nestedValue;
}

function normalizeCommandEnvelope(req = {}, options = {}) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const clientCommand = body.clientCommand && typeof body.clientCommand === 'object'
    ? body.clientCommand
    : {};
  const clientSchema = cleanText(clientCommand.schema, '');
  if (clientSchema && clientSchema !== COMMAND_SCHEMA) {
    throw new CommandEnvelopeError(
      'COMMAND_SCHEMA_UNSUPPORTED',
      `Unsupported command schema: ${clientSchema}`,
      { field: 'clientCommand.schema' },
    );
  }
  const requestedType = normalizeCommandType(options.type || body.action || clientCommand.type);
  const clientType = normalizeCommandType(clientCommand.type);
  if (!requestedType) {
    throw new CommandEnvelopeError('COMMAND_TYPE_REQUIRED', 'Command type is required');
  }
  if (clientType && clientType !== requestedType) {
    throw new CommandEnvelopeError(
      'COMMAND_TYPE_MISMATCH',
      'Command type does not match clientCommand.type',
      { requestedType, clientType },
    );
  }

  const requestId = cleanText(
    readHeader(req, 'X-Client-Request-ID')
      || body.clientRequestId
      || body.requestId
      || clientCommand.requestId
      || clientCommand.client?.requestId,
    createFallbackRequestId(),
  );
  const explicitCommandId = readConsistentIdentifier(body, clientCommand, 'commandId');
  const explicitIdempotencyKey = readConsistentIdentifier(body, clientCommand, 'idempotencyKey');
  const missingClientFields = [];
  if (!explicitCommandId) missingClientFields.push('commandId');
  if (!explicitIdempotencyKey) missingClientFields.push('idempotencyKey');
  if (options.requireClientIds && missingClientFields.length > 0) {
    throw new CommandEnvelopeError(
      'COMMAND_ENVELOPE_REQUIRED',
      `Missing required client command fields: ${missingClientFields.join(', ')}`,
      { missingFields: missingClientFields },
    );
  }
  const commandId = explicitCommandId || `cmd-${requestId}`;
  const idempotencyKey = explicitIdempotencyKey || commandId;
  const payload = buildCommandPayload(requestedType, body, options);
  const clientPayload = clientCommand.payload && typeof clientCommand.payload === 'object'
    ? removeUndefined(clientCommand.payload)
    : null;
  const payloadDigest = digestPayload(payload);
  const clientPayloadDigest = clientPayload ? digestPayload(clientPayload) : '';
  const clientPayloadMatches = !clientPayload || payloadDigest === clientPayloadDigest;
  if (options.requirePayloadMatch !== false && !clientPayloadMatches) {
    throw new CommandEnvelopeError(
      'COMMAND_PAYLOAD_MISMATCH',
      'Transport payload does not match clientCommand.payload',
      { payloadDigest, clientPayloadDigest },
    );
  }
  const idempotencyClassification = missingClientFields.length === 0
    ? CLIENT_IDEMPOTENT
    : SERVER_FALLBACK_ID;

  return {
    schema: COMMAND_SCHEMA,
    type: requestedType,
    action: normalizeCommandType(options.action || body.action || requestedType),
    commandId,
    requestId,
    idempotencyKey,
    playerId: cleanText(options.playerId ?? req.playerId ?? body.playerId, ''),
    clientVersion: cleanText(body.clientVersion || clientCommand.clientVersion, ''),
    clientStateRevision: body.clientStateRevision ?? body.stateRevision ?? null,
    payload,
    payloadDigest,
    client: {
      requestId,
      clientSequence: clientCommand.client?.clientSequence
        ?? clientCommand.clientSequence
        ?? body.clientSequence
        ?? null,
      clientInputIntent: clientCommand.client?.clientInputIntent
        ?? clientCommand.clientInputIntent
        ?? body.clientInputIntent
        ?? null,
    },
    source: {
      route: options.route || req.path || req.originalUrl || '',
      method: String(options.method || req.method || 'POST').toUpperCase(),
      platform: cleanText(body.platform || clientCommand.platform, ''),
      deployVersion: cleanText(body.deployVersion || clientCommand.deployVersion, ''),
      inventoryId: cleanText(options.inventoryId, '', 200),
    },
    compatibility: {
      clientEnvelopePresent: Boolean(body.clientCommand),
      idempotencyClassification,
      serverFallbackId: idempotencyClassification === SERVER_FALLBACK_ID,
      missingClientFields,
      clientPayloadDigest,
      clientPayloadMatches,
    },
  };
}

function createBuildBuildingCommand(req = {}, options = {}) {
  const envelope = options.envelope || normalizeCommandEnvelope(req, {
    ...options,
    type: 'build',
    action: 'build',
    route: options.route || '/api/game/action',
  });
  const buildingId = cleanText(
    envelope.payload?.buildingId || req.body?.buildingId || req.body?.target,
    '',
  );
  return {
    ...envelope,
    type: 'BuildBuilding',
    action: 'build',
    payload: {
      ...envelope.payload,
      buildingId,
      cityId: cleanText(envelope.payload?.cityId || req.body?.cityId, ''),
      target: buildingId,
    },
  };
}

function summarizeCommand(command = {}) {
  return {
    schema: 'game-command-summary-v1',
    commandId: command.commandId || '',
    requestId: command.requestId || '',
    idempotencyKey: command.idempotencyKey || '',
    idempotencyClassification: command.compatibility?.idempotencyClassification || '',
    type: command.type || '',
    action: command.action || '',
    playerId: command.playerId || '',
    ownerKey: command.ownerKey || '',
    ownerKeys: Array.isArray(command.ownerKeys) ? [...command.ownerKeys] : [],
    target: command.payload?.buildingId || command.payload?.target || '',
    cityId: command.payload?.cityId || '',
    payloadDigest: command.payloadDigest || '',
    clientStateRevision: command.clientStateRevision ?? null,
  };
}

function isCommandEnvelopeError(error = {}) {
  return error instanceof CommandEnvelopeError || error?.name === 'CommandEnvelopeError';
}

function buildCommandEnvelopeErrorPayload(error = {}) {
  return {
    success: false,
    error: error.code || 'COMMAND_ENVELOPE_INVALID',
    message: error.message || 'Command envelope is invalid',
    field: error.field || undefined,
    missingFields: error.missingFields || undefined,
  };
}

module.exports = {
  CLIENT_IDEMPOTENT,
  COMMAND_SCHEMA,
  CommandEnvelopeError,
  SERVER_FALLBACK_ID,
  buildCommandEnvelopeErrorPayload,
  buildCommandPayload,
  cleanText,
  createBuildBuildingCommand,
  digestPayload,
  isCommandEnvelopeError,
  normalizeCommandEnvelope,
  normalizeCommandType,
  stableStringify,
  summarizeCommand,
};

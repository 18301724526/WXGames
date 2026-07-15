'use strict';

const crypto = require('node:crypto');

const COMMAND_SCHEMA = 'game-command-v1';
const CLIENT_IDEMPOTENT = 'client-idempotent';
const INTERNAL_IDEMPOTENT = 'internal-idempotent';
const SERVER_FALLBACK_ID = 'server-fallback-id';
const ENVELOPE_FIELDS = new Set([
  'clientCommand',
  'clientRequestId',
  'commandId',
  'idempotencyKey',
  'requestId',
  'trace',
]);
const TRACE_ONLY_FIELDS = new Set([
  'debugTrace',
  'worldMarchTrace',
  'clientActionTrace',
  'clientActionTraceId',
  'sourceSurface',
  'hitTargetId',
  'actionType',
  'actionDescriptorId',
  'visualDisabled',
]);
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

function createPayloadNotHashableError(reason, cause) {
  return new CommandEnvelopeError(
    'PAYLOAD_NOT_HASHABLE',
    'Command payload is not hashable',
    { reason, ...(cause ? { cause } : {}) },
  );
}

function normalizePayloadForHash(value, seen = new Set()) {
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw createPayloadNotHashableError('Payload numbers must be finite');
    }
    return value;
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw createPayloadNotHashableError(`Payload contains unsupported ${typeof value} value`);
  }
  if (typeof value !== 'object') {
    throw createPayloadNotHashableError(`Payload contains unsupported ${typeof value} value`);
  }
  if (seen.has(value)) {
    throw createPayloadNotHashableError('Payload contains a circular reference');
  }

  seen.add(value);
  try {
    // Command identity accepts JSON primitives, arrays, and plain objects only. Custom toJSON
    // hooks are rejected instead of letting executable serialization redefine payload identity.
    if (typeof value.toJSON === 'function') {
      throw createPayloadNotHashableError('Payload must not define a toJSON method');
    }
    if (Array.isArray(value)) {
      return value.map((item) => normalizePayloadForHash(item, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw createPayloadNotHashableError('Payload containers must be plain objects or arrays');
    }

    const symbolKeys = Object.getOwnPropertySymbols(value)
      .filter((key) => Object.prototype.propertyIsEnumerable.call(value, key));
    if (symbolKeys.length > 0) {
      throw createPayloadNotHashableError('Payload contains an enumerable Symbol key');
    }

    const entries = Object.keys(value)
      .map((key) => ({ key, normalizedKey: key.normalize('NFC') }))
      .sort((left, right) => {
        if (left.normalizedKey < right.normalizedKey) return -1;
        if (left.normalizedKey > right.normalizedKey) return 1;
        return 0;
      });
    const result = {};
    let previousKey = null;
    for (const { key, normalizedKey } of entries) {
      if (normalizedKey === previousKey) {
        throw createPayloadNotHashableError(
          'Payload contains duplicate keys after Unicode normalization',
        );
      }
      previousKey = normalizedKey;
      if (value[key] !== undefined) {
        result[normalizedKey] = normalizePayloadForHash(value[key], seen);
      }
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function stableStringify(value) {
  try {
    // An omitted or explicitly undefined top-level payload is the empty payload. Nested
    // undefined values keep JSON's existing object-omission and array-null semantics.
    const payload = value === undefined ? {} : value;
    const serialized = JSON.stringify(normalizePayloadForHash(payload));
    if (typeof serialized !== 'string') {
      throw createPayloadNotHashableError('Payload does not serialize to JSON');
    }
    return serialized;
  } catch (error) {
    if (error instanceof CommandEnvelopeError && error.code === 'PAYLOAD_NOT_HASHABLE') {
      throw error;
    }
    throw createPayloadNotHashableError('Payload serialization failed', error);
  }
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

function normalizeTraceSection(body = {}, clientCommand = {}) {
  const source = clientCommand.trace && typeof clientCommand.trace === 'object'
    ? clientCommand.trace
    : (body.clientActionTrace && typeof body.clientActionTrace === 'object'
      ? body.clientActionTrace
      : body);
  const clientActionTraceId = cleanText(source.clientActionTraceId || source.tapTraceId, '', 160);
  const sourceSurface = cleanText(source.sourceSurface, '', 120);
  const hitTargetId = cleanText(source.hitTargetId, '', 160);
  const actionType = cleanText(source.actionType, '', 120);
  const actionDescriptorId = cleanText(source.actionDescriptorId, '', 160);
  const hasTrace = clientActionTraceId
    || sourceSurface
    || hitTargetId
    || actionType
    || actionDescriptorId
    || source.visualDisabled !== undefined;
  if (!hasTrace) return null;
  return {
    schema: 'client-action-trace-v1',
    clientActionTraceId,
    sourceSurface,
    hitTargetId,
    actionType,
    actionDescriptorId,
    visualDisabled: Boolean(source.visualDisabled),
  };
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
  const trace = normalizeTraceSection(body, clientCommand);
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
    ? (options.internalCommand === true ? INTERNAL_IDEMPOTENT : CLIENT_IDEMPOTENT)
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
    trace,
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
      internalCommand: options.internalCommand === true,
      idempotencyClassification,
      serverFallbackId: idempotencyClassification === SERVER_FALLBACK_ID,
      missingClientFields,
      clientPayloadDigest,
      clientPayloadMatches,
    },
  };
}

function createInternalCommandEnvelope(options = {}) {
  const type = normalizeCommandType(options.type);
  const commandId = cleanText(options.commandId, '');
  const idempotencyKey = cleanText(options.idempotencyKey, '');
  if (!type || !commandId || !idempotencyKey) {
    throw new CommandEnvelopeError(
      'INTERNAL_COMMAND_ENVELOPE_INVALID',
      'Internal command type, commandId, and idempotencyKey are required',
    );
  }
  return normalizeCommandEnvelope({
    playerId: options.playerId,
    method: options.method || 'BACKGROUND',
    path: options.route || 'backend/world-worker.js',
    headers: { 'x-client-request-id': options.requestId || commandId },
    get(name) {
      return this.headers[String(name).toLowerCase()] || '';
    },
    body: {
      action: type,
      commandId,
      idempotencyKey,
    },
  }, {
    type,
    action: type,
    playerId: options.playerId,
    route: options.route || 'backend/world-worker.js',
    method: options.method || 'BACKGROUND',
    inventoryId: options.inventoryId || 'worker:world-worker-runtime-writes',
    payload: options.payload || {},
    requireClientIds: true,
    internalCommand: true,
  });
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
    clientActionTrace: command.trace ? { ...command.trace } : null,
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
  INTERNAL_IDEMPOTENT,
  SERVER_FALLBACK_ID,
  buildCommandEnvelopeErrorPayload,
  buildCommandPayload,
  cleanText,
  createBuildBuildingCommand,
  createInternalCommandEnvelope,
  digestPayload,
  isCommandEnvelopeError,
  normalizeCommandEnvelope,
  normalizeCommandType,
  stableStringify,
  summarizeCommand,
};

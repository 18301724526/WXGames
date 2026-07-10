(function (global) {
  const COMMAND_SCHEMA = 'game-command-v1';
  const TRACE_SCHEMA = 'client-action-trace-v1';
  const LOCAL_BLOCK_EVENT = 'command:localBlock';
  let fallbackIdSequence = 0;
  let fallbackTraceSequence = 0;

  function cleanIdentifier(value, maxLength = 160) {
    return String(value ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9:._-]/g, '_')
      .slice(0, maxLength);
  }

  function canonicalize(value, seen = new Set()) {
    if (value === null) return null;
    if (value === undefined) return '__undefined__';
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value !== 'object') return String(value);
    if (seen.has(value)) throw new TypeError('Command payload must not contain circular references');
    seen.add(value);
    try {
      if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen));
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = canonicalize(value[key], seen);
          return result;
        }, {});
    } finally {
      seen.delete(value);
    }
  }

  function stableStringify(value) {
    return JSON.stringify(canonicalize(value));
  }

  function hashText(value = '') {
    let hash = 2166136261;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function createDefaultIdSeed() {
    const randomId = global.crypto?.randomUUID?.();
    if (randomId) return randomId;
    fallbackIdSequence += 1;
    return `${Date.now().toString(36)}-${fallbackIdSequence.toString(36)}`;
  }

  function createDefaultTraceId(type = '', sequence = 0) {
    fallbackTraceSequence += 1;
    return cleanIdentifier(
      `cat-${type || 'command'}-${Date.now().toString(36)}-${sequence || fallbackTraceSequence}`,
    );
  }

  function normalizeTrace(value = {}, fallback = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const clientActionTraceId = cleanIdentifier(
      source.clientActionTraceId
        || source.tapTraceId
        || fallback.clientActionTraceId
        || createDefaultTraceId(fallback.type, fallback.sequence),
    );
    return {
      schema: TRACE_SCHEMA,
      clientActionTraceId,
      sourceSurface: cleanIdentifier(source.sourceSurface || fallback.sourceSurface || ''),
      hitTargetId: cleanIdentifier(source.hitTargetId || fallback.hitTargetId || ''),
      actionType: cleanIdentifier(source.actionType || fallback.type || ''),
      actionDescriptorId: cleanIdentifier(source.actionDescriptorId || fallback.actionDescriptorId || fallback.type || ''),
      visualDisabled: Boolean(source.visualDisabled ?? fallback.visualDisabled ?? false),
    };
  }

  function createLocalBlockError(reason, detail = {}) {
    const error = new Error(detail.message || `Client command blocked: ${reason}`);
    error.name = 'ClientCommandBlockError';
    error.code = `CLIENT_COMMAND_${reason}`;
    error.localBlockReason = reason;
    error.commandType = detail.commandType || '';
    error.commandKey = detail.commandKey || '';
    error.commandId = detail.commandId || '';
    error.status = 0;
    return error;
  }

  class ClientCommandSender {
    constructor(options = {}) {
      this.transport = typeof options.transport === 'function' ? options.transport : null;
      this.operationLog = options.operationLog || null;
      this.createIdSeed = typeof options.createIdSeed === 'function'
        ? options.createIdSeed
        : createDefaultIdSeed;
      this.sequence = 0;
      this.inFlightByKey = new Map();
      this.inFlightCommandIds = new Set();
    }

    buildCommandKey(type, payload = {}) {
      const keyPayload = Object.keys(payload).reduce((result, key) => {
        if (key !== 'clientInputIntent') result[key] = payload[key];
        return result;
      }, {});
      return `${type}:${hashText(stableStringify(keyPayload))}`;
    }

    recordLocalBlock(reason, detail = {}) {
      const payload = {
        commandType: detail.commandType || '',
        commandKey: detail.commandKey || '',
        reason,
      };
      (this.operationLog || global.ClientOperationLog)?.record?.(LOCAL_BLOCK_EVENT, payload);
      return createLocalBlockError(reason, { ...detail, ...payload });
    }

    createEnvelope(type, payload, options = {}) {
      const sequence = ++this.sequence;
      const seed = cleanIdentifier(this.createIdSeed({ type, payload, sequence })) || createDefaultIdSeed();
      const commandId = cleanIdentifier(options.commandId || `cmd-${seed}`);
      const idempotencyKey = cleanIdentifier(options.idempotencyKey || `idem-${seed}`);
      if (!commandId || !idempotencyKey) {
        throw this.recordLocalBlock('PAYLOAD_SHAPE', {
          commandType: type,
          commandKey: options.commandKey || '',
          message: 'Command identifiers are required',
        });
      }
      return {
        schema: COMMAND_SCHEMA,
        type,
        commandId,
        idempotencyKey,
        payload,
        trace: normalizeTrace(options.trace, { type, sequence }),
        client: {
          requestId: '',
          clientSequence: sequence,
          clientInputIntent: payload.clientInputIntent || null,
          ...(options.client && typeof options.client === 'object' ? options.client : {}),
        },
      };
    }

    submit(type, payload = {}, options = {}) {
      const commandType = cleanIdentifier(type, 120);
      if (!commandType || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return Promise.reject(this.recordLocalBlock('PAYLOAD_SHAPE', {
          commandType,
          commandKey: cleanIdentifier(options.commandKey),
          message: 'Command type and object payload are required',
        }));
      }
      if (!this.transport) {
        return Promise.reject(this.recordLocalBlock('UI_NOT_READY', {
          commandType,
          commandKey: cleanIdentifier(options.commandKey),
          message: 'Client command transport is not ready',
        }));
      }

      let commandKey = cleanIdentifier(options.commandKey, 240);
      try {
        commandKey = commandKey || this.buildCommandKey(commandType, payload);
      } catch (error) {
        return Promise.reject(this.recordLocalBlock('PAYLOAD_SHAPE', {
          commandType,
          commandKey,
          message: error?.message || 'Command payload cannot be serialized',
        }));
      }
      if (this.inFlightByKey.has(commandKey)) {
        return Promise.reject(this.recordLocalBlock('IN_FLIGHT', { commandType, commandKey }));
      }

      let envelope;
      try {
        envelope = this.createEnvelope(commandType, payload, { ...options, commandKey });
      } catch (error) {
        return Promise.reject(error);
      }
      if (this.inFlightCommandIds.has(envelope.commandId)) {
        return Promise.reject(this.recordLocalBlock('DUPLICATE_COMMAND_ID', {
          commandType,
          commandKey,
          commandId: envelope.commandId,
        }));
      }

      let operation;
      operation = Promise.resolve()
        .then(() => this.transport(envelope, { ...options, commandKey }))
        .finally(() => {
          if (this.inFlightByKey.get(commandKey) === operation) this.inFlightByKey.delete(commandKey);
          this.inFlightCommandIds.delete(envelope.commandId);
        });
      this.inFlightByKey.set(commandKey, operation);
      this.inFlightCommandIds.add(envelope.commandId);
      return operation;
    }

    isInFlight(commandKey) {
      return this.inFlightByKey.has(String(commandKey || ''));
    }
  }

  ClientCommandSender.COMMAND_SCHEMA = COMMAND_SCHEMA;
  ClientCommandSender.TRACE_SCHEMA = TRACE_SCHEMA;
  ClientCommandSender.stableStringify = stableStringify;
  ClientCommandSender.hashText = hashText;
  global.ClientCommandSender = ClientCommandSender;
  if (typeof module !== 'undefined' && module.exports) module.exports = ClientCommandSender;
})(typeof window !== 'undefined' ? window : globalThis);

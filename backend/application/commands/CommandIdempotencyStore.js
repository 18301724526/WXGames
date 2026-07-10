'use strict';

const crypto = require('node:crypto');

const {
  CLIENT_IDEMPOTENT,
  INTERNAL_IDEMPOTENT,
  stableStringify,
} = require('./CommandEnvelope');

const STATUS_IN_PROGRESS = 'in_progress';
const STATUS_COMMITTED = 'committed';
const STATUS_REJECTED = 'rejected';
const STATUS_FAILED = 'failed';

class CommandIdempotencyError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'CommandIdempotencyError';
    this.code = code;
    this.status = detail.status || 409;
    Object.assign(this, detail);
  }
}

function responseDigest(statusCode, payload) {
  return crypto
    .createHash('sha256')
    .update(stableStringify({ statusCode, payload }))
    .digest('hex');
}

function parseResponsePayload(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function toRecord(row = null) {
  if (!row) return null;
  return {
    playerId: row.playerId,
    idempotencyKey: row.idempotencyKey,
    commandId: row.commandId,
    ownerKey: row.ownerKey || '',
    payloadDigest: row.payloadDigest,
    status: row.status,
    responseDigest: row.responseDigest || '',
    responsePayload: parseResponsePayload(row.responsePayload),
    statusCode: row.statusCode == null ? null : Number(row.statusCode),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function terminalStatusFor(statusCode) {
  const status = Number(statusCode) || 500;
  if (status < 400) return STATUS_COMMITTED;
  if (status < 500) return STATUS_REJECTED;
  return STATUS_FAILED;
}

class CommandIdempotencyStore {
  constructor(db, options = {}) {
    if (!db) throw new Error('CommandIdempotencyStore requires db');
    this.db = db;
    this.now = options.now || (() => new Date());
  }

  _nowIso() {
    const value = this.now();
    return (value instanceof Date ? value : new Date(value)).toISOString();
  }

  _get(playerId, idempotencyKey) {
    return toRecord(this.db.prepare(`
      SELECT playerId, idempotencyKey, commandId, ownerKey, payloadDigest, status,
        responseDigest, responsePayload, statusCode, createdAt, updatedAt
      FROM command_idempotency
      WHERE playerId = ? AND idempotencyKey = ?
    `).get(playerId, idempotencyKey));
  }

  _validateEnvelope(envelope = {}) {
    if (![CLIENT_IDEMPOTENT, INTERNAL_IDEMPOTENT]
      .includes(envelope.compatibility?.idempotencyClassification)
        || envelope.compatibility?.serverFallbackId) {
      throw new CommandIdempotencyError(
        'IDEMPOTENCY_CLIENT_KEY_REQUIRED',
        'A stable client or internal idempotency key is required',
        { status: 400 },
      );
    }
    const playerId = String(envelope.playerId || '').trim();
    const idempotencyKey = String(envelope.idempotencyKey || '').trim();
    const commandId = String(envelope.commandId || '').trim();
    const payloadDigestValue = String(envelope.payloadDigest || '').trim();
    if (!playerId) {
      throw new CommandIdempotencyError('IDEMPOTENCY_PLAYER_REQUIRED', 'playerId is required', {
        status: 400,
      });
    }
    if (!idempotencyKey || !commandId || !payloadDigestValue) {
      throw new CommandIdempotencyError(
        'IDEMPOTENCY_ENVELOPE_INVALID',
        'commandId, idempotencyKey, and payloadDigest are required',
        { status: 400 },
      );
    }
    return { playerId, idempotencyKey, commandId, payloadDigest: payloadDigestValue };
  }

  _inspectExisting(existing, envelopeFields) {
    if (existing.payloadDigest !== envelopeFields.payloadDigest) {
      throw new CommandIdempotencyError(
        'IDEMPOTENCY_KEY_CONFLICT',
        'Idempotency key was already used with a different payload',
        {
          status: 409,
          playerId: envelopeFields.playerId,
          idempotencyKey: envelopeFields.idempotencyKey,
          existingPayloadDigest: existing.payloadDigest,
          payloadDigest: envelopeFields.payloadDigest,
        },
      );
    }
    if (existing.status === STATUS_IN_PROGRESS) {
      return {
        status: 'in-progress',
        record: existing,
        response: {
          statusCode: 409,
          payload: {
            success: false,
            error: 'COMMAND_IN_FLIGHT',
            message: 'Command with this idempotency key is still in progress',
            retryable: true,
            commandId: existing.commandId,
            idempotencyKey: existing.idempotencyKey,
          },
        },
      };
    }
    if (existing.statusCode == null || existing.responsePayload == null) {
      throw new CommandIdempotencyError(
        'IDEMPOTENCY_RESULT_CORRUPT',
        'Stored idempotency result is incomplete',
        { status: 500, idempotencyKey: existing.idempotencyKey },
      );
    }
    return {
      status: 'replay',
      record: existing,
      response: {
        statusCode: existing.statusCode,
        payload: existing.responsePayload,
      },
    };
  }

  begin(envelope = {}) {
    const fields = this._validateEnvelope(envelope);
    const now = this._nowIso();
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO command_idempotency (
        playerId, idempotencyKey, commandId, ownerKey, payloadDigest, status,
        responseDigest, responsePayload, statusCode, createdAt, updatedAt
      ) VALUES (?, ?, ?, NULL, ?, ?, NULL, NULL, NULL, ?, ?)
    `).run(
      fields.playerId,
      fields.idempotencyKey,
      fields.commandId,
      fields.payloadDigest,
      STATUS_IN_PROGRESS,
      now,
      now,
    );
    const record = this._get(fields.playerId, fields.idempotencyKey);
    if (insert.changes > 0) return { status: 'started', record };
    return this._inspectExisting(record, fields);
  }

  bindOwner(record = {}, ownerKey = '') {
    const normalizedOwnerKey = String(ownerKey || '').trim();
    if (!normalizedOwnerKey) throw new Error('Command idempotency ownerKey is required');
    this.db.prepare(`
      UPDATE command_idempotency
      SET ownerKey = ?, updatedAt = ?
      WHERE playerId = ? AND idempotencyKey = ? AND commandId = ? AND status = ?
    `).run(
      normalizedOwnerKey,
      this._nowIso(),
      record.playerId,
      record.idempotencyKey,
      record.commandId,
      STATUS_IN_PROGRESS,
    );
    return this._get(record.playerId, record.idempotencyKey);
  }

  recordResult(record = {}, response = {}, options = {}) {
    const statusCode = Number(response.statusCode) || 500;
    const payload = response.payload == null ? {} : response.payload;
    const status = options.status || terminalStatusFor(statusCode);
    const serialized = JSON.stringify(payload);
    const digest = responseDigest(statusCode, payload);
    const result = this.db.prepare(`
      UPDATE command_idempotency
      SET status = ?, responseDigest = ?, responsePayload = ?, statusCode = ?, updatedAt = ?
      WHERE playerId = ? AND idempotencyKey = ? AND commandId = ? AND status = ?
    `).run(
      status,
      digest,
      serialized,
      statusCode,
      this._nowIso(),
      record.playerId,
      record.idempotencyKey,
      record.commandId,
      STATUS_IN_PROGRESS,
    );
    if (result.changes === 0) {
      const existing = this._get(record.playerId, record.idempotencyKey);
      if (existing?.status !== STATUS_IN_PROGRESS) {
        if (existing?.responseDigest === digest
            && existing?.statusCode === statusCode
            && existing?.status === status) {
          return existing;
        }
        throw new CommandIdempotencyError(
          'IDEMPOTENCY_RESULT_WRITE_CONFLICT',
          'A different terminal result is already stored for this idempotency key',
          { status: 409, idempotencyKey: record.idempotencyKey },
        );
      }
      throw new CommandIdempotencyError(
        'IDEMPOTENCY_RESULT_WRITE_CONFLICT',
        'Idempotency result could not be recorded',
        { status: 409, idempotencyKey: record.idempotencyKey },
      );
    }
    return this._get(record.playerId, record.idempotencyKey);
  }

  abandon(record = {}) {
    return this.db.prepare(`
      DELETE FROM command_idempotency
      WHERE playerId = ? AND idempotencyKey = ? AND commandId = ? AND status = ?
    `).run(
      record.playerId,
      record.idempotencyKey,
      record.commandId,
      STATUS_IN_PROGRESS,
    ).changes;
  }

  get(playerId, idempotencyKey) {
    return this._get(String(playerId || '').trim(), String(idempotencyKey || '').trim());
  }
}

module.exports = {
  CommandIdempotencyError,
  CommandIdempotencyStore,
  STATUS_COMMITTED,
  STATUS_FAILED,
  STATUS_IN_PROGRESS,
  STATUS_REJECTED,
  responseDigest,
  terminalStatusFor,
};

'use strict';

function requireText(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`Command receipt ${field} is required`);
  return normalized;
}

function requireNonNegativeInteger(value, field) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`Command receipt ${field} must be a non-negative integer`);
  }
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Command receipt ${field} must be a non-negative integer`);
  }
  return normalized;
}

class CommandReceiptShadowStore {
  constructor(db, options = {}) {
    if (!db) throw new Error('CommandReceiptShadowStore requires db');
    this.db = db;
    this.now = options.now || (() => new Date());
    this.insertAcceptedStatement = this.db.prepare(`
      INSERT OR IGNORE INTO command_receipts (
        command_id, payload_hash, session_id, client_seq, status,
        admission_credential_version, admission_session_epoch, admission_authz_epoch,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?)
    `);
    this.insertAcceptedTransaction = this.db.transaction((receipt) => (
      this.insertAcceptedStatement.run(
        receipt.commandId,
        receipt.payloadHash,
        receipt.sessionId,
        receipt.clientSeq,
        receipt.credentialVersion,
        receipt.sessionEpoch,
        receipt.authzEpoch,
        receipt.createdAt,
        receipt.createdAt,
      )
    ));
  }

  _nowIso() {
    const value = this.now();
    return (value instanceof Date ? value : new Date(value)).toISOString();
  }

  writeAccepted(receipt = {}) {
    const normalized = {
      commandId: requireText(receipt.commandId, 'commandId'),
      payloadHash: requireText(receipt.payloadHash, 'payloadHash'),
      sessionId: requireText(receipt.sessionId, 'sessionId'),
      clientSeq: requireNonNegativeInteger(receipt.clientSeq, 'clientSeq'),
      credentialVersion: requireNonNegativeInteger(
        receipt.credentialVersion,
        'credentialVersion',
      ),
      sessionEpoch: requireNonNegativeInteger(receipt.sessionEpoch, 'sessionEpoch'),
      authzEpoch: requireNonNegativeInteger(receipt.authzEpoch, 'authzEpoch'),
      createdAt: this._nowIso(),
    };
    const result = this.insertAcceptedTransaction(normalized);
    return {
      inserted: result.changes > 0,
      changes: result.changes,
    };
  }
}

module.exports = { CommandReceiptShadowStore };

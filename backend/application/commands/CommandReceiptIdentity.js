'use strict';

const crypto = require('node:crypto');

const {
  CommandEnvelopeError,
  cleanText,
  stableStringify,
} = require('./CommandEnvelope');

const MAX_COMMAND_ID_LENGTH = 160;

function computePayloadHash(payload = {}) {
  try {
    return crypto
      .createHash('sha256')
      .update(stableStringify(payload))
      .digest('hex');
  } catch (error) {
    if (error instanceof CommandEnvelopeError && error.code === 'PAYLOAD_NOT_HASHABLE') {
      throw error;
    }
    throw new CommandEnvelopeError(
      'PAYLOAD_NOT_HASHABLE',
      'Command payload is not hashable',
      { cause: error },
    );
  }
}

function normalizeCommandId(value) {
  return cleanText(value, '', MAX_COMMAND_ID_LENGTH);
}

function isNormalizedCommandId(value) {
  return typeof value === 'string'
    && value.length > 0
    && value === normalizeCommandId(value);
}

module.exports = {
  MAX_COMMAND_ID_LENGTH,
  computePayloadHash,
  isNormalizedCommandId,
  normalizeCommandId,
};

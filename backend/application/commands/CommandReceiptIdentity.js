'use strict';

const crypto = require('node:crypto');

const { cleanText, stableStringify } = require('./CommandEnvelope');

const MAX_COMMAND_ID_LENGTH = 160;

function computePayloadHash(payload = {}) {
  return crypto
    .createHash('sha256')
    .update(stableStringify(payload))
    .digest('hex');
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

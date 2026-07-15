'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CommandEnvelopeError,
  digestPayload,
  stableStringify,
} = require('../application/commands/CommandEnvelope');
const {
  MAX_COMMAND_ID_LENGTH,
  computePayloadHash,
  isNormalizedCommandId,
  normalizeCommandId,
} = require('../application/commands/CommandReceiptIdentity');

test('computePayloadHash is deterministic and ignores object field order', () => {
  const first = {
    target: { r: -2, q: 3 },
    formation: { members: ['general-1', 'general-2'], slot: 1 },
  };
  const reordered = {
    formation: { slot: 1, members: ['general-1', 'general-2'] },
    target: { q: 3, r: -2 },
  };

  assert.equal(computePayloadHash(first), computePayloadHash(first));
  assert.equal(computePayloadHash(first), computePayloadHash(reordered));
  assert.equal(computePayloadHash(first), digestPayload(first));
  assert.match(computePayloadHash(first), /^[a-f0-9]{64}$/);
});

test('computePayloadHash distinguishes different payloads', () => {
  assert.notEqual(
    computePayloadHash({ target: { q: 3, r: -2 } }),
    computePayloadHash({ target: { q: 4, r: -2 } }),
  );
});

function assertPayloadNotHashable(error) {
  assert.equal(error instanceof CommandEnvelopeError, true);
  assert.equal(error instanceof TypeError, false);
  assert.equal(error.code, 'PAYLOAD_NOT_HASHABLE');
  return true;
}

test('computePayloadHash rejects values that JSON cannot serialize with a domain error', () => {
  const circular = {};
  circular.self = circular;
  const payloads = [
    { value: 1n },
    { value: () => 'unsupported' },
    { value: Symbol('unsupported') },
    circular,
  ];

  for (const payload of payloads) {
    assert.throws(() => computePayloadHash(payload), assertPayloadNotHashable);
  }
});

test('stableStringify rejects non-finite payload numbers', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => stableStringify({ value }), assertPayloadNotHashable);
  }
});

test('computePayloadHash normalizes visually identical Unicode strings to NFC', () => {
  const nfc = 'Caf\u00e9';
  const nfd = 'Cafe\u0301';

  assert.equal(computePayloadHash({ label: nfc }), computePayloadHash({ label: nfd }));
});

test('command ids normalize to the existing envelope character and length contract', () => {
  assert.equal(normalizeCommandId(' cmd:player/1 '), 'cmd:player_1');
  assert.equal(normalizeCommandId('x'.repeat(MAX_COMMAND_ID_LENGTH + 1)), 'x'.repeat(MAX_COMMAND_ID_LENGTH));
  assert.equal(isNormalizedCommandId('cmd:player-1.retry_2'), true);
  assert.equal(isNormalizedCommandId(' cmd:player-1 '), false);
  assert.equal(isNormalizedCommandId('cmd:player/1'), false);
  assert.equal(isNormalizedCommandId(''), false);
  assert.equal(isNormalizedCommandId(null), false);
});

test('CommandReceiptIdentity stays in the pure backend layer', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'application', 'commands', 'CommandReceiptIdentity.js'),
    'utf8',
  );
  assert.doesNotMatch(source, /node:(?:fs|http|https|net)|\b(?:window|document|localStorage)\b/);
});

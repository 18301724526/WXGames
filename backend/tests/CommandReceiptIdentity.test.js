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

test('computePayloadHash rejects non-plain payload containers', () => {
  const containers = [
    new Map([['first', 1]]),
    new Map([['second', 2]]),
    new Set([1]),
    new Date('2026-07-16T00:00:00.000Z'),
    new Date('2026-07-17T00:00:00.000Z'),
    /payload/u,
    new Error('payload'),
    Promise.resolve('payload'),
    new ArrayBuffer(8),
    new DataView(new ArrayBuffer(8)),
    new Uint8Array([1, 2, 3]),
    Buffer.from([1, 2, 3]),
  ];

  for (const payload of containers) {
    assert.throws(() => computePayloadHash(payload), assertPayloadNotHashable);
  }
});

test('computePayloadHash rejects payloads with custom toJSON methods', () => {
  const payload = { value: 'original' };
  Object.defineProperty(payload, 'toJSON', {
    enumerable: false,
    value() {
      return { value: 'rewritten' };
    },
  });

  assert.throws(() => computePayloadHash(payload), assertPayloadNotHashable);
});

test('top-level undefined is the empty command payload', () => {
  assert.equal(stableStringify(undefined), '{}');
  assert.equal(computePayloadHash(), computePayloadHash({}));
  assert.equal(computePayloadHash(undefined), computePayloadHash({}));
});

test('computePayloadHash normalizes visually identical Unicode strings to NFC', () => {
  const nfc = 'Caf\u00e9';
  const nfd = 'Cafe\u0301';

  assert.equal(computePayloadHash({ label: nfc }), computePayloadHash({ label: nfd }));
  assert.equal(
    computePayloadHash({ anchor: true, [nfc]: 'value' }),
    computePayloadHash({ anchor: true, [nfd]: 'value' }),
  );
  assert.equal(
    computePayloadHash({ nested: { deep: { label: nfc } } }),
    computePayloadHash({ nested: { deep: { label: nfd } } }),
  );
  assert.equal(
    computePayloadHash({ labels: ['plain', nfc] }),
    computePayloadHash({ labels: ['plain', nfd] }),
  );
});

test('computePayloadHash treats negative and positive zero as the same JSON number', () => {
  assert.equal(computePayloadHash({ value: -0 }), computePayloadHash({ value: +0 }));
});

test('computePayloadHash rejects duplicate keys after NFC normalization', () => {
  const payload = {
    Caf\u00e9: 'nfc',
    Cafe\u0301: 'nfd',
  };

  assert.throws(() => computePayloadHash(payload), assertPayloadNotHashable);
});

test('computePayloadHash rejects enumerable Symbol keys', () => {
  const payload = { visible: true };
  payload[Symbol('hidden')] = 'value';

  assert.throws(() => computePayloadHash(payload), assertPayloadNotHashable);
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

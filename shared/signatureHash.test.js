'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { foldString, hashStep, hashString, hashText } = require('./signatureHash');

// Independent copies of the exact legacy inline implementations that lived in
// backend services and frontend snapshots before this module existed. The
// shared helpers must stay byte-identical to these forever.

function legacyHashString(input) {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function legacyHashText(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function legacyHashStep(hash, value) {
  const text = String(value ?? '');
  let next = hash >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    next ^= text.charCodeAt(i);
    next = Math.imul(next, 16777619);
  }
  return next >>> 0;
}

const STRING_INPUTS = [
  '',
  'a',
  'abc',
  'hello world',
  '城市探索',
  'df_seed',
  'world-seed|12|-7|reveal',
  '0|angle|3',
  'seed|explorer-1|4|9|2|ai-explore',
  '12345',
  'sourceKindABCDEF',
  'a'.repeat(257),
];

const ANY_INPUTS = [...STRING_INPUTS, 0, 1, -1, 123, false, true, null, undefined, NaN, {}, [1, 2]];

test('hashString matches the legacy String(input) FNV variant for every input', () => {
  for (const input of ANY_INPUTS) {
    assert.strictEqual(hashString(input), legacyHashString(input), `hashString(${String(input)})`);
  }
});

test('hashText matches the legacy String(value || "") FNV variant for every input', () => {
  for (const input of ANY_INPUTS) {
    assert.strictEqual(hashText(input), legacyHashText(input), `hashText(${String(input)})`);
  }
});

test('hashStep matches the legacy String(value ?? "") FNV variant across a running hash', () => {
  let shared = 2166136261;
  let legacy = 2166136261;
  for (const value of ANY_INPUTS) {
    shared = hashStep(shared, value);
    legacy = legacyHashStep(legacy, value);
    assert.strictEqual(shared, legacy, `hashStep folding ${String(value)}`);
  }
});

test('foldString is the shared core for both seeded helpers', () => {
  assert.strictEqual(hashString('abc'), foldString(2166136261, 'abc'));
  assert.strictEqual(hashStep(123, 'abc'), foldString(123, 'abc'));
});

test('every helper returns an unsigned 32-bit integer', () => {
  for (const input of ANY_INPUTS) {
    const value = hashString(input);
    assert.ok(
      Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
      `range for ${String(input)}`,
    );
  }
});

// Golden values pin the exact algorithm so an accidental change is caught even
// if both the shared helper and the in-test legacy copy were edited together.
test('golden FNV-1a values stay stable', () => {
  assert.strictEqual(hashString(''), 2166136261);
  assert.strictEqual(hashString('a'), 3826002220);
  assert.strictEqual(hashString('abc'), 440920331);
  assert.strictEqual(hashStep(2166136261, 'abc'), 440920331);
  assert.strictEqual(hashText(''), 2166136261);
  assert.strictEqual(hashText(null), 2166136261);
});

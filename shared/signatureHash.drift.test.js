'use strict';

const test = require('node:test');
const assert = require('node:assert');

// The browser cannot load top-level shared/, so frontend/js/shared/SignatureHash.js
// keeps a mirror copy of this module. This test fails the moment the two drift.
const backend = require('./signatureHash');
const frontend = require('../frontend/js/shared/SignatureHash');

const ANY_INPUTS = [
  '',
  'a',
  'abc',
  'hello world',
  '城市探索',
  'tile_3_-7',
  'world-seed|12|-7|reveal',
  'sourceKind:42:99:1000',
  '12345',
  'a'.repeat(257),
  0,
  1,
  -1,
  123,
  false,
  true,
  null,
  undefined,
  NaN,
];

test('frontend SignatureHash exposes the same constants as the backend source', () => {
  assert.strictEqual(frontend.FNV_OFFSET_BASIS, backend.FNV_OFFSET_BASIS);
  assert.strictEqual(frontend.FNV_PRIME, backend.FNV_PRIME);
});

test('frontend hashString/hashText match the backend source for every input', () => {
  for (const input of ANY_INPUTS) {
    assert.strictEqual(
      frontend.hashString(input),
      backend.hashString(input),
      `hashString(${String(input)})`,
    );
    assert.strictEqual(
      frontend.hashText(input),
      backend.hashText(input),
      `hashText(${String(input)})`,
    );
  }
});

test('frontend hashStep matches the backend source across a running hash', () => {
  let f = backend.FNV_OFFSET_BASIS;
  let b = backend.FNV_OFFSET_BASIS;
  for (const value of ANY_INPUTS) {
    f = frontend.hashStep(f, value);
    b = backend.hashStep(b, value);
    assert.strictEqual(f, b, `hashStep folding ${String(value)}`);
  }
});

test('frontend foldString matches the backend source', () => {
  for (const input of ANY_INPUTS) {
    assert.strictEqual(
      frontend.foldString(backend.FNV_OFFSET_BASIS, String(input)),
      backend.foldString(backend.FNV_OFFSET_BASIS, String(input)),
      `foldString(${String(input)})`,
    );
  }
});

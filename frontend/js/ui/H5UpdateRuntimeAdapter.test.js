const test = require('node:test');
const assert = require('node:assert/strict');

const H5UpdateRuntimeAdapter = require('./H5UpdateRuntimeAdapter');

test('H5UpdateRuntimeAdapter preserves world march trace through forced reload URLs', () => {
  const adapter = new H5UpdateRuntimeAdapter({}, {
    location: { href: 'http://47.116.32.216/?worldMarchTrace=1' },
    URL,
    now: () => 1780839647499,
  });

  const nextUrl = new URL(adapter.buildReloadUrl());
  assert.equal(nextUrl.searchParams.get('worldMarchTrace'), '1');
  assert.equal(nextUrl.searchParams.get('reload'), '1780839647499');
});

test('H5UpdateRuntimeAdapter normalizes trace aliases when rebuilding reload URLs', () => {
  const adapter = new H5UpdateRuntimeAdapter({}, {
    location: { href: 'http://47.116.32.216/?codexTrace=1&foo=bar' },
    URL,
    now: () => 1780839647500,
  });

  const nextUrl = new URL(adapter.buildReloadUrl());
  assert.equal(nextUrl.searchParams.get('worldMarchTrace'), '1');
  assert.equal(nextUrl.searchParams.get('codexTrace'), '1');
  assert.equal(nextUrl.searchParams.get('foo'), 'bar');
  assert.equal(nextUrl.searchParams.get('reload'), '1780839647500');
});

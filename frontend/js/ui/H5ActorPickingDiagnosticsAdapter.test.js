const test = require('node:test');
const assert = require('node:assert/strict');

const ActorPickingDiagnostics = require('../debug/ActorPickingDiagnostics');
const H5ActorPickingDiagnosticsAdapter = require('./H5ActorPickingDiagnosticsAdapter');

test('H5ActorPickingDiagnosticsAdapter maps query and storage flags into diagnostics preferences', () => {
  const runtime = {
    location: { href: 'https://game.test/?actorPickingDiag=1&actorPickingDiagVerbose=off' },
    localStorage: {
      getItem(key) {
        return key === 'actorPickingDiagVerbose' ? '1' : null;
      },
    },
  };
  try {
    H5ActorPickingDiagnosticsAdapter.fromRuntime(runtime);

    assert.equal(ActorPickingDiagnostics.isEnabled(), true);
    assert.equal(ActorPickingDiagnostics.isVerbose(), false);
  } finally {
    ActorPickingDiagnostics.setPreferenceProvider(null);
  }
});

test('H5ActorPickingDiagnosticsAdapter falls back to storage flags', () => {
  const runtime = {
    location: { href: 'https://game.test/' },
    localStorage: {
      getItem(key) {
        return key === 'actorPickingDiag' ? 'on' : null;
      },
    },
  };
  try {
    const adapter = H5ActorPickingDiagnosticsAdapter.fromRuntime(runtime);

    assert.equal(adapter.isEnabled(), true);
    assert.equal(ActorPickingDiagnostics.isEnabled(), true);
  } finally {
    ActorPickingDiagnostics.setPreferenceProvider(null);
  }
});

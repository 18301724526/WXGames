const test = require('node:test');
const assert = require('node:assert/strict');

const ActorPickingDiagnostics = require('./ActorPickingDiagnostics');

function snapshotGlobals() {
  return {
    enabled: global.__actorPickingDiag,
    verbose: global.__actorPickingDiagVerbose,
    events: global.__actorPickingDiagEvents,
    traceId: global.__actorPickingDiagActiveTapTraceId,
    signatures: global.__actorPickingDiagLastSignatureByStage,
    lastByStage: global.__actorPickingDiagLastByStage,
    sequence: global.__actorPickingDiagTapSequence,
  };
}

function restoreGlobals(snapshot) {
  global.__actorPickingDiag = snapshot.enabled;
  global.__actorPickingDiagVerbose = snapshot.verbose;
  global.__actorPickingDiagEvents = snapshot.events;
  global.__actorPickingDiagActiveTapTraceId = snapshot.traceId;
  global.__actorPickingDiagLastSignatureByStage = snapshot.signatures;
  global.__actorPickingDiagLastByStage = snapshot.lastByStage;
  global.__actorPickingDiagTapSequence = snapshot.sequence;
  ActorPickingDiagnostics.setPreferenceProvider(null);
}

test('ActorPickingDiagnostics uses injected preferences without browser globals', () => {
  const snapshot = snapshotGlobals();
  try {
    global.__actorPickingDiag = false;
    global.__actorPickingDiagEvents = [];
    ActorPickingDiagnostics.setPreferenceProvider({ isEnabled: () => true });

    const payload = ActorPickingDiagnostics.log('tap:test', { tapTraceId: 'tap-1', value: 42 });

    assert.equal(payload.stage, 'tap:test');
    assert.equal(payload.tapTraceId, 'tap-1');
    assert.equal(global.__actorPickingDiagActiveTapTraceId, 'tap-1');
    assert.equal(ActorPickingDiagnostics.getRecentEvents(1)[0].value, 42);
  } finally {
    restoreGlobals(snapshot);
  }
});

test('ActorPickingDiagnostics preserves legacy global enable and signature de-dupe', () => {
  const snapshot = snapshotGlobals();
  try {
    global.__actorPickingDiag = true;
    global.__actorPickingDiagEvents = [];
    global.__actorPickingDiagLastSignatureByStage = {};

    assert.ok(
      ActorPickingDiagnostics.log('tap:test', { tapTraceId: 'tap-1' }, { signature: 'same' }),
    );
    assert.equal(
      ActorPickingDiagnostics.log('tap:test', { tapTraceId: 'tap-1' }, { signature: 'same' }),
      null,
    );
    assert.equal(global.__actorPickingDiagEvents.length, 1);
  } finally {
    restoreGlobals(snapshot);
  }
});

test('ActorPickingDiagnostics creates stable tap trace ids from the shared counter', () => {
  const snapshot = snapshotGlobals();
  try {
    global.__actorPickingDiagTapSequence = 4;

    assert.equal(ActorPickingDiagnostics.createTapTraceId(123), 'tap-123-5');
    assert.equal(global.__actorPickingDiagTapSequence, 5);
  } finally {
    restoreGlobals(snapshot);
  }
});

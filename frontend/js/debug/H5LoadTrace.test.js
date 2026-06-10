const test = require('node:test');
const assert = require('node:assert/strict');

const previousTrace = globalThis.H5LoadTrace;
globalThis.H5LoadTrace = { mark() {} };
const H5LoadTrace = require('./H5LoadTrace');
globalThis.H5LoadTrace = previousTrace;

function createRecorder() {
  const entries = [];
  return {
    entries,
    console: {
      info(message, payload) {
        entries.push({ level: 'info', message, payload });
      },
      warn(message, payload) {
        entries.push({ level: 'warn', message, payload });
      },
      error(message, payload) {
        entries.push({ level: 'error', message, payload });
      },
      log(message, payload) {
        entries.push({ level: 'log', message, payload });
      },
    },
  };
}

function createTrace(options = {}) {
  let now = Number(options.now) || 0;
  const recorder = createRecorder();
  const trace = new H5LoadTrace({
    enabled: true,
    console: recorder.console,
    now: () => now,
    progressStep: options.progressStep || 10,
    slowApiMs: options.slowApiMs || 1000,
    runtime: {
      performance: { now: () => now },
      location: { href: 'https://example.test/wxgame/?loadTrace=1' },
      localStorage: { getItem: () => null },
      console: recorder.console,
    },
  });
  return {
    trace,
    entries: recorder.entries,
    advance(ms) {
      now += ms;
    },
  };
}

test('H5LoadTrace records phase durations relative to boot', () => {
  const { trace, entries, advance } = createTrace();

  trace.phaseStart('assets:preload', { total: 2 });
  advance(1250);
  trace.phaseEnd('assets:preload', { loaded: 2 });

  assert.equal(entries.length, 2);
  assert.equal(entries[0].message, '[H5LoadTrace] phase:start');
  assert.equal(entries[0].payload.phase, 'assets:preload');
  assert.equal(entries[1].message, '[H5LoadTrace] phase:end');
  assert.equal(entries[1].level, 'warn');
  assert.equal(entries[1].payload.durationMs, 1250);
  assert.equal(entries[1].payload.duration, '1.25s');
  assert.equal(entries[1].payload.loaded, 2);
});

test('H5LoadTrace throttles progress but always reports completion', () => {
  const { trace, entries } = createTrace({ progressStep: 25 });

  trace.progress('assets:preload', { percentage: 0, completed: 0, total: 100, status: 'start' });
  trace.progress('assets:preload', { percentage: 5, completed: 5, total: 100, status: 'loaded' });
  trace.progress('assets:preload', { percentage: 24, completed: 24, total: 100, status: 'loaded' });
  trace.progress('assets:preload', { percentage: 25, completed: 25, total: 100, status: 'loaded' });
  trace.progress('assets:preload', { percentage: 100, completed: 100, total: 100, status: 'loaded' });

  assert.deepEqual(entries.map((entry) => entry.payload.percentage), [0, 24, 25, 100]);
  assert.equal(entries.at(-1).message, '[H5LoadTrace] progress');
});

test('H5LoadTrace records api success and failure with ids and durations', () => {
  const { trace, entries, advance } = createTrace({ slowApiMs: 500 });

  const success = trace.apiStart('GET', '/game/state', '/api/game/state', { hasToken: true });
  advance(700);
  trace.apiEnd(success, { status: 200, ok: true });
  const failure = trace.apiStart('GET', '/version', '/api/version', {});
  advance(50);
  trace.apiFail(failure, new Error('HTTP 504'), { status: 504, ok: false });

  const apiEnd = entries.find((entry) => entry.message === '[H5LoadTrace] api:end');
  const apiFail = entries.find((entry) => entry.message === '[H5LoadTrace] api:fail');
  assert.equal(apiEnd.level, 'warn');
  assert.equal(apiEnd.payload.id, success.id);
  assert.equal(apiEnd.payload.durationMs, 700);
  assert.equal(apiFail.level, 'error');
  assert.equal(apiFail.payload.id, failure.id);
  assert.equal(apiFail.payload.status, 504);
  assert.equal(apiFail.payload.error, 'HTTP 504');
});

test('H5LoadTrace ready only reports once', () => {
  const { trace, entries, advance } = createTrace();

  advance(333);
  trace.ready({ source: 'applyState' });
  advance(100);
  trace.ready({ source: 'syncFromServer' });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].message, '[H5LoadTrace] boot:ready');
  assert.equal(entries[0].payload.durationMs, 333);
  assert.equal(entries[0].payload.source, 'applyState');
});

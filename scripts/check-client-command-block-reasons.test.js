const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const GUARD_PATH = path.resolve(__dirname, 'check-client-command-block-reasons.js');

function runGuard(root = null) {
  return spawnSync(process.execPath, [GUARD_PATH], {
    encoding: 'utf8',
    env: root ? { ...process.env, CLIENT_COMMAND_GUARD_ROOT: root } : process.env,
  });
}

test('client command block reason guard rejects no domain signals in current source', () => {
  const result = runGuard();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /guard passed/);
});

test('client command block reason guard fires on synthetic domain swallows', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'client-command-guard-'));
  const dispatchPath = path.join(root, 'frontend/js/platform/CanvasActionDispatcher.js');
  try {
    fs.mkdirSync(path.dirname(dispatchPath), { recursive: true });
    fs.writeFileSync(dispatchPath, `
      class CanvasActionDispatcher {
        handle(action) {
          if (action.eraLocked) return true;
          return action.ready
            ? { type: 'startWorldMarch' }
            : { type: 'blockCanvasModal' };
        }
      }
    `);

    const result = runGuard(root);

    assert.equal(result.status, 1, result.stdout || result.stderr);
    assert.match(result.stderr, /domain-conditioned early return in handle/);
    assert.match(result.stderr, /command action startWorldMarch conditionally replaced by blockCanvasModal/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

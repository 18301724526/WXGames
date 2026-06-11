const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server.js');

test('gateway API process does not own world runtime background ticks', () => {
  const source = fs.readFileSync(serverPath, 'utf8');

  assert.equal(source.includes('BACKGROUND_TICK_INTERVAL_MS'), false);
  assert.equal(source.includes('repository.findRecentlyActive(activeSince'), false);
  assert.equal(source.includes('gameStateService.advanceRuntimeState(rawState'), false);
});

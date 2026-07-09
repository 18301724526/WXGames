const test = require('node:test');
const assert = require('node:assert/strict');

const { inspectCoverage } = require('./check-client-command-sender-coverage');

const senderSource = `
class ClientCommandSender {
  constructor() { this.inFlightByKey = new Map(); }
  submit(type, payload = {}, options = {}) {
    return Promise.resolve().finally(() => this.inFlightByKey.delete(options.commandKey));
  }
}
`;

function inspect(gameApiSource) {
  return inspectCoverage({
    gameApiSource,
    senderSource,
    indexSource: '<script src="js/api/ClientCommandSender.js"></script><script src="js/api/GameAPI.js"></script>',
    helpers: [{ helper: 'build' }],
  }).violations;
}

test('client command sender coverage accepts one sender-owned POST bridge', () => {
  const violations = inspect(`
  class GameAPI {
    async request(method, path, body, options = {}) {
      if (method !== 'GET' && options.senderToken !== COMMAND_SENDER_REQUEST) throw new Error('blocked');
    }
    sendCommandEnvelope(envelope, options = {}) {
      return this.request('POST', options.path, envelope, { senderToken: COMMAND_SENDER_REQUEST });
    }
    build(buildingId) {
      return this.submitCommand('build', { buildingId }, { path: '/game/action' });
    }
  }
  `);

  assert.deepEqual(violations, []);
});

test('client command sender coverage fires on a helper-owned direct POST', () => {
  const violations = inspect(`
  class GameAPI {
    async request(method, path, body, options = {}) {
      if (method !== 'GET' && options.senderToken !== COMMAND_SENDER_REQUEST) throw new Error('blocked');
    }
    sendCommandEnvelope(envelope, options = {}) {
      return this.request('POST', options.path, envelope, { senderToken: COMMAND_SENDER_REQUEST });
    }
    build(buildingId) {
      return this.request('POST', '/game/action', { action: 'build', target: buildingId });
    }
  }
  `);

  assert.ok(violations.includes('GameAPI.build does not enter ClientCommandSender'));
  assert.ok(violations.includes('GameAPI.build performs a direct POST'));
  assert.ok(violations.includes('GameAPI.build owns a POST outside the sender transport bridge'));
});

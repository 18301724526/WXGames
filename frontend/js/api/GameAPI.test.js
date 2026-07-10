const test = require('node:test');
const assert = require('node:assert/strict');

const GameAPI = require('./GameAPI');
const { FRONTEND_WRITE_HELPERS } = require('../../../scripts/command-owner-step1/inventories');

function createResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get() {
        return '';
      },
    },
    async json() {
      return payload;
    },
  };
}

function createResponseWithHeaders(status, payload, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name || '').toLowerCase()] || '';
      },
    },
    async json() {
      return payload;
    },
  };
}

function withOperationLog(logger, callback) {
  const previous = globalThis.ClientOperationLog;
  globalThis.ClientOperationLog = logger;
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      globalThis.ClientOperationLog = previous;
    });
}

test('GameAPI sends H5 load trace spans for successful requests', async () => {
  const calls = [];
  const trace = {
    apiStart(method, path, url, detail) {
      calls.push(['start', method, path, url, detail.hasToken]);
      return { id: 1, startedAt: 10, method, path, url };
    },
    apiEnd(span, detail) {
      calls.push(['end', span.id, detail.status, detail.ok, detail.payload.worldMapTiles]);
    },
    apiFail() {
      calls.push(['fail']);
    },
    summarizePayload(payload) {
      return { worldMapTiles: payload.gameState?.territoryState?.worldMap?.tiles?.length || 0 };
    },
  };
  const api = new GameAPI('/api', 'token-a', {
    trace,
    transport: {
      async request(request) {
        calls.push(['transport', request.url, request.headers.Authorization]);
        return createResponse(200, {
          gameState: {
            playerId: 'player-1',
            territoryState: { worldMap: { tiles: [{ q: 0, r: 0 }] } },
          },
        });
      },
    },
  });

  const result = await api.getState();

  assert.equal(result.gameState.playerId, 'player-1');
  assert.deepEqual(calls, [
    ['start', 'GET', '/game/state', '/api/game/state', true],
    ['transport', '/api/game/state', 'Bearer token-a'],
    ['end', 1, 200, true, 1],
  ]);
});

test('GameAPI records local operation logs without extra client-event requests', async () => {
  const requests = [];
  const operationEvents = [];
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request(request) {
        requests.push([request.method, request.path, request.headers['X-Client-Request-ID']]);
        return createResponse(200, { success: true, gameState: { playerId: 'player-1' } });
      },
    },
  });
  const logger = {
    record(type, detail) {
      operationEvents.push([type, detail.requestId || '', detail.path || '', detail.status || 0]);
    },
  };

  await withOperationLog(logger, () => api.startWorldMarch({ targetQ: 1, targetR: 0, formationSlot: 1 }));

  assert.deepEqual(requests, [['POST', '/game/action', 'api-1']]);
  assert.deepEqual(operationEvents.map((event) => event[0]), ['api:request', 'api:response']);
  assert.equal(operationEvents[0][1], 'api-1');
  assert.equal(operationEvents[1][3], 200);
});

test('GameAPI sends compact client input intent evidence for world march commands', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request(request) {
        calls.push(JSON.parse(request.body));
        return createResponse(200, { success: true, gameState: { playerId: 'player-1' } });
      },
    },
  });
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    inputId: 'wmi-run-a-9',
    clientSequence: 9,
    points: { physical: { x: 1, y: 2 }, layer: { x: 101, y: 202 } },
    action: { type: 'startWorldMarch', targetQ: 3, targetR: -2, rendererPayload: 'x'.repeat(2000) },
    target: { kind: 'tile', tileId: 'tile_3_-2', targetQ: 3, targetR: -2 },
    picking: { inputEpoch: 9, signature: 'sig-9', counts: { targets: 7 } },
    view: { camera: { x: 4, y: 5 }, viewport: { scale: 1.25 } },
    tileMapView: { tiles: Array.from({ length: 50 }, (_, index) => ({ id: `tile_${index}` })) },
  };

  await api.startWorldMarch({
    targetQ: 3,
    targetR: -2,
    formationSlot: 1,
    clientInputIntent: inputIntent,
  });
  await api.returnWorldMarch('mission-1', { clientInputIntent: inputIntent });

  assert.equal(calls[0].action, 'startWorldMarch');
  assert.equal(calls[0].clientInputIntent.schema, 'world-map-input-intent-v1');
  assert.equal(calls[0].clientInputIntent.inputId, 'wmi-run-a-9');
  assert.equal(calls[0].clientInputIntent.clientSequence, 9);
  assert.equal(calls[0].clientInputIntent.target.tileId, 'tile_3_-2');
  assert.equal(calls[0].clientInputIntent.picking.inputEpoch, 9);
  assert.equal(JSON.stringify(calls[0].clientInputIntent).includes('tileMapView'), false);
  assert.equal(JSON.stringify(calls[0].clientInputIntent).includes('rendererPayload'), false);
  assert.equal(calls[1].action, 'returnWorldMarch');
  assert.equal(calls[1].clientInputIntent.target.tileId, 'tile_3_-2');
});

test('GameAPI sends build commands with a client command envelope', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    createCommandIdSeed: () => 'build-seed',
    transport: {
      async request(request) {
        calls.push({
          requestId: request.headers['X-Client-Request-ID'],
          body: JSON.parse(request.body),
        });
        return createResponse(200, { success: true, gameState: { playerId: 'player-1' } });
      },
    },
  });

  await api.build('barracks', {
    trace: {
      clientActionTraceId: 'cat-build-barracks',
      sourceSurface: 'canvas',
      hitTargetId: 'barracks',
      actionType: 'buildBuilding',
      actionDescriptorId: 'building.build',
      visualDisabled: true,
    },
  });

  assert.equal(calls[0].requestId, 'api-1');
  assert.equal(calls[0].body.action, 'build');
  assert.equal(calls[0].body.target, 'barracks');
  assert.deepEqual(calls[0].body.clientCommand, {
    schema: 'game-command-v1',
    type: 'build',
    commandId: 'cmd-build-seed',
    idempotencyKey: 'idem-build-seed',
    payload: { buildingId: 'barracks' },
    trace: {
      schema: 'client-action-trace-v1',
      clientActionTraceId: 'cat-build-barracks',
      sourceSurface: 'canvas',
      hitTargetId: 'barracks',
      actionType: 'buildBuilding',
      actionDescriptorId: 'building.build',
      visualDisabled: true,
    },
    client: {
      requestId: 'api-1',
      clientSequence: 1,
      clientInputIntent: null,
    },
    requestId: 'api-1',
  });
  assert.equal(calls[0].body.commandId, 'cmd-build-seed');
  assert.equal(calls[0].body.idempotencyKey, 'idem-build-seed');
  assert.equal(calls[0].body.clientCommand.payload.trace, undefined);
});

test('GameAPI forwards client action trace through clientCommand only', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    createCommandIdSeed: () => 'trace-seed',
    transport: {
      async request(request) {
        calls.push(JSON.parse(request.body));
        return createResponse(200, { success: true });
      },
    },
  });

  await api.build('farm', {
    trace: {
      clientActionTraceId: 'cat-build-farm',
      sourceSurface: 'canvas',
      hitTargetId: 'farm',
      actionType: 'buildBuilding',
      actionDescriptorId: 'building.build',
      visualDisabled: false,
    },
  });

  assert.equal(calls[0].clientCommand.trace.clientActionTraceId, 'cat-build-farm');
  assert.equal(calls[0].clientCommand.trace.actionType, 'buildBuilding');
  assert.deepEqual(calls[0].clientCommand.payload, { buildingId: 'farm' });
  assert.equal(calls[0].trace, undefined);
  assert.equal(calls[0].clientActionTrace, undefined);
});

test('GameAPI keeps empty heartbeat read-only and sends reports through ClientCommandSender', async () => {
  const requests = [];
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request(request) {
        requests.push(request);
        return createResponse(200, { type: 'heartbeat', serverTime: '2026-06-21T00:00:00.000Z' });
      },
    },
  });

  await api.heartbeat();
  await api.heartbeat({
    worldMarchClientReport: {
      schema: 'world-march-client-report-batch-v1',
      missions: [{ missionId: 'march-1', position: { q: 1.25, r: 0 } }],
    },
  });

  assert.equal(requests[0].method, 'GET');
  assert.equal(requests[0].body, undefined);
  assert.equal(requests[1].method, 'POST');
  const heartbeatBody = JSON.parse(requests[1].body);
  assert.equal(heartbeatBody.worldMarchClientReport.missions[0].position.q, 1.25);
  assert.equal(heartbeatBody.clientCommand.type, 'heartbeat');
  assert.ok(heartbeatBody.commandId);
  assert.ok(heartbeatBody.idempotencyKey);
});

test('GameAPI routes every inventoried write helper through ClientCommandSender', async () => {
  const requests = [];
  let seed = 0;
  const api = new GameAPI('/api', 'token-a', {
    createCommandIdSeed: () => `write-${++seed}`,
    transport: {
      async request(request) {
        requests.push(request);
        return createResponse(request.path.startsWith('/client-') ? 202 : 200, { success: true });
      },
    },
  });
  const report = {
    schema: 'world-march-client-report-batch-v1',
    missions: [{ missionId: 'march-1', position: { q: 1, r: 0 } }],
  };
  const cases = [
    ['reportClientEvent', 'clientEventIngest', () => api.reportClientEvent({ type: 'frontend_asset_failure' })],
    ['uploadClientOperationLog', 'clientOperationLogIngest', () => api.uploadClientOperationLog({ entries: [] })],
    ['build', 'build', () => api.build('farm')],
    ['upgrade', 'upgrade', () => api.upgrade('farm')],
    ['assignJob', 'assign', () => api.assignJob('farmer', 1)],
    ['applyTalentPolicy', 'applyTalentPolicy', () => api.applyTalentPolicy('policy-1', { id: 'policy-1' })],
    ['saveTalentPolicy', 'saveTalentPolicy', () => api.saveTalentPolicy({ id: 'policy-1' })],
    ['deleteTalentPolicy', 'deleteTalentPolicy', () => api.deleteTalentPolicy('policy-1')],
    ['research', 'research', () => api.research('writing')],
    ['seekFamousPerson', 'seekFamousPerson', () => api.seekFamousPerson('seek')],
    ['acceptFamousPerson', 'acceptFamousPerson', () => api.acceptFamousPerson('candidate-1')],
    ['dismissFamousPersonCandidate', 'dismissFamousPersonCandidate', () => api.dismissFamousPersonCandidate('candidate-1')],
    ['assignFamousAttributePoint', 'assignFamousAttributePoint', () => api.assignFamousAttributePoint('person-1', 'wisdom')],
    ['setArmyFormation', 'setArmyFormation', () => api.setArmyFormation('capital', 1, ['person-1'], { 'person-1': 10 })],
    ['veteranCampWithdraw', 'veteranCampWithdraw', () => api.veteranCampWithdraw('capital', 10)],
    ['veteranCampUpgrade', 'veteranCampUpgrade', () => api.veteranCampUpgrade('capital')],
    ['advanceEra', 'advanceEra', () => api.advanceEra()],
    ['resetPlayer', 'playerReset', () => api.resetPlayer()],
    ['claimTaskReward', 'claimTaskReward', () => api.claimTaskReward('task-1', 'main')],
    ['claimEvent', 'claimEvent', () => api.claimEvent('event-1', 'option-1')],
    ['resolveCapture', 'resolveCapture', () => api.resolveCapture('decision-1', 'release')],
    ['startWorldMarch', 'startWorldMarch', () => api.startWorldMarch({ targetQ: 1, targetR: 0, formationSlot: 1 })],
    ['returnWorldMarch', 'returnWorldMarch', () => api.returnWorldMarch('march-1')],
    ['stopWorldMarch', 'stopWorldMarch', () => api.stopWorldMarch('march-1')],
    ['startWorldCombat', 'startWorldCombat', () => api.startWorldCombat({ missionId: 'march-1', targetQ: 1, targetR: 0 })],
    ['resolveWorldCombat', 'resolveWorldCombat', () => api.resolveWorldCombat('battle-1', [])],
    ['startConquest', 'startConquest', () => api.startConquest('territory-1', {})],
    ['claimConquest', 'claimConquest', () => api.claimConquest('territory-1')],
    ['renameCity', 'renameCity', () => api.renameCity('territory-1', 'River')],
    ['renamePolity', 'renamePolity', () => api.renamePolity('River League')],
    ['switchCity', 'switchCity', () => api.switchCity('territory-1')],
    ['advanceTutorial', 'tutorialAdvance', () => api.advanceTutorial(2)],
    ['heartbeat', 'heartbeat', () => api.heartbeat({ worldMarchClientReport: report })],
  ];

  assert.deepEqual(
    cases.map(([helper]) => helper).sort(),
    FRONTEND_WRITE_HELPERS.map(({ helper }) => helper).sort(),
  );
  for (const [, , invoke] of cases) await invoke();

  assert.equal(requests.length, cases.length);
  requests.forEach((request, index) => {
    const [helper, commandType] = cases[index];
    const body = JSON.parse(request.body);
    assert.equal(request.method, 'POST', helper);
    assert.equal(body.clientCommand.schema, 'game-command-v1', helper);
    assert.equal(body.clientCommand.type, commandType, helper);
    assert.equal(body.commandId, `cmd-write-${index + 1}`, helper);
    assert.equal(body.idempotencyKey, `idem-write-${index + 1}`, helper);
    assert.equal(body.clientCommand.commandId, body.commandId, helper);
    assert.equal(body.clientCommand.idempotencyKey, body.idempotencyKey, helper);
    assert.equal(body.clientCommand.requestId, request.headers['X-Client-Request-ID'], helper);
  });
});

test('GameAPI rejects write transport that bypasses ClientCommandSender', async () => {
  let transportCalls = 0;
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request() {
        transportCalls += 1;
        return createResponse(200, { success: true });
      },
    },
  });

  await assert.rejects(
    () => api.request('POST', '/game/action', { action: 'advanceEra' }),
    (error) => error.code === 'CLIENT_COMMAND_SENDER_REQUIRED',
  );
  assert.equal(transportCalls, 0);
});

test('GameAPI measures the heartbeat round-trip and clears it on failure', async () => {
  let nowMs = 1000;
  let failNext = false;
  const api = new GameAPI('/api', 'token-a', {
    maxRetries: 0,
    scheduler: { now: () => nowMs },
    transport: {
      async request() {
        if (failNext) throw new Error('offline');
        nowMs += 87; // the transport "takes" 87ms
        return createResponse(200, { type: 'heartbeat', serverTime: '2026-06-21T00:00:00.000Z' });
      },
    },
  });

  assert.equal(api.lastHeartbeatLatencyMs, null);
  await api.heartbeat();
  // Real measured RTT (never fabricated): elapsed scheduler time around the request.
  assert.equal(api.lastHeartbeatLatencyMs, 87);

  failNext = true;
  await assert.rejects(() => api.heartbeat());
  // A failed heartbeat must not leave a stale "measured" latency behind.
  assert.equal(api.lastHeartbeatLatencyMs, null);
});

test('GameAPI sends formation soldier assignments with saved formations', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request(request) {
        calls.push(JSON.parse(request.body));
        return createResponse(200, { success: true, gameState: { playerId: 'player-1' } });
      },
    },
  });

  await api.setArmyFormation('capital', 1, ['hero-1'], { 'hero-1': 300 });

  assert.equal(calls[0].action, 'setArmyFormation');
  assert.equal(calls[0].cityId, 'capital');
  assert.deepEqual(calls[0].memberIds, ['hero-1']);
  assert.deepEqual(calls[0].soldierAssignments, { 'hero-1': 300 });
});

test('GameAPI records replay correlation evidence in local operation logs', async () => {
  const operationEvents = [];
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request() {
        return createResponse(200, {
          success: true,
          authority: {
            schema: 'command-authority-contract-v1',
            status: 'accepted',
            commandId: 'cmd_abc123',
            command: {
              type: 'startWorldMarch',
              actorId: 'explore-1',
              playerId: 'player-1',
            },
          },
        });
      },
    },
  });
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    kind: 'tap',
    inputId: 'wmi-run-a-9',
    clientSequence: 9,
    target: { kind: 'tile', tileId: 'tile_3_-2', targetQ: 3, targetR: -2 },
    picking: { inputEpoch: 9, signature: 'sig-9' },
    rendererCache: { targets: Array.from({ length: 100 }, (_, index) => ({ index })) },
  };
  const logger = {
    record(type, detail) {
      operationEvents.push([type, detail]);
    },
  };

  await withOperationLog(logger, () => api.startWorldMarch({
    targetQ: 3,
    targetR: -2,
    formationSlot: 1,
    clientInputIntent: inputIntent,
  }));

  const requestEvent = operationEvents.find((event) => event[0] === 'api:request')?.[1];
  const responseEvent = operationEvents.find((event) => event[0] === 'api:response')?.[1];

  assert.equal(requestEvent.requestId, 'api-1');
  assert.equal(requestEvent.clientInput.schema, 'world-map-input-intent-v1');
  assert.equal(requestEvent.clientInput.inputId, 'wmi-run-a-9');
  assert.equal(requestEvent.clientInput.clientSequence, 9);
  assert.equal(requestEvent.clientInput.target.tileId, 'tile_3_-2');
  assert.equal(JSON.stringify(requestEvent.clientInput).includes('rendererCache'), false);
  assert.equal(responseEvent.payload.authority.commandId, 'cmd_abc123');
  assert.equal(responseEvent.payload.authority.status, 'accepted');
});

test('GameAPI surfaces an expected world-march decline without an alarming console error', async () => {
  const api = new GameAPI('/api', 'token-a', {
    transport: {
      async request() {
        return createResponse(400, {
          success: false,
          error: 'EXPLORE_ROUTE_BLOCKED',
          message: 'Explorer route is blocked by ocean.',
        });
      },
    },
  });
  const originalConsoleError = console.error;
  const errorCalls = [];
  console.error = (...args) => {
    errorCalls.push(args);
  };
  let caught = null;
  try {
    await api.startWorldMarch({ targetQ: -3, targetR: 31, formationSlot: 1 });
  } catch (error) {
    caught = error;
  } finally {
    console.error = originalConsoleError;
  }
  // Still rejects (so the optimistic march rolls back), but tagged as an
  // expected decline and never logged as a system failure.
  assert.ok(caught, 'a 400 decline should still reject the promise');
  assert.equal(caught.worldMarchDecline, 'EXPLORE_ROUTE_BLOCKED');
  assert.equal(
    errorCalls.some((call) => String(call[0]).includes('world march action failed')),
    false,
  );
});

test('GameAPI reports H5 load trace failures for 504 version checks', async () => {
  const calls = [];
  const trace = {
    apiStart(method, path, url) {
      calls.push(['start', method, path, url]);
      return { id: 7, startedAt: 10, method, path, url };
    },
    apiEnd() {
      calls.push(['end']);
    },
    apiFail(span, error, detail) {
      calls.push(['fail', span.id, error.message, detail.status, detail.ok]);
    },
    summarizePayload() {
      return { keys: ['message'] };
    },
  };
  const api = new GameAPI('/api', null, {
    trace,
    maxRetries: 0,
    transport: {
      async request(request) {
        calls.push(['transport', request.url]);
        return createResponse(504, { message: 'Gateway Timeout' });
      },
    },
  });

  await assert.rejects(
    () => api.getVersion(),
    /Gateway Timeout/,
  );

  assert.equal(calls[0][0], 'start');
  assert.deepEqual(calls.at(-1), ['fail', 7, 'Gateway Timeout', 504, false]);
  assert.equal(calls.some((call) => call[0] === 'end'), false);
});

test('GameAPI reuses cached version info on 304 ETag responses', async () => {
  const calls = [];
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 0,
    transport: {
      async request(request) {
        calls.push([
          'transport',
          request.url,
          request.headers['If-None-Match'] || '',
        ]);
        if (!request.headers['If-None-Match']) {
          return createResponseWithHeaders(200, {
            deploymentId: 'dep-1',
            version: 'v1',
          }, { etag: '"wxgame-etag-1"' });
        }
        return createResponseWithHeaders(304, {}, { etag: '"wxgame-etag-1"' });
      },
    },
  });

  const first = await api.getVersion();
  const second = await api.getVersion();

  assert.equal(first.deploymentId, 'dep-1');
  assert.equal(second.deploymentId, 'dep-1');
  assert.equal(second.notModified, true);
  assert.deepEqual(calls, [
    ['transport', '/api/version', ''],
    ['transport', '/api/version', '"wxgame-etag-1"'],
  ]);
});

test('GameAPI reads deploy status from the configured frontend marker', async () => {
  const calls = [];
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 0,
    deployStatusPath: '.wxgame-deploy-status.json',
    transport: {
      async request(request) {
        calls.push(['transport', request.url, request.headers['Cache-Control']]);
        return createResponseWithHeaders(200, {
          status: 'failed',
          stage: 'deploy-gate',
        });
      },
    },
  });

  const status = await api.getDeployStatus();

  assert.equal(status.status, 'failed');
  assert.deepEqual(calls, [
    ['transport', '.wxgame-deploy-status.json', 'no-cache'],
  ]);
});

test('GameAPI aborts timed out requests with structured request metadata', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    timeoutMs: 5,
    maxRetries: 0,
    scheduler: {
      setTimeout(callback, ms) {
        calls.push(['setTimeout', ms]);
        callback();
        return 1;
      },
      clearTimeout(id) {
        calls.push(['clearTimeout', id]);
      },
      now() {
        return calls.length * 10;
      },
    },
    abortControllerFactory: () => {
      const listeners = [];
      return {
        signal: {
          addEventListener(type, listener) {
            if (type === 'abort') listeners.push(listener);
          },
        },
        abort() {
          listeners.forEach((listener) => listener());
        },
      };
    },
    transport: {
      request(request) {
        calls.push([
          'transport',
          request.requestId,
          request.timeoutMs,
          Boolean(request.signal),
          request.headers['X-Client-Request-ID'],
        ]);
        request.signal?.addEventListener?.('abort', () => calls.push(['abort']));
        return new Promise(() => {});
      },
    },
  });

  await assert.rejects(
    () => api.getState(),
    (error) => {
      assert.equal(error.code, 'GAME_API_TIMEOUT');
      assert.equal(error.status, 0);
      assert.equal(error.method, 'GET');
      assert.equal(error.path, '/game/state');
      assert.equal(error.requestId, 'api-1');
      assert.equal(error.timeoutMs, 5);
      assert.equal(error.attempts, 1);
      assert.equal(error.retryable, true);
      return true;
    },
  );

  assert.deepEqual(calls.slice(0, 4), [
    ['transport', 'api-1', 5, true, 'api-1'],
    ['setTimeout', 5],
    ['abort'],
    ['clearTimeout', 1],
  ]);
});

test('GameAPI records compact client input on request failures', async () => {
  const inputIntent = {
    schema: 'world-map-input-intent-v1',
    inputId: 'wmi-error-api-5',
    clientSequence: 5,
    target: { kind: 'tile', tileId: 'tile_4_-1', targetQ: 4, targetR: -1 },
    rendererPayload: 'x'.repeat(2000),
  };
  const transportEvents = [];
  const httpEvents = [];

  const transportApi = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 0,
    transport: {
      async request() {
        throw new Error('network down');
      },
    },
  });

  await assert.rejects(
    withOperationLog({
      record(type, detail) {
        transportEvents.push([type, detail]);
      },
    }, () => transportApi.startWorldMarch({
      targetQ: 4,
      targetR: -1,
      formationSlot: 1,
      clientInputIntent: inputIntent,
    })),
    /network down/,
  );

  const httpApi = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 0,
    transport: {
      async request() {
        return createResponse(409, { error: 'blocked', message: 'not allowed' });
      },
    },
  });

  await assert.rejects(
    withOperationLog({
      record(type, detail) {
        httpEvents.push([type, detail]);
      },
    }, () => httpApi.startWorldMarch({
      targetQ: 4,
      targetR: -1,
      formationSlot: 1,
      clientInputIntent: inputIntent,
    })),
    /not allowed/,
  );

  const transportError = transportEvents.find((event) => event[0] === 'api:error')?.[1];
  const httpError = httpEvents.find((event) => event[0] === 'api:error')?.[1];

  assert.equal(transportError.clientInput.inputId, 'wmi-error-api-5');
  assert.equal(transportError.clientInput.clientSequence, 5);
  assert.equal(transportError.clientInput.target.tileId, 'tile_4_-1');
  assert.equal(JSON.stringify(transportError.clientInput).includes('rendererPayload'), false);

  assert.equal(httpError.clientInput.inputId, 'wmi-error-api-5');
  assert.equal(httpError.clientInput.clientSequence, 5);
  assert.equal(httpError.clientInput.target.tileId, 'tile_4_-1');
  assert.equal(JSON.stringify(httpError.clientInput).includes('rendererPayload'), false);
});

test('GameAPI retries transient GET failures without retrying unsafe methods', async () => {
  const calls = [];
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    maxRetries: 1,
    retryBaseDelayMs: 25,
    scheduler: {
      setTimeout(callback, ms) {
        calls.push(['delay', ms]);
        callback();
        return 1;
      },
      clearTimeout() {},
    },
    transport: {
      async request(request) {
        calls.push(['transport', request.method, request.path, request.attempt]);
        if (request.method === 'GET' && request.attempt === 1) {
          return createResponse(504, { message: 'Gateway Timeout' });
        }
        if (request.method === 'POST') {
          return createResponse(504, { message: 'Gateway Timeout' });
        }
        return createResponse(200, { deploymentId: 'dep-1', version: 'v1' });
      },
    },
  });

  const version = await api.getVersion();
  assert.equal(version.deploymentId, 'dep-1');

  await assert.rejects(
    () => api.build('farm'),
    (error) => {
      assert.equal(error.status, 504);
      assert.equal(error.attempts, 1);
      assert.equal(error.retryable, false);
      return true;
    },
  );

  assert.deepEqual(calls, [
    ['transport', 'GET', '/version', 1],
    ['delay', 25],
    ['transport', 'GET', '/version', 2],
    ['transport', 'POST', '/game/action', 1],
  ]);
});

test('GameAPI reports client events without throwing on backend rejection', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    timeoutMs: 0,
    transport: {
      async request(request) {
        calls.push([
          request.method,
          request.path,
          request.url,
          request.headers.Authorization,
          request.headers['X-Client-Request-ID'],
          JSON.parse(request.body),
        ]);
        return createResponse(202, { success: true, accepted: true });
      },
    },
  });

  const result = await api.reportClientEvent({
    type: 'frontend_asset_failure',
    phase: 'assets:preload',
    assetPath: 'assets/missing.png',
  });

  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'POST');
  assert.equal(calls[0][1], '/client-events');
  assert.equal(calls[0][2], '/api/client-events');
  assert.equal(calls[0][3], 'Bearer token-a');
  assert.match(calls[0][4], /^client-event-/);
  assert.equal(calls[0][5].type, 'frontend_asset_failure');
  assert.equal(calls[0][5].requestId, calls[0][4]);
});

test('GameAPI reportClientEvent returns failure payload instead of throwing', async () => {
  const api = new GameAPI('/api', null, {
    timeoutMs: 0,
    transport: {
      async request() {
        return createResponse(400, { error: 'CLIENT_EVENT_TYPE_UNSUPPORTED' });
      },
    },
  });

  const result = await api.reportClientEvent({ type: 'debug_note' });

  assert.equal(result.success, false);
  assert.equal(result.status, 400);
  assert.equal(result.payload.error, 'CLIENT_EVENT_TYPE_UNSUPPORTED');
});

test('GameAPI uploads explicit client operation logs with auth and request id', async () => {
  const calls = [];
  const api = new GameAPI('/api', 'token-a', {
    timeoutMs: 0,
    transport: {
      async request(request) {
        calls.push([
          request.method,
          request.path,
          request.url,
          request.headers.Authorization,
          request.headers['X-Client-Request-ID'],
          JSON.parse(request.body),
        ]);
        return createResponse(202, { success: true, accepted: true, logId: 9 });
      },
    },
  });

  const result = await api.uploadClientOperationLog({
    schema: 'client-operation-log-v1',
    reason: 'city-click-repro',
    entries: [{ seq: 1, type: 'input:tapMiss' }],
  });

  assert.equal(result.success, true);
  assert.equal(result.logId, 9);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'POST');
  assert.equal(calls[0][1], '/client-operation-logs');
  assert.equal(calls[0][2], '/api/client-operation-logs');
  assert.equal(calls[0][3], 'Bearer token-a');
  assert.match(calls[0][4], /^client-oplog-/);
  assert.equal(calls[0][5].reason, 'city-click-repro');
  assert.equal(calls[0][5].requestId, calls[0][4]);
});

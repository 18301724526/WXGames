let fallbackSequence = 0;

function cleanText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return (
    String(value)
      .replace(/[^a-zA-Z0-9:._-]/g, '_')
      .slice(0, 160) || fallback
  );
}

function readHeader(req = {}, name = '') {
  const direct = req.get?.(name);
  if (direct) return direct;
  const lower = name.toLowerCase();
  return req.headers?.[lower] || req.headers?.[name] || '';
}

function createFallbackRequestId() {
  fallbackSequence += 1;
  return `server-${Date.now()}-${fallbackSequence}`;
}

function createBuildBuildingCommand(req = {}) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestId = cleanText(
    readHeader(req, 'X-Client-Request-ID') || body.clientRequestId || body.requestId,
    createFallbackRequestId(),
  );
  const buildingId = cleanText(body.buildingId || body.target, '');
  const commandId = cleanText(
    body.commandId || body.clientCommand?.commandId || `cmd-${requestId}`,
    `cmd-${requestId}`,
  );
  const idempotencyKey = cleanText(
    body.idempotencyKey || body.clientCommand?.idempotencyKey || commandId,
    commandId,
  );
  return {
    schema: 'game-command-v1',
    type: 'BuildBuilding',
    action: 'build',
    commandId,
    requestId,
    idempotencyKey,
    playerId: cleanText(req.playerId, ''),
    clientVersion: cleanText(body.clientVersion || body.clientCommand?.clientVersion, ''),
    clientStateRevision: body.clientStateRevision ?? body.stateRevision ?? null,
    payload: {
      buildingId,
      cityId: cleanText(body.cityId, ''),
      target: buildingId,
    },
    source: {
      route: '/api/game/action',
      platform: cleanText(body.platform || body.clientCommand?.platform, ''),
      deployVersion: cleanText(body.deployVersion || body.clientCommand?.deployVersion, ''),
    },
  };
}

function summarizeCommand(command = {}) {
  return {
    schema: 'game-command-summary-v1',
    commandId: command.commandId || '',
    requestId: command.requestId || '',
    idempotencyKey: command.idempotencyKey || '',
    type: command.type || '',
    action: command.action || '',
    playerId: command.playerId || '',
    target: command.payload?.buildingId || command.payload?.target || '',
    cityId: command.payload?.cityId || '',
    clientStateRevision: command.clientStateRevision ?? null,
  };
}

module.exports = {
  createBuildBuildingCommand,
  summarizeCommand,
};

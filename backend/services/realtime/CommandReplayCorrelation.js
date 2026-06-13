const CommandAuthorityContract = require('./CommandAuthorityContract');

const SCHEMA = 'command-replay-correlation-v1';

function cleanText(value, maxLength = 160) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function parseMaybeJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function stripEmpty(value) {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    if (item === undefined || item === null || item === '') return;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const stripped = stripEmpty(item);
      if (Object.keys(stripped).length > 0) output[key] = stripped;
      return;
    }
    output[key] = item;
  });
  return output;
}

function summarizeClientInput(input = null) {
  return CommandAuthorityContract.summarizeClientInput(input);
}

function summarizeAuthority(authority = null) {
  if (!authority || typeof authority !== 'object') return null;
  const command = authority.command && typeof authority.command === 'object'
    ? authority.command
    : {};
  const rejection = authority.rejection && typeof authority.rejection === 'object'
    ? authority.rejection
    : null;
  return stripEmpty({
    schema: cleanText(authority.schema, 80),
    status: cleanText(authority.status, 32),
    commandId: cleanText(authority.commandId, 120),
    serverTime: cleanText(authority.serverTime, 80),
    command: {
      type: cleanText(command.type, 80),
      actorId: cleanText(command.actorId, 120),
      playerId: cleanText(command.playerId, 120),
      clientSequence: command.clientSequence ?? undefined,
      clientInput: summarizeClientInput(command.clientInput || command.clientInputIntent || null),
    },
    rejection: rejection ? {
      error: cleanText(rejection.error, 120),
      message: cleanText(rejection.message, 240),
    } : null,
  });
}

function getEntries(clientSnapshot = {}) {
  return Array.isArray(clientSnapshot?.entries) ? clientSnapshot.entries : [];
}

function getDetail(entry = {}) {
  return entry?.detail && typeof entry.detail === 'object' ? entry.detail : {};
}

function findClientEntry(entries, type, requestId = '') {
  const candidates = entries.filter((entry) => entry?.type === type);
  if (!requestId) return candidates.at(-1) || null;
  return candidates.find((entry) => cleanText(getDetail(entry).requestId, 120) === requestId)
    || candidates.at(-1)
    || null;
}

function findInputFromClientEntries(entries, requestId = '') {
  const requestEntry = findClientEntry(entries, 'api:request', requestId);
  const requestDetail = getDetail(requestEntry);
  if (requestDetail.clientInput) return requestDetail.clientInput;
  if (requestDetail.inputIntent) return requestDetail.inputIntent;
  const tapEntry = [...entries].reverse().find((entry) => {
    const detail = getDetail(entry);
    return detail.clientInput || detail.inputIntent;
  });
  const tapDetail = getDetail(tapEntry);
  return tapDetail.clientInput || tapDetail.inputIntent || null;
}

function stableJson(value) {
  return JSON.stringify(value || null);
}

function clientInputMatches(primary, ...others) {
  if (!primary) return false;
  const reference = stableJson(primary);
  return others
    .filter(Boolean)
    .some((candidate) => stableJson(summarizeClientInput(candidate) || candidate) === reference);
}

function getBodyRequestId(body = {}) {
  return cleanText(
    body.operationLog?.requestId
      || body.clientRequestId
      || body.requestId,
    120,
  );
}

function getBodyAction(body = {}) {
  return cleanText(body.operationLog?.action || body.action, 80);
}

function createSummary(input = {}) {
  const clientSnapshot = input.clientSnapshot && typeof input.clientSnapshot === 'object'
    ? input.clientSnapshot
    : {};
  const apiLog = input.apiLog && typeof input.apiLog === 'object' ? input.apiLog : {};
  const body = parseMaybeJson(apiLog.body);
  const response = parseMaybeJson(apiLog.response);
  const entries = getEntries(clientSnapshot);
  const bodyRequestId = getBodyRequestId(body);
  const requestEntry = findClientEntry(entries, 'api:request', bodyRequestId);
  const responseEntry = findClientEntry(entries, 'api:response', bodyRequestId);
  const requestDetail = getDetail(requestEntry);
  const responseDetail = getDetail(responseEntry);
  const requestId = bodyRequestId
    || cleanText(requestDetail.requestId, 120)
    || cleanText(responseDetail.requestId, 120);
  const apiClientInput = body.operationLog?.clientInput || body.clientInputIntent || null;
  const clientEntryInput = findInputFromClientEntries(entries, requestId);
  const clientInput = summarizeClientInput(apiClientInput || clientEntryInput);
  const authority = summarizeAuthority(
    body.operationLog?.authority
      || response.authority
      || responseDetail.payload?.authority
      || null,
  );
  const responseAuthority = summarizeAuthority(response.authority || responseDetail.payload?.authority || null);
  return stripEmpty({
    schema: SCHEMA,
    requestId,
    action: getBodyAction(body) || cleanText(requestDetail.action || responseDetail.action, 80),
    path: cleanText(apiLog.path || requestDetail.path || responseDetail.path, 160),
    statusCode: apiLog.statusCode === undefined ? undefined : Number(apiLog.statusCode),
    timestamp: cleanText(apiLog.timestamp, 80),
    clientRunId: cleanText(clientSnapshot.runId, 120),
    clientInput,
    authority,
    matches: {
      requestId: Boolean(requestId
        && cleanText(requestDetail.requestId, 120) === requestId
        && (!responseDetail.requestId || cleanText(responseDetail.requestId, 120) === requestId)),
      clientInput: clientInputMatches(clientInput, clientEntryInput, apiClientInput, requestDetail.clientInput),
      authorityCommand: Boolean(authority?.commandId
        && responseAuthority?.commandId
        && authority.commandId === responseAuthority.commandId),
    },
  });
}

module.exports = {
  SCHEMA,
  createSummary,
  summarizeAuthority,
  summarizeClientInput,
};

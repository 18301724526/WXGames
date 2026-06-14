const crypto = require('node:crypto');

const SCHEMA = 'command-authority-contract-v1';

function createCommandId(input = {}) {
  const hash = crypto.createHash('sha1');
  hash.update([
    input.playerId || '',
    input.type || '',
    input.actorId || '',
    input.serverTime || '',
    input.clientSequence || '',
  ].join('|'));
  return `cmd_${hash.digest('hex').slice(0, 16)}`;
}

function normalizeIntent(intent = {}) {
  const serverTime = intent.serverTime || new Date().toISOString();
  const type = String(intent.type || intent.action || '').trim();
  const actorId = String(intent.actorId || intent.missionId || intent.targetId || '').trim();
  return {
    type,
    actorId,
    playerId: intent.playerId || '',
    clientSequence: intent.clientSequence || null,
    clientInput: summarizeClientInput(intent.clientInputIntent || intent.clientInput || null),
    serverTime,
    commandId: intent.commandId || createCommandId({
      ...intent,
      type,
      actorId,
      serverTime,
    }),
  };
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(toNumber(value, 0) * factor) / factor;
}

function summarizePoint(point = null) {
  if (!point || typeof point !== 'object') return null;
  return {
    x: round(point.x ?? point.clientX),
    y: round(point.y ?? point.clientY),
  };
}

function summarizeAction(action = null) {
  if (!action || typeof action !== 'object') return null;
  const summary = { type: String(action.type || '').slice(0, 80) };
  ['siteId', 'territoryId', 'cityId', 'tileId', 'actorId', 'missionId', 'source'].forEach((key) => {
    if (action[key] !== undefined && action[key] !== '') summary[key] = String(action[key]).slice(0, 96);
  });
  if (action.targetQ !== undefined || action.q !== undefined) summary.targetQ = Math.floor(toNumber(action.targetQ ?? action.q));
  if (action.targetR !== undefined || action.r !== undefined) summary.targetR = Math.floor(toNumber(action.targetR ?? action.r));
  if (action.background !== undefined) summary.background = Boolean(action.background);
  if (action.known !== undefined) summary.known = Boolean(action.known);
  return summary;
}

function summarizeClientInput(input = null) {
  if (!input || typeof input !== 'object') return null;
  const points = input.points && typeof input.points === 'object' ? input.points : {};
  const target = input.target && typeof input.target === 'object' ? input.target : {};
  const picking = input.picking && typeof input.picking === 'object' ? input.picking : {};
  const view = input.view && typeof input.view === 'object' ? input.view : {};
  const camera = view.camera && typeof view.camera === 'object' ? view.camera : {};
  const viewport = view.viewport && typeof view.viewport === 'object' ? view.viewport : {};
  return {
    schema: String(input.schema || '').slice(0, 80),
    kind: String(input.kind || '').slice(0, 32),
    source: String(input.source || '').slice(0, 80),
    inputId: String(input.inputId || '').replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 64) || undefined,
    clientSequence: input.clientSequence === undefined
      ? undefined
      : Math.max(0, Math.floor(toNumber(input.clientSequence, 0))),
    points: {
      physical: summarizePoint(points.physical),
      layer: summarizePoint(points.layer),
    },
    action: summarizeAction(input.action),
    target: {
      kind: String(target.kind || '').slice(0, 32),
      tileId: target.tileId ? String(target.tileId).slice(0, 96) : undefined,
      siteId: target.siteId ? String(target.siteId).slice(0, 96) : undefined,
      actorId: target.actorId ? String(target.actorId).slice(0, 96) : undefined,
      missionId: target.missionId ? String(target.missionId).slice(0, 96) : undefined,
      targetQ: target.targetQ !== undefined ? Math.floor(toNumber(target.targetQ)) : undefined,
      targetR: target.targetR !== undefined ? Math.floor(toNumber(target.targetR)) : undefined,
    },
    picking: {
      inputEpoch: Math.max(0, Math.floor(toNumber(picking.inputEpoch, 0))),
      signature: String(picking.signature || '').slice(0, 160),
      counts: picking.counts && typeof picking.counts === 'object' ? {
        sites: Math.max(0, Math.floor(toNumber(picking.counts.sites, 0))),
        actors: Math.max(0, Math.floor(toNumber(picking.counts.actors, 0))),
        targets: Math.max(0, Math.floor(toNumber(picking.counts.targets, 0))),
      } : undefined,
    },
    view: {
      camera: {
        x: round(camera.x),
        y: round(camera.y),
      },
      viewport: {
        scale: round(viewport.scale, 4),
      },
    },
  };
}

function createAuthorityResult(intent = {}, options = {}) {
  const command = normalizeIntent({
    ...intent,
    serverTime: options.serverTime || intent.serverTime,
  });
  const accepted = options.accepted !== false;
  return {
    schema: SCHEMA,
    status: accepted ? 'accepted' : 'rejected',
    commandId: command.commandId,
    serverTime: command.serverTime,
    command: {
      type: command.type,
      actorId: command.actorId,
      playerId: command.playerId,
      clientSequence: command.clientSequence,
      clientInput: command.clientInput,
    },
    authority: {
      owner: 'server',
      frontendRole: 'intent-only',
      serverOwns: [
        'command validation',
        'movement timeline',
        'final coordinates',
        'combat results',
        'occupation results',
        'AOI sync',
      ],
    },
    timeline: options.timeline || null,
    aoi: options.aoi || null,
    rejection: accepted ? null : {
      error: options.error || 'COMMAND_REJECTED',
      message: options.message || 'Command rejected by authority contract.',
    },
  };
}

function accept(intent = {}, options = {}) {
  return createAuthorityResult(intent, {
    ...options,
    accepted: true,
  });
}

function reject(intent = {}, options = {}) {
  return createAuthorityResult(intent, {
    ...options,
    accepted: false,
  });
}

function attach(result = {}, intent = {}, options = {}) {
  const accepted = result?.success !== false && options.accepted !== false;
  return {
    ...result,
    authority: accepted
      ? accept(intent, options)
      : reject(intent, {
        ...options,
        error: result?.error || options.error,
        message: result?.message || options.message,
      }),
  };
}

module.exports = {
  SCHEMA,
  createCommandId,
  normalizeIntent,
  createAuthorityResult,
  summarizeClientInput,
  accept,
  reject,
  attach,
};

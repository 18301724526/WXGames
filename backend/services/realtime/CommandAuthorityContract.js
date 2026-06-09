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
    serverTime,
    commandId: intent.commandId || createCommandId({
      ...intent,
      type,
      actorId,
      serverTime,
    }),
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
  accept,
  reject,
  attach,
};

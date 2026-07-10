'use strict';

const WorldMarchVerification = require('../../services/worldExplorer/WorldMarchVerification');
const { requireOwnerContext } = require('./CommandOwnerContext');

function hasDueMission(gameState = {}, now = new Date()) {
  const nowMs = now.getTime();
  return (Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [])
    .some((mission) => {
      if (!mission || mission.status !== 'active') return false;
      const nextStepAtMs = Date.parse(mission.nextStepAt || '');
      return Number.isFinite(nextStepAtMs) && nextStepAtMs <= nowMs;
    });
}

class HeartbeatCommandHandler {
  constructor(options = {}) {
    this.gameStateService = options.gameStateService;
    this.now = options.now || (() => new Date());
  }

  validate(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    return { success: true };
  }

  execute(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    const now = this.now();
    let state = context.state;
    let changed = false;
    if (state && hasDueMission(state, now)) {
      state = this.gameStateService.advanceRuntimeState(state, now, {
        planningContext: context.application.projection,
        worldEncounterRepo: context.application.worldEncounterRepo,
        sharedWorldEncounters: context.application.projection?.sharedWorldEncounters,
      });
      changed = true;
    }

    const reportPayload = context.envelope?.payload?.worldMarchClientReport;
    let clientReport = null;
    if (state && reportPayload && typeof reportPayload === 'object') {
      const batch = WorldMarchVerification.sanitizeReportBatch(reportPayload, now);
      if (Object.keys(batch.missions || {}).length > 0) {
        state.worldMarchClientReports = batch;
        clientReport = batch;
        changed = true;
      }
    }
    if (changed && state) state.updatedAt = now.toISOString();
    context.state = state;
    return {
      success: true,
      changed,
      clientReport,
      serverTime: now.toISOString(),
      heartbeatSeq: now.getTime(),
    };
  }
}

module.exports = {
  HeartbeatCommandHandler,
  hasDueMission,
};

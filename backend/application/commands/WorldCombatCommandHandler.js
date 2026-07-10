'use strict';

const TutorialService = require('../../services/TutorialService');
const WorldCombatSessionService = require('../../services/worldCombat/WorldCombatSessionService');
const { requireOwnerContext } = require('./CommandOwnerContext');
const {
  generateCommandEvents,
  normalizeResultTutorial,
  syncEra2Tutorial,
} = require('./GameCommandStateSupport');

const WORLD_COMBAT_ACTIONS = new Set(['startWorldCombat', 'resolveWorldCombat']);

function stageEncounter(context, encounter, now) {
  if (!encounter?.id) return;
  context.sharedMutations.encounters = Array.isArray(context.sharedMutations.encounters)
    ? context.sharedMutations.encounters
    : [];
  const mutation = { encounter, now: now?.toISOString?.() || now || null };
  const index = context.sharedMutations.encounters
    .findIndex((item) => (item?.encounter || item)?.id === encounter.id);
  if (index >= 0) context.sharedMutations.encounters[index] = mutation;
  else context.sharedMutations.encounters.push(mutation);
}

class WorldCombatCommandHandler {
  constructor(options = {}) {
    this.gameStateService = options.gameStateService;
    this.now = options.now || (() => new Date());
  }

  validate(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    const action = context.envelope?.type || '';
    if (!WORLD_COMBAT_ACTIONS.has(action)) {
      return { success: false, statusCode: 400, error: 'UNKNOWN_ACTION', message: '未知操作' };
    }
    const payload = context.envelope?.payload || {};
    const encounterId = String(payload.encounterId || payload.combatEncounterId || '').trim();
    if (!encounterId || context.ownerResolution?.ownerKey !== `encounter:${encounterId}`) {
      return {
        success: false,
        statusCode: 400,
        error: 'WORLD_COMBAT_ENCOUNTER_OWNER_MISMATCH',
        message: '敌军标识与命令 owner 不一致',
      };
    }
    const tutorial = syncEra2Tutorial(context.state, this.gameStateService);
    context.application.tutorial = tutorial;
    const tutorialResult = TutorialService.validateAction(tutorial, action, payload, context.state);
    if (tutorialResult.allowed) return { success: true };
    return {
      success: false,
      statusCode: 403,
      error: tutorialResult.code,
      message: tutorialResult.message,
    };
  }

  execute(context = {}) {
    requireOwnerContext({
      ownerKey: context.ownerResolution?.ownerKey,
      ownerKeys: context.ownerResolution?.ownerKeys,
    });
    generateCommandEvents(context.state);
    const action = context.envelope.type;
    const payload = context.envelope.payload || {};
    const now = this.now();
    const worldOptions = {
      worldEncounterRepo: context.application.worldEncounterRepo,
      sharedWorldEncounters: context.application.projection?.sharedWorldEncounters,
      stageEncounter: (encounter, mutationNow) => stageEncounter(
        context,
        encounter,
        mutationNow || now,
      ),
    };
    const result = action === 'startWorldCombat'
      ? WorldCombatSessionService.openSession(context.state, payload, now, worldOptions)
      : WorldCombatSessionService.resolveSession(context.state, payload, now, worldOptions);
    context.state.tutorial = normalizeResultTutorial(result, context.application.tutorial);
    context.application.tutorial = syncEra2Tutorial(context.state, this.gameStateService);
    generateCommandEvents(context.state);
    return result;
  }
}

module.exports = {
  WORLD_COMBAT_ACTIONS,
  WorldCombatCommandHandler,
  stageEncounter,
};

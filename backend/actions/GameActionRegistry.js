const AdvanceEraAction = require('./AdvanceEraAction');
const AssignPopulationAction = require('./AssignPopulationAction');
const BuildBuildingAction = require('./BuildBuildingAction');
const ClaimEventAction = require('./ClaimEventAction');
const TerritoryAction = require('./TerritoryAction');
const TalentPolicyService = require('../services/TalentPolicyService');
const TechTreeService = require('../services/TechTreeService');
const FamousPersonService = require('../services/FamousPersonService');
const MilitaryService = require('../services/MilitaryService');
const TutorialService = require('../services/TutorialService');

const TERRITORY_ACTIONS = new Set([
  'scoutTerritory',
  'claimScout',
  'startConquest',
  'claimConquest',
  'renameCity',
  'renamePolity',
  'switchCity',
  'startWorldMarch',
  'returnWorldMarch',
  'stopWorldMarch',
]);

const defaultDeps = {
  AdvanceEraAction,
  AssignPopulationAction,
  BuildBuildingAction,
  ClaimEventAction,
  TerritoryAction,
  TalentPolicyService,
  TechTreeService,
  FamousPersonService,
  MilitaryService,
  TutorialService,
};

function buildTerritoryPayload(body = {}, actionOverride = '') {
  const action = actionOverride || body.action || '';
  const payload = {
    territoryId: body.territoryId,
    cityId: body.cityId,
    soldiers: body.soldiers,
    name: body.name,
    direction: body.direction,
    missionId: body.missionId,
    mode: body.mode,
    targetQ: body.targetQ,
    targetR: body.targetR,
    stopQ: body.stopQ,
    stopR: body.stopR,
    formationSlot: body.formationSlot,
    slot: body.slot,
    q: body.q,
    r: body.r,
    x: body.x,
    y: body.y,
    expedition: body.expedition,
  };
  if (action === 'stopWorldMarch') {
    delete payload.targetQ;
    delete payload.targetR;
    delete payload.stopQ;
    delete payload.stopR;
    delete payload.q;
    delete payload.r;
    delete payload.x;
    delete payload.y;
  }
  if (body.clientSequence !== undefined) payload.clientSequence = body.clientSequence;
  if (body.clientInputIntent !== undefined) payload.clientInputIntent = body.clientInputIntent;
  if (body.aoiRadius !== undefined) payload.aoiRadius = body.aoiRadius;
  if (body.debugTrace !== undefined) payload.debugTrace = body.debugTrace;
  if (body.worldMarchTrace !== undefined) payload.worldMarchTrace = body.worldMarchTrace;
  if (body.planningContext !== undefined) payload.planningContext = body.planningContext;
  return payload;
}

function createGameActionRegistry(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const handlers = new Map();

  function register(action, handler) {
    handlers.set(action, handler);
  }

  register('build', ({ action, gameState, tutorial, body }) => (
    deps.BuildBuildingAction.execute(action, gameState, tutorial, body.target)
  ));
  register('upgrade', ({ action, gameState, tutorial, body }) => (
    deps.BuildBuildingAction.execute(action, gameState, tutorial, body.target)
  ));
  register('advanceEra', ({ gameState, tutorial }) => (
    deps.AdvanceEraAction.execute(gameState, tutorial)
  ));
  register('claimEvent', ({ gameState, tutorial, body }) => (
    deps.ClaimEventAction.execute(gameState, tutorial, { eventId: body.eventId, optionId: body.optionId })
  ));
  register('assign', ({ gameState, tutorial, body }) => (
    deps.AssignPopulationAction.execute(gameState, tutorial, { target: body.target, count: body.count })
  ));
  register('tutorialAdvance', ({ tutorial, body }) => ({
    ...deps.TutorialService.advanceClientStep(tutorial, body.step),
  }));
  register('applyTalentPolicy', ({ gameState, tutorial, body }) => (
    deps.TalentPolicyService.applyPolicy(gameState, tutorial, {
      policyId: body.policyId,
      basePolicyId: body.basePolicyId,
      tiers: body.tiers,
      policy: body.policy,
    })
  ));
  register('saveTalentPolicy', ({ gameState, body }) => (
    deps.TalentPolicyService.saveCustomPolicy(gameState, {
      policyId: body.policyId,
      basePolicyId: body.basePolicyId,
      tiers: body.tiers,
      policy: body.policy,
    })
  ));
  register('deleteTalentPolicy', ({ gameState, body }) => (
    deps.TalentPolicyService.deleteCustomPolicy(gameState, { policyId: body.policyId })
  ));
  register('setArmyFormation', ({ gameState, body }) => (
    deps.MilitaryService.setArmyFormation(gameState, {
      cityId: body.cityId,
      slot: body.slot,
      memberIds: body.memberIds,
    })
  ));
  register('research', ({ gameState, body }) => (
    deps.TechTreeService.research(gameState, body.techId || body.target || body.tech)
  ));
  register('seekFamousPerson', ({ gameState, tutorial, body }) => {
    const result = deps.FamousPersonService.seekFamousPerson(gameState, { source: body.source || body.target });
    if (result?.success) {
      const normalizedTutorial = deps.TutorialService.normalizeTutorialState(tutorial || gameState.tutorial);
      if (normalizedTutorial.currentStep === deps.TutorialService.TUTORIAL_STEPS.famousSeekOpened) {
        return {
          ...result,
          tutorial: deps.TutorialService.advanceTutorial(normalizedTutorial, 'famousSeekCompleted'),
        };
      }
    }
    return result;
  });
  register('acceptFamousPerson', ({ gameState, body }) => (
    deps.FamousPersonService.acceptFamousPerson(gameState, body.candidateId || body.target)
  ));
  register('dismissFamousPersonCandidate', ({ gameState, body }) => (
    deps.FamousPersonService.dismissFamousPersonCandidate(gameState, body.candidateId || body.target)
  ));
  register('assignFamousAttributePoint', ({ gameState, body }) => (
    deps.FamousPersonService.assignAttributePoint(gameState, body.personId || body.target, body.attribute)
  ));

  for (const action of TERRITORY_ACTIONS) {
    register(action, ({ gameState, body }) => (
      deps.TerritoryAction.execute(action, gameState, buildTerritoryPayload(body, action))
    ));
  }

  return {
    execute(context = {}) {
      const action = context.action || context.body?.action || '';
      const handler = handlers.get(action);
      if (!handler) return { success: false, message: '鏈煡鎿嶄綔', error: 'UNKNOWN_ACTION' };
      const body = {
        ...(context.body || {}),
        ...(context.planningContext ? { planningContext: context.planningContext } : {}),
      };
      return handler({ ...context, action, body });
    },
    has(action) {
      return handlers.has(action);
    },
  };
}

const defaultRegistry = createGameActionRegistry();

function execute(context = {}) {
  return defaultRegistry.execute(context);
}

function has(action) {
  return defaultRegistry.has(action);
}

module.exports = {
  TERRITORY_ACTIONS,
  buildTerritoryPayload,
  createGameActionRegistry,
  execute,
  has,
};

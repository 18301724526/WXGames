const Shared = require('./worldExplorer/WorldExplorerShared');
const MissionNormalizer = require('./worldExplorer/WorldExplorerMissionNormalizer');
const Progression = require('./worldExplorer/WorldExplorerProgression');
const RoutePlanner = require('./worldExplorer/WorldExplorerRoutePlanner');
const ClientState = require('./worldExplorer/WorldExplorerClientState');
const Actions = require('./worldExplorer/WorldExplorerActions');
const Tutorial = require('./worldExplorer/WorldExplorerTutorial');

module.exports = {
  EXPLORE_STEP_DURATION_MS: Shared.EXPLORE_STEP_DURATION_MS,
  MAX_MANUAL_ROUTE_LENGTH: Shared.MAX_MANUAL_ROUTE_LENGTH,
  MAX_ACTIVE_EXPLORE_MISSIONS: Shared.MAX_ACTIVE_EXPLORE_MISSIONS,
  EXPLORE_REVEAL_RADIUS: Shared.EXPLORE_REVEAL_RADIUS,
  TUTORIAL_FIRST_SITE_GRANT_KEY: Shared.TUTORIAL_FIRST_SITE_GRANT_KEY,
  normalizeExploreState: Progression.normalizeExploreState,
  advanceExploreMissions: Progression.advanceExploreMissions,
  startWorldMarch: Actions.startWorldMarch,
  returnWorldMarch: Actions.returnWorldMarch,
  stopWorldMarch: Actions.stopWorldMarch,
  getClientState: ClientState.getClientState,
  buildManualRoute: RoutePlanner.buildManualRoute,
  normalizeMission: MissionNormalizer.normalizeMission,
  ensureTutorialFirstCityClaimSoldiers: Tutorial.ensureTutorialFirstCityClaimSoldiers,
};

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CHECK_FILES = Object.freeze([
  'frontend/js/config/GameConfig.js',
  'frontend/js/ecs/core/EcsCoreBoundary.js',
  'frontend/js/ecs/core/EcsCoreBoundary.test.js',
  'frontend/js/ecs/registry/EcsBoundaryManifest.js',
  'frontend/js/ecs/registry/EcsBoundaryManifest.test.js',
  'frontend/js/ecs/mode/EcsModeRuntimeEntry.js',
  'frontend/js/ecs/mode/ModeComponents.js',
  'frontend/js/ecs/mode/ModeKeys.js',
  'frontend/js/ecs/mode/ModeResolver.js',
  'frontend/js/ecs/mode/ModeWorld.js',
  'frontend/js/ecs/mode/ModeWorld.test.js',
  'frontend/js/state/StateWriter.js',
  'frontend/js/state/StateWriter.test.js',
  'frontend/js/state/TerritoryUiStateStore.js',
  'frontend/js/state/TerritoryUiStateStore.test.js',
  'frontend/js/state/BattleStore.js',
  'frontend/js/state/BattleStore.test.js',
  'frontend/js/state/ModalStore.js',
  'frontend/js/state/ModalStore.test.js',
  'frontend/js/ecs/projection/FogProjection.js',
  'frontend/js/ecs/projection/FogProjection.test.js',
  'frontend/js/ecs/snapshot/RendererSnapshotBoundary.js',
  'frontend/js/ecs/snapshot/RendererSnapshotBoundary.test.js',
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
  'frontend/js/ecs/input/InputIntent.js',
  'frontend/js/ecs/input/InputIntent.test.js',
  'frontend/js/ecs/input/InputIntentResolver.js',
  'frontend/js/ecs/input/InputIntentResolver.test.js',
  'frontend/js/config/FeatureFlags.js',
  'frontend/js/config/FeatureFlags.test.js',
  'frontend/js/config/LocaleTextRegistry.js',
  'frontend/js/config/LocaleTextRegistry.test.js',
  'frontend/js/ecs/resource/LocaleText.js',
  'frontend/js/ecs/resource/LocaleText.test.js',
  'frontend/js/config/AssetKeyRegistry.js',
  'frontend/js/config/AssetKeyRegistry.test.js',
  'frontend/js/debug/H5LoadTrace.js',
  'frontend/js/debug/H5LoadTrace.test.js',
  'frontend/js/debug/ActorPickingDiagnostics.js',
  'frontend/js/debug/ActorPickingDiagnostics.test.js',
  'frontend/js/debug/ClientOperationLog.js',
  'frontend/js/debug/ClientOperationLog.test.js',
  'frontend/js/debug/WorldMarchTrace.js',
  'frontend/js/debug/WorldMarchTrace.test.js',
  'frontend/js/api/GameAPI.js',
  'frontend/js/api/GameAPI.test.js',
  'frontend/js/ui/H5AuthStorageAdapter.js',
  'frontend/js/ui/H5AuthStorageAdapter.test.js',
  'frontend/js/ui/H5ActorPickingDiagnosticsAdapter.js',
  'frontend/js/ui/H5ActorPickingDiagnosticsAdapter.test.js',
  'frontend/js/services/GameStateSync.js',
  'frontend/js/services/GameStateSync.test.js',
  'frontend/js/services/UpdateChecker.js',
  'frontend/js/services/UpdateChecker.test.js',
  'frontend/tools/config-release-console.test.js',
  'frontend/tools/ops-console.test.js',
  'frontend/js/ecs/foundation/TileCoord.js',
  'frontend/js/ecs/foundation/TileCoord.test.js',
  'frontend/js/ecs/foundation/WorldTopology.js',
  'frontend/js/ecs/foundation/WorldTopology.test.js',
  'frontend/js/ecs/foundation/WorldChunkAddress.js',
  'frontend/js/ecs/foundation/WorldChunkAddress.test.js',
  'frontend/js/ecs/foundation/WorldInterestWindow.js',
  'frontend/js/ecs/foundation/WorldInterestWindow.test.js',
  'shared/worldMarchCore.js',
  'shared/worldMarchCore.test.js',
  'shared/worldMarchPassability.js',
  'shared/worldMarchPassability.test.js',
  'shared/worldMarchPassability.architecture.test.js',
  'frontend/js/ecs/foundation/TileMapGeometry.js',
  'frontend/js/ecs/foundation/TileMapGeometry.test.js',

  'frontend/js/platform/renderers/CanvasPreloadAssetManifest.js',
  'frontend/js/platform/renderers/CanvasPreloadAssetManifest.test.js',
  'frontend/js/platform/CanvasLayerRegistry.js',
  'frontend/js/platform/CanvasLayerRegistry.test.js',
  'frontend/js/platform/CanvasRuntimeContract.js',
  'frontend/js/platform/CanvasRuntimeContract.test.js',
  'frontend/js/platform/H5CanvasRuntime.js',
  'frontend/js/platform/H5CanvasRuntime.test.js',
  'frontend/js/platform/CanvasGameShell.js',
  'frontend/js/platform/WorldMapRuntimePolicy.js',
  'frontend/js/platform/WorldMapRuntimePolicy.test.js',
  'frontend/js/platform/CanvasGameShell.test.js',
  'frontend/js/platform/CanvasModeOwnershipRuntime.js',
  'frontend/js/platform/CanvasModeOwnershipRuntime.test.js',
  'frontend/js/platform/CanvasModalSnapshotAdapter.js',
  'frontend/js/platform/CanvasModalSnapshotAdapter.test.js',
  'frontend/js/platform/ModalCallbackRegistry.js',
  'frontend/js/platform/ModalCallbackRegistry.test.js',
  'frontend/js/platform/CanvasGameApp.js',
  'frontend/js/platform/CanvasGameApp.test.js',
  'frontend/js/platform/CanvasActionController.test.js',
  'frontend/js/ecs/projection/WorldMapVisibilityModel.js',
  'frontend/js/ecs/projection/WorldMapVisibilityModel.test.js',
  'frontend/js/ecs/projection/WorldMapEntitySnapshot.js',
  'frontend/js/ecs/projection/WorldMapEntitySnapshot.test.js',
  'frontend/js/ecs/projection/WorldMapRenderSnapshot.js',
  'frontend/js/ecs/projection/WorldMapRenderSnapshot.test.js',
  'frontend/js/ecs/projection/WorldMapPerformanceBudget.js',
  'frontend/js/ecs/projection/WorldMapPerformanceBudget.test.js',
  'frontend/js/ecs/system/WorldFogVisionModel.js',
  'frontend/js/ecs/system/WorldFogVisionModel.test.js',
  'frontend/js/ecs/system/FogRevealModel.js',
  'frontend/js/ecs/system/FogRevealModel.test.js',
  'frontend/js/ecs/projection/WorldFogVisualSnapshot.js',
  'frontend/js/ecs/projection/WorldFogVisualSnapshot.test.js',
  'frontend/js/ecs/input/WorldMapPickingModel.js',
  'frontend/js/ecs/input/WorldMapPickingModel.test.js',
  'frontend/js/ecs/input/WorldMapInputIntent.js',
  'frontend/js/ecs/input/WorldMapInputIntent.test.js',
  'frontend/js/ecs/input/WorldMapInputActionMap.js',
  'frontend/js/ecs/input/WorldMapInputActionMap.test.js',
  'frontend/js/ecs/debug/DebugOverlaySnapshot.js',
  'frontend/js/ecs/debug/DebugOverlaySnapshot.test.js',
  'frontend/js/ecs/projection/WorldActorProjection.js',
  'frontend/js/ecs/projection/WorldActorProjection.test.js',
  'frontend/js/ecs/system/WorldMarchProgressSnapshot.js',
  'frontend/js/ecs/system/WorldMarchProgressSnapshot.test.js',
  'frontend/js/state/optimistic/MarchCommandBuilder.js',
  'frontend/js/state/optimistic/MarchPendingStore.js',
  'frontend/js/state/optimistic/MarchReconciler.js',
  'frontend/js/state/optimistic/index.js',
  'frontend/js/state/optimistic/MarchOptimisticState.test.js',
  'frontend/js/ecs/foundation/WorldMarchGeometry.js',
  'frontend/js/ecs/foundation/WorldMarchGeometry.test.js',
  'frontend/js/ecs/system/WorldMarchSystem.js',
  'frontend/js/ecs/system/WorldMarchSystem.test.js',
  'frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.js',
  'frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js',
  'frontend/js/platform/renderers/WorldMapRendererCompositionFactory.js',
  'frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js',
  'frontend/js/platform/renderers/WorldMapLayoutModel.js',
  'frontend/js/platform/renderers/WorldMapLayoutModel.test.js',
  'frontend/js/platform/renderers/WorldMapHitTargetModel.js',
  'frontend/js/platform/renderers/WorldMapHitTargetModel.test.js',
  'frontend/js/platform/renderers/WorldMapCachePolicy.js',
  'frontend/js/platform/renderers/WorldMapCachePolicy.test.js',
  'frontend/js/platform/renderers/WorldMapLayerCacheStore.js',
  'frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js',
  'frontend/js/platform/renderers/WorldMapStaticLayerRenderer.js',
  'frontend/js/platform/renderers/WorldMapStaticLayerRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapStaticEntryRenderer.js',
  'frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapStaticChunkRenderer.js',
  'frontend/js/platform/renderers/WorldMapStaticChunkRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapWaterLayerRenderer.js',
  'frontend/js/platform/renderers/WorldMapWaterLayerRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapWaterEntryRenderer.js',
  'frontend/js/platform/renderers/WorldMapWaterEntryRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.js',
  'frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.js',
  'frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapScoutRenderer.js',
  'frontend/js/platform/renderers/WorldMapScoutRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.js',
  'frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.js',
  'frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.test.js',
  'frontend/js/platform/renderers/WorldFogMaskGenerator.js',
  'frontend/js/platform/renderers/WorldFogCanvasRenderer.js',
  'frontend/js/platform/renderers/WorldMapTileMapRenderer.js',
  'frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js',
  'frontend/js/platform/renderers/WorldMapActorHudRenderer.js',
  'frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapCanvasRenderer.js',
  'frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js',
  'frontend/js/platform/DebugOverlayRegistry.js',
  'frontend/js/platform/DebugOverlayRegistry.test.js',
  'frontend/js/platform/CanvasActionController.js',
  'frontend/js/platform/CanvasActionController.test.js',
  'frontend/js/platform/CanvasActionControllerTerritory.test.js',
  'frontend/js/platform/CanvasActionControllerCity.test.js',
  'frontend/js/platform/CanvasActionControllerFamous.test.js',
  'frontend/js/platform/CanvasActionControllerShell.test.js',
  'frontend/js/platform/CanvasGameRendererCompositionFactory.js',
  'frontend/js/platform/CanvasGameRendererCompositionFactory.test.js',
  'frontend/js/platform/renderers/ResourceTopBarCanvasRenderer.js',
  'frontend/js/platform/renderers/ResourceTopBarCanvasRenderer.test.js',
  'frontend/js/platform/renderers/CityPeopleCanvasRenderer.js',
  'frontend/js/platform/renderers/CityPeopleCanvasRenderer.test.js',
  'frontend/js/tutorial/TutorialGuideStepPolicy.js',
  'frontend/js/tutorial/TutorialGuideStepPolicy.test.js',
  'frontend/js/tutorial/TutorialGuideTargetResolver.js',
  'frontend/js/tutorial/TutorialGuideTargetResolver.test.js',
  'frontend/js/tutorial/TutorialGuideArchitecture.test.js',
  'frontend/js/tutorial/TutorialGuideController.js',
  'frontend/js/tutorial/TutorialGuideController.test.js',
  'frontend/js/platform/CanvasGameAppRenderPolicy.js',
  'frontend/js/platform/CanvasGameAppRenderPolicy.test.js',
  'frontend/js/platform/CanvasGameAppRenderScheduler.js',
  'frontend/js/platform/CanvasGameAppRenderScheduler.test.js',
  'frontend/js/state/presenters/WorldTileMapTileNormalizer.js',
  'frontend/js/state/presenters/WorldTileMapTileNormalizer.test.js',
  'frontend/js/state/presenters/WorldTileMapExplorerNormalizer.js',
  'frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js',
  'frontend/js/state/presenters/WorldTileMapPresenter.js',
  'frontend/js/state/UIStatePresenterDelegates.js',
  'frontend/js/state/UIStatePresenterDelegates.test.js',
  'frontend/js/state/UIStatePresenter.js',
  'frontend/js/state/UIStatePresenter.test.js',
  'frontend/js/platform/CanvasGameRenderer.js',
  'frontend/js/platform/WorldMapRuntimeBakePolicy.js',
  'frontend/js/platform/WorldMapRuntimeBakePolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeCameraPolicy.js',
  'frontend/js/platform/WorldMapRuntimeCameraPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeInputPolicy.js',
  'frontend/js/platform/WorldMapRuntimeInputPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeHitTargetPolicy.js',
  'frontend/js/platform/WorldMapRuntimeHitTargetPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeRenderPolicy.js',
  'frontend/js/platform/WorldMapRuntimeRenderPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeRenderPipeline.js',
  'frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js',
  'frontend/js/platform/WorldMapRuntime.js',
  'frontend/js/platform/WorldMapRuntime.test.js',
  'frontend/minigame/game.js',
  'backend/services/TerritoryService.js',
  'backend/services/territory/TerritoryMilitaryMissions.js',
  'backend/services/worldExplorer/WorldExplorerDtoMapper.js',
  'backend/services/worldExplorer/WorldExplorerClientState.js',
  'backend/services/worldExplorer/WorldMarchVerification.js',
  'backend/scripts/cleanup-world-explorer-ready-state.js',
  'backend/services/realtime/CommandAuthorityContract.js',
  'backend/services/realtime/CommandReplayCorrelation.js',
  'backend/services/realtime/PresenceService.js',
  'backend/services/realtime/ServerTimelineSnapshot.js',
  'backend/services/realtime/WorldWorkerService.js',
  'backend/services/realtime/AoiSyncSnapshot.js',
  'backend/services/realtime/index.js',
  'backend/services/random/ServerRandomAuthorityContract.js',
  'backend/services/worldMap/WorldMapGenerationAuthority.js',
  'backend/services/worldMap/WorldMapTopology.js',
  'backend/services/worldMap/WorldMapShared.js',
  'backend/services/worldMap/WorldMapBatch.js',
  'backend/services/worldMap/WorldMapWater.js',
  'backend/services/worldMap/WorldMapTiles.js',
  'backend/services/WorldMapService.js',
  'backend/services/TerritoryClientAssembler.js',
  'backend/services/WorldAiExplorerService.js',
  'backend/services/worldExplorer/WorldExplorerClientState.js',
  'backend/config/BattleConfig.js',
  'backend/config/BuildingConfig.js',
  'backend/config/EraConfig.js',
  'backend/config/GameConfig.js',
  'backend/config/SecurityConfig.js',
  'backend/config/TechTreeConfig.js',
  'backend/config/TutorialFlowConfig.js',
  'backend/modules/BuildingState.js',
  'backend/services/SkillGeneratorService.js',
  'backend/services/skillGenerator/SkillAbilityFactory.js',
  'backend/services/skillGenerator/SkillAbilityKitService.js',
  'backend/services/skillGenerator/SkillGeneratorConstants.js',
  'backend/services/skillGenerator/SkillGeneratorDescriptions.js',
  'backend/services/skillGenerator/SkillGeneratorNormalizer.js',
  'backend/services/skillGenerator/SkillGeneratorRandomAuthority.js',
  'backend/services/skillGenerator/SkillGeneratorShared.js',
  'backend/services/DefenderLeaderService.js',
  'backend/services/defenderLeader/DefenderLeaderRandomAuthority.js',
  'backend/services/FamousPersonService.js',
  'backend/services/famousPerson/FamousPersonConstants.js',
  'backend/services/famousPerson/FamousPersonGenerator.js',
  'backend/services/famousPerson/FamousPersonProgression.js',
  'backend/services/famousPerson/FamousPersonRandomAuthority.js',
  'backend/services/famousPerson/FamousPersonShared.js',
  'backend/services/famousPerson/FamousPersonSkillNormalizer.js',
  'backend/services/event/EventCatalog.js',
  'backend/services/population/PopulationAssignment.js',
  'backend/services/TalentPolicyService.js',
  'backend/services/CityService.js',
  'backend/services/TechTreeService.js',
  'backend/services/VersionService.js',
  'backend/services/DatabaseRuntime.js',
  'backend/services/SchemaMigrationService.js',
  'backend/services/ObservabilityService.js',
  'backend/services/PerformanceCapacityBudget.js',
  'backend/services/OpsControlService.js',
  'backend/services/OpsAuthService.js',
  'backend/ops-agent/OpsAgentService.js',
  'backend/ops-agent/OpsAgentHttpServer.js',
  'backend/ops-agent/server.js',
  'backend/world-worker.js',
  'backend/services/config/ConfigRegistryContract.js',
  'backend/services/config/ConfigPipeline.js',
  'backend/services/config/ConfigReleaseService.js',
  'backend/services/config/ConfigRuntimeLoader.js',
  'backend/services/config/GameplayConfigRuntime.js',
  'backend/services/GameStateMigrationPipeline.js',
  'backend/services/GameStateNormalizer.js',
  'backend/services/GameStateService.js',
  'backend/services/ClientGameStateAssembler.js',
  'backend/actions/GameActionRegistry.js',
  'backend/tests/GameActionRegistry.test.js',
  'backend/services/logService.js',
  'backend/tests/LogService.test.js',
  'backend/services/WorldExplorerService.js',
  'backend/tests/WorldExplorerService.test.js',
  'backend/middleware/adminMiddleware.js',
  'backend/middleware/maintenanceMiddleware.js',
  'backend/routes/adminRoutes.js',
  'backend/routes/gameRoutes.js',
  'backend/routes/playerRoutes.js',
  'backend/routes/opsRoutes.js',
  'backend/routes/versionRoutes.js',
  'backend/routes/metricsRoutes.js',
  'backend/routes/clientEventsRoutes.js',
  'backend/repositories/GameStateRepository.js',
  'backend/tests/ConfigRegistryContract.test.js',
  'backend/tests/ConfigReleaseService.test.js',
  'backend/tests/ConfigRuntimeLoader.test.js',
  'backend/tests/SecurityConfig.test.js',
  'backend/tests/ServerRandomAuthorityContract.test.js',
  'backend/tests/GameStateRepository.test.js',
  'backend/tests/WorldMapArchitecture.test.js',
  'backend/tests/SkillGeneratorArchitecture.test.js',
  'backend/tests/FamousPersonArchitecture.test.js',
  'backend/tests/TalentPolicyService.test.js',
  'backend/tests/AdminRoutes.test.js',
  'backend/tests/VersionRoutes.test.js',
  'backend/tests/MetricsRoutes.test.js',
  'backend/tests/OpsControlService.test.js',
  'backend/tests/OpsRoutes.test.js',
  'backend/tests/OpsAgentService.test.js',
  'backend/tests/OpsAgentHttpServer.test.js',
  'backend/tests/OpsAuthService.test.js',
  'backend/tests/AuthServiceBotAccounts.test.js',
  'backend/tests/ClientEventsRoutes.test.js',
  'backend/tests/ObservabilityService.test.js',
  'backend/tests/DatabaseRuntime.test.js',
  'backend/tests/SchemaMigrationService.test.js',
  'backend/tests/PresenceService.test.js',
  'backend/tests/PerformanceCapacityBudget.test.js',
  'backend/tests/RealtimeAuthorityContract.test.js',
  'backend/tests/ServerGatewayNoWorldTick.test.js',
  'backend/tests/VersionService.test.js',
  'backend/tests/WorldWorkerService.test.js',
  'backend/tests/WorldMarchVerification.test.js',
  'backend/tests/GameStateMigrationPipeline.test.js',
  'backend/tests/WorldExplorerDtoMapper.test.js',
  'backend/tests/WorldExplorerArchitecture.test.js',
  'backend/tests/WorldExplorerReadyStateCleanup.test.js',
  'backend/tests/GameStateServiceSplit.test.js',
  'backend/tests/GameStateProjectionArchitecture.test.js',
  'scripts/check-backend-security-audit.js',
  'scripts/check-backend-security-audit.test.js',
  'scripts/verify-production-security-config.js',
  'scripts/verify-production-security-config.test.js',
  'scripts/run-architecture-smoke.js',
  'scripts/run-architecture-smoke.test.js',
  'scripts/check-repository-hygiene.js',
  'scripts/check-repository-hygiene.test.js',
  'scripts/check-retired-legacy-code.js',
  'scripts/check-retired-legacy-code.test.js',
  'scripts/report-frontend-ecs-mode-ownership.js',
  'scripts/report-frontend-ecs-mode-ownership.test.js',
  'scripts/report-frontend-ecs-bridge-shrink.js',
  'scripts/report-frontend-ecs-bridge-shrink.test.js',
  'scripts/report-domain-business-candidates.js',
  'scripts/report-domain-business-candidates.test.js',
  'scripts/report-command-owner-step1.js',
  'scripts/report-command-owner-step1.test.js',
  'scripts/command-owner-step1/contracts.js',
  'scripts/command-owner-step1/index.js',
  'scripts/command-owner-step1/inventories.js',
  'scripts/command-owner-step1/anti-evasion.js',
  'scripts/command-owner-step1/scanner.js',
  'scripts/check-frontend-ecs-core-guard.js',
  'scripts/check-frontend-ecs-core-guard.test.js',
  'scripts/check-frontend-ecs-boundary-skeleton.js',
  'scripts/check-frontend-ecs-boundary-skeleton.test.js',
  'scripts/check-frontend-ecs-source-layout.js',
  'scripts/check-frontend-ecs-source-layout.test.js',
  'scripts/check-frontend-ecs-mode-ownership-spine.js',
  'scripts/check-frontend-ecs-mode-ownership-spine.test.js',
  'scripts/check-frontend-ecs-input-intent-spine.js',
  'scripts/check-frontend-ecs-input-intent-spine.test.js',
  'scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js',
  'scripts/check-frontend-ecs-blocking-panel-mirror-retirement.test.js',
  'scripts/check-duplicate-shared-helpers.js',
  'scripts/check-duplicate-shared-helpers.test.js',
  'scripts/check-duplicate-coord-helpers.js',
  'scripts/check-duplicate-coord-helpers.test.js',
  'scripts/check-duplicate-march-builders.js',
  'scripts/check-duplicate-march-builders.test.js',
  'scripts/check-tutorial-advance-single-source.js',
  'scripts/check-tutorial-advance-single-source.test.js',
  'scripts/check-tutorial-step-contract.js',
  'scripts/check-tutorial-step-contract.test.js',
  'shared/tutorialFlowConfig.js',
  'shared/tutorialFlowConfig.test.js',
  'scripts/check-source-encoding.js',
  'scripts/check-source-encoding.test.js',
  'scripts/check-renderer-host-bridge-retired.js',
  'scripts/check-renderer-host-bridge-retired.test.js',
  'scripts/check-frontend-ecs-mode-vocab.js',
  'scripts/check-frontend-ecs-mode-vocab.test.js',
  'scripts/check-frontend-ecs-runtime-bundle-fresh.js',
  'scripts/check-frontend-ecs-runtime-bundle-fresh.test.js',
  'scripts/check-frontend-ecs-renderer-snapshot-boundary.js',
  'scripts/check-frontend-ecs-renderer-snapshot-boundary.test.js',
  'scripts/check-frontend-ecs-fog-owner.js',
  'scripts/check-frontend-single-source-redline.js',
  'scripts/check-frontend-single-source-redline.test.js',
  'scripts/check-frontend-ecs-naming-mirror-retirement.js',
  'scripts/check-frontend-ecs-naming-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js',
  'scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js',
  'scripts/check-frontend-ecs-rewardreveal-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-event-mirror-retirement.js',
  'scripts/check-frontend-ecs-event-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-target-picker-mirror-retirement.js',
  'scripts/check-frontend-ecs-target-picker-mirror-retirement.test.js',
  'scripts/check-frontend-platform-boundary.js',
  'scripts/check-frontend-platform-boundary.test.js',
  'scripts/build-frontend-ecs-runtime.js',
  'scripts/check-frontend-script-manifest.js',
  'scripts/rewrite-frontend-asset-version.js',
  'scripts/rewrite-frontend-asset-version.test.js',
  'scripts/check-shell-scripts.js',
  'scripts/check-shell-scripts.test.js',
  'scripts/profile-h5-performance.js',
  'scripts/loadtest-bot-heartbeat.js',
  'scripts/loadtest-bot-heartbeat.test.js',
  'scripts/validate-config-pipeline.js',
  'scripts/validate-config-pipeline.test.js',
  'scripts/build-config-tables.js',
  'scripts/build-config-tables.test.js',
  'scripts/check-client-command-block-reasons.js',
  'scripts/check-client-command-block-reasons.test.js',
]);

const TEST_FILES = Object.freeze([
  'frontend/js/ecs/core/EcsCoreBoundary.test.js',
  'frontend/js/ecs/registry/EcsBoundaryManifest.test.js',
  'frontend/js/ecs/mode/ModeWorld.test.js',
  'frontend/js/state/StateWriter.test.js',
  'frontend/js/state/BattleStore.test.js',
  'frontend/js/state/ModalStore.test.js',
  'frontend/js/ecs/snapshot/RendererSnapshotBoundary.test.js',
  'frontend/js/ecs/input/InputIntent.test.js',
  'frontend/js/ecs/input/InputIntentResolver.test.js',
  'frontend/js/platform/CanvasLayerRegistry.test.js',
  'frontend/js/platform/CanvasRuntimeContract.test.js',
  'frontend/js/platform/H5CanvasRuntime.test.js',
  'frontend/js/platform/WorldMapRuntimePolicy.test.js',
  'frontend/js/platform/CanvasGameApp.test.js',
  'frontend/js/ecs/foundation/TileCoord.test.js',
  'frontend/js/ecs/foundation/WorldTopology.test.js',
  'frontend/js/ecs/foundation/WorldChunkAddress.test.js',
  'frontend/js/ecs/foundation/WorldInterestWindow.test.js',
  'shared/worldMarchCore.test.js',
  'shared/worldMarchPassability.test.js',
  'shared/worldMarchPassability.architecture.test.js',
  'frontend/js/ecs/foundation/TileMapGeometry.test.js',

  'frontend/js/config/FeatureFlags.test.js',
  'frontend/js/config/LocaleTextRegistry.test.js',
  'frontend/js/ecs/resource/LocaleText.test.js',
  'frontend/js/config/AssetKeyRegistry.test.js',
  'frontend/js/debug/H5LoadTrace.test.js',
  'frontend/js/debug/ActorPickingDiagnostics.test.js',
  'frontend/js/debug/ClientOperationLog.test.js',
  'frontend/js/debug/WorldMarchTrace.test.js',
  'frontend/js/api/GameAPI.test.js',
  'frontend/js/ui/H5AuthStorageAdapter.test.js',
  'frontend/js/ui/H5ActorPickingDiagnosticsAdapter.test.js',
  'frontend/js/services/GameStateSync.test.js',
  'frontend/js/services/UpdateChecker.test.js',
  'frontend/tools/config-release-console.test.js',
  'frontend/tools/ops-console.test.js',
  'frontend/js/platform/renderers/CanvasPreloadAssetManifest.test.js',
  'frontend/js/platform/CanvasGameShell.test.js',
  'frontend/js/platform/CanvasActionController.test.js',
  'frontend/js/platform/CanvasModeOwnershipRuntime.test.js',
  'frontend/js/platform/CanvasModalSnapshotAdapter.test.js',
  'frontend/js/platform/ModalCallbackRegistry.test.js',
  'frontend/js/platform/renderers/WorldFogCanvasRenderer.test.js',
  'frontend/js/ecs/system/FogRevealModel.test.js',
  'frontend/js/ecs/system/WorldFogVisionModel.test.js',
  'frontend/js/ecs/projection/FogProjection.test.js',
  'frontend/js/ecs/projection/WorldMapVisibilityModel.test.js',
  'frontend/js/ecs/projection/WorldMapEntitySnapshot.test.js',
  'frontend/js/ecs/projection/WorldMapRenderSnapshot.test.js',
  'frontend/js/ecs/projection/WorldMapPerformanceBudget.test.js',
  'frontend/js/ecs/projection/WorldFogVisualSnapshot.test.js',
  'frontend/js/ecs/input/WorldMapPickingModel.test.js',
  'frontend/js/ecs/input/WorldMapInputIntent.test.js',
  'frontend/js/ecs/input/WorldMapInputActionMap.test.js',
  'frontend/js/ecs/debug/DebugOverlaySnapshot.test.js',
  'frontend/js/ecs/projection/WorldActorProjection.test.js',
  'frontend/js/ecs/system/WorldMarchProgressSnapshot.test.js',
  'frontend/js/state/optimistic/MarchOptimisticState.test.js',
  'frontend/js/ecs/foundation/WorldMarchGeometry.test.js',
  'frontend/js/ecs/system/WorldMarchSystem.test.js',
  'frontend/js/platform/renderers/WorldMapRendererDependencyRegistry.test.js',
  'frontend/js/platform/renderers/WorldMapRendererCompositionFactory.test.js',
  'frontend/js/platform/renderers/WorldMapLayoutModel.test.js',
  'frontend/js/platform/renderers/WorldMapHitTargetModel.test.js',
  'frontend/js/platform/renderers/WorldMapCachePolicy.test.js',
  'frontend/js/platform/renderers/WorldMapLayerCacheStore.test.js',
  'frontend/js/platform/renderers/WorldMapStaticLayerRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapStaticEntryRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapStaticChunkRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapWaterLayerRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapWaterEntryRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapSnapshotCacheRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapFastDragCompositeRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapScoutRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapSiteOverlayRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapMilitaryViewRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapTileMapRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapLayerOwnershipContract.test.js',
  'frontend/js/platform/renderers/WorldMapActorHudRenderer.test.js',
  'frontend/js/platform/renderers/WorldMapCanvasRenderer.test.js',
  'frontend/js/platform/DebugOverlayRegistry.test.js',
  'frontend/js/platform/CanvasActionController.test.js',
  'frontend/js/platform/CanvasActionControllerTerritory.test.js',
  'frontend/js/platform/CanvasActionControllerCity.test.js',
  'frontend/js/platform/CanvasActionControllerFamous.test.js',
  'frontend/js/platform/CanvasActionControllerShell.test.js',
  'frontend/js/platform/CanvasGameRendererCompositionFactory.test.js',
  'frontend/js/platform/renderers/ResourceTopBarCanvasRenderer.test.js',
  'frontend/js/platform/renderers/CityPeopleCanvasRenderer.test.js',
  'frontend/js/tutorial/TutorialGuideStepPolicy.test.js',
  'frontend/js/tutorial/TutorialGuideTargetResolver.test.js',
  'frontend/js/tutorial/TutorialGuideArchitecture.test.js',
  'frontend/js/tutorial/TutorialGuideController.test.js',
  'frontend/js/platform/CanvasGameAppRenderPolicy.test.js',
  'frontend/js/platform/CanvasGameAppRenderScheduler.test.js',
  'frontend/js/state/presenters/WorldTileMapTileNormalizer.test.js',
  'frontend/js/state/presenters/WorldTileMapExplorerNormalizer.test.js',
  'frontend/js/state/UIStatePresenterDelegates.test.js',
  'frontend/js/state/UIStatePresenter.test.js',
  'frontend/js/platform/WorldMapRuntimeBakePolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeCameraPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeInputPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeHitTargetPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeRenderPolicy.test.js',
  'frontend/js/platform/WorldMapRuntimeRenderPipeline.test.js',
  'frontend/js/platform/WorldMapRuntime.test.js',
  'backend/tests/GameStateMigrationPipeline.test.js',
  'backend/tests/GameStateServiceSplit.test.js',
  'backend/tests/GameStateProjectionArchitecture.test.js',
  'backend/tests/ConfigRegistryContract.test.js',
  'backend/tests/SecurityConfig.test.js',
  'backend/tests/ServerRandomAuthorityContract.test.js',
  'backend/tests/WorldMapArchitecture.test.js',
  'backend/tests/SkillGeneratorArchitecture.test.js',
  'backend/tests/TerritoryArchitecture.test.js',
  'backend/tests/FamousPersonArchitecture.test.js',
  'backend/tests/TalentPolicyService.test.js',
  'backend/tests/AdminRoutes.test.js',
  'backend/tests/VersionRoutes.test.js',
  'backend/tests/MetricsRoutes.test.js',
  'backend/tests/OpsControlService.test.js',
  'backend/tests/OpsRoutes.test.js',
  'backend/tests/OpsAgentService.test.js',
  'backend/tests/OpsAgentHttpServer.test.js',
  'backend/tests/ClientEventsRoutes.test.js',
  'backend/tests/ObservabilityService.test.js',
  'backend/tests/PresenceService.test.js',
  'backend/tests/PerformanceCapacityBudget.test.js',
  'backend/tests/OpsAuthService.test.js',
  'backend/tests/AuthServiceBotAccounts.test.js',
  'backend/tests/ConfigPipeline.test.js',
  'backend/tests/ConfigReleaseService.test.js',
  'backend/tests/ConfigRuntimeLoader.test.js',
  'backend/tests/GameplayConfigRuntime.test.js',
  'backend/tests/DatabaseRuntime.test.js',
  'backend/tests/SchemaMigrationService.test.js',
  'backend/tests/RealtimeAuthorityContract.test.js',
  'backend/tests/VersionService.test.js',
  'backend/tests/WorldExplorerDtoMapper.test.js',
  'backend/tests/WorldExplorerArchitecture.test.js',
  'backend/tests/WorldExplorerService.test.js',
  'backend/tests/WorldExplorerReadyStateCleanup.test.js',
  'backend/tests/GameStateRepository.test.js',
  'backend/tests/ServerGatewayNoWorldTick.test.js',
  'backend/tests/WorldWorkerService.test.js',
  'backend/tests/WorldMarchVerification.test.js',
  'backend/tests/GameActionRegistry.test.js',
  'backend/tests/LogService.test.js',
  'backend/tests/CommandReplayCorrelation.test.js',
  'scripts/loadtest-bot-heartbeat.test.js',
  'scripts/check-backend-security-audit.test.js',
  'scripts/verify-production-security-config.test.js',
  'scripts/run-architecture-smoke.test.js',
  'scripts/check-repository-hygiene.test.js',
  'scripts/check-retired-legacy-code.test.js',
  'scripts/report-frontend-ecs-mode-ownership.test.js',
  'scripts/report-frontend-ecs-bridge-shrink.test.js',
  'scripts/report-domain-business-candidates.test.js',
  'scripts/report-command-owner-step1.test.js',
  'scripts/check-frontend-ecs-core-guard.test.js',
  'scripts/check-frontend-ecs-boundary-skeleton.test.js',
  'scripts/check-frontend-ecs-source-layout.test.js',
  'scripts/check-frontend-ecs-mode-ownership-spine.test.js',
  'scripts/check-frontend-ecs-input-intent-spine.test.js',
  'scripts/check-frontend-ecs-blocking-panel-mirror-retirement.test.js',
  'scripts/check-duplicate-shared-helpers.test.js',
  'scripts/check-duplicate-coord-helpers.test.js',
  'scripts/check-duplicate-march-builders.test.js',
  'scripts/build-config-tables.test.js',
  'scripts/check-tutorial-advance-single-source.test.js',
  'scripts/check-tutorial-step-contract.test.js',
  'shared/tutorialFlowConfig.test.js',
  'scripts/check-source-encoding.test.js',
  'scripts/check-renderer-host-bridge-retired.test.js',
  'scripts/check-frontend-single-source-redline.test.js',
  'scripts/check-frontend-ecs-mode-vocab.test.js',
  'scripts/check-frontend-ecs-runtime-bundle-fresh.test.js',
  'scripts/check-frontend-ecs-renderer-snapshot-boundary.test.js',
  'scripts/check-frontend-ecs-naming-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-rewardreveal-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-event-mirror-retirement.test.js',
  'scripts/check-frontend-ecs-target-picker-mirror-retirement.test.js',
  'scripts/check-frontend-platform-boundary.test.js',
  'scripts/rewrite-frontend-asset-version.test.js',
  'scripts/check-shell-scripts.test.js',
  'scripts/validate-config-pipeline.test.js',
  'scripts/check-client-command-block-reasons.test.js',
]);

const CONTRACT_SEARCH_DIRS = Object.freeze([
  'frontend',
  'backend',
  'scripts',
]);

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function isContractTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const name = path.basename(normalized).toLowerCase();
  return name.endsWith('.contract.test.js') || name.endsWith('contract.test.js');
}

function collectFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, files);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function discoverContractTests(repoRoot = process.cwd()) {
  return CONTRACT_SEARCH_DIRS
    .flatMap((dir) => collectFiles(path.join(repoRoot, dir), []))
    .filter(isContractTestFile)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .sort();
}

function uniqueFiles(files) {
  return Array.from(new Set(files));
}

function run(label, command, args) {
  console.log(`[architecture-smoke] ${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

function hasGitWorkTree(cwd = process.cwd()) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function runGitDiffCheck(cwd = process.cwd()) {
  if (!hasGitWorkTree(cwd)) {
    console.log('[architecture-smoke] git diff --check skipped (no git worktree)');
    return;
  }
  run('git diff --check', 'git', ['diff', '--check']);
}

function main() {
  CHECK_FILES.forEach((file) => {
    run(`node --check ${file}`, process.execPath, ['--check', file]);
  });

  const testFiles = uniqueFiles([
    ...TEST_FILES,
    ...discoverContractTests(),
  ]);

  run('focused node tests', process.execPath, ['--test', ...testFiles]);
  run('client command block reason guard', process.execPath, [
    'scripts/check-client-command-block-reasons.js',
  ]);
  run('repository hygiene guard', process.execPath, ['scripts/check-repository-hygiene.js']);
  run('retired legacy code guard', process.execPath, ['scripts/check-retired-legacy-code.js']);
  run('frontend ECS core blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-core-guard.js',
  ]);
  run('frontend ECS boundary skeleton blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-boundary-skeleton.js',
  ]);
  run('frontend ECS source layout blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-source-layout.js',
  ]);
  run('frontend ECS mode ownership spine blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-mode-ownership-spine.js',
  ]);
  run('frontend ECS input intent spine blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-input-intent-spine.js',
  ]);
  run('frontend ECS blockingPanel mirror retirement blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-blocking-panel-mirror-retirement.js',
  ]);
  run('frontend locale lazy-resolution blocking guard', process.execPath, [
    'scripts/check-frontend-locale-lazy-resolution.js',
  ]);
  run('frontend locale key coverage blocking guard', process.execPath, [
    'scripts/check-frontend-locale-key-coverage.js',
  ]);
  run('duplicate shared helpers blocking guard', process.execPath, [
    'scripts/check-duplicate-shared-helpers.js',
  ]);
  run('duplicate coord helpers blocking guard', process.execPath, [
    'scripts/check-duplicate-coord-helpers.js',
  ]);
  run('duplicate march builders blocking guard', process.execPath, [
    'scripts/check-duplicate-march-builders.js',
  ]);
  run('tutorial advance single-source blocking guard', process.execPath, [
    'scripts/check-tutorial-advance-single-source.js',
  ]);
  run('tutorial step contract blocking guard', process.execPath, [
    'scripts/check-tutorial-step-contract.js',
  ]);
  run('source encoding blocking guard', process.execPath, [
    'scripts/check-source-encoding.js',
  ]);
  run('renderer host-bridge retired blocking guard', process.execPath, [
    'scripts/check-renderer-host-bridge-retired.js',
  ]);
  run('frontend ECS mode vocab blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-mode-vocab.js',
  ]);
  run('frontend ECS runtime bundle freshness guard', process.execPath, [
    'scripts/check-frontend-ecs-runtime-bundle-fresh.js',
  ]);
  run('frontend ECS renderer snapshot boundary blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-renderer-snapshot-boundary.js',
  ]);
  run('frontend ECS fog owner blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-fog-owner.js',
  ]);
  run('frontend single-source redline blocking guard', process.execPath, [
    'scripts/check-frontend-single-source-redline.js',
  ]);
  run('frontend ECS naming mirror retirement blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-naming-mirror-retirement.js',
  ]);
  run('frontend ECS confirmDialog mirror retirement blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-confirm-dialog-mirror-retirement.js',
  ]);
  run('frontend ECS rewardReveal mirror retirement blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-rewardreveal-mirror-retirement.js',
  ]);
  run('frontend ECS event mirror retirement blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-event-mirror-retirement.js',
  ]);
  run('frontend ECS targetPicker mirror retirement blocking guard', process.execPath, [
    'scripts/check-frontend-ecs-target-picker-mirror-retirement.js',
  ]);
  run('frontend platform boundary blocking-growth guard', process.execPath, [
    'scripts/check-frontend-platform-boundary.js',
  ]);
  run('frontend ECS mode ownership report-only guard', process.execPath, [
    'scripts/report-frontend-ecs-mode-ownership.js',
    '--summary',
  ]);
  run('frontend ECS bridge shrink blocking guard', process.execPath, [
    'scripts/report-frontend-ecs-bridge-shrink.js',
    '--summary',
  ]);
  run('domain business candidate report-only guard', process.execPath, [
    'scripts/report-domain-business-candidates.js',
    '--summary',
  ]);
  run('command owner Step1 report-only guard', process.execPath, [
    'scripts/report-command-owner-step1.js',
    '--summary',
  ]);
  run('frontend ECS renderer authority report-only guard', process.execPath, [
    'scripts/report-frontend-ecs-renderer-authority.js',
    '--summary',
  ]);
  run('frontend ECS input branch report-only guard', process.execPath, [
    'scripts/report-frontend-ecs-input-branch.js',
    '--summary',
  ]);
  run('frontend ECS literal duplicate report-only guard', process.execPath, [
    'scripts/report-frontend-ecs-literal-duplicate.js',
    '--summary',
  ]);
  run('backend security audit guard', process.execPath, ['scripts/check-backend-security-audit.js']);
  run('frontend script manifest guard', process.execPath, ['scripts/check-frontend-script-manifest.js']);
  run('shell script syntax guard', process.execPath, ['scripts/check-shell-scripts.js']);
  run('config pipeline validation guard', process.execPath, [
    'scripts/validate-config-pipeline.js',
    '--baseline',
    'docs/config_registry_snapshot_2026-06-11.json',
  ]);
  run('config tables freshness guard', process.execPath, [
    'scripts/build-config-tables.js',
    '--check',
  ]);
  runGitDiffCheck();

  console.log('[architecture-smoke] passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  CHECK_FILES,
  TEST_FILES,
  discoverContractTests,
  hasGitWorkTree,
  isContractTestFile,
  runGitDiffCheck,
  uniqueFiles,
};

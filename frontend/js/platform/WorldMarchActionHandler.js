// WorldMarchActionHandler owns the world-march action cluster (target select,
// formation picker, HUD, actor select, start/return/stop march, deployment
// eligibility dialogs) extracted from CanvasActionController in slice 11 of the
// god-file re-decomposition. SHAPE: plain class composed by CanvasActionController
// in its constructor; `core` is the controller (dispatch, finalize/runAction,
// refreshWorldMarchLayer, shared territory ui-state), `helpers` are the
// controller-module helpers that are also used by code that stayed behind.
// Method and helper bodies are verbatim relocations.
(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const TileCoord = (() => {
    if (global.TileCoord) return global.TileCoord;
    try {
      if (typeof require === 'function') return require('../ecs/foundation/TileCoord');
    } catch (_error) {
      // Optional dependency in browser bundles.
    }
    return null;
  })();
  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    try {
      if (typeof require === 'function') return require('./CanvasModalSnapshotAdapter');
    } catch (_error) {
      // Optional adapter in standalone action tests.
    }
    return null;
  })();
  const FormationDeploymentEligibility = (() => {
    if (global.FormationDeploymentEligibility) return global.FormationDeploymentEligibility;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../shared/FormationDeploymentEligibilityAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function openTargetPickerSnapshot(host, payload) {
    if (typeof host?.openTargetPickerSnapshot === 'function') {
      return host.openTargetPickerSnapshot(payload);
    }
    return CanvasModalSnapshotAdapter?.openTargetPickerSnapshot?.(host, payload) || null;
  }

  function openConfirmDialogSnapshot(host, payload = {}, callbacks = null) {
    if (typeof host?.openConfirmDialogSnapshot === 'function') {
      return host.openConfirmDialogSnapshot(payload, callbacks);
    }
    return (
      CanvasModalSnapshotAdapter?.openConfirmDialogSnapshot?.(host, payload, callbacks) || null
    );
  }

  function closeConfirmDialogSnapshot(host) {
    if (typeof host?.closeConfirmDialogSnapshot === 'function')
      return host.closeConfirmDialogSnapshot();
    return CanvasModalSnapshotAdapter?.closeConfirmDialogSnapshot?.(host) || null;
  }

  function normalizeWorldMarchTarget(action = {}) {
    const q = Math.floor(Number(action.targetQ ?? action.q));
    const r = Math.floor(Number(action.targetR ?? action.r));
    if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
    const coord = TileCoord?.normalizeCoord?.({ x: q, y: r }) || { q, r, tileId: `${q},${r}` };
    return {
      q: coord.q,
      r: coord.r,
      tileId: coord.tileId,
    };
  }

  function getCombatEncounterId(action = {}, previousTarget = {}) {
    return String(
      action.combatEncounterId ||
        action.encounterId ||
        action.combatTarget?.encounterId ||
        previousTarget.combatEncounterId ||
        previousTarget.encounterId ||
        previousTarget.combatTarget?.encounterId ||
        '',
    ).trim();
  }

  function getMarchMissionId(action = {}, previousTarget = {}, uiState = {}) {
    return String(
      action.missionId || previousTarget.missionId || uiState.selectedWorldMissionId || '',
    ).trim();
  }

  function getWorldActorId(action = {}, previousTarget = {}, uiState = {}) {
    return String(
      action.actorId || previousTarget.actorId || uiState.selectedWorldActorId || '',
    ).trim();
  }

  function assignMarchMissionTarget(target = {}, missionId = '', actorId = '') {
    if (!missionId) return target;
    target.missionId = missionId;
    if (actorId) target.actorId = actorId;
    return target;
  }

  function clonePlain(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clonePlain);
    const output = {};
    Object.entries(value).forEach(([key, next]) => {
      if (typeof next !== 'function') output[key] = clonePlain(next);
    });
    return output;
  }

  function copyCombatTargetFields(nextTarget = {}, action = {}, previousTarget = {}) {
    const encounterId = getCombatEncounterId(action, previousTarget);
    if (encounterId) nextTarget.combatEncounterId = encounterId;
    const combatTarget = action.combatTarget || previousTarget.combatTarget || null;
    if (combatTarget && typeof combatTarget === 'object')
      nextTarget.combatTarget = clonePlain(combatTarget);
    return nextTarget;
  }

  function publishWorldMarchUiChanged(core, source = 'WorldMarchActionHandler') {
    return core?.emitGameEvent?.('worldMarchUiChanged', { source }) || null;
  }

  function joinNames(names = []) {
    return (Array.isArray(names) ? names : [])
      .map((name) => String(name || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  function formatDeploymentWarning(warning = {}) {
    return t(warning.messageKey || 'world.march.deploy.warning', {
      name: warning.names?.[0] || warning.participants?.[0]?.name || '',
      names: joinNames(
        warning.names || warning.participants?.map((participant) => participant.name),
      ),
    });
  }

  class WorldMarchActionHandler {
    constructor(options = {}) {
      this.core = options.core || null;
      this.helpers = options.helpers || {};
    }

    publishWorldMarchUiChanged(source) {
      return publishWorldMarchUiChanged(this.core, source);
    }

    getWorldMarchDeploymentEligibility(action = {}) {
      if (action.deploymentEligibility && typeof action.deploymentEligibility === 'object') {
        return action.deploymentEligibility;
      }
      const formation = this.core.getWorldMarchFormationForAction(action);
      if (!formation) {
        return {
          allowed: true,
          blocked: false,
          blockers: [],
          warnings: [],
        };
      }
      return (
        FormationDeploymentEligibility?.evaluateFormationDeployment?.(formation) || {
          allowed: true,
          blocked: false,
          blockers: [],
          warnings: [],
        }
      );
    }

    openWorldMarchDeploymentWarning(eligibility = {}, action = {}) {
      const warning = eligibility.warnings?.[0] || {};
      const message = formatDeploymentWarning(warning);
      const pendingAction = clonePlain({
        ...action,
        skipDeploymentWarnings: true,
        deploymentEligibility: undefined,
      });
      const game = this.core.getGameHost();
      const uiHost = this.core.host?.openConfirmDialog ? this.core.host : game?.canvasShell || game;
      if (typeof uiHost?.openConfirmDialog === 'function') {
        uiHost.openConfirmDialog({
          kind: 'worldMarchDeploymentWarning',
          source: 'worldMarch',
          title: t('world.march.deploy.confirmTitle'),
          message,
          confirmLabel: t('world.march.deploy.confirmDeploy'),
          cancelLabel: t('common.cancel'),
          confirmAction: {
            type: 'confirmWorldMarchDeployment',
            action: pendingAction,
          },
        });
        return true;
      }
      const opened = openConfirmDialogSnapshot(this.core.host, {
        visible: true,
        kind: 'worldMarchDeploymentWarning',
        source: 'worldMarch',
        title: t('world.march.deploy.confirmTitle'),
        message,
        confirmLabel: t('world.march.deploy.confirmDeploy'),
        cancelLabel: t('common.cancel'),
        confirmAction: {
          type: 'confirmWorldMarchDeployment',
          action: pendingAction,
        },
      });
      this.core.refreshWorldMarchLayer(action);
      return Boolean(opened);
    }

    confirmDeployment(action, meta = {}) {
      const game = this.core.getGameHost();
      this.core.host?.closeConfirmDialog?.();
      closeConfirmDialogSnapshot(this.core.host);
      game?.canvasShell?.closeConfirmDialog?.();
      closeConfirmDialogSnapshot(game?.canvasShell);
      game?.closeConfirmDialog?.();
      closeConfirmDialogSnapshot(game);
      const pendingAction = action.action || action.pendingAction || null;
      if (!pendingAction?.type) return false;
      return this.startMarch(
        {
          ...pendingAction,
          skipDeploymentWarnings: true,
        },
        meta,
      );
    }

    selectTarget(action) {
      const target = normalizeWorldMarchTarget(action);
      const tapTraceId =
        this.core.getActionTapTraceId?.(action) || global.__actorPickingDiagActiveTapTraceId || '';
      if (!target) {
        this.helpers.logActorPickingDiag('territory:selectWorldMarchTarget:invalidTarget', {
          tapTraceId,
          action: this.helpers.summarizeActorPickingAction(action),
        });
        return false;
      }
      const uiState = this.core.getSharedTerritoryUiState();
      const combatEncounterId = getCombatEncounterId(action);
      const missionId = combatEncounterId ? '' : getMarchMissionId(action, {}, uiState);
      const actorId = missionId ? getWorldActorId(action, {}, uiState) : '';
      const game = this.core.getGameHost();
      game?.territoryController?.closeSiteDialog?.({ render: false });
      this.helpers.logActorPickingDiag('territory:selectWorldMarchTarget:beforeWrite', {
        tapTraceId,
        action: this.helpers.summarizeActorPickingAction(action),
        target,
        uiState: this.helpers.summarizeActorPickingUiState(uiState),
      });
      const nextTarget = {
        q: target.q,
        r: target.r,
        tileId: target.tileId,
      };
      assignMarchMissionTarget(nextTarget, missionId, actorId);
      if (action.known !== undefined) nextTarget.known = Boolean(action.known);
      if (action.terrain) nextTarget.terrain = action.terrain;
      if (action.terrainLabel) nextTarget.terrainLabel = action.terrainLabel;
      if (action.marchDisabled !== undefined)
        nextTarget.marchDisabled = Boolean(action.marchDisabled);
      if (action.marchDisabledReason) nextTarget.marchDisabledReason = action.marchDisabledReason;
      copyCombatTargetFields(nextTarget, action);
      uiState.worldMarchTarget = nextTarget;
      uiState.selectedWorldActorId = '';
      uiState.selectedWorldMissionId = '';
      uiState.selectedSiteId = '';
      this.helpers.closeTargetPickerSnapshot(this.core.host);
      uiState.expeditionConfigSiteId = '';
      this.helpers.logActorPickingDiag('territory:selectWorldMarchTarget:afterWrite', {
        tapTraceId,
        action: this.helpers.summarizeActorPickingAction(action),
        target,
        uiState: this.helpers.summarizeActorPickingUiState(uiState),
      });
      this.core.refreshWorldMarchLayer(action);
      this.core.emitGameEvent?.('worldMarchTargetSelected', { target: nextTarget });
      this.publishWorldMarchUiChanged('selectWorldMarchTarget');
      return true;
    }

    openFormationPicker(action) {
      const target = normalizeWorldMarchTarget(action);
      if (!target) return false;
      const uiState = this.core.getSharedTerritoryUiState();
      const previousTarget = uiState.worldMarchTarget || {};
      const combatEncounterId = getCombatEncounterId(action, previousTarget);
      const missionId = combatEncounterId ? '' : getMarchMissionId(action, previousTarget, uiState);
      const actorId = missionId ? getWorldActorId(action, previousTarget, uiState) : '';
      const samePreviousTarget =
        Number(previousTarget.q) === Number(target.q) &&
        Number(previousTarget.r) === Number(target.r);
      const nextTarget = {
        q: target.q,
        r: target.r,
        tileId: target.tileId,
      };
      assignMarchMissionTarget(nextTarget, missionId, actorId);
      if (action.known !== undefined) nextTarget.known = Boolean(action.known);
      else if (previousTarget.known !== undefined) nextTarget.known = Boolean(previousTarget.known);
      if (action.terrain || previousTarget.terrain)
        nextTarget.terrain = action.terrain || previousTarget.terrain;
      if (action.terrainLabel || previousTarget.terrainLabel)
        nextTarget.terrainLabel = action.terrainLabel || previousTarget.terrainLabel;
      if (action.marchDisabled !== undefined)
        nextTarget.marchDisabled = Boolean(action.marchDisabled);
      else if (samePreviousTarget && previousTarget.marchDisabled !== undefined)
        nextTarget.marchDisabled = Boolean(previousTarget.marchDisabled);
      if (action.marchDisabledReason || (samePreviousTarget && previousTarget.marchDisabledReason))
        nextTarget.marchDisabledReason =
          action.marchDisabledReason || previousTarget.marchDisabledReason;
      copyCombatTargetFields(nextTarget, action, previousTarget);
      uiState.worldMarchTarget = nextTarget;
      openTargetPickerSnapshot(this.core.host, {
        pickerKind: 'worldMarchFormation',
        target: nextTarget,
      });
      uiState.selectedWorldActorId = '';
      uiState.selectedWorldMissionId = '';
      const handled = this.core.refreshWorldMarchLayer(action);
      this.publishWorldMarchUiChanged('openWorldMarchFormationPicker');
      return handled;
    }

    closeHud(action) {
      const uiState = this.core.getSharedTerritoryUiState();
      this.helpers.closeTargetPickerSnapshot(this.core.host);
      uiState.worldMarchTarget = null;
      uiState.selectedWorldActorId = '';
      uiState.selectedWorldMissionId = '';
      const handled = this.core.refreshWorldMarchLayer(action);
      this.publishWorldMarchUiChanged('closeWorldMarchHud');
      return handled;
    }

    selectActor(action) {
      const actorId = action.actorId || action.missionId || '';
      const missionId = action.missionId || '';
      const tapTraceId =
        this.core.getActionTapTraceId?.(action) || global.__actorPickingDiagActiveTapTraceId || '';
      if (!actorId) {
        this.helpers.logActorPickingDiag('territory:selectWorldActor:missingActorId', {
          tapTraceId,
          action: this.helpers.summarizeActorPickingAction(action),
        });
        return false;
      }
      const uiState = this.core.getSharedTerritoryUiState();
      this.helpers.logActorPickingDiag('territory:selectWorldActor:beforeWrite', {
        tapTraceId,
        action: this.helpers.summarizeActorPickingAction(action),
        actorId,
        uiState: this.helpers.summarizeActorPickingUiState(uiState),
      });
      uiState.selectedWorldActorId = actorId;
      uiState.selectedWorldMissionId = missionId;
      uiState.worldMarchTarget = null;
      uiState.selectedSiteId = '';
      this.helpers.closeTargetPickerSnapshot(this.core.host);
      this.helpers.logActorPickingDiag('territory:selectWorldActor:afterWrite', {
        tapTraceId,
        action: this.helpers.summarizeActorPickingAction(action),
        actorId,
        uiState: this.helpers.summarizeActorPickingUiState(uiState),
      });
      const handled = this.core.refreshWorldMarchLayer(action);
      this.helpers.logActorPickingDiag('territory:selectWorldActor:afterRefresh', {
        tapTraceId,
        action: this.helpers.summarizeActorPickingAction(action),
        actorId,
        handled: handled !== false,
        uiState: this.helpers.summarizeActorPickingUiState(uiState),
      });
      this.publishWorldMarchUiChanged('selectWorldActor');
      return handled;
    }

    startMarch(action, meta = {}) {
      const target = normalizeWorldMarchTarget(action);
      if (!target) return false;
      const deploymentEligibility = this.getWorldMarchDeploymentEligibility(action);
      if (
        !action.skipDeploymentWarnings &&
        Array.isArray(deploymentEligibility.warnings) &&
        deploymentEligibility.warnings.length > 0
      ) {
        return this.openWorldMarchDeploymentWarning(deploymentEligibility, action);
      }
      const uiState = this.core.getSharedTerritoryUiState();
      const previousTarget = uiState.worldMarchTarget || {};
      const combatEncounterId = getCombatEncounterId(action, previousTarget);
      const missionId = combatEncounterId ? '' : getMarchMissionId(action, previousTarget, uiState);
      const run = () => {
        const game = this.core.getGameHost();
        const options = {
          mode: 'manual',
          targetQ: target.q,
          targetR: target.r,
          formationSlot: action.formationSlot || action.slot || 1,
          cityId: action.cityId || game?.state?.activeCityId || 'capital',
        };
        if (missionId) options.missionId = missionId;
        if (combatEncounterId) options.combatEncounterId = combatEncounterId;
        if (meta.inputIntent) options.clientInputIntent = meta.inputIntent;
        // Attacking a hostile force means MARCHING the formation to its tile — the
        // battle resolves on arrival (or immediately if the formation is already
        // standing on it). We never open a battle from afar; the backend session
        // service also refuses out-of-range attacks (WORLD_COMBAT_NOT_IN_RANGE).
        if (typeof game?.startWorldMarch === 'function') return game.startWorldMarch(options);
        return this.core.runAction(() => this.core.host.api.startWorldMarch(options));
      };
      const result = run();
      if (result !== false) {
        this.helpers.closeTargetPickerSnapshot(this.core.host);
        uiState.worldMarchTarget = null;
        uiState.selectedWorldActorId = '';
        uiState.selectedWorldMissionId = '';
        this.core.refreshWorldMarchLayer(action);
        this.publishWorldMarchUiChanged('startWorldMarch');
      }
      return this.core.finalize(Promise.resolve(result).then((value) => value !== false));
    }

    returnMarch(action, meta = {}) {
      const missionId = action.missionId || action.actorId || '';
      if (!missionId) return false;
      const game = this.core.getGameHost();
      const options = meta.inputIntent ? { clientInputIntent: meta.inputIntent } : {};
      const run = () => {
        if (typeof game?.returnWorldMarch === 'function')
          return game.returnWorldMarch(missionId, options);
        return this.core.runAction(() => this.core.host.api.returnWorldMarch(missionId, options));
      };
      const result = run();
      if (result !== false) {
        this.core.getSharedTerritoryUiState().selectedWorldActorId = '';
        this.core.getSharedTerritoryUiState().selectedWorldMissionId = '';
        this.helpers.closeTargetPickerSnapshot(this.core.host);
        this.core.refreshWorldMarchLayer(action);
        this.publishWorldMarchUiChanged('returnWorldMarch');
      }
      return this.core.finalize(Promise.resolve(result).then((value) => value !== false));
    }

    stopMarch(action, meta = {}) {
      const missionId = action.missionId || action.actorId || '';
      if (!missionId) return false;
      const game = this.core.getGameHost();
      const options = meta.inputIntent ? { clientInputIntent: meta.inputIntent } : {};
      const run = () => {
        if (typeof game?.stopWorldMarch === 'function')
          return game.stopWorldMarch(missionId, options);
        return this.core.runAction(() => this.core.host.api.stopWorldMarch(missionId, options));
      };
      return this.core.finalize(
        Promise.resolve(run()).then((result) => {
          if (result !== false) {
            this.core.getSharedTerritoryUiState().selectedWorldActorId = '';
            this.core.getSharedTerritoryUiState().selectedWorldMissionId = '';
            this.helpers.closeTargetPickerSnapshot(this.core.host);
            this.core.refreshWorldMarchLayer(action);
            this.publishWorldMarchUiChanged('stopWorldMarch');
          }
          return result !== false;
        }),
      );
    }
  }

  // Shared with TargetPickerActionHandler (and only that module) so each helper
  // body exists in exactly one file.
  WorldMarchActionHandler.t = t;
  WorldMarchActionHandler.clonePlain = clonePlain;
  WorldMarchActionHandler.openTargetPickerSnapshot = openTargetPickerSnapshot;
  WorldMarchActionHandler.publishWorldMarchUiChanged = publishWorldMarchUiChanged;

  global.WorldMarchActionHandler = WorldMarchActionHandler;
  if (typeof module !== 'undefined' && module.exports) module.exports = WorldMarchActionHandler;
})(typeof globalThis !== 'undefined' ? globalThis : window);

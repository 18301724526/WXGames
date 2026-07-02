(function (global) {
  const TutorialFlowShared = (() => {
    if (global.TutorialFlowShared) return global.TutorialFlowShared;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../../shared/tutorialFlowConfig');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const TutorialGuideStepPolicy = (() => {
    if (global.TutorialGuideStepPolicy) return global.TutorialGuideStepPolicy;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./TutorialGuideStepPolicy');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

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

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  const CanvasModalSnapshotAdapter = (() => {
    if (global.CanvasModalSnapshotAdapter) return global.CanvasModalSnapshotAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/CanvasModalSnapshotAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  var StateWriter = global.StateWriter;
  if (typeof module !== 'undefined' && module.exports && !StateWriter) {
    StateWriter = require('../state/StateWriter');
  }

  function getStep(host) {
    return TutorialFlowShared.stepName(host?.getCurrentStep?.()) || 'initial';
  }

  function getSteps(host, fallback = {}) {
    return (
      host?.constructor?.TUTORIAL_STEPS || TutorialGuideStepPolicy?.TUTORIAL_STEPS || fallback || {}
    );
  }

  function stepEquals(a, b) {
    return TutorialFlowShared.stepEquals(a, b);
  }

  function syncFromResult(host, payload = {}) {
    if (
      payload &&
      typeof payload === 'object' &&
      ('tutorial' in payload || 'gameState' in payload)
    ) {
      host.sync?.(
        payload.tutorial || payload.gameState?.tutorial || host.game?.tutorial || host.state,
      );
    }
    return host.state;
  }

  async function advanceIf(host, condition, nextStep) {
    if (!condition(host)) return host.state;
    return host.advanceTo?.(nextStep) || host.state;
  }

  function createDefaultHandlers(steps = {}) {
    return {
      tabClicked: async (host, payload = {}) => {
        const tabId = payload.tabId || payload.panelId || payload.tab || '';
        if (!host.canOpenTab?.(tabId)) return false;
        if (tabId === 'buildings' && stepEquals(getStep(host), steps.cityEntered)) {
          await host.advanceTo?.(steps.houseGuideReady);
        }
        if (tabId === 'civilization' && stepEquals(getStep(host), steps.houseBuilt)) {
          await host.advanceTo?.(steps.civilizationTabOpened);
        }
        return true;
      },

      commandPanelOpened: async (host, payload = {}) => {
        const tabId =
          host.normalizePanelTab?.(payload.panelId || payload.tabId || payload.panel || '') || '';
        const allowed = await host.handleEvent?.('tabClicked', { tabId });
        if (allowed === false) return false;
        if (tabId === 'events' && stepEquals(getStep(host), steps.eraAdvancedTo2)) {
          await host.advanceTo?.(steps.specialEventTabOpened);
        }
        if (tabId === 'buildings' && stepEquals(getStep(host), steps.specialEventClaimed)) {
          await host.advanceTo?.(steps.buildingsTabOpenedForLumbermill);
        }
        if (tabId === 'buildings' && stepEquals(getStep(host), steps.barracksSuppliesClaimed)) {
          await host.advanceTo?.(steps.buildingsTabOpenedForBarracks);
        }
        if (tabId === 'tech' && stepEquals(getStep(host), steps.famousSeekCompleted)) {
          await host.advanceTo?.(steps.finalTechOpened);
        }
        if (allowed !== false) host.refreshCurrentHighlight?.();
        return allowed;
      },

      cityEntered: async (host) => {
        if (host.isCompleted?.()) return host.state;
        // houseGuideReady is no longer auto-advanced here: it is reached by
        // claiming the homestead-supplies task (TASK_CLAIM_STEPS).
        if (TutorialFlowShared.stepBefore(getStep(host), steps.cityEntered)) {
          return host.advanceTo?.(steps.cityEntered) || host.state;
        }
        return host.state;
      },

      buildingAction: (host, payload = {}) => {
        const buildingId = payload.buildingId || '';
        const action = payload.action || 'build';
        if (host.isFarmGuideActive?.()) return action === 'build' && buildingId === 'farm';
        if (host.isLumbermillGuideActive?.())
          return action === 'build' && buildingId === 'lumbermill';
        if (!host.isHouseGuideActive?.()) return true;
        return action === 'build' && buildingId === 'house';
      },

      eraAdvanced: (host, payload = {}) => {
        syncFromResult(host, payload.result || payload);
        const step = getStep(host);
        if (stepEquals(step, steps.era3Advanced)) {
          // Era 3 lands on the barracks segment: the next beat is claiming the
          // barracks supplies from the task center.
          return (
            host.showSoftGuide?.(
              'task-center-button',
              t('tutorial.softGuide.claimBarracksSupplies'),
            ) || false
          );
        }
        if (
          TutorialFlowShared.stepAtLeast(step, steps.scoutFamousGranted) &&
          TutorialFlowShared.stepBefore(step, steps.scoutFormationSaved)
        ) {
          return (
            host.showSoftGuide?.(
              'famous-persons-button',
              '\u57ce\u90a6\u7684\u9053\u8def\u5df2\u7ecf\u6253\u5f00\uff0c\u4e00\u4f4d\u5584\u4e8e\u4fa6\u5bdf\u7684\u540d\u4eba\u52a0\u5165\u4e86\u6211\u4eec\u3002\u5148\u53bb\u540d\u4eba\u91cc\u770b\u770b\u4ed6\u7684\u5361\u7247\u3002',
            ) || false
          );
        }
        if (stepEquals(step, steps.eraAdvancedTo2)) {
          return (
            host.showSoftGuide?.(
              'events-button',
              '\u68ee\u6797\u8fb9\u7f18\u4f20\u6765\u4e86\u52a8\u9759\u3002\u5148\u53bb\u4e8b\u4ef6\u91cc\u770b\u4e00\u770b\uff0c\u628a\u6728\u6750\u5e26\u56de\u6765\u3002',
            ) || false
          );
        }
        if (!stepEquals(step, steps.eraAdvancedTo1)) return false;
        return (
          host.showSoftGuide?.('task-center-button', t('tutorial.softGuide.claimSupplies')) || false
        );
      },

      taskRewardClaimed: (host, payload = {}) => {
        syncFromResult(host, payload.result || payload);
        return TutorialFlowShared.stepAtLeast(getStep(host), steps.farmPrepReserved);
      },

      famousPersonsOpened: (host) => {
        if (stepEquals(getStep(host), steps.scoutFamousGranted)) {
          return host.advanceTo?.(steps.famousPanelOpened) || host.state;
        }
        if (stepEquals(getStep(host), steps.manualTalentAssigned)) {
          return host.advanceTo?.(steps.famousSeekOpened) || host.state;
        }
        return host.state;
      },

      talentPolicyOpened: async (host) => {
        if (stepEquals(getStep(host), steps.polityNamed)) {
          await host.advanceTo?.(steps.talentPolicyOpened);
        }
        if (stepEquals(getStep(host), steps.talentPolicyOpened)) {
          return await (host.advanceTo?.(steps.talentPolicyApplied) || host.state);
        }
        return host.state;
      },

      tutorialStateChanged: (host, payload = {}) => {
        syncFromResult(host, payload.result || payload);
        host.refreshCurrentHighlight?.();
        return host.state;
      },

      famousPersonDetailOpened: (host, payload = {}) => {
        const personId = payload.personId || '';
        const scoutPersonId = host.getScoutFamousPersonId?.() || '';
        if (
          stepEquals(getStep(host), steps.famousPanelOpened) &&
          (!scoutPersonId || String(personId || '') === scoutPersonId)
        ) {
          return host.advanceTo?.(steps.famousCardViewed) || host.state;
        }
        return host.state;
      },

      armyFormationOpened: (host) =>
        advanceIf(
          host,
          () => stepEquals(getStep(host), steps.famousCardViewed),
          steps.formationPanelOpened,
        ),

      armyFormationSaved: (host, payload = {}) => {
        syncFromResult(host, payload.result || payload);
        const step = getStep(host);
        if (
          stepEquals(step, steps.scoutFormationSaved) ||
          stepEquals(step, steps.scoutWorldPanelOpened)
        ) {
          host.closeArmyFormationEditorEverywhere?.();
          host.ensureMapHomeGuideVisible?.({ clearWorldMarchTarget: true });
          host.refreshCurrentHighlight?.();
          return true;
        }
        host.closeArmyFormationEditorEverywhere?.();
        host.refreshCurrentHighlight?.();
        return false;
      },

      militaryViewSwitched: (host, payload = {}) => {
        const view = payload.view || '';
        return advanceIf(
          host,
          () => view === 'world' && stepEquals(getStep(host), steps.scoutFormationSaved),
          steps.scoutWorldPanelOpened,
        );
      },

      famousPersonsClosed: (host) => {
        const game = host.game || {};
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'showFamousPersons');
        game.famousPersonsPage = 0;
        game.selectedFamousPersonId = '';
        host.refreshCurrentHighlight?.();
        return host.state;
      },

      cityManagementOpened: (host, payload = {}) => {
        const tab = payload.tab || payload.tabId || '';
        if (tab === 'people') {
          return host.handleEvent?.('talentPolicyOpened') || host.state;
        }
        host.refreshCurrentHighlight?.();
        return host.state;
      },

      worldMarchTargetSelected: (host) =>
        advanceIf(
          host,
          () => stepEquals(getStep(host), steps.scoutFormationSaved),
          steps.scoutWorldPanelOpened,
        ),

      exploreStarted: (host, payload = {}) => {
        syncFromResult(host, payload.result || payload);
        host.refreshCurrentHighlight?.();
        return host.state;
      },

      advisorClosed: async (host) => {
        const game = host.game || {};
        CanvasModalSnapshotAdapter.closeBlockingPanelSnapshot(game, 'showAdvisor');
        game.tutorialAdvisorDialogue = null;
        if (game.canvasShell) {
          game.canvasShell.tutorialAdvisorDialogue = null;
        }
        if (!stepEquals(getStep(host), steps.finalTechOpened)) {
          host.refreshCurrentHighlight?.();
          return host.state;
        }
        game.canvasShell?.hideTutorialHighlight?.();
        StateWriter.commit(
          game,
          (prev) => ({
            ...(prev || {}),
            softGuide: null,
          }),
          { source: 'tutorialEvent:advisorClosed' },
        );
        const result = await host.advanceTo?.(steps.completed);
        host.refreshCurrentHighlight?.();
        return result;
      },
    };
  }

  class TutorialGuideEventRegistry {
    constructor(options = {}) {
      this.steps = options.steps || TutorialGuideStepPolicy?.TUTORIAL_STEPS || {};
      this.handlers = options.handlers || createDefaultHandlers(this.steps);
    }

    handle(host, eventName, payload = {}) {
      const steps = getSteps(host, this.steps);
      if (steps !== this.steps) {
        this.steps = steps;
        this.handlers = createDefaultHandlers(steps);
      }
      return this.handlers[eventName]?.(host, payload);
    }
  }

  function create(options = {}) {
    return new TutorialGuideEventRegistry(options);
  }

  const api = {
    TutorialGuideEventRegistry,
    create,
    createDefaultHandlers,
  };

  global.TutorialGuideEventRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

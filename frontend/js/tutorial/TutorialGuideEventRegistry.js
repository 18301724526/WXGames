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

  const EVENT_CONTRACTS = Object.freeze({
    tabClicked: Object.freeze([{ name: 'tabId', aliases: ['panelId', 'tab'] }]),
    commandPanelOpened: Object.freeze([{ name: 'panelId', aliases: ['tabId', 'panel'] }]),
    cityEntered: Object.freeze([]),
    buildingAction: Object.freeze([
      { name: 'buildingId', aliases: [] },
      { name: 'action', aliases: [] },
    ]),
    eraAdvanced: Object.freeze([{ name: 'result', aliases: [], object: true }]),
    taskRewardClaimed: Object.freeze([{ name: 'result', aliases: [], object: true }]),
    famousPersonsOpened: Object.freeze([]),
    talentPolicyOpened: Object.freeze([]),
    tutorialStateChanged: Object.freeze([{ name: 'result', aliases: [], object: true }]),
    famousPersonDetailOpened: Object.freeze([{ name: 'personId', aliases: [] }]),
    armyFormationOpened: Object.freeze([]),
    armyFormationSaved: Object.freeze([{ name: 'result', aliases: [], object: true }]),
    militaryViewSwitched: Object.freeze([{ name: 'view', aliases: [] }]),
    famousPersonsClosed: Object.freeze([]),
    cityManagementOpened: Object.freeze([{ name: 'tab', aliases: ['tabId'] }]),
    worldMarchTargetSelected: Object.freeze([]),
    exploreStarted: Object.freeze([{ name: 'result', aliases: [], object: true }]),
    advisorClosed: Object.freeze([]),
  });
  const EVENT_NAMES = Object.freeze(Object.keys(EVENT_CONTRACTS));

  function hasOwn(payload, field) {
    return Object.prototype.hasOwnProperty.call(payload, field);
  }

  function validatePayload(eventName, payload) {
    const fields = EVENT_CONTRACTS[eventName];
    if (!fields || !payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    return fields.every((field) => {
      const candidate = [field.name, ...(field.aliases || [])].find((name) => hasOwn(payload, name));
      if (!candidate) return false;
      return !field.object || (payload[candidate] && typeof payload[candidate] === 'object');
    });
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
    if (typeof host?.syncFromResultPayload === 'function') {
      return host.syncFromResultPayload(payload);
    }
    if (
      payload &&
      typeof payload === 'object' &&
      ('tutorial' in payload || 'gameState' in payload)
    ) {
      host.sync?.(payload.tutorial || payload.gameState?.tutorial || host.state);
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
        let result = host.state;
        if (TutorialFlowShared.stepBefore(getStep(host), steps.cityEntered)) {
          result = await (host.advanceTo?.(steps.cityEntered) || host.state);
        }
        host.refreshCurrentHighlight?.();
        return result;
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
            host.showSoftGuide?.('famous-persons-button', t('tutorial.guide.scoutFamousJoined')) ||
            false
          );
        }
        if (stepEquals(step, steps.eraAdvancedTo2)) {
          return (
            host.showSoftGuide?.('events-button', t('tutorial.guide.forestEventHint')) || false
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
        if (stepEquals(getStep(host), steps.famousSeekCompleted)) {
          host.closeFamousPersonsSurface?.();
        }
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
        host.closeFamousPersonsSurface?.();
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
        host.closeAdvisorSurface?.();
        if (!stepEquals(getStep(host), steps.finalTechOpened)) {
          host.refreshCurrentHighlight?.();
          return host.state;
        }
        host.clearTutorialSoftGuide?.();
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
      if (!validatePayload(eventName, payload)) return undefined;
      const steps = getSteps(host, this.steps);
      if (steps !== this.steps) {
        this.steps = steps;
        this.handlers = createDefaultHandlers(steps);
      }
      return this.handlers[eventName]?.(host, payload);
    }

    subscribeToBus(bus, host) {
      if (!bus || typeof bus.subscribe !== 'function') return () => false;
      const unsubscribers = EVENT_NAMES.map((eventName) => (
        bus.subscribe(eventName, (payload = {}) => (
          this.handle(host, eventName, payload)
        ))
      ));
      ['state.changed', 'modal.changed'].forEach((eventName) => {
        unsubscribers.push(bus.subscribe(eventName, (change = {}) => {
          if (host?.isChangeEventRelevant?.(eventName, change) === false) return false;
          return host?.refreshCurrentHighlight?.();
        }));
      });
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        unsubscribers.forEach((unsubscribe) => unsubscribe?.());
        return true;
      };
    }
  }

  function create(options = {}) {
    return new TutorialGuideEventRegistry(options);
  }

  const api = {
    EVENT_CONTRACTS,
    EVENT_NAMES,
    TutorialGuideEventRegistry,
    create,
    createDefaultHandlers,
    validatePayload,
  };

  global.TutorialGuideEventRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

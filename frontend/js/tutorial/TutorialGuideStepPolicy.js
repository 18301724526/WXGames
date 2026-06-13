(function (global) {
  const TUTORIAL_STEPS = Object.freeze({
    initial: 0,
    tutorialStarted: 1,
    cityEntered: 2,
    houseGuideReady: 3,
    houseBuilt: 4,
    civilizationTabOpened: 5,
    eraAdvancedTo1: 6,
    buildingsTabOpened: 7,
    farmPrepReserved: 8,
    farmBuilt: 9,
    era2AdvanceReady: 10,
    eraAdvancedTo2: 11,
    specialEventTabOpened: 12,
    specialEventClaimed: 13,
    buildingsTabOpenedForLumbermill: 14,
    lumbermillBuilt: 15,
    era3AdvanceReady: 16,
    era3Advanced: 17,
    scoutFamousGranted: 18,
    famousPanelOpened: 19,
    famousCardViewed: 20,
    formationPanelOpened: 21,
    scoutFormationSaved: 22,
    scoutWorldPanelOpened: 23,
    scoutExploreStarted: 24,
    firstCityDiscovered: 25,
    firstCityConquestStarted: 26,
    firstCityOccupied: 27,
    firstCityNamed: 28,
    polityNamed: 29,
    talentPolicyOpened: 30,
    talentPolicyApplied: 31,
    manualTalentAssigned: 32,
    famousSeekOpened: 33,
    famousSeekCompleted: 34,
    finalTechOpened: 35,
    completed: 36,
  });

  function normalizeStep(step) {
    const value = Number(step);
    return Number.isFinite(value) ? value : 0;
  }

  function isGuideRangeActive(step, completed, startStep, endStep, options = {}) {
    if (completed) return false;
    const current = normalizeStep(step);
    const start = normalizeStep(startStep);
    const end = normalizeStep(endStep);
    const includeEnd = options.includeEnd === true;
    return current >= start && (includeEnd ? current <= end : current < end);
  }

  function canOpenTab(tabId, context = {}) {
    if (context.completed) return true;
    const step = normalizeStep(context.step);
    if (step < TUTORIAL_STEPS.houseBuilt) return ['resources', 'military', 'buildings'].includes(tabId);
    if (step < TUTORIAL_STEPS.eraAdvancedTo1) return ['resources', 'military', 'buildings', 'civilization'].includes(tabId);
    if (step <= TUTORIAL_STEPS.farmBuilt) return ['buildings', 'civilization', 'tasks'].includes(tabId);
    if (step === TUTORIAL_STEPS.era2AdvanceReady) return tabId === 'civilization';
    if (step < TUTORIAL_STEPS.specialEventClaimed) return ['civilization', 'events'].includes(tabId);
    if (step < TUTORIAL_STEPS.lumbermillBuilt) return ['events', 'buildings'].includes(tabId);
    if (step === TUTORIAL_STEPS.lumbermillBuilt) return ['buildings', 'tasks'].includes(tabId);
    if (step === TUTORIAL_STEPS.era3AdvanceReady) return ['civilization', 'buildings', 'tasks'].includes(tabId);
    if (step >= TUTORIAL_STEPS.era3Advanced && step < TUTORIAL_STEPS.firstCityDiscovered) {
      return ['civilization', 'resources', 'military'].includes(tabId);
    }
    if (step >= TUTORIAL_STEPS.firstCityDiscovered && step < TUTORIAL_STEPS.polityNamed) {
      return ['resources', 'military'].includes(tabId);
    }
    if (step >= TUTORIAL_STEPS.polityNamed && step <= TUTORIAL_STEPS.talentPolicyApplied) {
      return tabId === 'military';
    }
    if (step >= TUTORIAL_STEPS.manualTalentAssigned && step < TUTORIAL_STEPS.famousSeekCompleted) {
      return ['resources', 'famousPersons'].includes(tabId);
    }
    if (step >= TUTORIAL_STEPS.famousSeekCompleted && step < TUTORIAL_STEPS.completed) {
      return tabId === 'tech';
    }
    return true;
  }

  function isHouseGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.cityEntered, TUTORIAL_STEPS.houseBuilt);
  }

  function isFirstEraGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.houseBuilt, TUTORIAL_STEPS.farmPrepReserved);
  }

  function isFarmGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.farmPrepReserved, TUTORIAL_STEPS.farmBuilt);
  }

  function isEra2GuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.era2AdvanceReady, TUTORIAL_STEPS.lumbermillBuilt, { includeEnd: true });
  }

  function isScoutFormationGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.era3AdvanceReady, TUTORIAL_STEPS.scoutFormationSaved);
  }

  function isScoutExploreGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.scoutFormationSaved, TUTORIAL_STEPS.firstCityDiscovered);
  }

  function isFirstCityGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.firstCityDiscovered, TUTORIAL_STEPS.polityNamed);
  }

  function isFinalTechGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.famousSeekCompleted, TUTORIAL_STEPS.completed);
  }

  function isPostNamingSystemGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.polityNamed, TUTORIAL_STEPS.famousSeekCompleted);
  }

  function isLumbermillGuideActive(step, completed) {
    return isGuideRangeActive(step, completed, TUTORIAL_STEPS.specialEventClaimed, TUTORIAL_STEPS.lumbermillBuilt);
  }

  const TutorialGuideStepPolicy = Object.freeze({
    TUTORIAL_STEPS,
    normalizeStep,
    canOpenTab,
    isGuideRangeActive,
    isHouseGuideActive,
    isFirstEraGuideActive,
    isFarmGuideActive,
    isEra2GuideActive,
    isScoutFormationGuideActive,
    isScoutExploreGuideActive,
    isFirstCityGuideActive,
    isFinalTechGuideActive,
    isPostNamingSystemGuideActive,
    isLumbermillGuideActive,
  });

  global.TutorialGuideStepPolicy = TutorialGuideStepPolicy;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideStepPolicy;
})(typeof window !== 'undefined' ? window : globalThis);

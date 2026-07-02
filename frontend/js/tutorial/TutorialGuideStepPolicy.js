(function (global) {
  // Thin reader over the shared tutorial flow table. The step table and ALL
  // ordering helpers live in shared/tutorialFlowConfig.js; this module only
  // keeps the client-side guide-window policy functions.
  const TutorialFlowShared = (() => {
    if (global.TutorialFlowShared) return global.TutorialFlowShared;
    if (typeof module !== 'undefined' && module.exports) {
      return require('../../../shared/tutorialFlowConfig');
    }
    return null;
  })();

  const TUTORIAL_STEPS = TutorialFlowShared.TUTORIAL_STEPS;

  // Canonical step name for a name-or-legacy-number value; unknown -> 'initial'
  // (mirrors the legacy Number(step)->0 fallback).
  function normalizeStep(step) {
    return TutorialFlowShared.stepName(step) || TUTORIAL_STEPS.initial;
  }

  function isGuideRangeActive(step, completed, startStep, endStep, options = {}) {
    if (completed) return false;
    const current = normalizeStep(step);
    const includeEnd = options.includeEnd === true;
    return (
      TutorialFlowShared.stepAtLeast(current, startStep) &&
      (includeEnd
        ? TutorialFlowShared.stepAtMost(current, endStep)
        : TutorialFlowShared.stepBefore(current, endStep))
    );
  }

  function canOpenTab(tabId, context = {}) {
    if (context.completed) return true;
    const step = normalizeStep(context.step);
    const { stepEquals, stepAtLeast, stepAtMost, stepBefore } = TutorialFlowShared;
    if (stepBefore(step, TUTORIAL_STEPS.houseBuilt)) return ['resources', 'military', 'buildings'].includes(tabId);
    if (stepBefore(step, TUTORIAL_STEPS.eraAdvancedTo1)) return ['resources', 'military', 'buildings', 'civilization'].includes(tabId);
    if (stepAtMost(step, TUTORIAL_STEPS.farmBuilt)) return ['buildings', 'civilization', 'tasks'].includes(tabId);
    if (stepEquals(step, TUTORIAL_STEPS.era2AdvanceReady)) return tabId === 'civilization';
    if (stepBefore(step, TUTORIAL_STEPS.specialEventClaimed)) return ['civilization', 'events'].includes(tabId);
    if (stepBefore(step, TUTORIAL_STEPS.lumbermillBuilt)) return ['events', 'buildings'].includes(tabId);
    if (stepEquals(step, TUTORIAL_STEPS.lumbermillBuilt)) return ['buildings', 'tasks'].includes(tabId);
    if (stepEquals(step, TUTORIAL_STEPS.era3AdvanceReady)) return ['civilization', 'buildings', 'tasks'].includes(tabId);
    if (stepAtLeast(step, TUTORIAL_STEPS.era3Advanced) && stepBefore(step, TUTORIAL_STEPS.firstCityDiscovered)) {
      return ['civilization', 'resources', 'military'].includes(tabId);
    }
    if (stepAtLeast(step, TUTORIAL_STEPS.firstCityDiscovered) && stepBefore(step, TUTORIAL_STEPS.polityNamed)) {
      return ['resources', 'military'].includes(tabId);
    }
    if (stepAtLeast(step, TUTORIAL_STEPS.polityNamed) && stepAtMost(step, TUTORIAL_STEPS.talentPolicyApplied)) {
      return tabId === 'military';
    }
    if (stepAtLeast(step, TUTORIAL_STEPS.manualTalentAssigned) && stepBefore(step, TUTORIAL_STEPS.famousSeekCompleted)) {
      return ['resources', 'famousPersons'].includes(tabId);
    }
    if (stepAtLeast(step, TUTORIAL_STEPS.famousSeekCompleted) && stepBefore(step, TUTORIAL_STEPS.completed)) {
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

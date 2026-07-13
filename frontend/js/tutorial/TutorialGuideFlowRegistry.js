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

  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function isVisuallyDisabled(action = {}) {
    return ClientCommandSemantics?.isVisuallyDisabled?.(action)
      ?? Boolean(action?.visualDisabled ?? action?.disabled);
  }

  function getStep(host) {
    return TutorialFlowShared.stepName(host?.getCurrentStep?.()) || 'initial';
  }

  function getSteps(host, fallback = {}) {
    return (
      host?.constructor?.TUTORIAL_STEPS || TutorialGuideStepPolicy?.TUTORIAL_STEPS || fallback || {}
    );
  }

  function stepIs(...allowedSteps) {
    const allowedNames = allowedSteps.map((step) => TutorialFlowShared.stepName(step));
    return (host) => allowedNames.includes(getStep(host));
  }

  function all(...conditions) {
    return (host) => conditions.every((condition) => condition(host));
  }

  function any(...conditions) {
    return (host) => conditions.some((condition) => condition(host));
  }

  function not(condition) {
    return (host) => !condition(host);
  }

  function hideHighlight(host) {
    host.hideTutorialHighlight?.();
    return false;
  }

  function isCommandPanelOpen(panelId) {
    return (host) => host.isCommandPanelOpen?.(panelId);
  }

  function isFamousPersonsOpen(host) {
    return host.isFamousPersonsOpen?.();
  }

  function isFamousPersonDetailOpen(host) {
    return host.isFamousPersonDetailOpen?.();
  }

  function isCityManagementOpen(host) {
    return host.isCityManagementOpen?.();
  }

  function isCityManagementTabOpen(tab) {
    return (host) => host.isCityManagementTabOpen?.(tab);
  }

  function renderOpenCommandPanel(host, panel, message) {
    host.prepareCommandPanelGuide?.(panel);
    return host.showHighlight(
      'openCommandPanel',
      (action) => !isVisuallyDisabled(action) && action.panel === panel,
      message,
      { type: 'openCommandPanel', panel },
    );
  }

  function renderAdvanceEra(host, message) {
    return host.showHighlight('advanceEra', (action) => !isVisuallyDisabled(action), message, {
      type: 'advanceEra',
    });
  }

  function renderScoutFamousPersonOpen(host) {
    return host.showHighlight(
      'openFamousPersons',
      (action) => !isVisuallyDisabled(action),
      t('tutorial.guide.openScoutFamous'),
      { type: 'openFamousPersons' },
    );
  }

  function renderOpenScoutFamousDetail(host) {
    const scoutPersonId = host.getScoutFamousPersonId?.() || '';
    return host.showHighlight(
      'openFamousPersonDetail',
      (action) => !isVisuallyDisabled(action) && (!scoutPersonId || action.personId === scoutPersonId),
      t('tutorial.guide.openScoutFamousDetail'),
      { type: 'openFamousPersonDetail', personId: scoutPersonId },
    );
  }

  // A guided click on a world site whose tile also carries an actor (the intro
  // march on the capital, the arrived scout on the discovered city) resolves to
  // the multi-candidate world target picker instead of opening the site. The
  // picker blocks every canvas click, so whenever it is open during a step that
  // guides towards a known site, the guide must follow into it and highlight
  // choosing that site's candidate.
  function renderChooseGuidedSiteCandidate(host, siteId, message) {
    const candidate = host.getWorldTargetPickerSiteCandidate?.(siteId);
    if (!candidate) return false;
    return host.showHighlight(
      'chooseWorldTarget',
      (action) => !isVisuallyDisabled(action) && String(action.targetId || '') === String(candidate.id),
      message,
      { type: 'chooseWorldTarget', targetId: candidate.id },
    );
  }

  function hasGuidedSitePickerCandidate(getSiteId) {
    return (host) => Boolean(host.getWorldTargetPickerSiteCandidate?.(getSiteId(host) || ''));
  }

  function renderFirstCityDiscovered(host) {
    const siteId = host.getFirstExploreCityId?.() || '';
    if (!host.isWorldSiteSelected?.(siteId)) {
      const highlighted = host.showFirstCitySiteOpenHighlight?.(siteId);
      if (highlighted) return true;
      return host.focusFirstCitySite?.(siteId) || false;
    }
    return host.showHighlight(
      'conquer',
      (action) =>
        !isVisuallyDisabled(action) && (!siteId || action.territoryId === siteId || action.cityId === siteId),
      t('tutorial.guide.conquerEmptyCity'),
      { type: 'conquer', territoryId: siteId },
    );
  }

  function renderFirstCityOccupied(host) {
    const siteId = host.getFirstExploreCityId?.() || '';
    const site = host.getFirstExploreCity?.() || {};
    if (!host.isNamingOpen?.('city', siteId)) {
      return host.showHighlight(
        'renameCity',
        (action) =>
          !isVisuallyDisabled(action) &&
          (!siteId || action.territoryId === siteId || action.cityId === siteId),
        t('tutorial.guide.renameNewCity', {
          name: site.naturalName || t('tutorial.guide.renameNewCity.fallbackName'),
        }),
        { type: 'renameCity', territoryId: siteId },
      );
    }
    if (!host.getNamingInputValue?.()) {
      return host.showHighlight(
        'requestNamingInput',
        (action) => !isVisuallyDisabled(action),
        t('tutorial.guide.focusCityNameInput'),
        { type: 'requestNamingInput' },
      );
    }
    return host.showHighlight(
      'submitNaming',
      (action) => !isVisuallyDisabled(action),
      t('tutorial.guide.submitCityName'),
      { type: 'submitNaming' },
    );
  }

  function renderPolityNaming(host) {
    if (!host.isNamingOpen?.('polity')) {
      host.openNaming?.({
        type: 'polity',
        title: t('tutorial.guide.namePolityTitle'),
        message: t('tutorial.guide.namePolityMessage'),
      });
    }
    if (!host.getNamingInputValue?.()) {
      return host.showHighlight(
        'requestNamingInput',
        (action) => !isVisuallyDisabled(action),
        t('tutorial.guide.focusPolityNameInput'),
        { type: 'requestNamingInput' },
      );
    }
    return host.showHighlight(
      'submitNaming',
      (action) => !isVisuallyDisabled(action),
      t('tutorial.guide.submitPolityName'),
      { type: 'submitNaming' },
    );
  }

  function renderTalentAdjustment(host) {
    host.ensureCityPeopleGuideVisible?.();
    if (!host.isCityManagementTabOpen?.('people')) {
      return host.showHighlight(
        'switchCityManagementTab',
        (action) => !isVisuallyDisabled(action) && action.tab === 'people',
        t('tutorial.highlight.switchTalentTabAdjust'),
        { type: 'switchCityManagementTab', tab: 'people' },
      );
    }
    const picked = host.pickManualAssignAction?.();
    if (picked?.target) {
      return (
        host.showTutorialHighlight?.(
          picked.target,
          t('tutorial.highlight.adjustTalentDetail'),
          {
            ...host.getCityPeopleGuideHighlightOptions?.(),
            allowedAction: picked.action,
            source: 'strongTutorial',
          },
        ) || false
      );
    }
    return host.showHighlight(
      'assignJob',
      (action) => !isVisuallyDisabled(action) && Number(action.delta) !== 0,
      t('tutorial.highlight.adjustTalentShort'),
      { type: 'assignJob' },
      host.getCityPeopleGuideHighlightOptions?.() || {},
    );
  }

  function renderHouseGuide(host) {
    const target = host.getCanvasTarget?.(
      'buildBuilding',
      (action) => !isVisuallyDisabled(action) && action.buildingId === 'house',
    );
    if (!target) return false;
    return (
      host.showTutorialHighlight?.(target, t('tutorial.highlight.buildFirstHouse'), {
        allowedAction: { type: 'buildBuilding', buildingId: 'house' },
        source: 'strongTutorial',
      }) || false
    );
  }

  function resolveMessage(message, host) {
    return typeof message === 'function' ? message(host) : message;
  }

  function makeBuildRule({ id, matches, buildingId, message, render }) {
    return {
      id,
      matches,
      render:
        render ||
        ((host) => host.showBuildingGuide?.(buildingId, resolveMessage(message, host)) || false),
    };
  }

  function createDefaultRules(steps = {}) {
    const eventPanelOpen = all(
      any(
        stepIs(steps.specialEventTabOpened),
        all(stepIs(steps.eraAdvancedTo2), isCommandPanelOpen('events')),
      ),
      (host) => !host.getActiveEventId?.(),
    );
    const eventClaimReady = all(
      any(
        stepIs(steps.specialEventTabOpened),
        all(stepIs(steps.eraAdvancedTo2), isCommandPanelOpen('events')),
      ),
      (host) => host.getActiveEventId?.() === 'evt_settlement_forest_001',
    );
    const famousCardViewed = stepIs(steps.famousCardViewed);
    const famousClosedAndCityClosed = all(
      famousCardViewed,
      not(isFamousPersonsOpen),
      not(isCityManagementOpen),
    );

    const getCapitalSiteId = (host) => host.getCapitalCityId?.() || '';
    const getFirstCitySiteId = (host) => host.getFirstExploreCityId?.() || '';

    return [
      { id: 'advisor-open', matches: (host) => host.isAdvisorOpen?.(), render: hideHighlight },
      {
        id: 'reward-reveal-open',
        matches: (host) => host.isRewardRevealOpen?.(),
        render: hideHighlight,
      },
      // World-target-picker follow-through: these run before every segment rule
      // because the open picker is modal — any highlight the segment rules would
      // draw sits underneath it and cannot be clicked.
      {
        id: 'capital-site-picker-follow-through',
        matches: all(famousCardViewed, hasGuidedSitePickerCandidate(getCapitalSiteId)),
        render: (host) =>
          renderChooseGuidedSiteCandidate(
            host,
            getCapitalSiteId(host),
            t('tutorial.highlight.chooseCapitalSite'),
          ),
      },
      {
        id: 'first-city-site-picker-follow-through',
        matches: all(
          stepIs(
            steps.firstCityDiscovered,
            steps.firstCityConquestStarted,
            steps.firstCityOccupied,
          ),
          hasGuidedSitePickerCandidate(getFirstCitySiteId),
        ),
        render: (host) =>
          renderChooseGuidedSiteCandidate(
            host,
            getFirstCitySiteId(host),
            t('tutorial.highlight.chooseFirstCitySite'),
          ),
      },
      {
        id: 'first-era-open-civilization',
        matches: all(stepIs(steps.houseBuilt), (host) => !host.isOnTab?.('civilization')),
        render: (host) =>
          renderOpenCommandPanel(host, 'civilization', t('tutorial.highlight.openCivilization')),
      },
      {
        id: 'first-era-advance',
        matches: stepIs(steps.civilizationTabOpened),
        render: (host) => renderAdvanceEra(host, t('tutorial.highlight.advanceEra')),
      },
      makeBuildRule({
        id: 'farm-build',
        matches: (host) => host.isFarmGuideActive?.(),
        buildingId: 'farm',
        message: () => t('tutorial.guide.buildFirstFarm'),
      }),
      {
        id: 'era2-advance',
        matches: all(stepIs(steps.era2AdvanceReady), isCommandPanelOpen('civilization')),
        render: (host) => renderAdvanceEra(host, t('tutorial.guide.advanceToEra2')),
      },
      {
        id: 'era2-open-forest-event',
        matches: eventPanelOpen,
        render: (host) =>
          host.showHighlight(
            'openEvent',
            (action) => !isVisuallyDisabled(action) && action.eventId === 'evt_settlement_forest_001',
            t('tutorial.guide.openForestEvent'),
            { type: 'openEvent', eventId: 'evt_settlement_forest_001' },
          ),
      },
      {
        id: 'era2-claim-forest-event',
        matches: eventClaimReady,
        render: (host) =>
          host.showHighlight(
            'claimEvent',
            (action) =>
              !isVisuallyDisabled(action) &&
              action.eventId === 'evt_settlement_forest_001' &&
              action.optionId === 'opt_collect_wood',
            t('tutorial.guide.claimForestWood'),
            {
              type: 'claimEvent',
              eventId: 'evt_settlement_forest_001',
              optionId: 'opt_collect_wood',
            },
          ),
      },
      makeBuildRule({
        id: 'lumbermill-build',
        matches: any(
          stepIs(steps.specialEventClaimed),
          stepIs(steps.buildingsTabOpenedForLumbermill),
        ),
        buildingId: 'lumbermill',
        message: () => t('tutorial.guide.buildLumbermill'),
      }),
      {
        id: 'era3-advance',
        matches: all(stepIs(steps.era3AdvanceReady), isCommandPanelOpen('civilization')),
        render: (host) => renderAdvanceEra(host, t('tutorial.guide.advanceToEra3')),
      },
      // Barracks segment: claim supplies, open the buildings tab, build the
      // barracks, claim the first army, then recruit the scout officer.
      // house-style: showBuildingGuide force-opens city management on the
      // buildings tab from ANY surface (the claim leaves the player on the
      // world-map home, where a command-panel highlight has no target), so
      // the build highlight fires directly; buildingsTabOpenedForBarracks is
      // advanced by the commandPanelOpened event when the player routes via
      // the panel, and the build event jumps past it otherwise (monotonic).
      makeBuildRule({
        id: 'barracks-build',
        matches: any(
          stepIs(steps.barracksSuppliesClaimed),
          stepIs(steps.buildingsTabOpenedForBarracks),
        ),
        buildingId: 'barracks',
        message: () => t('tutorial.highlight.buildBarracks'),
      }),
      {
        id: 'scout-open-famous',
        matches: all(stepIs(steps.scoutFamousGranted), not(isFamousPersonsOpen)),
        render: renderScoutFamousPersonOpen,
      },
      {
        id: 'scout-open-famous-detail',
        matches: all(stepIs(steps.famousPanelOpened), isFamousPersonsOpen),
        render: renderOpenScoutFamousDetail,
      },
      {
        id: 'scout-close-famous-detail',
        matches: all(famousCardViewed, isFamousPersonsOpen, isFamousPersonDetailOpen),
        render: (host) =>
          host.showHighlight(
            'closeFamousPersonDetail',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.guide.closeScoutFamousDetail'),
            { type: 'closeFamousPersonDetail' },
          ),
      },
      {
        id: 'scout-close-famous-panel',
        matches: all(famousCardViewed, isFamousPersonsOpen),
        render: (host) =>
          host.showHighlight(
            'closeFamousPersons',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.guide.closeFamousPanel'),
            { type: 'closeFamousPersons' },
          ),
      },
      {
        id: 'scout-enter-selected-capital',
        matches: all(famousClosedAndCityClosed, (host) =>
          host.isWorldSiteSelected?.(host.getCapitalCityId?.()),
        ),
        render: (host) => host.showCapitalEnterHighlight?.(host.getCapitalCityId?.()) || false,
      },
      {
        id: 'scout-focus-capital',
        matches: famousClosedAndCityClosed,
        render: (host) => host.focusCapitalSite?.(host.getCapitalCityId?.()) || false,
      },
      {
        id: 'scout-explore-active',
        matches: all(stepIs(steps.scoutExploreStarted), (host) =>
          Boolean(host.hasActiveWorldExplorerMission?.()),
        ),
        render: hideHighlight,
      },
      {
        id: 'first-city-discovered',
        matches: stepIs(steps.firstCityDiscovered),
        render: renderFirstCityDiscovered,
      },
      {
        id: 'first-city-conquest-ready',
        matches: stepIs(steps.firstCityConquestStarted),
        render: (host) => {
          const siteId = host.getFirstExploreCityId?.() || '';
          return host.showHighlight(
            'claimConquest',
            (action) =>
              !isVisuallyDisabled(action) &&
              (!siteId || action.territoryId === siteId || action.cityId === siteId),
            t('tutorial.guide.claimFirstCityConquest'),
            { type: 'claimConquest', territoryId: siteId },
          );
        },
      },
      {
        id: 'first-city-occupied',
        matches: stepIs(steps.firstCityOccupied),
        render: renderFirstCityOccupied,
      },
      { id: 'first-city-named', matches: stepIs(steps.firstCityNamed), render: renderPolityNaming },
      {
        id: 'talent-policy-open-direct',
        matches: stepIs(steps.polityNamed),
        render: (host) => {
          host.ensureCityPeopleGuideVisible?.();
          const result =
            typeof host.handleEvent === 'function'
              ? host.handleEvent('talentPolicyOpened')
              : host.onTalentPolicyOpened?.();
          result?.then?.(() => host.refreshCurrentHighlight?.())?.catch?.(() => {});
          host.hideTutorialHighlight?.();
          return false;
        },
      },
      {
        id: 'talent-policy-apply-direct',
        matches: stepIs(steps.talentPolicyOpened),
        render: (host) => {
          host.ensureCityPeopleGuideVisible?.();
          if (!host.isCityManagementTabOpen?.('people')) {
            return host.showHighlight(
              'switchCityManagementTab',
              (action) => !isVisuallyDisabled(action) && action.tab === 'people',
              t('tutorial.highlight.switchTalentTab'),
              { type: 'switchCityManagementTab', tab: 'people' },
            );
          }
          host
            .advanceTo?.(steps.talentPolicyApplied)
            ?.then?.(() => host.refreshCurrentHighlight?.())
            ?.catch?.(() => {});
          host.hideTutorialHighlight?.();
          return false;
        },
      },
      {
        id: 'talent-adjustment',
        matches: stepIs(steps.talentPolicyApplied),
        render: renderTalentAdjustment,
      },
      {
        id: 'talent-open-famous',
        matches: stepIs(steps.manualTalentAssigned),
        render: (host) =>
          host.showHighlight(
            'openFamousPersons',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.highlight.openFamousSeek'),
            { type: 'openFamousPersons' },
          ),
      },
      {
        id: 'famous-seek-open-panel',
        matches: all(stepIs(steps.famousSeekOpened), not(isFamousPersonsOpen)),
        render: (host) =>
          host.showHighlight(
            'openFamousPersons',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.highlight.openFamousPanel'),
            { type: 'openFamousPersons' },
          ),
      },
      {
        id: 'famous-seek-action',
        matches: all(stepIs(steps.famousSeekOpened), isFamousPersonsOpen),
        render: (host) =>
          host.showHighlight(
            'seekFamousPerson',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.highlight.seekFamous'),
            { type: 'seekFamousPerson' },
          ),
      },
      {
        id: 'final-tech-soft-guide',
        matches: stepIs(steps.famousSeekCompleted, steps.finalTechOpened),
        render: (host) =>
          host.showSoftGuide?.('tech-tree', t('tutorial.guide.techSoftGuide')) || false,
      },
      makeBuildRule({
        id: 'house-build',
        matches: (host) => host.isHouseGuideActive?.(),
        buildingId: 'house',
        render: renderHouseGuide,
      }),
    ];
  }

  class TutorialGuideFlowRegistry {
    constructor(options = {}) {
      this.steps = options.steps || TutorialGuideStepPolicy?.TUTORIAL_STEPS || {};
      this.rules = options.rules || createDefaultRules(this.steps);
    }

    refresh(host) {
      const steps = getSteps(host, this.steps);
      if (steps !== this.steps) {
        this.steps = steps;
        this.rules = createDefaultRules(steps);
      }
      const rule = this.rules.find((entry) => entry?.matches?.(host));
      if (!rule) return false;
      return rule.render?.(host) || false;
    }
  }

  function create(options = {}) {
    return new TutorialGuideFlowRegistry(options);
  }

  const api = {
    TutorialGuideFlowRegistry,
    create,
    createDefaultRules,
    makeBuildRule,
  };

  global.TutorialGuideFlowRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

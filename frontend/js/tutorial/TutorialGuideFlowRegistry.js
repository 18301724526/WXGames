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
    host.game?.canvasShell?.hideTutorialHighlight?.();
    return false;
  }

  function isCommandPanelOpen(panelId) {
    return (host) => host.isCommandPanelOpen?.(panelId);
  }

  function isTaskCenterOpen(host) {
    return host.isTaskCenterOpen?.();
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

  function getArmyFormationEditor(host) {
    return host.getArmyFormationEditor?.() || {};
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

  function renderOpenTaskCenter(host, message, allowedAction = { type: 'openTaskCenter' }) {
    return host.showHighlight(
      'openTaskCenter',
      (action) => !isVisuallyDisabled(action) && (action.tab || 'main') === 'main',
      message,
      allowedAction,
    );
  }

  function renderClaimTaskReward(host, taskId, message) {
    return host.showHighlight(
      'claimTaskReward',
      (action) => !isVisuallyDisabled(action) && action.taskId === taskId,
      message,
      { type: 'claimTaskReward', taskId, category: 'main' },
    );
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

  function renderScoutFormationMemberOrSave(host) {
    const scoutPersonId = host.getScoutFamousPersonId?.() || '';
    const editor = getArmyFormationEditor(host);
    const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds.map(String) : [];
    if (scoutPersonId && !memberIds.includes(scoutPersonId)) {
      return host.showHighlight(
        'toggleArmyFormationMember',
        (action) => !isVisuallyDisabled(action) && action.personId === scoutPersonId,
        t('tutorial.guide.pickScoutLeader'),
        { type: 'toggleArmyFormationMember', personId: scoutPersonId },
      );
    }
    // Middle branch: the scout is in the formation but has no soldiers drafted
    // yet - guide the auto-replenish button so the first-army reserve is
    // assigned before saving.
    const scoutDraftSoldiers = Number(
      editor.soldierDraftAssignments?.[scoutPersonId] ??
        editor.soldierAssignments?.[scoutPersonId] ??
        0,
    );
    if (scoutPersonId && memberIds.includes(scoutPersonId) && scoutDraftSoldiers <= 0) {
      return host.showHighlight(
        'autoReplenishArmyFormation',
        (action) => !isVisuallyDisabled(action),
        t('tutorial.highlight.replenishScoutFormation'),
        { type: 'autoReplenishArmyFormation' },
      );
    }
    return host.showHighlight(
      'saveArmyFormation',
      (action) => !isVisuallyDisabled(action),
      t('tutorial.guide.saveScoutFormation'),
      { type: 'saveArmyFormation' },
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
      host.game?.openNaming?.({
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
        host.game?.canvasShell?.showTutorialHighlight?.(
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
    host.ensureHouseGuideVisible?.();
    const shell = host.game?.canvasShell;
    const target = shell?.getCanvasTarget?.(
      'buildBuilding',
      (action) => !isVisuallyDisabled(action) && action.buildingId === 'house',
    );
    if (!target) return false;
    return (
      shell.showTutorialHighlight?.(target, t('tutorial.highlight.buildFirstHouse'), {
        allowedAction: { type: 'buildBuilding', buildingId: 'house' },
        source: 'strongTutorial',
      }) || false
    );
  }

  function resolveMessage(message, host) {
    return typeof message === 'function' ? message(host) : message;
  }

  // Standard-rule factories. `message` may be a string or a () => string thunk
  // (kept lazy so LocaleText lookups still happen at render time).
  function makeTabOpenRule({ id, steps, panel, message }) {
    return {
      id,
      matches: all(stepIs(...steps), not(isCommandPanelOpen(panel))),
      render: (host) => renderOpenCommandPanel(host, panel, resolveMessage(message, host)),
    };
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

  function makeTaskClaimPairRules({ openId, claimId, step, taskId, openMessage, claimMessage }) {
    return [
      {
        id: openId,
        matches: all(stepIs(step), not(isTaskCenterOpen)),
        render: (host) =>
          renderOpenTaskCenter(host, resolveMessage(openMessage, host), {
            type: 'openTaskCenter',
          }),
      },
      {
        id: claimId,
        matches: all(stepIs(step), isTaskCenterOpen),
        render: (host) => renderClaimTaskReward(host, taskId, resolveMessage(claimMessage, host)),
      },
    ];
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
      ...makeTaskClaimPairRules({
        openId: 'first-era-open-task-center',
        claimId: 'first-era-claim-supplies',
        step: steps.eraAdvancedTo1,
        taskId: 'main_first_supplies',
        openMessage: () => t('tutorial.highlight.openTaskCenter'),
        claimMessage: () => t('tutorial.highlight.claimFirstSupplies'),
      }),
      makeBuildRule({
        id: 'farm-build',
        matches: (host) => host.isFarmGuideActive?.(),
        buildingId: 'farm',
        message: () => t('tutorial.guide.buildFirstFarm'),
      }),
      makeTabOpenRule({
        id: 'era2-open-civilization',
        steps: [steps.era2AdvanceReady],
        panel: 'civilization',
        message: () => t('tutorial.guide.openCivilizationForEra2'),
      }),
      {
        id: 'era2-advance',
        matches: all(stepIs(steps.era2AdvanceReady), isCommandPanelOpen('civilization')),
        render: (host) => renderAdvanceEra(host, t('tutorial.guide.advanceToEra2')),
      },
      makeTabOpenRule({
        id: 'era2-open-events',
        steps: [steps.eraAdvancedTo2],
        panel: 'events',
        message: () => t('tutorial.guide.openEventsForForest'),
      }),
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
      ...makeTaskClaimPairRules({
        openId: 'lumbermill-open-task-center',
        claimId: 'lumbermill-claim-task',
        step: steps.lumbermillBuilt,
        taskId: 'main_lumbermill_supplies',
        openMessage: () => t('tutorial.guide.openLumbermillTask'),
        claimMessage: () => t('tutorial.guide.claimLumbermillReward'),
      }),
      makeTabOpenRule({
        id: 'era3-open-civilization',
        steps: [steps.era3AdvanceReady],
        panel: 'civilization',
        message: () => t('tutorial.guide.openCivilizationForEra3'),
      }),
      {
        id: 'era3-advance',
        matches: all(stepIs(steps.era3AdvanceReady), isCommandPanelOpen('civilization')),
        render: (host) => renderAdvanceEra(host, t('tutorial.guide.advanceToEra3')),
      },
      // Barracks segment: claim supplies, open the buildings tab, build the
      // barracks, claim the first army, then recruit the scout officer.
      ...makeTaskClaimPairRules({
        openId: 'barracks-open-task-center',
        claimId: 'barracks-claim-supplies',
        step: steps.era3Advanced,
        taskId: 'main_barracks_supplies',
        openMessage: () => t('tutorial.highlight.openBarracksTask'),
        claimMessage: () => t('tutorial.highlight.claimBarracksSupplies'),
      }),
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
      ...makeTaskClaimPairRules({
        openId: 'first-army-open-task-center',
        claimId: 'first-army-claim',
        step: steps.barracksBuilt,
        taskId: 'main_first_army',
        openMessage: () => t('tutorial.highlight.openFirstArmyTask'),
        claimMessage: () => t('tutorial.highlight.claimFirstArmy'),
      }),
      ...makeTaskClaimPairRules({
        openId: 'scout-officer-open-task-center',
        claimId: 'scout-officer-claim',
        step: steps.firstArmyClaimed,
        taskId: 'main_scout_officer',
        openMessage: () => t('tutorial.highlight.openScoutOfficerTask'),
        claimMessage: () => t('tutorial.highlight.claimScoutOfficer'),
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
        id: 'scout-switch-city-military-tab',
        matches: all(
          famousCardViewed,
          isCityManagementOpen,
          not(isCityManagementTabOpen('military')),
        ),
        render: (host) =>
          host.showHighlight(
            'switchCityManagementTab',
            (action) => !isVisuallyDisabled(action) && action.tab === 'military',
            t('tutorial.guide.switchCityMilitaryTab'),
            { type: 'switchCityManagementTab', tab: 'military' },
          ),
      },
      {
        id: 'scout-open-formation',
        matches: all(
          famousCardViewed,
          isCityManagementOpen,
          isCityManagementTabOpen('military'),
          (host) => !getArmyFormationEditor(host).open,
        ),
        render: (host) =>
          host.showHighlight(
            'openArmyFormation',
            (action) => !isVisuallyDisabled(action) && Number(action.slot || 1) === 1,
            t('tutorial.guide.openFirstFormation'),
            { type: 'openArmyFormation', cityId: host.getCapitalCityId?.(), slot: 1 },
          ),
      },
      {
        id: 'scout-formation-member-or-save',
        matches: all(
          stepIs(steps.formationPanelOpened),
          (host) => getArmyFormationEditor(host).open,
        ),
        render: renderScoutFormationMemberOrSave,
      },
      {
        id: 'scout-select-world-target',
        matches: stepIs(steps.scoutFormationSaved),
        render: (host) => {
          host.ensureMapHomeGuideVisible?.({ clearWorldMarchTarget: true });
          // S5 (R-route): steer the target selection to the PRE-PLACED first city's tile so the guided
          // march heads toward it and its vision discovery fires. The city coord is carried in the grant.
          // If that specific tile's selectWorldMarchTarget action is present (its tile is on-screen /
          // revealed), highlight it; otherwise fall back to the generic target highlight so the player is
          // never left without a prompt while the city tile is still fogged.
          const target = host.getFirstExploreCityTarget?.();
          if (target) {
            const steered = host.showHighlight(
              'selectWorldMarchTarget',
              (action) =>
                !isVisuallyDisabled(action)
                && Number(action.targetQ ?? action.q ?? action.x) === target.q
                && Number(action.targetR ?? action.r ?? action.y) === target.r,
              t('tutorial.guide.selectScoutTarget'),
              { type: 'selectWorldMarchTarget', targetQ: target.q, targetR: target.r },
            );
            if (steered) return true;
          }
          return host.showHighlight(
            'selectWorldMarchTarget',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.guide.selectScoutTarget'),
            { type: 'selectWorldMarchTarget' },
          );
        },
      },
      {
        id: 'scout-open-world-formation-picker',
        matches: all(
          stepIs(steps.scoutWorldPanelOpened),
          (host) => !host.isWorldMarchFormationPickerOpen?.(),
        ),
        render: (host) => {
          host.ensureMapHomeGuideVisible?.();
          return host.showHighlight(
            'openWorldMarchFormationPicker',
            (action) => !isVisuallyDisabled(action),
            t('tutorial.guide.openMarchFormationPicker'),
            { type: 'openWorldMarchFormationPicker' },
          );
        },
      },
      {
        id: 'scout-start-world-march',
        matches: all(stepIs(steps.scoutWorldPanelOpened), (host) =>
          host.isWorldMarchFormationPickerOpen?.(),
        ),
        render: (host) =>
          host.showHighlight(
            'startWorldMarch',
            (action) => !isVisuallyDisabled(action) && Number(action.formationSlot || action.slot || 1) === 1,
            t('tutorial.guide.startScoutMarch'),
            { type: 'startWorldMarch', formationSlot: 1 },
          ),
      },
      {
        id: 'scout-explore-active',
        matches: all(stepIs(steps.scoutExploreStarted), (host) =>
          Boolean(host.game?.state?.worldExplorerState?.activeMission),
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
          host.game?.canvasShell?.hideTutorialHighlight?.();
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
          host.game?.canvasShell?.hideTutorialHighlight?.();
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
      makeTabOpenRule({
        id: 'final-tech-open',
        steps: [steps.famousSeekCompleted, steps.finalTechOpened],
        panel: 'tech',
        message: () => t('tutorial.guide.openTechFinal'),
      }),
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
    makeTabOpenRule,
    makeBuildRule,
    makeTaskClaimPairRules,
  };

  global.TutorialGuideFlowRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

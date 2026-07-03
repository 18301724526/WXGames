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

  function t(key, params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
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
      (action) => !action.disabled && action.panel === panel,
      message,
      { type: 'openCommandPanel', panel },
    );
  }

  function renderAdvanceEra(host, message) {
    return host.showHighlight('advanceEra', (action) => !action.disabled, message, {
      type: 'advanceEra',
    });
  }

  function renderOpenTaskCenter(host, message, allowedAction = { type: 'openTaskCenter' }) {
    return host.showHighlight(
      'openTaskCenter',
      (action) => !action.disabled && (action.tab || 'main') === 'main',
      message,
      allowedAction,
    );
  }

  function renderClaimTaskReward(host, taskId, message) {
    return host.showHighlight(
      'claimTaskReward',
      (action) => !action.disabled && action.taskId === taskId,
      message,
      { type: 'claimTaskReward', taskId, category: 'main' },
    );
  }

  function renderScoutFamousPersonOpen(host) {
    return host.showHighlight(
      'openFamousPersons',
      (action) => !action.disabled,
      '\u6253\u5f00\u540d\u4eba\uff0c\u67e5\u770b\u521a\u52a0\u5165\u7684\u4fa6\u5bdf\u578b\u82f1\u6770\u3002',
      { type: 'openFamousPersons' },
    );
  }

  function renderOpenScoutFamousDetail(host) {
    const scoutPersonId = host.getScoutFamousPersonId?.() || '';
    return host.showHighlight(
      'openFamousPersonDetail',
      (action) => !action.disabled && (!scoutPersonId || action.personId === scoutPersonId),
      '\u70b9\u5f00\u8fd9\u5f20\u4fa6\u5bdf\u578b\u540d\u4eba\u5361\uff0c\u8bb0\u4f4f\u4ed6\u4f1a\u5e26\u961f\u51fa\u57ce\u63a2\u8def\u3002',
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
        (action) => !action.disabled && action.personId === scoutPersonId,
        '\u9009\u4e2d\u8fd9\u4f4d\u4fa6\u5bdf\u540d\u4eba\uff0c\u4ed6\u5c06\u6210\u4e3a\u9996\u652f\u4fa6\u5bdf\u961f\u7684\u4e3b\u5c06\u3002',
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
        (action) => !action.disabled,
        t('tutorial.highlight.replenishScoutFormation'),
        { type: 'autoReplenishArmyFormation' },
      );
    }
    return host.showHighlight(
      'saveArmyFormation',
      (action) => !action.disabled,
      '\u4fdd\u5b58\u7f16\u961f\uff0c\u63a5\u4e0b\u6765\u5c31\u53ef\u4ee5\u51fa\u57ce\u4fa6\u5bdf\u571f\u5730\u4e86\u3002',
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
      (action) => !action.disabled && String(action.targetId || '') === String(candidate.id),
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
        !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
      '\u8fd9\u662f\u4e00\u5ea7\u65e0\u4e3b\u7a7a\u57ce\uff0c\u70b9\u51fb\u5360\u9886\uff0c\u6d3e\u4eba\u5efa\u7acb\u65b0\u636e\u70b9\u3002',
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
          !action.disabled &&
          (!siteId || action.territoryId === siteId || action.cityId === siteId),
        `\u7ed9${site.naturalName || '\u8fd9\u5ea7\u65b0\u57ce'}\u53d6\u4e00\u4e2a\u540d\u5b57\uff0c\u8ba9\u5b83\u6210\u4e3a\u771f\u6b63\u7684\u57ce\u5e02\u3002`,
        { type: 'renameCity', territoryId: siteId },
      );
    }
    if (!host.getNamingInputValue?.()) {
      return host.showHighlight(
        'requestNamingInput',
        (action) => !action.disabled,
        '\u5148\u70b9\u51fb\u8f93\u5165\u6846\uff0c\u4e3a\u65b0\u57ce\u586b\u5165\u4e00\u4e2a\u540d\u5b57\u3002',
        { type: 'requestNamingInput' },
      );
    }
    return host.showHighlight(
      'submitNaming',
      (action) => !action.disabled,
      '\u786e\u8ba4\u57ce\u5e02\u540d\u79f0\uff0c\u63a5\u4e0b\u6765\u4e3a\u6211\u4eec\u7684\u6587\u660e\u547d\u540d\u3002',
      { type: 'submitNaming' },
    );
  }

  function renderPolityNaming(host) {
    if (!host.isNamingOpen?.('polity')) {
      host.game?.openNaming?.({
        type: 'polity',
        title: '\u4e3a\u6587\u660e\u547d\u540d',
        message:
          '\u65b0\u57ce\u5df2\u7ecf\u5e76\u5165\u6211\u4eec\u7684\u7248\u56fe\uff0c\u73b0\u5728\u7ed9\u8fd9\u4e2a\u65b0\u751f\u6587\u660e\u4e00\u4e2a\u540d\u5b57\u3002',
      });
    }
    if (!host.getNamingInputValue?.()) {
      return host.showHighlight(
        'requestNamingInput',
        (action) => !action.disabled,
        '\u8f93\u5165\u6587\u660e\u540d\u79f0\uff0c\u8fd9\u4e2a\u540d\u5b57\u4f1a\u8bb0\u5f55\u5728\u52bf\u529b\u6863\u6848\u91cc\u3002',
        { type: 'requestNamingInput' },
      );
    }
    return host.showHighlight(
      'submitNaming',
      (action) => !action.disabled,
      '\u786e\u8ba4\u6587\u660e\u540d\u79f0\uff0c\u8fd9\u6761\u5f3a\u5f15\u5bfc\u5c31\u53ea\u5269\u6700\u540e\u7684\u79d1\u6280\u8bf4\u660e\u4e86\u3002',
      { type: 'submitNaming' },
    );
  }

  function renderTalentAdjustment(host) {
    host.ensureCityPeopleGuideVisible?.();
    if (!host.isCityManagementTabOpen?.('people')) {
      return host.showHighlight(
        'switchCityManagementTab',
        (action) => !action.disabled && action.tab === 'people',
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
      (action) => !action.disabled && Number(action.delta) !== 0,
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
      (action) => action.buildingId === 'house',
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
      // Homestead claim pair: at cityEntered the house supplies are claimed
      // from the task center BEFORE the house-build guide takes over.
      ...makeTaskClaimPairRules({
        openId: 'homestead-open-task-center',
        claimId: 'homestead-claim-supplies',
        step: steps.cityEntered,
        taskId: 'main_homestead_supplies',
        openMessage: () => t('tutorial.highlight.openHomesteadTask'),
        claimMessage: () => t('tutorial.highlight.claimHomesteadSupplies'),
      }),
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
        message:
          '\u5efa\u9020\u7b2c\u4e00\u5757\u519c\u7530\uff0c\u8ba9\u98df\u7269\u4f9b\u5e94\u5148\u7a33\u5b9a\u4e0b\u6765\u3002',
      }),
      makeTabOpenRule({
        id: 'era2-open-civilization',
        steps: [steps.era2AdvanceReady],
        panel: 'civilization',
        message:
          '\u56de\u5230\u6587\u660e\uff0c\u628a\u805a\u843d\u63a8\u5411\u4e0b\u4e00\u4e2a\u65f6\u4ee3\u3002',
      }),
      {
        id: 'era2-advance',
        matches: all(stepIs(steps.era2AdvanceReady), isCommandPanelOpen('civilization')),
        render: (host) =>
          renderAdvanceEra(
            host,
            '\u6761\u4ef6\u5df2\u7ecf\u51c6\u5907\u597d\uff0c\u70b9\u51fb\u8fdb\u9636\u8fdb\u5165\u805a\u843d\u65f6\u4ee3\u3002',
          ),
      },
      makeTabOpenRule({
        id: 'era2-open-events',
        steps: [steps.eraAdvancedTo2],
        panel: 'events',
        message:
          '\u6253\u5f00\u4e8b\u4ef6\uff0c\u5904\u7406\u68ee\u6797\u91cc\u7684\u6728\u6750\u7ebf\u7d22\u3002',
      }),
      {
        id: 'era2-open-forest-event',
        matches: eventPanelOpen,
        render: (host) =>
          host.showHighlight(
            'openEvent',
            (action) => !action.disabled && action.eventId === 'evt_settlement_forest_001',
            '\u70b9\u5f00\u68ee\u6797\u4f4e\u8bed\u4e8b\u4ef6\uff0c\u5148\u628a\u53ef\u7528\u7684\u6728\u6750\u6536\u4e0b\u3002',
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
              !action.disabled &&
              action.eventId === 'evt_settlement_forest_001' &&
              action.optionId === 'opt_collect_wood',
            '\u9886\u53d6\u8fd9\u6279\u6728\u6750\uff0c\u6211\u4eec\u9a6c\u4e0a\u5efa\u8d77\u4f10\u6728\u573a\u3002',
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
        message:
          '\u5efa\u9020\u4f10\u6728\u573a\uff0c\u8ba9\u6728\u6750\u5f00\u59cb\u6301\u7eed\u6d41\u5165\u4ed3\u5e93\u3002',
      }),
      ...makeTaskClaimPairRules({
        openId: 'lumbermill-open-task-center',
        claimId: 'lumbermill-claim-task',
        step: steps.lumbermillBuilt,
        taskId: 'main_lumbermill_supplies',
        openMessage:
          '\u6253\u5f00\u4efb\u52a1\uff0c\u9886\u53d6\u4f10\u6728\u573a\u5b8c\u6210\u540e\u7684\u4e3b\u7ebf\u5956\u52b1\u3002',
        claimMessage:
          '\u9886\u53d6\u201c\u8ba9\u6728\u6750\u6d41\u5165\u4ed3\u623f\u201d\uff0c\u4e0b\u4e00\u6b21\u8fdb\u9636\u7684\u7269\u8d44\u5c31\u5230\u4f4d\u4e86\u3002',
      }),
      makeTabOpenRule({
        id: 'era3-open-civilization',
        steps: [steps.era3AdvanceReady],
        panel: 'civilization',
        message:
          '\u6253\u5f00\u6587\u660e\uff0c\u7528\u4f10\u6728\u573a\u7684\u7269\u8d44\u63a8\u8fdb\u5230\u57ce\u90a6\u65f6\u4ee3\u3002',
      }),
      {
        id: 'era3-advance',
        matches: all(stepIs(steps.era3AdvanceReady), isCommandPanelOpen('civilization')),
        render: (host) =>
          renderAdvanceEra(
            host,
            '\u8fdb\u9636\u5230\u57ce\u90a6\u65f6\u4ee3\uff0c\u4fa6\u5bdf\u4e0e\u540d\u4eba\u7f16\u961f\u5c31\u4f1a\u6b63\u5f0f\u5f00\u653e\u3002',
          ),
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
            (action) => !action.disabled,
            '\u5361\u7247\u5df2\u7ecf\u770b\u8fc7\uff0c\u5148\u8fd4\u56de\u540d\u4eba\u5217\u8868\u3002',
            { type: 'closeFamousPersonDetail' },
          ),
      },
      {
        id: 'scout-close-famous-panel',
        matches: all(famousCardViewed, isFamousPersonsOpen),
        render: (host) =>
          host.showHighlight(
            'closeFamousPersons',
            (action) => !action.disabled,
            '\u5173\u95ed\u540d\u4eba\u9762\u677f\uff0c\u63a5\u4e0b\u6765\u56de\u4e3b\u57ce\u914d\u7f6e\u7b2c\u4e00\u652f\u4fa6\u5bdf\u7f16\u961f\u3002',
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
            (action) => !action.disabled && action.tab === 'military',
            '\u5207\u5230\u57ce\u5185\u519b\u4e8b\uff0c\u6211\u4eec\u8981\u628a\u8fd9\u4f4d\u540d\u4eba\u653e\u8fdb\u4fa6\u5bdf\u7f16\u961f\u3002',
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
            (action) => !action.disabled && Number(action.slot || 1) === 1,
            '\u70b9\u51fb\u7b2c\u4e00\u5f20\u7f16\u961f\u5361\u7247\uff0c\u628a\u4fa6\u5bdf\u540d\u4eba\u653e\u8fdb\u961f\u4f0d\u3002',
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
          return host.showHighlight(
            'selectWorldMarchTarget',
            (action) => !action.disabled,
            '\u70b9\u9009\u5927\u5730\u56fe\u4e0a\u7684\u4e00\u5757\u76ee\u6807\u5730\uff0c\u6211\u4eec\u4f1a\u628a\u4fa6\u5bdf\u961f\u6d3e\u5f80\u90a3\u91cc\u3002',
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
            (action) => !action.disabled,
            '\u76ee\u6807\u5df2\u7ecf\u6807\u51fa\uff0c\u70b9\u51fb\u884c\u519b\uff0c\u9009\u62e9\u672c\u6b21\u51fa\u57ce\u7684\u961f\u4f0d\u3002',
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
            (action) => !action.disabled && Number(action.formationSlot || action.slot || 1) === 1,
            '\u9009\u62e9\u7b2c\u4e00\u652f\u4fa6\u5bdf\u961f\u51fa\u57ce\uff0c\u8def\u7ebf\u4f1a\u7559\u5728\u5927\u5730\u56fe\u4e0a\u3002',
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
              !action.disabled &&
              (!siteId || action.territoryId === siteId || action.cityId === siteId),
            '\u961f\u4f0d\u5df2\u7ecf\u5230\u8fbe\uff0c\u70b9\u51fb\u5b8c\u6210\u5360\u9886\uff0c\u628a\u8fd9\u91cc\u7eb3\u5165\u6211\u4eec\u7684\u7248\u56fe\u3002',
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
              (action) => !action.disabled && action.tab === 'people',
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
            (action) => !action.disabled,
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
            (action) => !action.disabled,
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
            (action) => !action.disabled,
            t('tutorial.highlight.seekFamous'),
            { type: 'seekFamousPerson' },
          ),
      },
      makeTabOpenRule({
        id: 'final-tech-open',
        steps: [steps.famousSeekCompleted, steps.finalTechOpened],
        panel: 'tech',
        message:
          '\u6253\u5f00\u79d1\u6280\uff0c\u770b\u770b\u6587\u660e\u672a\u6765\u7684\u53d1\u5c55\u8def\u7ebf\u3002',
      }),
      {
        id: 'final-tech-soft-guide',
        matches: stepIs(steps.famousSeekCompleted, steps.finalTechOpened),
        render: (host) =>
          host.showSoftGuide?.(
            'tech-tree',
            '\u79d1\u6280\u70b9\u4f1a\u5f71\u54cd\u6587\u660e\u7684\u53d1\u5c55\u8fdb\u7a0b\uff0c\u4e0d\u540c\u8def\u7ebf\u4f1a\u628a\u805a\u843d\u5e26\u5411\u519c\u4e1a\u3001\u519b\u4e8b\u6216\u5de5\u4e1a\u7b49\u4e0d\u540c\u4fa7\u91cd\u3002\u63a5\u4e0b\u6765\u7531\u4f60\u6765\u51b3\u5b9a\u7b2c\u4e00\u9879\u7814\u7a76\u3002',
          ) || false,
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

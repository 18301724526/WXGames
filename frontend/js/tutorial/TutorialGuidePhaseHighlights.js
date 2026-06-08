(function (global) {
  function install(TutorialGuideController) {
    if (!TutorialGuideController?.prototype) return false;
    const TUTORIAL_STEPS = TutorialGuideController.TUTORIAL_STEPS || {};
    TutorialGuideController.prototype.refreshCurrentHighlight = function refreshCurrentHighlight() {
    if (this.isAdvisorOpen()) {
      this.game?.canvasShell?.hideTutorialHighlight?.();
      return false;
    }
    if (this.isRewardRevealOpen()) {
      this.game?.canvasShell?.hideTutorialHighlight?.();
      return false;
    }
    if (this.isFirstEraGuideActive()) {
      const step = this.getCurrentStep();
      if (step === TUTORIAL_STEPS.houseBuilt && !this.isOnTab('civilization')) {
        this.prepareCommandPanelGuide('civilization');
        return this.showHighlight(
          'openCommandPanel',
          (action) => !action.disabled && action.panel === 'civilization',
          '点击文明，查看族群迈向下一阶段所需的条件。',
          { type: 'openCommandPanel', panel: 'civilization' },
        );
      }
      if (step === TUTORIAL_STEPS.civilizationTabOpened) {
        return this.showHighlight(
          'advanceEra',
          (action) => !action.disabled,
          '条件已经满足，点击进阶，让文明迈入农耕时代。',
          { type: 'advanceEra' },
        );
      }
      if (step === TUTORIAL_STEPS.eraAdvancedTo1 && !this.isTaskCenterOpen()) {
        return this.showHighlight(
          'openTaskCenter',
          (action) => !action.disabled && (action.tab || 'main') === 'main',
          '打开任务，领取第一份主线物资。',
          { type: 'openTaskCenter' },
        );
      }
      if (step === TUTORIAL_STEPS.eraAdvancedTo1 && this.isTaskCenterOpen()) {
        return this.showHighlight(
          'claimTaskReward',
          (action) => !action.disabled && action.taskId === 'main_first_supplies',
          '领取“安居的火种”，准备建造第一块农田。',
          { type: 'claimTaskReward', taskId: 'main_first_supplies', category: 'main' },
        );
      }
    }
    if (this.isFarmGuideActive()) {
      return this.showBuildingGuide(
        'farm',
        '\u5efa\u9020\u7b2c\u4e00\u5757\u519c\u7530\uff0c\u8ba9\u98df\u7269\u4f9b\u5e94\u5148\u7a33\u5b9a\u4e0b\u6765\u3002',
      );
    }
    if (this.isEra2GuideActive()) {
      const step = this.getCurrentStep();
      if (step === TUTORIAL_STEPS.era2AdvanceReady && !this.isCommandPanelOpen('civilization')) {
        this.prepareCommandPanelGuide('civilization');
        return this.showHighlight(
          'openCommandPanel',
          (action) => !action.disabled && action.panel === 'civilization',
          '\u56de\u5230\u6587\u660e\uff0c\u628a\u805a\u843d\u63a8\u5411\u4e0b\u4e00\u4e2a\u65f6\u4ee3\u3002',
          { type: 'openCommandPanel', panel: 'civilization' },
        );
      }
      if (step === TUTORIAL_STEPS.era2AdvanceReady && this.isCommandPanelOpen('civilization')) {
        return this.showHighlight(
          'advanceEra',
          (action) => !action.disabled,
          '\u6761\u4ef6\u5df2\u7ecf\u51c6\u5907\u597d\uff0c\u70b9\u51fb\u8fdb\u9636\u8fdb\u5165\u805a\u843d\u65f6\u4ee3\u3002',
          { type: 'advanceEra' },
        );
      }
      if (step === TUTORIAL_STEPS.eraAdvancedTo2 && !this.isCommandPanelOpen('events')) {
        this.prepareCommandPanelGuide('events');
        return this.showHighlight(
          'openCommandPanel',
          (action) => !action.disabled && action.panel === 'events',
          '\u6253\u5f00\u4e8b\u4ef6\uff0c\u5904\u7406\u68ee\u6797\u91cc\u7684\u6728\u6750\u7ebf\u7d22\u3002',
          { type: 'openCommandPanel', panel: 'events' },
        );
      }
      if (
        (step === TUTORIAL_STEPS.specialEventTabOpened || (step === TUTORIAL_STEPS.eraAdvancedTo2 && this.isCommandPanelOpen('events')))
        && !this.getActiveEventId()
      ) {
        return this.showHighlight(
          'openEvent',
          (action) => !action.disabled && action.eventId === 'evt_settlement_forest_001',
          '\u70b9\u5f00\u68ee\u6797\u4f4e\u8bed\u4e8b\u4ef6\uff0c\u5148\u628a\u53ef\u7528\u7684\u6728\u6750\u6536\u4e0b\u3002',
          { type: 'openEvent', eventId: 'evt_settlement_forest_001' },
        );
      }
      if (
        (step === TUTORIAL_STEPS.specialEventTabOpened || (step === TUTORIAL_STEPS.eraAdvancedTo2 && this.isCommandPanelOpen('events')))
        && this.getActiveEventId() === 'evt_settlement_forest_001'
      ) {
        return this.showHighlight(
          'claimEvent',
          (action) => !action.disabled && action.eventId === 'evt_settlement_forest_001' && action.optionId === 'opt_collect_wood',
          '\u9886\u53d6\u8fd9\u6279\u6728\u6750\uff0c\u6211\u4eec\u9a6c\u4e0a\u5efa\u8d77\u4f10\u6728\u573a\u3002',
          { type: 'claimEvent', eventId: 'evt_settlement_forest_001', optionId: 'opt_collect_wood' },
        );
      }
      if (step === TUTORIAL_STEPS.specialEventClaimed || step === TUTORIAL_STEPS.buildingsTabOpenedForLumbermill) {
        return this.showBuildingGuide(
          'lumbermill',
          '\u5efa\u9020\u4f10\u6728\u573a\uff0c\u8ba9\u6728\u6750\u5f00\u59cb\u6301\u7eed\u6d41\u5165\u4ed3\u5e93\u3002',
        );
      }
      if (step === TUTORIAL_STEPS.lumbermillBuilt && !this.isTaskCenterOpen()) {
        return this.showHighlight(
          'openTaskCenter',
          (action) => !action.disabled && (action.tab || 'main') === 'main',
          '\u6253\u5f00\u4efb\u52a1\uff0c\u9886\u53d6\u4f10\u6728\u573a\u5b8c\u6210\u540e\u7684\u4e3b\u7ebf\u5956\u52b1\u3002',
          { type: 'openTaskCenter' },
        );
      }
      if (step === TUTORIAL_STEPS.lumbermillBuilt && this.isTaskCenterOpen()) {
        return this.showHighlight(
          'claimTaskReward',
          (action) => !action.disabled && action.taskId === 'main_lumbermill_supplies',
          '\u9886\u53d6\u201c\u8ba9\u6728\u6750\u6d41\u5165\u4ed3\u623f\u201d\uff0c\u4e0b\u4e00\u6b21\u8fdb\u9636\u7684\u7269\u8d44\u5c31\u5230\u4f4d\u4e86\u3002',
          { type: 'claimTaskReward', taskId: 'main_lumbermill_supplies', category: 'main' },
        );
      }
    }
    if (this.isScoutFormationGuideActive()) {
      const step = this.getCurrentStep();
      const scoutPersonId = this.getScoutFamousPersonId();
      if (step === TUTORIAL_STEPS.era3AdvanceReady && !this.isCommandPanelOpen('civilization')) {
        this.prepareCommandPanelGuide('civilization');
        return this.showHighlight(
          'openCommandPanel',
          (action) => !action.disabled && action.panel === 'civilization',
          '\u6253\u5f00\u6587\u660e\uff0c\u7528\u4f10\u6728\u573a\u7684\u7269\u8d44\u63a8\u8fdb\u5230\u57ce\u90a6\u65f6\u4ee3\u3002',
          { type: 'openCommandPanel', panel: 'civilization' },
        );
      }
      if (step === TUTORIAL_STEPS.era3AdvanceReady && this.isCommandPanelOpen('civilization')) {
        return this.showHighlight(
          'advanceEra',
          (action) => !action.disabled,
          '\u8fdb\u9636\u5230\u57ce\u90a6\u65f6\u4ee3\uff0c\u4fa6\u5bdf\u4e0e\u540d\u4eba\u7f16\u961f\u5c31\u4f1a\u6b63\u5f0f\u5f00\u653e\u3002',
          { type: 'advanceEra' },
        );
      }
      if (step === TUTORIAL_STEPS.scoutFamousGranted && !this.isFamousPersonsOpen()) {
        return this.showHighlight(
          'openFamousPersons',
          (action) => !action.disabled,
          '\u6253\u5f00\u540d\u4eba\uff0c\u67e5\u770b\u521a\u52a0\u5165\u7684\u4fa6\u5bdf\u578b\u82f1\u6770\u3002',
          { type: 'openFamousPersons' },
        );
      }
      if (step === TUTORIAL_STEPS.famousPanelOpened && this.isFamousPersonsOpen()) {
        return this.showHighlight(
          'openFamousPersonDetail',
          (action) => !action.disabled && (!scoutPersonId || action.personId === scoutPersonId),
          '\u70b9\u5f00\u8fd9\u5f20\u4fa6\u5bdf\u578b\u540d\u4eba\u5361\uff0c\u8bb0\u4f4f\u4ed6\u4f1a\u5e26\u961f\u51fa\u57ce\u63a2\u8def\u3002',
          { type: 'openFamousPersonDetail', personId: scoutPersonId },
        );
      }
      if (step === TUTORIAL_STEPS.famousCardViewed && this.isFamousPersonsOpen() && this.isFamousPersonDetailOpen()) {
        return this.showHighlight(
          'closeFamousPersonDetail',
          (action) => !action.disabled,
          '\u5361\u7247\u5df2\u7ecf\u770b\u8fc7\uff0c\u5148\u8fd4\u56de\u540d\u4eba\u5217\u8868\u3002',
          { type: 'closeFamousPersonDetail' },
        );
      }
      if (step === TUTORIAL_STEPS.famousCardViewed && this.isFamousPersonsOpen()) {
        return this.showHighlight(
          'closeFamousPersons',
          (action) => !action.disabled,
          '\u5173\u95ed\u540d\u4eba\u9762\u677f\uff0c\u63a5\u4e0b\u6765\u56de\u4e3b\u57ce\u914d\u7f6e\u7b2c\u4e00\u652f\u4fa6\u5bdf\u7f16\u961f\u3002',
          { type: 'closeFamousPersons' },
        );
      }
      const capitalCityId = this.getCapitalCityId();
      if (step === TUTORIAL_STEPS.famousCardViewed && this.isWorldSiteSelected(capitalCityId) && !this.isFamousPersonsOpen() && !this.isCityManagementOpen()) {
        return this.showCapitalEnterHighlight(capitalCityId);
      }
      if (step === TUTORIAL_STEPS.famousCardViewed && !this.isFamousPersonsOpen() && !this.isCityManagementOpen()) {
        return this.focusCapitalSite(capitalCityId);
      }
      if (step === TUTORIAL_STEPS.famousCardViewed && this.isCityManagementOpen() && !this.isCityManagementTabOpen('military')) {
        return this.showHighlight(
          'switchCityManagementTab',
          (action) => !action.disabled && action.tab === 'military',
          '\u5207\u5230\u57ce\u5185\u519b\u4e8b\uff0c\u6211\u4eec\u8981\u628a\u8fd9\u4f4d\u540d\u4eba\u653e\u8fdb\u4fa6\u5bdf\u7f16\u961f\u3002',
          { type: 'switchCityManagementTab', tab: 'military' },
        );
      }
      if (step === TUTORIAL_STEPS.famousCardViewed && this.isCityManagementOpen() && this.isCityManagementTabOpen('military') && !this.getArmyFormationEditor().open) {
        return this.showHighlight(
          'openArmyFormation',
          (action) => !action.disabled && Number(action.slot || 1) === 1,
          '\u70b9\u51fb\u7b2c\u4e00\u5f20\u7f16\u961f\u5361\u7247\uff0c\u628a\u4fa6\u5bdf\u540d\u4eba\u653e\u8fdb\u961f\u4f0d\u3002',
          { type: 'openArmyFormation', cityId: capitalCityId, slot: 1 },
        );
      }
      const editor = this.getArmyFormationEditor();
      if (step === TUTORIAL_STEPS.formationPanelOpened && editor.open) {
        const memberIds = Array.isArray(editor.memberIds) ? editor.memberIds.map(String) : [];
        if (scoutPersonId && !memberIds.includes(scoutPersonId)) {
          return this.showHighlight(
            'toggleArmyFormationMember',
            (action) => !action.disabled && action.personId === scoutPersonId,
            '\u9009\u4e2d\u8fd9\u4f4d\u4fa6\u5bdf\u540d\u4eba\uff0c\u4ed6\u5c06\u6210\u4e3a\u9996\u652f\u4fa6\u5bdf\u961f\u7684\u4e3b\u5c06\u3002',
            { type: 'toggleArmyFormationMember', personId: scoutPersonId },
          );
        }
        return this.showHighlight(
          'saveArmyFormation',
          (action) => !action.disabled,
          '\u4fdd\u5b58\u7f16\u961f\uff0c\u63a5\u4e0b\u6765\u5c31\u53ef\u4ee5\u51fa\u57ce\u4fa6\u5bdf\u571f\u5730\u4e86\u3002',
          { type: 'saveArmyFormation' },
        );
      }
    }
    if (this.isScoutExploreGuideActive()) {
      const step = this.getCurrentStep();
      const explorer = this.game?.state?.worldExplorerState || {};
      const activeMission = explorer.activeMission || null;
      const readyMission = Array.isArray(explorer.readyMissions) ? explorer.readyMissions[0] : null;
      if (step === TUTORIAL_STEPS.scoutFormationSaved) {
        this.ensureMapHomeGuideVisible({ clearWorldMarchTarget: true });
        return this.showHighlight(
          'selectWorldMarchTarget',
          (action) => !action.disabled,
          '\u70b9\u9009\u5927\u5730\u56fe\u4e0a\u7684\u4e00\u5757\u76ee\u6807\u5730\uff0c\u6211\u4eec\u4f1a\u628a\u4fa6\u5bdf\u961f\u6d3e\u5f80\u90a3\u91cc\u3002',
          { type: 'selectWorldMarchTarget' },
        );
      }
      if (step === TUTORIAL_STEPS.scoutWorldPanelOpened && !this.isWorldMarchFormationPickerOpen()) {
        this.ensureMapHomeGuideVisible();
        return this.showHighlight(
          'openWorldMarchFormationPicker',
          (action) => !action.disabled,
          '\u76ee\u6807\u5df2\u7ecf\u6807\u51fa\uff0c\u70b9\u51fb\u884c\u519b\uff0c\u9009\u62e9\u672c\u6b21\u51fa\u57ce\u7684\u961f\u4f0d\u3002',
          { type: 'openWorldMarchFormationPicker' },
        );
      }
      if (step === TUTORIAL_STEPS.scoutWorldPanelOpened && this.isWorldMarchFormationPickerOpen()) {
        return this.showHighlight(
          'startWorldMarch',
          (action) => !action.disabled && Number(action.formationSlot || action.slot || 1) === 1,
          '\u9009\u62e9\u7b2c\u4e00\u652f\u4fa6\u5bdf\u961f\u51fa\u57ce\uff0c\u8def\u7ebf\u4f1a\u7559\u5728\u5927\u5730\u56fe\u4e0a\u3002',
          { type: 'startWorldMarch', formationSlot: 1 },
        );
      }
      if (step === TUTORIAL_STEPS.scoutExploreStarted && readyMission) {
        return this.showHighlight(
          'claimExplore',
          (action) => !action.disabled && (!readyMission.id || action.missionId === readyMission.id),
          '\u4fa6\u5bdf\u961f\u5df2\u8fd4\u56de\uff0c\u70b9\u51fb\u5f52\u961f\uff0c\u67e5\u770b\u65b0\u53d1\u73b0\u7684\u7a7a\u57ce\u3002',
          { type: 'claimExplore', missionId: readyMission.id },
        );
      }
      if (step === TUTORIAL_STEPS.scoutExploreStarted && activeMission) {
        this.game?.canvasShell?.hideTutorialHighlight?.();
        return false;
      }
    }
    if (this.isFirstCityGuideActive()) {
      const step = this.getCurrentStep();
      const siteId = this.getFirstExploreCityId();
      const site = this.getFirstExploreCity() || {};
      if (step === TUTORIAL_STEPS.scoutExploreClaimed) {
        if (!this.isWorldSiteSelected(siteId)) {
          const highlighted = this.showFirstCitySiteOpenHighlight(siteId);
          if (highlighted) return true;
          return this.focusFirstCitySite(siteId);
        }
        return this.showHighlight(
          'conquer',
          (action) => !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
          '\u8fd9\u662f\u4e00\u5ea7\u65e0\u4e3b\u7a7a\u57ce\uff0c\u70b9\u51fb\u5360\u9886\uff0c\u6d3e\u4eba\u5efa\u7acb\u65b0\u636e\u70b9\u3002',
          { type: 'conquer', territoryId: siteId },
        );
      }
      if (step === TUTORIAL_STEPS.firstCityConquestStarted) {
        return this.showHighlight(
          'claimConquest',
          (action) => !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
          '\u961f\u4f0d\u5df2\u7ecf\u5230\u8fbe\uff0c\u70b9\u51fb\u5b8c\u6210\u5360\u9886\uff0c\u628a\u8fd9\u91cc\u7eb3\u5165\u6211\u4eec\u7684\u7248\u56fe\u3002',
          { type: 'claimConquest', territoryId: siteId },
        );
      }
      if (step === TUTORIAL_STEPS.firstCityOccupied) {
        if (!this.isNamingOpen('city', siteId)) {
          return this.showHighlight(
            'renameCity',
            (action) => !action.disabled && (!siteId || action.territoryId === siteId || action.cityId === siteId),
            `\u7ed9${site.naturalName || '\u8fd9\u5ea7\u65b0\u57ce'}\u53d6\u4e00\u4e2a\u540d\u5b57\uff0c\u8ba9\u5b83\u6210\u4e3a\u771f\u6b63\u7684\u57ce\u5e02\u3002`,
            { type: 'renameCity', territoryId: siteId },
          );
        }
        if (!this.getNamingInputValue()) {
          return this.showHighlight(
            'requestNamingInput',
            (action) => !action.disabled,
            '\u5148\u70b9\u51fb\u8f93\u5165\u6846\uff0c\u4e3a\u65b0\u57ce\u586b\u5165\u4e00\u4e2a\u540d\u5b57\u3002',
            { type: 'requestNamingInput' },
          );
        }
        return this.showHighlight(
          'submitNaming',
          (action) => !action.disabled,
          '\u786e\u8ba4\u57ce\u5e02\u540d\u79f0\uff0c\u63a5\u4e0b\u6765\u4e3a\u6211\u4eec\u7684\u6587\u660e\u547d\u540d\u3002',
          { type: 'submitNaming' },
        );
      }
      if (step === TUTORIAL_STEPS.firstCityNamed) {
        if (!this.isNamingOpen('polity')) {
          this.game?.openNaming?.({
            type: 'polity',
            title: '\u4e3a\u6587\u660e\u547d\u540d',
            message: '\u65b0\u57ce\u5df2\u7ecf\u5e76\u5165\u6211\u4eec\u7684\u7248\u56fe\uff0c\u73b0\u5728\u7ed9\u8fd9\u4e2a\u65b0\u751f\u6587\u660e\u4e00\u4e2a\u540d\u5b57\u3002',
          });
        }
        if (!this.getNamingInputValue()) {
          return this.showHighlight(
            'requestNamingInput',
            (action) => !action.disabled,
            '\u8f93\u5165\u6587\u660e\u540d\u79f0\uff0c\u8fd9\u4e2a\u540d\u5b57\u4f1a\u8bb0\u5f55\u5728\u52bf\u529b\u6863\u6848\u91cc\u3002',
            { type: 'requestNamingInput' },
          );
        }
        return this.showHighlight(
          'submitNaming',
          (action) => !action.disabled,
          '\u786e\u8ba4\u6587\u660e\u540d\u79f0\uff0c\u8fd9\u6761\u5f3a\u5f15\u5bfc\u5c31\u53ea\u5269\u6700\u540e\u7684\u79d1\u6280\u8bf4\u660e\u4e86\u3002',
          { type: 'submitNaming' },
        );
      }
    }
    if (this.isPostNamingSystemGuideActive()) {
      const step = this.getCurrentStep();
      if (step === TUTORIAL_STEPS.polityNamed) {
        this.ensureResourcesGuideVisible();
        return this.showHighlight(
          'openTalentPolicy',
          (action) => !action.disabled,
          '先打开方针，看看文明会怎样自动安排人才。',
          { type: 'openTalentPolicy' },
          this.getResourcesGuideHighlightOptions(),
        );
      }
      if (step === TUTORIAL_STEPS.talentPolicyOpened) {
        if (!this.isTalentPolicyOpen()) {
          this.ensureResourcesGuideVisible();
          return this.showHighlight(
            'openTalentPolicy',
            (action) => !action.disabled,
            '打开方针面板，确认一套适合当前阶段的人才安排。',
            { type: 'openTalentPolicy' },
            this.getResourcesGuideHighlightOptions(),
          );
        }
        return this.showHighlight(
          'confirmTalentPolicy',
          (action) => !action.disabled,
          '确认这套方针，系统会先帮我们把人才分配到更合适的位置。',
          { type: 'confirmTalentPolicy' },
        );
      }
      if (step === TUTORIAL_STEPS.talentPolicyApplied) {
        this.ensureResourcesGuideVisible();
        const picked = this.pickManualAssignAction();
        if (picked?.target) {
          return this.game?.canvasShell?.showTutorialHighlight?.(
            picked.target,
            '现在手动调整一次人才分配，之后你就能按城市需要微调岗位。',
            { ...this.getResourcesGuideHighlightOptions(), allowedAction: picked.action, source: 'strongTutorial' },
          ) || false;
        }
        return false;
      }
      if (step === TUTORIAL_STEPS.manualTalentAssigned) {
        return this.showHighlight(
          'openFamousPersons',
          (action) => !action.disabled,
          '打开名人，试一次寻访，看看新的候选人如何出现。',
          { type: 'openFamousPersons' },
        );
      }
      if (step === TUTORIAL_STEPS.famousSeekOpened) {
        if (!this.isFamousPersonsOpen()) {
          return this.showHighlight(
            'openFamousPersons',
            (action) => !action.disabled,
            '打开名人面板，进行一次寻访。',
            { type: 'openFamousPersons' },
          );
        }
        return this.showHighlight(
          'seekFamousPerson',
          (action) => !action.disabled,
          '点击寻访名人，新的候选人会进入名人馆等待你后续处理。',
          { type: 'seekFamousPerson' },
        );
      }
    }
    if (this.isFinalTechGuideActive()) {
      if (!this.isCommandPanelOpen('tech')) {
        this.prepareCommandPanelGuide('tech');
        return this.showHighlight(
          'openCommandPanel',
          (action) => !action.disabled && action.panel === 'tech',
          '\u6253\u5f00\u79d1\u6280\uff0c\u770b\u770b\u6587\u660e\u672a\u6765\u7684\u53d1\u5c55\u8def\u7ebf\u3002',
          { type: 'openCommandPanel', panel: 'tech' },
        );
      }
      return this.showSoftGuide(
        'tech-tree',
        '\u79d1\u6280\u70b9\u4f1a\u5f71\u54cd\u6587\u660e\u7684\u53d1\u5c55\u8fdb\u7a0b\uff0c\u4e0d\u540c\u8def\u7ebf\u4f1a\u628a\u805a\u843d\u5e26\u5411\u519c\u4e1a\u3001\u519b\u4e8b\u6216\u5de5\u4e1a\u7b49\u4e0d\u540c\u4fa7\u91cd\u3002\u63a5\u4e0b\u6765\u7531\u4f60\u6765\u51b3\u5b9a\u7b2c\u4e00\u9879\u7814\u7a76\u3002',
      );
    }
    if (!this.isHouseGuideActive()) return false;
    this.ensureHouseGuideVisible();
    const shell = this.game?.canvasShell;
    const target = shell?.getCanvasTarget?.('buildBuilding', (action) => action.buildingId === 'house');
    if (!target) return false;
    return shell.showTutorialHighlight?.(
      target,
      '建造第一处民居，让族人有稳定的居所。',
      { allowedAction: { type: 'buildBuilding', buildingId: 'house' }, source: 'strongTutorial' },
    ) || false;
    };
    return true;
  }

  const TutorialGuidePhaseHighlights = { install };
  global.TutorialGuidePhaseHighlights = TutorialGuidePhaseHighlights;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuidePhaseHighlights;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  const FINISH_ACTIONS = {
    enterCity(context = {}, action = {}) {
      return typeof context.enterCity === 'function' ? context.enterCity(action) : false;
    },

    openCityManagement(context = {}, action = {}) {
      return typeof context.openCityManagement === 'function' ? context.openCityManagement(action) : false;
    },

    closeCityManagement(context = {}, action = {}) {
      return typeof context.closeCityManagement === 'function' ? context.closeCityManagement(action) : false;
    },

    switchCityManagementTab(context = {}, action = {}) {
      return typeof context.switchCityManagementTab === 'function'
        ? context.switchCityManagementTab(action.tab, action)
        : false;
    },

    openArmyFormation(context = {}, action = {}) {
      return typeof context.openArmyFormation === 'function' ? context.openArmyFormation(action) : false;
    },

    closeArmyFormationEditor(context = {}, action = {}) {
      return typeof context.closeArmyFormationEditor === 'function' ? context.closeArmyFormationEditor(action) : false;
    },

    toggleArmyFormationMember(context = {}, action = {}) {
      return typeof context.toggleArmyFormationMember === 'function' ? context.toggleArmyFormationMember(action) : false;
    },

    changeArmyFormationPage(context = {}, action = {}) {
      return typeof context.changeArmyFormationPage === 'function' ? context.changeArmyFormationPage(action) : false;
    },

    changeArmyFormationSoldiers(context = {}, action = {}) {
      return typeof context.changeArmyFormationSoldiers === 'function'
        ? context.changeArmyFormationSoldiers(action)
        : false;
    },

    requestArmyFormationSoldierInput(context = {}, action = {}) {
      return typeof context.requestArmyFormationSoldierInput === 'function'
        ? context.requestArmyFormationSoldierInput(action)
        : false;
    },

    autoReplenishArmyFormation(context = {}, action = {}) {
      return typeof context.autoReplenishArmyFormation === 'function'
        ? context.autoReplenishArmyFormation(action)
        : false;
    },

    saveArmyFormation(context = {}, action = {}) {
      return typeof context.saveArmyFormation === 'function' ? context.saveArmyFormation(action) : false;
    },

    startWorldMarch(context = {}, action = {}) {
      return typeof context.startWorldMarch === 'function' ? context.startWorldMarch(action) : false;
    },

    returnWorldMarch(context = {}, action = {}) {
      const missionId = action.missionId || action.actorId || '';
      return typeof context.returnWorldMarch === 'function' ? context.returnWorldMarch(missionId) : false;
    },

    stopWorldMarch(context = {}, action = {}) {
      const missionId = action.missionId || action.actorId || '';
      return typeof context.stopWorldMarch === 'function' ? context.stopWorldMarch(missionId) : false;
    },
  };

  const COERCE_BOOLEAN_FINISH_ACTIONS = new Set([
    'startWorldMarch',
    'returnWorldMarch',
    'stopWorldMarch',
  ]);

  const RENDER_ACTIONS = {
    openResourceDetails(context = {}, action = {}) {
      return typeof context.openResourceDetails === 'function' ? context.openResourceDetails(action) : false;
    },

    closeResourceDetails(context = {}, action = {}) {
      return typeof context.closeResourceDetails === 'function' ? context.closeResourceDetails(action) : false;
    },

    openCommandPanel(context = {}, action = {}) {
      return typeof context.openCommandPanel === 'function' ? context.openCommandPanel(action) : false;
    },

    closeCommandPanel(context = {}, action = {}) {
      return typeof context.closeCommandPanel === 'function' ? context.closeCommandPanel(action) : false;
    },

    closeRewardReveal(context = {}, action = {}) {
      return typeof context.closeRewardReveal === 'function' ? context.closeRewardReveal(action) : false;
    },

    openCitySwitcher(context = {}, action = {}) {
      return typeof context.openCitySwitcher === 'function' ? context.openCitySwitcher(action) : false;
    },

    closeCitySwitcher(context = {}, action = {}) {
      return typeof context.closeCitySwitcher === 'function' ? context.closeCitySwitcher(action) : false;
    },

    openSubcityList(context = {}, action = {}) {
      return typeof context.openSubcityList === 'function' ? context.openSubcityList(action) : false;
    },

    closeSubcityList(context = {}, action = {}) {
      return typeof context.closeSubcityList === 'function' ? context.closeSubcityList(action) : false;
    },

    openSettings(context = {}, action = {}) {
      return typeof context.openSettings === 'function' ? context.openSettings(action) : false;
    },

    closeSettings(context = {}, action = {}) {
      return typeof context.closeSettings === 'function' ? context.closeSettings(action) : false;
    },

    openLogs(context = {}, action = {}) {
      return typeof context.openLogs === 'function' ? context.openLogs(action) : false;
    },

    closeLogs(context = {}, action = {}) {
      return typeof context.closeLogs === 'function' ? context.closeLogs(action) : false;
    },

    openAdvisor(context = {}, action = {}) {
      return typeof context.openAdvisor === 'function' ? context.openAdvisor(action) : false;
    },

    closeAdvisor(context = {}, action = {}) {
      return typeof context.closeAdvisor === 'function' ? context.closeAdvisor(action) : false;
    },

    goToAdvisorTarget(context = {}, action = {}) {
      return typeof context.goToAdvisorTarget === 'function' ? context.goToAdvisorTarget(action) : false;
    },

    openEvent(context = {}, action = {}) {
      return typeof context.openEvent === 'function' ? context.openEvent(action) : false;
    },

    closeEvent(context = {}, action = {}) {
      return typeof context.closeEvent === 'function' ? context.closeEvent(action) : false;
    },

    openWorldSite(context = {}, action = {}) {
      return typeof context.openWorldSite === 'function' ? context.openWorldSite(action) : false;
    },

    closeWorldSite(context = {}, action = {}) {
      return typeof context.closeWorldSite === 'function' ? context.closeWorldSite(action) : false;
    },

    jumpToSubcity(context = {}, action = {}) {
      return typeof context.jumpToSubcity === 'function' ? context.jumpToSubcity(action) : false;
    },

    resetWorldPan(context = {}, action = {}) {
      return typeof context.resetWorldPan === 'function' ? context.resetWorldPan(action) : false;
    },

    worldMapDrag(context = {}, action = {}) {
      return typeof context.worldMapDrag === 'function' ? context.worldMapDrag(action) : false;
    },

    changeExpeditionSoldiers(context = {}, action = {}) {
      return typeof context.changeExpeditionSoldiers === 'function'
        ? context.changeExpeditionSoldiers(action)
        : false;
    },

    changeExpeditionLeader(context = {}, action = {}) {
      return typeof context.changeExpeditionLeader === 'function'
        ? context.changeExpeditionLeader(action)
        : false;
    },

    enterBattleScene(context = {}, action = {}) {
      return typeof context.enterBattleScene === 'function' ? context.enterBattleScene(action) : false;
    },

    closeBattleScene(context = {}, action = {}) {
      return typeof context.closeBattleScene === 'function' ? context.closeBattleScene(action) : false;
    },

    skipBattleScene(context = {}, action = {}) {
      return typeof context.skipBattleScene === 'function' ? context.skipBattleScene(action) : false;
    },

    goToGuideTaskTarget(context = {}, action = {}) {
      return typeof context.goToGuideTaskTarget === 'function' ? context.goToGuideTaskTarget(action) : false;
    },

    openTaskCenter(context = {}, action = {}) {
      return typeof context.openTaskCenter === 'function' ? context.openTaskCenter(action) : false;
    },

    closeTaskCenter(context = {}, action = {}) {
      return typeof context.closeTaskCenter === 'function' ? context.closeTaskCenter(action) : false;
    },

    switchTaskCenterTab(context = {}, action = {}) {
      return typeof context.switchTaskCenterTab === 'function'
        ? context.switchTaskCenterTab(action.tab, action)
        : false;
    },

    openFamousPersons(context = {}, action = {}) {
      return typeof context.openFamousPersons === 'function' ? context.openFamousPersons(action) : false;
    },

    closeFamousPersons(context = {}, action = {}) {
      return typeof context.closeFamousPersons === 'function' ? context.closeFamousPersons(action) : false;
    },

    changeFamousPersonsPage(context = {}, action = {}) {
      return typeof context.changeFamousPersonsPage === 'function'
        ? context.changeFamousPersonsPage(action)
        : false;
    },

    openFamousPersonDetail(context = {}, action = {}) {
      return typeof context.openFamousPersonDetail === 'function'
        ? context.openFamousPersonDetail(action)
        : false;
    },

    closeFamousPersonDetail(context = {}, action = {}) {
      return typeof context.closeFamousPersonDetail === 'function'
        ? context.closeFamousPersonDetail(action)
        : false;
    },

    selectBuildingCategory(context = {}, action = {}) {
      return typeof context.selectBuildingCategory === 'function'
        ? context.selectBuildingCategory(action)
        : false;
    },

    selectTechNode(context = {}, action = {}) {
      return typeof context.selectTechNode === 'function' ? context.selectTechNode(action) : false;
    },

    closeTechDetail(context = {}, action = {}) {
      return typeof context.closeTechDetail === 'function' ? context.closeTechDetail(action) : false;
    },

    selectWorldMarchTarget(context = {}, action = {}) {
      return typeof context.selectWorldMarchTarget === 'function'
        ? context.selectWorldMarchTarget(action)
        : false;
    },

    openWorldMarchFormationPicker(context = {}, action = {}) {
      return typeof context.openWorldMarchFormationPicker === 'function'
        ? context.openWorldMarchFormationPicker(action)
        : false;
    },

    closeWorldMarchHud(context = {}, action = {}) {
      return typeof context.closeWorldMarchHud === 'function' ? context.closeWorldMarchHud(action) : false;
    },

    selectWorldActor(context = {}, action = {}) {
      return typeof context.selectWorldActor === 'function' ? context.selectWorldActor(action) : false;
    },

    openWorldTargetPicker(context = {}, action = {}) {
      return typeof context.openWorldTargetPicker === 'function'
        ? context.openWorldTargetPicker(action)
        : false;
    },

    chooseWorldTarget(context = {}, action = {}) {
      return typeof context.chooseWorldTarget === 'function' ? context.chooseWorldTarget(action) : false;
    },

    closeWorldTargetPicker(context = {}, action = {}) {
      return typeof context.closeWorldTargetPicker === 'function'
        ? context.closeWorldTargetPicker(action)
        : false;
    },
  };

  const SUPPORTED_ACTIONS = [
    'switchTab',
    'openResourceDetails',
    'closeResourceDetails',
    'openCommandPanel',
    'closeCommandPanel',
    'closeRewardReveal',
    'openCitySwitcher',
    'closeCitySwitcher',
    'openSubcityList',
    'closeSubcityList',
    'enterCity',
    'openCityManagement',
    'closeCityManagement',
    'switchCityManagementTab',
    'openArmyFormation',
    'closeArmyFormationEditor',
    'toggleArmyFormationMember',
    'changeArmyFormationPage',
    'changeArmyFormationSoldiers',
    'requestArmyFormationSoldierInput',
    'autoReplenishArmyFormation',
    'saveArmyFormation',
    'openSettings',
    'closeSettings',
    'openLogs',
    'closeLogs',
    'openAdvisor',
    'closeAdvisor',
    'goToAdvisorTarget',
    'openEvent',
    'closeEvent',
    'openWorldSite',
    'closeWorldSite',
    'jumpToSubcity',
    'resetWorldPan',
    'worldMapDrag',
    'selectWorldMarchTarget',
    'openWorldMarchFormationPicker',
    'closeWorldMarchHud',
    'startWorldMarch',
    'selectWorldActor',
    'openWorldTargetPicker',
    'chooseWorldTarget',
    'closeWorldTargetPicker',
    'returnWorldMarch',
    'stopWorldMarch',
    'changeExpeditionSoldiers',
    'changeExpeditionLeader',
    'enterBattleScene',
    'closeBattleScene',
    'skipBattleScene',
    'goToGuideTaskTarget',
    'openTaskCenter',
    'closeTaskCenter',
    'switchTaskCenterTab',
    'openFamousPersons',
    'closeFamousPersons',
    'changeFamousPersonsPage',
    'openFamousPersonDetail',
    'closeFamousPersonDetail',
    'selectBuildingCategory',
    'selectTechNode',
    'closeTechDetail',
  ];
  const SUPPORTED_ACTION_SET = new Set(SUPPORTED_ACTIONS);

  class CanvasActionDispatchRegistry {
    static supportedActions() {
      return [...SUPPORTED_ACTIONS];
    }

    static canHandle(action) {
      return Boolean(action && SUPPORTED_ACTION_SET.has(action.type));
    }

    static renderIfHandled(handled, context = {}, action = {}) {
      if (handled && typeof context.render === 'function') context.render(action);
      return handled;
    }

    static dispatchSwitchTab(action = {}, context = {}) {
      if (typeof context.resetForTabSwitch === 'function') context.resetForTabSwitch(action);
      const switched = typeof context.switchTab === 'function'
        ? context.switchTab(action.tab, action) !== false
        : false;
      return this.renderIfHandled(switched, context, action);
    }

    static dispatch(action = {}, context = {}, options = {}) {
      if (!this.canHandle(action)) return false;
      if (action.type === 'switchTab') return this.dispatchSwitchTab(action, context);

      const finishAction = FINISH_ACTIONS[action.type];
      if (finishAction) {
        const rawResult = finishAction(context, action);
        const result = COERCE_BOOLEAN_FINISH_ACTIONS.has(action.type) ? rawResult !== false : rawResult;
        return typeof options.finishHandled === 'function'
          ? options.finishHandled(result, context, action)
          : result !== false;
      }

      const renderAction = RENDER_ACTIONS[action.type];
      if (renderAction) {
        const handled = renderAction(context, action) !== false;
        return this.renderIfHandled(handled, context, action);
      }

      return false;
    }
  }

  global.CanvasActionDispatchRegistry = CanvasActionDispatchRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatchRegistry;
})(typeof globalThis !== 'undefined' ? globalThis : window);

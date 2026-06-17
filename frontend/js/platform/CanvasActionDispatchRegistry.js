(function (global) {
  const FINISH_ACTIONS = {
    enterCity: { method: 'enterCity' },
    openCityManagement: { method: 'openCityManagement' },
    closeCityManagement: { method: 'closeCityManagement' },
    switchCityManagementTab: { method: 'switchCityManagementTab', args: (action) => [action.tab, action] },
    openArmyFormation: { method: 'openArmyFormation' },
    closeArmyFormationEditor: { method: 'closeArmyFormationEditor' },
    toggleArmyFormationMember: { method: 'toggleArmyFormationMember' },
    changeArmyFormationPage: { method: 'changeArmyFormationPage' },
    saveArmyFormation: { method: 'saveArmyFormation' },
    startWorldMarch: { method: 'startWorldMarch', coerceBoolean: true },
    returnWorldMarch: { method: 'returnWorldMarch', args: (action) => [action.missionId || action.actorId || ''], coerceBoolean: true },
    stopWorldMarch: { method: 'stopWorldMarch', args: (action) => [action.missionId || action.actorId || ''], coerceBoolean: true },
  };

  const RENDER_ACTIONS = {
    openResourceDetails: { method: 'openResourceDetails' },
    closeResourceDetails: { method: 'closeResourceDetails' },
    openCommandPanel: { method: 'openCommandPanel' },
    closeCommandPanel: { method: 'closeCommandPanel' },
    closeRewardReveal: { method: 'closeRewardReveal' },
    openCitySwitcher: { method: 'openCitySwitcher' },
    closeCitySwitcher: { method: 'closeCitySwitcher' },
    openSubcityList: { method: 'openSubcityList' },
    closeSubcityList: { method: 'closeSubcityList' },
    openSettings: { method: 'openSettings' },
    closeSettings: { method: 'closeSettings' },
    openLogs: { method: 'openLogs' },
    closeLogs: { method: 'closeLogs' },
    openAdvisor: { method: 'openAdvisor' },
    closeAdvisor: { method: 'closeAdvisor' },
    goToAdvisorTarget: { method: 'goToAdvisorTarget' },
    openEvent: { method: 'openEvent' },
    closeEvent: { method: 'closeEvent' },
    openWorldSite: { method: 'openWorldSite' },
    closeWorldSite: { method: 'closeWorldSite' },
    jumpToSubcity: { method: 'jumpToSubcity' },
    resetWorldPan: { method: 'resetWorldPan' },
    worldMapDrag: { method: 'worldMapDrag' },
    changeExpeditionSoldiers: { method: 'changeExpeditionSoldiers' },
    changeExpeditionLeader: { method: 'changeExpeditionLeader' },
    enterBattleScene: { method: 'enterBattleScene' },
    closeBattleScene: { method: 'closeBattleScene' },
    skipBattleScene: { method: 'skipBattleScene' },
    goToGuideTaskTarget: { method: 'goToGuideTaskTarget' },
    openTaskCenter: { method: 'openTaskCenter' },
    closeTaskCenter: { method: 'closeTaskCenter' },
    switchTaskCenterTab: { method: 'switchTaskCenterTab', args: (action) => [action.tab, action] },
    openFamousPersons: { method: 'openFamousPersons' },
    closeFamousPersons: { method: 'closeFamousPersons' },
    changeFamousPersonsPage: { method: 'changeFamousPersonsPage' },
    openFamousPersonDetail: { method: 'openFamousPersonDetail' },
    closeFamousPersonDetail: { method: 'closeFamousPersonDetail' },
    selectBuildingCategory: { method: 'selectBuildingCategory' },
    selectTechNode: { method: 'selectTechNode' },
    closeTechDetail: { method: 'closeTechDetail' },
    selectWorldMarchTarget: { method: 'selectWorldMarchTarget' },
    openWorldMarchFormationPicker: { method: 'openWorldMarchFormationPicker' },
    closeWorldMarchHud: { method: 'closeWorldMarchHud' },
    selectWorldActor: { method: 'selectWorldActor' },
    openWorldTargetPicker: { method: 'openWorldTargetPicker' },
    chooseWorldTarget: { method: 'chooseWorldTarget' },
    closeWorldTargetPicker: { method: 'closeWorldTargetPicker' },
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

    static getArgs(definition = {}, action = {}) {
      return typeof definition.args === 'function' ? definition.args(action) : [action];
    }

    static invoke(context = {}, definition = {}, action = {}) {
      const method = definition.method;
      if (!method || typeof context[method] !== 'function') return false;
      return context[method](...this.getArgs(definition, action));
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

      const finishDefinition = FINISH_ACTIONS[action.type];
      if (finishDefinition) {
        const rawResult = this.invoke(context, finishDefinition, action);
        const result = finishDefinition.coerceBoolean ? rawResult !== false : rawResult;
        return typeof options.finishHandled === 'function'
          ? options.finishHandled(result, context, action)
          : result !== false;
      }

      const renderDefinition = RENDER_ACTIONS[action.type];
      if (renderDefinition) {
        const handled = this.invoke(context, renderDefinition, action) !== false;
        return this.renderIfHandled(handled, context, action);
      }

      return false;
    }
  }

  global.CanvasActionDispatchRegistry = CanvasActionDispatchRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatchRegistry;
})(typeof globalThis !== 'undefined' ? globalThis : window);

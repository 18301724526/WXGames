(function (global) {
  class CanvasActionDispatcher {
    constructor(options = {}) {
      this.log = typeof options.log === 'function' ? options.log : null;
    }

    canHandle(action) {
      return Boolean(action && CanvasActionDispatcher.supportedActions().includes(action.type));
    }

    handle(action, context = {}) {
      if (!this.canHandle(action)) return false;
      if (action.disabled) return true;

      if (action.type === 'switchTab') {
        if (typeof context.resetForTabSwitch === 'function') context.resetForTabSwitch(action);

        let switched = false;
        if (typeof context.switchTab === 'function') {
          switched = context.switchTab(action.tab, action) !== false;
        }

        if (switched && typeof context.render === 'function') context.render(action);
        return switched;
      }

      if (action.type === 'openResourceDetails') {
        const opened = typeof context.openResourceDetails === 'function'
          ? context.openResourceDetails(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeResourceDetails') {
        const closed = typeof context.closeResourceDetails === 'function'
          ? context.closeResourceDetails(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'closeRewardReveal') {
        const closed = typeof context.closeRewardReveal === 'function'
          ? context.closeRewardReveal(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openCitySwitcher') {
        const opened = typeof context.openCitySwitcher === 'function'
          ? context.openCitySwitcher(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeCitySwitcher') {
        const closed = typeof context.closeCitySwitcher === 'function'
          ? context.closeCitySwitcher(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openSettings') {
        const opened = typeof context.openSettings === 'function'
          ? context.openSettings(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeSettings') {
        const closed = typeof context.closeSettings === 'function'
          ? context.closeSettings(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openLogs') {
        const opened = typeof context.openLogs === 'function'
          ? context.openLogs(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeLogs') {
        const closed = typeof context.closeLogs === 'function'
          ? context.closeLogs(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openAdvisor') {
        const opened = typeof context.openAdvisor === 'function'
          ? context.openAdvisor(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeAdvisor') {
        const closed = typeof context.closeAdvisor === 'function'
          ? context.closeAdvisor(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'goToAdvisorTarget') {
        const moved = typeof context.goToAdvisorTarget === 'function'
          ? context.goToAdvisorTarget(action) !== false
          : false;
        if (moved && typeof context.render === 'function') context.render(action);
        return moved;
      }

      if (action.type === 'openEvent') {
        const opened = typeof context.openEvent === 'function'
          ? context.openEvent(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeEvent') {
        const closed = typeof context.closeEvent === 'function'
          ? context.closeEvent(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'openWorldSite') {
        const opened = typeof context.openWorldSite === 'function'
          ? context.openWorldSite(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeWorldSite') {
        const closed = typeof context.closeWorldSite === 'function'
          ? context.closeWorldSite(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'resetWorldPan') {
        const reset = typeof context.resetWorldPan === 'function'
          ? context.resetWorldPan(action) !== false
          : false;
        if (reset && typeof context.render === 'function') context.render(action);
        return reset;
      }

      if (action.type === 'changeExpeditionSoldiers') {
        const changed = typeof context.changeExpeditionSoldiers === 'function'
          ? context.changeExpeditionSoldiers(action) !== false
          : false;
        if (changed && typeof context.render === 'function') context.render(action);
        return changed;
      }

      if (action.type === 'changeExpeditionLeader') {
        const changed = typeof context.changeExpeditionLeader === 'function'
          ? context.changeExpeditionLeader(action) !== false
          : false;
        if (changed && typeof context.render === 'function') context.render(action);
        return changed;
      }

      if (action.type === 'enterBattleScene') {
        const entered = typeof context.enterBattleScene === 'function'
          ? context.enterBattleScene(action) !== false
          : false;
        if (entered && typeof context.render === 'function') context.render(action);
        return entered;
      }

      if (action.type === 'closeBattleScene') {
        const closed = typeof context.closeBattleScene === 'function'
          ? context.closeBattleScene(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'skipBattleScene') {
        const skipped = typeof context.skipBattleScene === 'function'
          ? context.skipBattleScene(action) !== false
          : false;
        if (skipped && typeof context.render === 'function') context.render(action);
        return skipped;
      }

      if (action.type === 'goToGuideTaskTarget') {
        const moved = typeof context.goToGuideTaskTarget === 'function'
          ? context.goToGuideTaskTarget(action) !== false
          : false;
        if (moved && typeof context.render === 'function') context.render(action);
        return moved;
      }

      if (action.type === 'openTaskCenter') {
        const opened = typeof context.openTaskCenter === 'function'
          ? context.openTaskCenter(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeTaskCenter') {
        const closed = typeof context.closeTaskCenter === 'function'
          ? context.closeTaskCenter(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'switchTaskCenterTab') {
        const switched = typeof context.switchTaskCenterTab === 'function'
          ? context.switchTaskCenterTab(action.tab, action) !== false
          : false;
        if (switched && typeof context.render === 'function') context.render(action);
        return switched;
      }

      if (action.type === 'openFamousPersons') {
        const opened = typeof context.openFamousPersons === 'function'
          ? context.openFamousPersons(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeFamousPersons') {
        const closed = typeof context.closeFamousPersons === 'function'
          ? context.closeFamousPersons(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'changeFamousPersonsPage') {
        const changed = typeof context.changeFamousPersonsPage === 'function'
          ? context.changeFamousPersonsPage(action) !== false
          : false;
        if (changed && typeof context.render === 'function') context.render(action);
        return changed;
      }

      if (action.type === 'openFamousPersonDetail') {
        const opened = typeof context.openFamousPersonDetail === 'function'
          ? context.openFamousPersonDetail(action) !== false
          : false;
        if (opened && typeof context.render === 'function') context.render(action);
        return opened;
      }

      if (action.type === 'closeFamousPersonDetail') {
        const closed = typeof context.closeFamousPersonDetail === 'function'
          ? context.closeFamousPersonDetail(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      if (action.type === 'selectBuildingCategory') {
        const selected = typeof context.selectBuildingCategory === 'function'
          ? context.selectBuildingCategory(action) !== false
          : false;
        if (selected && typeof context.render === 'function') context.render(action);
        return selected;
      }

      if (action.type === 'selectTechNode') {
        const selected = typeof context.selectTechNode === 'function'
          ? context.selectTechNode(action) !== false
          : false;
        if (selected && typeof context.render === 'function') context.render(action);
        return selected;
      }

      if (action.type === 'closeTechDetail') {
        const closed = typeof context.closeTechDetail === 'function'
          ? context.closeTechDetail(action) !== false
          : false;
        if (closed && typeof context.render === 'function') context.render(action);
        return closed;
      }

      return false;
    }

    static supportedActions() {
      return [
        'switchTab',
        'openResourceDetails',
        'closeResourceDetails',
        'closeRewardReveal',
        'openCitySwitcher',
        'closeCitySwitcher',
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
        'resetWorldPan',
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
    }

  }

  global.CanvasActionDispatcher = CanvasActionDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);

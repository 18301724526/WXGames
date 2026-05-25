(function (global) {
  const DEFAULT_GUIDE_MESSAGE = '\u6309\u8fd9\u91cc\u7ee7\u7eed\u4e3b\u7ebf\u4efb\u52a1';
  const CLAIM_REWARD_MESSAGE = '\u9886\u53d6\u4e3b\u7ebf\u4efb\u52a1\u5956\u52b1';

  const BUILDING_TARGETS = {
    'card-farm': 'farm',
    'card-house': 'house',
    'card-lumbermill': 'lumbermill',
    'card-barracks': 'barracks',
    'card-watchtower': 'watchtower',
    'card-barracks-upgrade': 'barracks',
  };

  const TARGET_TABS = {
    'btn-advance-era': 'civilization',
    'card-craftsman': 'resources',
    'event-card-special': 'events',
    'btn-claim-event': 'events',
    'tab-territory': 'military',
    'scout-action-first': 'military',
  };

  function normalizeTargetRect(target) {
    if (!target) return null;
    const rect = typeof target.getRect === 'function'
      ? target.getRect()
      : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
    const left = Number(rect.left ?? rect.x);
    const top = Number(rect.top ?? rect.y);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    const normalized = {
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: Number(rect.right) || left + width,
      bottom: Number(rect.bottom) || top + height,
    };
    normalized.getRect = () => ({
      left: normalized.left,
      top: normalized.top,
      width: normalized.width,
      height: normalized.height,
      right: normalized.right,
      bottom: normalized.bottom,
    });
    normalized.getBoundingClientRect = normalized.getRect;
    normalized.scrollIntoView = () => {};
    return normalized;
  }

  class CanvasGuideController {
    constructor(options = {}) {
      this.host = options.host || null;
    }

    getState() {
      return this.host?.getGuideState?.() || this.host?.state || this.host?.lastGame?.state || {};
    }

    getPresenter() {
      return this.host?.presenter || null;
    }

    getActiveTab() {
      return this.host?.getGuideActiveTab?.() || this.getState()?.currentTab || this.host?.activeTab || 'resources';
    }

    getTutorialState() {
      return this.host?.getGuideTutorialState?.() || this.getState()?.tutorial || {};
    }

    getUiHost() {
      return (this.host?.canvasShell && this.host.canvasShell !== this.host)
        ? this.host.canvasShell
        : this.host;
    }

    getMirrorHost() {
      const uiHost = this.getUiHost();
      if (uiHost === this.host) return this.host?.lastGame || null;
      return this.host || null;
    }

    getUiField(key, fallback = undefined) {
      const uiHost = this.getUiHost();
      if (uiHost && key in uiHost) return uiHost[key];
      if (this.host && key in this.host) return this.host[key];
      return fallback;
    }

    setUiField(key, value) {
      const uiHost = this.getUiHost();
      if (uiHost && key in uiHost) uiHost[key] = value;
      const mirrorHost = this.getMirrorHost();
      if (mirrorHost && key in mirrorHost) mirrorHost[key] = value;
    }

    render() {
      if (typeof this.host?.renderGuideFrame === 'function') return this.host.renderGuideFrame();
      if (typeof this.host?.render === 'function') return this.host.render();
      return false;
    }

    getCanvasTarget(type, predicate = null) {
      const target = typeof this.host?.getGuideCanvasTarget === 'function'
        ? this.host.getGuideCanvasTarget(type, predicate)
        : this.host?.getCanvasTarget?.(type, predicate);
      return normalizeTargetRect(target);
    }

    getTargetTab(target) {
      if (TARGET_TABS[target]) return TARGET_TABS[target];
      if (typeof target === 'string' && target.startsWith('tab-')) return target.slice(4);
      if (typeof target === 'string' && target.startsWith('card-')) return 'buildings';
      return null;
    }

    getGuideTaskActionTarget(key) {
      return this.getCanvasTarget('goToGuideTaskTarget', (action) => (
        action.target === key || action.nextTarget === key
      ));
    }

    getBuildingCategory(buildingId) {
      const state = this.getState();
      const config = state?.buildingDefinitions?.[buildingId] || null;
      return config?.category || 'all';
    }

    getBuildingActionType(key) {
      return key === 'card-barracks-upgrade' ? 'upgradeBuilding' : 'buildBuilding';
    }

    hasBuildingActionTarget(key, buildingId) {
      const type = this.getBuildingActionType(key);
      return Boolean(this.getCanvasTarget(type, (action) => action.buildingId === buildingId));
    }

    isBuildingTarget(key) {
      return Boolean(BUILDING_TARGETS[key]);
    }

    getBuildingTargetRect(key, type, buildingId) {
      const realTarget = this.getCanvasTarget(type, (action) => action.buildingId === buildingId);
      if (realTarget) return realTarget;
      if (this.getActiveTab() !== 'buildings') return this.getGuideTaskActionTarget(key);
      return null;
    }

    getTargetRectWithoutScroll(key) {
      if (key === 'btn-advance-era') return this.getCanvasTarget('advanceEra');
      if (key === 'card-farm') return this.getBuildingTargetRect(key, 'buildBuilding', 'farm');
      if (key === 'card-house') return this.getBuildingTargetRect(key, 'buildBuilding', 'house');
      if (key === 'card-lumbermill') return this.getBuildingTargetRect(key, 'buildBuilding', 'lumbermill');
      if (key === 'card-barracks') return this.getBuildingTargetRect(key, 'buildBuilding', 'barracks');
      if (key === 'card-watchtower') return this.getBuildingTargetRect(key, 'buildBuilding', 'watchtower');
      if (key === 'card-barracks-upgrade') return this.getBuildingTargetRect(key, 'upgradeBuilding', 'barracks');
      if (key === 'card-craftsman') return this.getCanvasTarget('assignJob', (action) => action.job === 'craftsman' && action.delta > 0);
      if (key === 'guide-task-claim' || key === 'task-center-main-claim') {
        return this.getCanvasTarget('claimTaskReward', (action) => (action.category || 'main') === 'main')
          || this.getCanvasTarget('openTaskCenter', (action) => action.source === 'taskIcon');
      }
      if (key === 'task-center-button') return this.getCanvasTarget('openTaskCenter', (action) => action.source === 'taskIcon');
      if (key === 'event-card-special') return this.getCanvasTarget('openEvent', (action) => action.eventId === 'evt_settlement_forest_001');
      if (key === 'btn-claim-event') return this.getCanvasTarget('claimEvent', (action) => action.eventId === 'evt_settlement_forest_001');
      if (key === 'scout-action-first') {
        return this.getCanvasTarget('scoutTerritory', (action) => !action.disabled)
          || this.getCanvasTarget('switchMilitaryView', (action) => action.view === 'scout');
      }
      if (key === 'tab-resources') return this.getCanvasTarget('switchTab', (action) => action.tab === 'resources');
      if (key === 'tab-civilization') return this.getCanvasTarget('switchTab', (action) => action.tab === 'civilization');
      if (key === 'tab-buildings') return this.getCanvasTarget('switchTab', (action) => action.tab === 'buildings');
      if (key === 'tab-events') return this.getCanvasTarget('switchTab', (action) => action.tab === 'events');
      if (key === 'tab-military' || key === 'tab-territory') return this.getCanvasTarget('switchTab', (action) => action.tab === 'military');
      return this.getGuideTaskActionTarget(key);
    }

    getTargetRect(key) {
      const visibleTarget = this.getTargetRectWithoutScroll(key);
      if (visibleTarget) return visibleTarget;
      this.ensureTargetVisible(key);
      return this.getTargetRectWithoutScroll(key);
    }

    hasClaimableMainTask() {
      const view = this.getPresenter()?.buildTaskCenterViewState?.(
        this.getState(),
        { activeTab: this.host?.activeTaskCenterTab || 'main' },
      );
      const tasks = Array.isArray(view?.categories?.main?.tasks) ? view.categories.main.tasks : [];
      return tasks.some((task) => task.status === 'claimable' && !task.claimed);
    }

    refreshTaskCenterGuideHighlight(action = {}) {
      const guideTarget = action.target || this.getState()?.softGuide?.target;
      if (
        guideTarget !== 'task-center-main-claim'
        && guideTarget !== 'guide-task-claim'
        && !this.hasClaimableMainTask()
      ) return false;
      this.render();
      const target = this.getTargetRectWithoutScroll('task-center-main-claim');
      if (!target) return false;
      return this.showHighlight(target, action.message || CLAIM_REWARD_MESSAGE);
    }

    refreshCurrentGuideHighlight() {
      const guide = this.getState()?.softGuide || null;
      if (!guide || guide.mode !== 'strong' || !guide.target) return this.hideHighlight();
      const targetKey = guide.target;
      if (targetKey !== 'task-center-main-claim' && targetKey !== 'guide-task-claim') {
        this.setTaskCenterVisible(false);
      }
      return this.moveToTarget(targetKey, {
        message: guide.message,
        nextAction: targetKey === 'scout-action-first'
          ? { type: 'switchMilitaryView', view: 'scout' }
          : null,
      });
    }

    goToGuideTaskTarget(action = {}) {
      const targetKey = action.target || action.nextTarget;
      if (!targetKey) return false;
      return this.moveToTarget(targetKey, {
        message: action.message || DEFAULT_GUIDE_MESSAGE,
        nextAction: action.nextAction,
      });
    }

    moveToTarget(targetKey, options = {}) {
      const tabId = this.getTargetTab(targetKey);
      const showTarget = () => {
        this.applyNextAction(targetKey, options.nextAction);
        this.clearTransientPanels();
        this.ensureTargetVisible(targetKey);
        this.render();
        const target = this.getTargetRect(targetKey)
          || (tabId && (!this.isBuildingTarget(targetKey) || this.getActiveTab() !== tabId)
            ? this.getTargetRect(`tab-${tabId}`)
            : null);
        if (target) return this.showHighlight(target, options.message || DEFAULT_GUIDE_MESSAGE);
        if (this.hasHighlight()) {
          this.render();
          return false;
        }
        return this.hideHighlight();
      };

      if (tabId && this.getActiveTab() !== tabId) {
        const switchResult = this.switchTab(tabId);
        Promise.resolve(switchResult).then((allowed) => {
          if (allowed !== false) showTarget();
        }).catch(() => {});
        return true;
      }
      return showTarget();
    }

    switchTab(tabId) {
      if (typeof this.host?.switchGuideTab === 'function') return this.host.switchGuideTab(tabId);
      if (typeof this.host?.switchTab === 'function') return this.host.switchTab(tabId);
      return false;
    }

    applyNextAction(targetKey, nextAction = null) {
      if (nextAction?.type === 'switchMilitaryView') {
        this.setMilitaryView(nextAction.view || 'army');
      } else if (targetKey === 'scout-action-first') {
        this.setMilitaryView('scout');
      }
    }

    setMilitaryView(view) {
      if (typeof this.host?.setGuideMilitaryView === 'function') {
        return this.host.setGuideMilitaryView(view);
      }
      if ('militaryView' in this.host) this.host.militaryView = view;
      const state = this.getState();
      if (state && typeof state === 'object') state.militaryView = view;
      return true;
    }

    clearTransientPanels() {
      ['showAdvisor', 'showSettings', 'showLogs', 'showResourceDetails', 'showCitySwitcher'].forEach((key) => {
        this.setUiField(key, false);
      });
      this.setUiField('activeEventId', null);
    }

    setTaskCenterVisible(visible) {
      this.setUiField('showTaskCenter', Boolean(visible));
    }

    ensureTargetVisible(key) {
      if (!key || this.getActiveTab() !== 'buildings') return false;
      const targetBuilding = BUILDING_TARGETS[key];
      if (!targetBuilding) return false;
      const category = this.getBuildingCategory(targetBuilding);
      let categoryChanged = false;
      if (category && category !== 'all' && this.getUiField('activeBuildingCategory', 'all') !== category) {
        this.setUiField('activeBuildingCategory', category);
        this.setUiField('buildingOffset', 0);
        categoryChanged = true;
      }
      const state = this.getState();
      const view = this.getPresenter()?.buildBuildingViewState?.(
        state,
        this.getTutorialState(),
        state?.buildingDefinitions || {},
        { activeCategory: this.getUiField('activeBuildingCategory', 'all') || 'all' },
      );
      const ids = view?.filteredIds || view?.ids || [];
      const index = ids.indexOf(targetBuilding);
      if (index < 0) return false;
      const currentOffset = Math.max(0, Math.floor(Number(this.getUiField('buildingOffset', 0)) || 0));
      const candidates = [];
      const addCandidate = (value) => {
        const offset = Math.max(0, Math.floor(Number(value) || 0));
        if (!candidates.includes(offset)) candidates.push(offset);
      };
      if (currentOffset <= index) addCandidate(currentOffset);
      for (let offset = 0; offset <= index; offset += 1) addCandidate(offset);

      let changed = categoryChanged;
      for (const offset of candidates) {
        if (Math.max(0, Number(this.getUiField('buildingOffset', 0)) || 0) !== offset) {
          this.setUiField('buildingOffset', offset);
          changed = true;
        }
        this.render();
        if (this.hasBuildingActionTarget(key, targetBuilding)) return true;
      }
      return changed;
    }

    showHighlight(rect, message) {
      if (typeof this.host?.showGuideControllerHighlight === 'function') {
        return this.host.showGuideControllerHighlight(rect, message);
      }
      if (typeof this.host?.showGuideHighlight === 'function') return this.host.showGuideHighlight(rect, message);
      if (typeof this.host?.showTutorialHighlight === 'function') return this.host.showTutorialHighlight(rect, message);
      return false;
    }

    hideHighlight() {
      if (typeof this.host?.hideGuideControllerHighlight === 'function') {
        return this.host.hideGuideControllerHighlight();
      }
      if (typeof this.host?.hideTutorialHighlight === 'function') return this.host.hideTutorialHighlight();
      if ('tutorialHighlight' in this.host) {
        const hadHighlight = Boolean(this.host.tutorialHighlight);
        this.host.tutorialHighlight = null;
        this.render();
        return hadHighlight;
      }
      return false;
    }

    hasHighlight() {
      if (typeof this.host?.hasGuideControllerHighlight === 'function') {
        return this.host.hasGuideControllerHighlight();
      }
      return Boolean(this.getUiField('tutorialHighlight', null));
    }
  }

  global.CanvasGuideController = CanvasGuideController;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGuideController;
})(typeof globalThis !== 'undefined' ? globalThis : window);

(function (global) {
  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
getCanvasTarget(type, predicate = null) {
      if (!this.renderer || !Array.isArray(this.renderer.hitTargets)) return null;
      let target = null;
      for (let index = this.renderer.hitTargets.length - 1; index >= 0; index -= 1) {
        const item = this.renderer.hitTargets[index];
        if (
          item.action?.type === type
          && (typeof predicate !== 'function' || predicate(item.action))
        ) {
          target = item;
          break;
        }
      }
      if (!target) return null;
      return {
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
        action: target.action,
        getRect: () => ({
          left: target.x,
          top: target.y,
          width: target.width,
          height: target.height,
          right: target.x + target.width,
          bottom: target.y + target.height,
        }),
        getBoundingClientRect: () => ({
          left: target.x,
          top: target.y,
          width: target.width,
          height: target.height,
          right: target.x + target.width,
          bottom: target.y + target.height,
        }),
        scrollIntoView() {},
      };
    },

getGuideState() {
      return this.lastGame?.state || {};
    },

getGuideActiveTab() {
      return this.getActiveTab();
    },

getGuideTutorialState() {
      return this.lastGame?.tutorialController?.state || this.lastGame?.tutorial || {};
    },

getGuideCanvasTarget(type, predicate = null) {
      return this.getCanvasTarget(type, predicate);
    },

    renderGuideFrame() {
      return this.renderActive();
    },

renderGuideHighlightFrame(highlight = this.tutorialHighlight) {
      const activeTab = highlight?.renderActiveTab || this.getActiveTab();
      const renderOptions = highlight?.renderOptions || null;
      if (renderOptions && typeof this.renderReadOnly === 'function') {
        return this.renderReadOnly(this.lastGame?.state, activeTab, renderOptions);
      }
      return this.renderActive();
    },

switchGuideTab(tabId) {
      if (!tabId) return false;
      if (this.lastGame?.handleCanvasTabSelection) {
        const result = this.lastGame.handleCanvasTabSelection(tabId);
        if (result !== false && this.lastGame?.state && typeof this.lastGame.state === 'object') {
          this.lastGame.state.currentTab = tabId;
        }
        return result;
      }
      if (this.onAction) return this.onAction({ type: 'switchTab', tab: tabId, source: 'guideTask' });
      return this.lastGame?.switchTab?.(tabId);
    },

setGuideMilitaryView(view) {
      if (this.onAction) return this.onAction({ type: 'switchMilitaryView', view: view || 'army' });
      if (this.lastGame?.switchMilitaryView) return this.lastGame.switchMilitaryView(view || 'army');
      if (this.lastGame?.state) this.lastGame.state.militaryView = view || 'army';
      return true;
    },

showGuideControllerHighlight(target, message) {
      return this.showTutorialHighlight(target, message);
    },

hideGuideControllerHighlight() {
      return this.hideTutorialHighlight();
    },

getTutorialTarget(key) {
      return null;
    },

getTutorialTargetWithoutScroll(key) {
      return null;
    },

refreshTaskCenterGuideHighlight(action = {}) {
      return false;
    },

hasClaimableMainTask() {
      return false;
    },

refreshCurrentGuideHighlight() {
      return false;
    },

getTargetTab(key) {
      return null;
    },

ensureTutorialTargetVisible(key) {
      return false;
    },

goToGuideTaskTarget(action = {}) {
      return false;
    },

resolveTutorialRect(target) {
      if (!target) return null;
      const rect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const x = Number(rect.x ?? rect.left);
      const y = Number(rect.y ?? rect.top);
      const width = Number(rect.width);
      const height = Number(rect.height);
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left: x,
        top: y,
        width,
        height,
        right: Number(rect.right) || x + width,
        bottom: Number(rect.bottom) || y + height,
      };
    },

showTutorialHighlight(target, message, options = {}) {
      const rect = this.resolveTutorialRect(target);
      if (!rect) {
        if (this.tutorialHighlight) return true;
        return false;
      }
      const now = this.now();
      const previousRect = this.tutorialHighlight?.rect || rect;
      this.tutorialHighlight = {
        rect,
        message: String(message ?? ''),
        allowedAction: options.allowedAction || null,
        renderActiveTab: options.renderActiveTab || null,
        renderOptions: options.renderOptions || null,
        transition: {
          fromRect: previousRect,
          toRect: rect,
          startedAt: now,
          durationMs: 260,
        },
        pulseStartedAt: this.tutorialHighlight?.pulseStartedAt || now,
        source: options.source || 'guide',
      };
      this.startFloatTimer();
      this.renderGuideHighlightFrame(this.tutorialHighlight);
      return true;
    },

hideTutorialHighlight() {
      const hadHighlight = Boolean(this.tutorialHighlight);
      this.tutorialHighlight = null;
      if (hadHighlight) this.renderActive();
      return hadHighlight;
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellGuideUi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

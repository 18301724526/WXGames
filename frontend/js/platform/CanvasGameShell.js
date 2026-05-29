(function (global) {
  var CanvasGameAppBase = global.CanvasGameApp;
  if (typeof module !== 'undefined' && module.exports && !CanvasGameAppBase) {
    CanvasGameAppBase = require('./CanvasGameApp');
  }

  class CanvasGameShell extends (CanvasGameAppBase || class {}) {
    constructor(options = {}) {
      super({
        runtime: options.runtime || null,
        renderer: options.renderer || null,
        presenter: options.presenter || null,
        actionDispatcher: options.actionDispatcher,
        runtimeRequired: false,
        apiRequired: false,
        rendererRequired: false,
      });
      this.runtime = options.runtime || null;
      this.renderer = options.renderer || null;
      this.presenter = options.presenter || null;
      this.previewEnabled = Boolean(options.previewEnabled);
      this.inputEnabled = Boolean(options.inputEnabled);
      this.onAction = typeof options.onAction === 'function' ? options.onAction : null;
      const DispatcherCtor = global.CanvasActionDispatcher;
      this.actionDispatcher = options.actionDispatcher || (DispatcherCtor ? new DispatcherCtor() : null);
      const ActionControllerCtor = global.CanvasActionController || (typeof require === 'function' ? require('./CanvasActionController') : null);
      this.actionController = options.actionController || (ActionControllerCtor ? new ActionControllerCtor({
        host: this,
        log: options.log,
      }) : this.actionController);
      this.mounted = false;
      this.lastGame = null;
      this.resizeDisposer = null;
      this.tapDisposer = null;
      this.dragDisposer = null;
      this.gestureDisposer = null;
      this.pointerMoveDisposer = null;
      this.effectTimer = null;
      this.floatTimer = null;
      this.showSettings = false;
      this.showLogs = false;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showAdvisor = false;
      this.showTaskCenter = false;
      this.activeTaskCenterTab = 'main';
      this.showGuidebook = false;
      this.activeGuidebookTab = 'planning';
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
      this.talentPolicyUiState = {};
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      this.transitionTimer = null;
      this.lastAnimationRenderAt = 0;
      this.activeEventId = null;
      this.territoryUiState = {};
      this.naming = {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      };
      this.auth = {
        view: {
          loginPanelVisible: false,
          appVisible: true,
          message: '',
        },
        credentials: {
          usernameValue: '',
          passwordValue: '',
          rememberPasswordChecked: false,
        },
      };
      this.loading = {
        visible: false,
        percentage: 0,
        message: '',
      };
      this.tutorialHighlight = null;
      this.floatingTexts = [];
      this.floatDurationMs = options.floatDurationMs || 1200;
      this.rewardReveal = null;
      this.battleScene = null;
      const GuideControllerCtor = global.CanvasGuideController || (typeof require === 'function' ? require('./CanvasGuideController') : null);
      this.guideController = options.guideController || (GuideControllerCtor ? new GuideControllerCtor({
        host: this,
        actionDispatcher: this.actionDispatcher,
      }) : this.guideController);
    }

    createRenderer(canvas) {
      if (this.renderer || !canvas) return this.renderer;
      const RendererCtor = global.H5CanvasGameRenderer;
      if (!RendererCtor) return null;
      this.renderer = new RendererCtor({
        canvas,
        presenter: this.presenter,
        pixelRatio: this.runtime?.pixelRatio,
        width: this.runtime?.width,
        height: this.runtime?.height,
        h5Runtime: this.runtime,
      });
      return this.renderer;
    }

    mount(game) {
      if (this.mounted) return false;
      if (!this.runtime || typeof this.runtime.ensureCanvas !== 'function') return false;
      const canvas = this.runtime.ensureCanvas();
      if (!canvas) return false;
      this.createRenderer(canvas);
      this.mounted = true;
      this.lastGame = game || null;
      if (game?.authView) this.applyAuthShell(game.authView);
      if (game?.authCredentials) this.applyCredentials(game.authCredentials);
      if (this.runtime?.onResize && !this.resizeDisposer) {
        this.resizeDisposer = this.runtime.onResize((size) => this.handleResize(size));
      }
      this.bindInput();
      this.renderActive();
      return true;
    }

    bindInput() {
      if (!this.inputEnabled || !this.runtime?.onTap || this.tapDisposer) return false;
      this.tapDisposer = this.runtime.onTap((point, event) => this.handleTap(point, event));
      if (this.runtime.onDrag && !this.dragDisposer) {
        this.dragDisposer = this.runtime.onDrag((phase, point, event) => this.handleDrag(phase, point, event));
      }
      if (this.runtime.onGesture && !this.gestureDisposer) {
        this.gestureDisposer = this.runtime.onGesture((gesture, event) => this.handleGesture(gesture, event));
      }
      if (this.runtime.onPointerMove && !this.pointerMoveDisposer) {
        this.pointerMoveDisposer = this.runtime.onPointerMove((point) => this.handlePointerMove(point));
      }
      return true;
    }

    handlePointerMove(point) {
      if (!this.renderer || typeof this.renderer.setHoverPoint !== 'function') return false;
      const changed = this.renderer.setHoverPoint(point);
      if (changed && this.showFamousPersons) this.renderActive();
      return changed;
    }

    hasBlockingOverlayOpen() {
      return Boolean(this.showSettings
        || this.showLogs
        || this.showResourceDetails
        || this.showCitySwitcher
        || this.showAdvisor
        || this.showTaskCenter
        || this.showGuidebook
        || this.showTalentPolicy
        || this.techDetailOpen
        || this.activeEventId
        || this.naming.visible
        || this.battleScene?.visible
        || this.rewardReveal);
    }

    handleDrag(phase, point, event) {
      if (!this.inputEnabled || !this.renderer) return false;
      if (phase === 'start') {
        if (this.getActiveTab() === 'tech' && !this.hasBlockingOverlayOpen()) {
          this.dragAction = { type: 'techTreeDrag' };
        } else {
          if (typeof this.renderer.getHitTarget !== 'function') return false;
          const action = this.renderer.getHitTarget(point);
          if (
          action?.type !== 'worldRadarDrag'
          && action?.type !== 'openWorldSite'
          && action?.type !== 'techTreeDrag'
          && action?.dragType !== 'techTreeDrag'
        ) return false;
          this.dragAction = action.dragType === 'techTreeDrag' ? { type: 'techTreeDrag' } : action;
        }
      }
      if (!this.dragAction) return false;
      const dragType = this.dragAction.type === 'techTreeDrag' ? 'techTreeDrag' : 'worldRadarDrag';
      const handled = this.actionController?.handle?.({ type: dragType, phase, pointer: point }, { event }) || false;
      if (phase === 'end') this.dragAction = null;
      return handled;
    }

    handleGesture(gesture, event) {
      if (!this.inputEnabled || !this.renderer) return false;
      if (this.getActiveTab() !== 'tech' || this.hasBlockingOverlayOpen()) return false;
      const handled = this.actionController?.handle?.({ type: 'techTreeZoom', gesture }, { event }) || false;
      if (handled && event?.preventDefault) event.preventDefault();
      if (handled && event?.stopPropagation) event.stopPropagation();
      return handled;
    }

    handleTap(point, event) {
      if (!this.inputEnabled || !this.renderer || typeof this.renderer.getHitTarget !== 'function') return false;
      const action = this.renderer.getHitTarget(point);
      if (!action || action.disabled) return false;
      if (action.type === 'showFamousSkillTooltip') {
        const handled = typeof this.renderer.setPinnedFamousSkillTooltip === 'function'
          ? this.renderer.setPinnedFamousSkillTooltip(action)
          : false;
        if (handled) this.renderActive();
        return handled;
      }
      if (action.type === 'clearFamousSkillTooltip') {
        const handled = typeof this.renderer.clearFamousSkillTooltip === 'function'
          ? this.renderer.clearFamousSkillTooltip()
          : false;
        if (handled) this.renderActive();
        return handled;
      }
      const handled = this.handleAction(action, event);
      if (handled && event?.preventDefault) event.preventDefault();
      if (handled && event?.stopPropagation) event.stopPropagation();
      return handled;
    }

    getCanvasTarget(type, predicate = null) {
      if (!this.renderer || !Array.isArray(this.renderer.hitTargets)) return null;
      const target = this.renderer.hitTargets.find((item) => (
        item.action?.type === type
        && (typeof predicate !== 'function' || predicate(item.action))
      ));
      if (!target) return null;
      return {
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
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
    }

    getCanvasGameHost() {
      return this.lastGame || null;
    }

    getCanvasActionState() {
      return this.lastGame?.state || {};
    }

    runAction(callback) {
      if (typeof this.lastGame?.runAction === 'function') return this.lastGame.runAction(callback);
      return typeof callback === 'function' ? callback() : null;
    }

    selectBuildingCategory(action = {}) {
      const category = action.category || 'all';
      this.activeBuildingCategory = category;
      this.buildingOffset = 0;
      this.buildingTransition = null;
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.activeBuildingCategory = category;
        this.lastGame.buildingOffset = 0;
        this.lastGame.buildingTransition = null;
      }
      return true;
    }

    selectTechNode(action = {}) {
      const techId = action.techId || '';
      this.selectedTechId = techId;
      this.techDetailOpen = Boolean(techId);
      if (this.lastGame?.state && typeof this.lastGame.state === 'object') {
        this.lastGame.state = {
          ...this.lastGame.state,
          techUiState: {
            ...(this.lastGame.state.techUiState || {}),
            selectedTechId: techId,
            detailOpen: Boolean(techId),
          },
        };
      }
      return true;
    }

    closeTechDetail(action = {}) {
      this.techDetailOpen = false;
      if (this.lastGame?.state && typeof this.lastGame.state === 'object') {
        this.lastGame.state = {
          ...this.lastGame.state,
          techUiState: {
            ...(this.lastGame.state.techUiState || {}),
            detailOpen: false,
          },
        };
      }
      return true;
    }

    openFamousPersons() {
      this.showFamousPersons = true;
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.showTalentPolicy = false;
      return true;
    }

    closeFamousPersons() {
      this.showFamousPersons = false;
      this.renderer?.clearFamousSkillTooltip?.();
      return true;
    }

    resetForCanvasTabSwitch() {
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.buildingTransition = null;
      this.activeEventId = null;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
      this.renderer?.clearFamousSkillTooltip?.();
    }

    resetLocalViewToResources(options = {}) {
      this.buildingOffset = 0;
      this.activeBuildingCategory = 'all';
      this.techTreePanX = 0;
      this.techTreePanY = 0;
      this.techTreeZoom = 1;
      this.selectedTechId = '';
      this.techDetailOpen = false;
      this.techTreeDragStart = null;
      this.pageTransition = null;
      this.buildingTransition = null;
      this.activeEventId = null;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showAdvisor = false;
      this.showTaskCenter = false;
      this.showGuidebook = false;
      this.showFamousPersons = false;
      this.showTalentPolicy = false;
      this.renderer?.clearFamousSkillTooltip?.();
      this.activeTaskCenterTab = 'main';
      this.activeGuidebookTab = 'planning';
      const game = this.lastGame;
      if (game?.state && typeof game.state === 'object') game.state = { ...game.state, currentTab: 'resources' };
      if (game && 'activeTab' in game) game.activeTab = 'resources';
      if (!options.skipGame && game?.resetLocalViewToResources) {
        game.resetLocalViewToResources({ skipShell: true, skipRender: true });
      }
      if (!options.skipRender) this.renderReadOnly(game?.state, 'resources');
      return true;
    }

    forwardCanvasAction(action, meta = {}) {
      if (!this.onAction) return undefined;
      return this.onAction(action, meta.event) !== false;
    }

    renderCanvasAction(action = {}) {
      this.renderActive();
      return true;
    }

    getGuideState() {
      return this.lastGame?.state || {};
    }

    getGuideActiveTab() {
      return this.getActiveTab();
    }

    getGuideTutorialState() {
      return this.lastGame?.tutorialController?.state || this.lastGame?.tutorial || {};
    }

    getGuideCanvasTarget(type, predicate = null) {
      return this.getCanvasTarget(type, predicate);
    }

    renderGuideFrame() {
      return this.renderActive();
    }

    switchGuideTab(tabId) {
      if (!tabId) return false;
      if (this.lastGame?.handleCanvasTabSelection) return this.lastGame.handleCanvasTabSelection(tabId);
      if (this.onAction) return this.onAction({ type: 'switchTab', tab: tabId, source: 'guideTask' });
      return this.lastGame?.switchTab?.(tabId);
    }

    setGuideMilitaryView(view) {
      if (this.onAction) return this.onAction({ type: 'switchMilitaryView', view: view || 'army' });
      if (this.lastGame?.switchMilitaryView) return this.lastGame.switchMilitaryView(view || 'army');
      if (this.lastGame?.state) this.lastGame.state.militaryView = view || 'army';
      return true;
    }

    showGuideControllerHighlight(target, message) {
      return this.showTutorialHighlight(target, message);
    }

    hideGuideControllerHighlight() {
      return this.hideTutorialHighlight();
    }

    getTutorialTarget(key) {
      return this.guideController?.getTargetRect?.(key) || null;
    }

    getTutorialTargetWithoutScroll(key) {
      return this.guideController?.getTargetRectWithoutScroll?.(key) || null;
    }

    refreshTaskCenterGuideHighlight(action = {}) {
      return this.guideController?.refreshTaskCenterGuideHighlight?.(action) || false;
    }

    hasClaimableMainTask() {
      return this.guideController?.hasClaimableMainTask?.() || false;
    }

    refreshCurrentGuideHighlight() {
      return this.guideController?.refreshCurrentGuideHighlight?.() || false;
    }

    getTargetTab(key) {
      return this.guideController?.getTargetTab?.(key) || null;
    }

    ensureTutorialTargetVisible(key) {
      return this.guideController?.ensureTargetVisible?.(key) || false;
    }

    goToGuideTaskTarget(action = {}) {
      return this.guideController?.goToGuideTaskTarget?.(action) || false;
    }

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
    }

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
      this.renderActive();
      return true;
    }

    hideTutorialHighlight() {
      const hadHighlight = Boolean(this.tutorialHighlight);
      this.tutorialHighlight = null;
      if (hadHighlight) this.renderActive();
      return hadHighlight;
    }

    now() {
      return this.runtime?.now?.() || Date.now();
    }

    getTabOrder() {
      return ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
    }

    getTransitionDurationMs() {
      return 220;
    }

    getAnimationFrameMs() {
      return 16;
    }

    renderAnimationFrame() {
      const now = this.now();
      const frameMs = Math.max(1, this.getAnimationFrameMs() - 1);
      if (this.lastAnimationRenderAt && now - this.lastAnimationRenderAt < frameMs) return false;
      this.lastAnimationRenderAt = now;
      return this.renderActive();
    }

    startTransitionTimer() {
      if (this.transitionTimer || !this.runtime?.setInterval) return false;
      this.transitionTimer = this.runtime.setInterval(() => {
        const now = this.now();
        const duration = this.getTransitionDurationMs();
        const pageDone = !this.pageTransition || now - this.pageTransition.startedAt >= (this.pageTransition.durationMs || duration);
        const buildingDone = !this.buildingTransition || now - this.buildingTransition.startedAt >= (this.buildingTransition.durationMs || duration);
        if (pageDone) this.pageTransition = null;
        if (buildingDone) this.buildingTransition = null;
        if (!this.pageTransition && !this.buildingTransition) this.stopTransitionTimer();
        this.renderAnimationFrame();
      }, this.getAnimationFrameMs());
      return true;
    }

    stopTransitionTimer() {
      if (!this.transitionTimer) return;
      this.runtime?.clearInterval?.(this.transitionTimer);
      this.transitionTimer = null;
    }

    startPageTransition(fromTab, toTab, options = {}) {
      if (!fromTab || !toTab || fromTab === toTab) {
        this.pageTransition = null;
        return false;
      }
      const tabs = this.getTabOrder();
      const fromIndex = tabs.indexOf(fromTab);
      const toIndex = tabs.indexOf(toTab);
      this.pageTransition = {
        fromTab,
        toTab,
        direction: toIndex >= 0 && fromIndex >= 0 && toIndex < fromIndex ? -1 : 1,
        startedAt: this.now(),
        durationMs: this.getTransitionDurationMs(),
        fromBuildingOffset: options.fromBuildingOffset ?? this.buildingOffset,
      };
      this.startTransitionTimer();
      this.renderActive();
      return true;
    }

    scrollBuildings(action = {}) {
      const fromOffset = Math.max(0, Number(this.buildingOffset) || 0);
      const delta = Number(action.delta) || 0;
      const toOffset = Math.max(0, fromOffset + delta);
      this.buildingOffset = toOffset;
      if (toOffset !== fromOffset) {
        this.buildingTransition = {
          fromOffset,
          toOffset,
          direction: toOffset < fromOffset ? -1 : 1,
          startedAt: this.now(),
          durationMs: this.getTransitionDurationMs(),
        };
        this.startTransitionTimer();
      }
      return true;
    }

    showFloatingText(text, options = {}) {
      const content = String(text ?? '').trim();
      if (!content) return false;
      const now = this.now();
      this.floatingTexts.unshift({
        id: `${now}:${content}:${this.floatingTexts.length}`,
        text: content,
        color: options.color || '#74d3a0',
        createdAt: now,
        durationMs: options.durationMs || this.floatDurationMs,
      });
      this.floatingTexts = this.floatingTexts.slice(0, 4);
      this.startFloatTimer();
      this.renderActive();
      return true;
    }

    showRewardReveal(reveal) {
      if (!reveal) return false;
      this.rewardReveal = {
        ...reveal,
        createdAt: this.now(),
      };
      this.startFloatTimer();
      this.renderActive();
      return true;
    }

    closeRewardReveal() {
      const hadReveal = Boolean(this.rewardReveal);
      this.rewardReveal = null;
      if (hadReveal) this.renderActive();
      return hadReveal;
    }

    getFloatingTextView(now = this.now()) {
      return this.floatingTexts
        .map((effect) => ({
          ...effect,
          progress: Math.max(0, Math.min(1, (now - effect.createdAt) / Math.max(1, effect.durationMs))),
        }))
        .filter((effect) => effect.progress < 1);
    }

    pruneFloatingTexts(now = this.now()) {
      const next = this.floatingTexts.filter((effect) => now - effect.createdAt < effect.durationMs);
      const changed = next.length !== this.floatingTexts.length;
      this.floatingTexts = next;
      return changed;
    }

    startFloatTimer() {
      if (this.effectTimer || !this.runtime?.setInterval) return;
      this.effectTimer = this.runtime.setInterval(() => {
        const changed = this.pruneFloatingTexts();
        const hasHighlight = Boolean(this.tutorialHighlight);
        const hasReveal = Boolean(this.rewardReveal);
        if (!this.floatingTexts.length && !hasHighlight && !hasReveal) {
          this.stopFloatTimer();
        }
        if (changed || this.floatingTexts.length || hasHighlight || hasReveal) {
          this.renderAnimationFrame();
        }
      }, this.getAnimationFrameMs());
      this.floatTimer = this.effectTimer;
    }

    stopFloatTimer() {
      if (!this.effectTimer) return;
      this.runtime?.clearInterval?.(this.effectTimer);
      this.effectTimer = null;
      this.floatTimer = null;
    }

    applyAuthShell(view = {}) {
      this.auth = {
        ...this.auth,
        view: {
          loginPanelVisible: Boolean(view.loginPanelVisible),
          appVisible: view.appVisible !== false,
          message: view.message || '',
        },
      };
      this.renderActive();
    }

    setLoginMessage(message) {
      this.applyAuthShell({
        ...(this.auth.view || {}),
        loginPanelVisible: true,
        appVisible: false,
        message: message || '',
      });
    }

    applyCredentials(view = {}) {
      this.auth = {
        ...this.auth,
        credentials: {
          usernameValue: view.usernameValue || '',
          passwordValue: view.passwordValue || '',
          rememberPasswordChecked: Boolean(view.rememberPasswordChecked),
        },
      };
      this.renderActive();
    }

    readCredentials() {
      const credentials = this.auth.credentials || {};
      return {
        username: String(credentials.usernameValue || '').trim().toLowerCase(),
        password: credentials.passwordValue || '',
        rememberPassword: Boolean(credentials.rememberPasswordChecked),
      };
    }

    showLoading(message = '') {
      this.loading = {
        visible: true,
        percentage: 0,
        message: message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90',
      };
      this.renderActive();
      return true;
    }

    updateLoading(progress = {}) {
      if (!this.loading.visible) return false;
      this.loading = {
        ...this.loading,
        percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
        message: progress.message || this.loading.message,
      };
      this.renderActive();
      return true;
    }

    hideLoading() {
      const hadLoading = Boolean(this.loading.visible);
      this.loading = {
        visible: false,
        percentage: 100,
        message: '',
      };
      if (hadLoading) this.renderActive();
      return hadLoading;
    }

    preloadAssets(onProgress = null, assetPaths = null) {
      if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
        onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }
      return this.renderer.preloadAssets(assetPaths || undefined, onProgress);
    }

    toggleRememberPassword() {
      const credentials = this.auth.credentials || {};
      this.auth = {
        ...this.auth,
        credentials: {
          ...credentials,
          rememberPasswordChecked: !credentials.rememberPasswordChecked,
        },
      };
      this.renderActive();
      return true;
    }

    requestAuthInput(field) {
      if (!this.auth.view?.loginPanelVisible || !this.runtime?.requestTextInput) return false;
      const credentials = this.auth.credentials || {};
      const isPassword = field === 'password';
      Promise.resolve(this.runtime.requestTextInput({
        title: isPassword ? '输入密码' : '输入用户名',
        message: isPassword ? '' : '请输入用于登录的用户名',
        placeholder: isPassword ? '密码' : '用户名',
        value: isPassword ? '' : (credentials.usernameValue || ''),
        maxLength: isPassword ? 64 : 32,
      })).then((value) => {
        if (value === null || value === undefined || !this.auth.view?.loginPanelVisible) return;
        const nextValue = String(value);
        this.auth = {
          ...this.auth,
          credentials: {
            ...this.auth.credentials,
            [isPassword ? 'passwordValue' : 'usernameValue']: nextValue,
          },
        };
        this.renderActive();
      }).catch(() => {});
      return true;
    }

    openNaming(view = {}) {
      this.naming = {
        visible: true,
        view,
        inputValue: '',
        submitting: false,
      };
      this.showSettings = false;
      this.showLogs = false;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showAdvisor = false;
      this.showFamousPersons = false;
      this.activeEventId = null;
      this.renderActive();
      return true;
    }

    closeNaming() {
      this.naming = {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      };
      this.renderActive();
      return true;
    }

    getNamingName() {
      return String(this.naming?.inputValue || '').trim();
    }

    setNamingSubmitting(isSubmitting) {
      this.naming = {
        ...this.naming,
        submitting: Boolean(isSubmitting),
      };
      this.renderActive();
    }

    requestNamingInput() {
      if (!this.naming?.visible) return false;
      const view = this.naming.view || {};
      const currentValue = this.naming.inputValue || '';
      if (!this.runtime || typeof this.runtime.requestTextInput !== 'function') return false;
      Promise.resolve(this.runtime.requestTextInput({
        title: view.title || '命名',
        message: view.message || '',
        placeholder: view.placeholder || '',
        value: currentValue,
        maxLength: view.maxLength || 12,
      })).then((value) => {
        if (value === null || value === undefined || !this.naming?.visible) return;
        const maxLength = Number(view.maxLength) || 12;
        this.naming = {
          ...this.naming,
          inputValue: String(value).trim().slice(0, maxLength),
        };
        this.renderActive();
      }).catch(() => {});
      return true;
    }

    handleAction(action, event) {
      return this.actionController?.handle?.(action, { event }) || false;
    }
    setInputEnabled(enabled) {
      this.inputEnabled = Boolean(enabled);
      if (!this.inputEnabled && this.tapDisposer) {
        this.tapDisposer();
        this.tapDisposer = null;
      }
      if (!this.inputEnabled && this.dragDisposer) {
        this.dragDisposer();
        this.dragDisposer = null;
      }
      if (!this.inputEnabled && this.gestureDisposer) {
        this.gestureDisposer();
        this.gestureDisposer = null;
      }
      if (!this.inputEnabled && this.pointerMoveDisposer) {
        this.pointerMoveDisposer();
        this.pointerMoveDisposer = null;
      }
      if (this.inputEnabled) this.bindInput();
    }

    handleResize(size) {
      if (!this.renderer) return;
      this.renderer.width = size.width;
      this.renderer.height = size.height;
      this.renderer.pixelRatio = size.pixelRatio;
      this.renderActive();
    }

    getActiveTab() {
      return this.lastGame?.getActiveTab?.()
        || this.lastGame?.activeTab
        || this.lastGame?.state?.currentTab
        || 'resources';
    }

    getTechTreePan() {
      return {
        x: Number(this.techTreePanX) || 0,
        y: Number(this.techTreePanY) || 0,
      };
    }

    setTechTreePan(pan = {}) {
      const x = Number(pan.x) || 0;
      const y = Number(pan.y) || 0;
      this.techTreePanX = x;
      this.techTreePanY = y;
      if (this.lastGame && typeof this.lastGame === 'object') {
        this.lastGame.techTreePanX = x;
        this.lastGame.techTreePanY = y;
      }
      return true;
    }

    getTechTreeZoom() {
      return Math.max(0.65, Math.min(1.6, Number(this.techTreeZoom) || 1));
    }

    setTechTreeZoom(zoom = 1) {
      const nextZoom = Math.max(0.65, Math.min(1.6, Number(zoom) || 1));
      this.techTreeZoom = nextZoom;
      if (this.lastGame && typeof this.lastGame === 'object') this.lastGame.techTreeZoom = nextZoom;
      return true;
    }

    renderActive() {
      return this.renderReadOnly(this.lastGame?.state, this.getActiveTab());
    }

    renderReadOnly(state, activeTab = 'resources') {
      if (!this.previewEnabled || !this.renderer || !state) return false;
      this.renderer.render(state, {
        activeTab,
        mode: 'hud',
        showSettings: this.showSettings,
        showLogs: this.showLogs,
        showResourceDetails: this.showResourceDetails,
        showCitySwitcher: this.showCitySwitcher,
        showAdvisor: this.showAdvisor,
        showTaskCenter: this.showTaskCenter,
        activeTaskCenterTab: this.activeTaskCenterTab,
        showGuidebook: this.showGuidebook,
        activeGuidebookTab: this.activeGuidebookTab,
        showFamousPersons: this.showFamousPersons,
        showTalentPolicy: this.showTalentPolicy,
        talentPolicyUiState: this.lastGame?.talentPolicyUiState || this.talentPolicyUiState || {},
        logs: this.lastGame?.requestLogs || [],
        tutorial: this.lastGame?.tutorialController?.state || this.lastGame?.tutorial || {},
        buildingOffset: this.buildingOffset,
        techTreePanX: this.techTreePanX,
        techTreePanY: this.techTreePanY,
        techTreeZoom: this.getTechTreeZoom(),
        ...(this.selectedTechId ? { selectedTechId: this.selectedTechId } : {}),
        techDetailOpen: this.techDetailOpen || Boolean(state.techUiState?.detailOpen),
        activeBuildingCategory: this.activeBuildingCategory,
        ...(this.pageTransition ? { pageTransition: this.pageTransition } : {}),
        ...(this.buildingTransition ? { buildingTransition: this.buildingTransition } : {}),
        activeEventId: this.activeEventId,
        territoryUiState: this.lastGame?.territoryController?.getUiState?.() || this.territoryUiState || {},
        ...((this.lastGame?.battleScene || this.battleScene) ? { battleScene: this.lastGame?.battleScene || this.battleScene } : {}),
        tabLocks: this.getTabLocks(state),
        naming: this.naming,
        auth: this.auth,
        loading: this.loading,
        floatingTexts: this.getFloatingTextView(),
        tutorialHighlight: this.tutorialHighlight,
        rewardReveal: this.rewardReveal,
      });
      return true;
    }

    startBattleScene(report = null) {
      if (!report) return false;
      this.battleScene = {
        visible: true,
        report,
        turnIndex: 0,
      };
      return this.renderActive();
    }

    closeBattleScene() {
      this.battleScene = null;
      return this.renderActive();
    }

    getTabLocks(state = {}) {
      const tabIds = ['resources', 'buildings', 'tech', 'events', 'civilization', 'military'];
      const canOpenTab = this.lastGame?.tutorialController?.canOpenTab;
      if (typeof canOpenTab !== 'function') {
        return tabIds.map((id) => ({ id, disabled: false, isLocked: false }));
      }
      return tabIds.map((id) => {
        const allowed = Boolean(canOpenTab.call(this.lastGame.tutorialController, id));
        return {
          id,
          disabled: !allowed,
          isLocked: !allowed,
        };
      });
    }

    static mount(game, options = {}) {
      const RuntimeCtor = options.Runtime || global.H5CanvasRuntime;
      const runtime = options.canvasRuntime
        || (options.runtime?.ensureCanvas ? options.runtime : null)
        || (RuntimeCtor ? new RuntimeCtor(options) : null);
      const shell = new CanvasGameShell({
        runtime,
        renderer: options.renderer,
        presenter: options.presenter,
        previewEnabled: options.previewEnabled,
        inputEnabled: options.inputEnabled,
        onAction: options.onAction,
      });
      const mounted = shell.mount(game);
      return mounted ? shell : null;
    }
  }

  global.CanvasGameShell = CanvasGameShell;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasGameShell;
})(typeof window !== 'undefined' ? window : globalThis);

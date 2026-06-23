(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function install(CanvasGameApp) {
    if (!CanvasGameApp?.prototype) return false;
    Object.assign(CanvasGameApp.prototype, {
      openNaming(prompt = {}) {
            const view = this.presenter.buildNamingPromptViewState(prompt);
            this.activeNamingPrompt = prompt;
            this.activeNamingPromptKey = view.key;
            this.naming = {
              visible: true,
              view,
              prompt,
              inputValue: '',
              submitting: false,
            };
              this.showResourceDetails = false;
              this.showCitySwitcher = false;
              this.showSubcityList = false;
              this.showCityManagement = false;
              this.activeEventId = null;
              this.showFamousPersons = false;
              this.activeCommandPanel = '';
              if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
              this.render();
              this.scheduleTutorialHighlightRefresh(80);
          },

      closeNaming() {
            this.activeNamingPrompt = null;
            this.activeNamingPromptKey = null;
            this.naming = {
              visible: false,
              view: null,
              prompt: null,
              inputValue: '',
              submitting: false,
            };
            if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
            this.render();
          },

      scheduleTutorialHighlightRefresh(delayMs = 0) {
            const callback = () => this.tutorialController?.refreshCurrentHighlight?.();
            const scheduler = typeof this.scheduler?.setTimeout === 'function'
              ? this.scheduler
              : (typeof this.runtime?.setTimeout === 'function' ? this.runtime : null);
            if (scheduler) {
              scheduler.setTimeout(callback, delayMs);
              return true;
            }
            if (typeof setTimeout === 'function') {
              setTimeout(callback, delayMs);
              return true;
            }
            callback();
            return false;
          },

      async requestNamingInput() {
            if (!this.naming.visible || typeof this.runtime.requestTextInput !== 'function') return;
            const view = this.naming.view || {};
            const value = await this.runtime.requestTextInput({
              title: view.title || t('shell.naming.title'),
              message: view.message || '',
              placeholder: view.placeholder || '',
              value: this.naming.inputValue || '',
              maxLength: view.maxLength || 12,
            });
            if (value === null || value === undefined || !this.naming.visible) return;
            this.naming.inputValue = String(value).trim().slice(0, Number(view.maxLength) || 12);
            if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
            this.render();
            this.scheduleTutorialHighlightRefresh(0);
          },

      submitNaming(inputName = null) {
            return this.submitNamingValue(inputName);
          },

      async submitNamingValue(inputName = null) {
            const prompt = this.activeNamingPrompt || this.naming.prompt || {};
            const name = String(inputName ?? this.naming.inputValue ?? '').trim();
            if (!prompt.type || !name) return;
            let tutorialHandledView = false;
            this.naming.submitting = true;
            if (this.canvasShell && typeof this.canvasShell.naming !== 'undefined') this.canvasShell.naming = this.naming;
            this.render();
            try {
              const api = this.getGameApi();
              const result = prompt.type === 'polity'
                ? await api.renamePolity(name)
                : await api.renameCity(prompt.territoryId, name);
              this.closeNaming();
              this.applyApiState(result);
              this.tutorialController?.sync?.(this.tutorial || this.state?.tutorial || {});
              tutorialHandledView = this.tutorialController?.refreshCurrentHighlight?.() === true;
              this.showFloatingText(result.message);
              this.log(`成功：${result.message || ''}`);
            } catch (error) {
              this.log(`失败：${error.payload?.message || error.message}`);
            } finally {
              this.naming.submitting = false;
              if (!tutorialHandledView) this.renderCanvasSurface(this.state?.currentTab);
            }
          },

      async handleCanvasTabSelection(tabId) {
            if (!tabId) return false;
            const onTabClicked = this.tutorialController?.onTabClicked;
            const allowed = typeof onTabClicked === 'function'
              ? await onTabClicked.call(this.tutorialController, tabId).catch(() => false)
              : true;
            if (!allowed) {
              this.log('请先完成当前引导步骤');
              this.renderCanvasSurface(this.state?.currentTab);
              return false;
            }
            this.switchTab(tabId);
            return true;
          },

      moveToCurrentMainTaskTarget() {
            return false;
          },

      continueCurrentMainTaskTarget() {
            return false;
          },

      getTargetTab(key) {
            return this.guideController?.getTargetTab?.(key) || null;
          },

      getTutorialTarget(key) {
            return this.canvasShell?.getTutorialTarget?.(key)
              || this.guideController?.getTargetRect?.(key)
              || null;
          },

      getGuideState() {
            return this.state;
          },

      getGuideActiveTab() {
            return this.getActiveTab();
          },

      getGuideTutorialState() {
            return this.state?.tutorial || {};
          },

      getGuideCanvasTarget(type, predicate = null) {
            return this.canvasShell?.getCanvasTarget?.(type, predicate)
              || this.getCanvasTarget(type, predicate);
          },

      renderGuideFrame() {
            this.renderCanvasSurface(this.state?.currentTab || this.getActiveTab());
            return true;
          },

      switchGuideTab(tabId) {
            this.switchTab(tabId);
            return true;
          },

      setGuideMilitaryView(view) {
            this.militaryView = view || 'army';
            this.state = { ...this.state, militaryView: this.militaryView };
            this.render();
            return true;
          },

      getCanvasTarget(type, predicate = null) {
            const targets = this.canvasShell?.renderer?.hitTargets || this.renderer?.hitTargets || [];
            const target = targets.find((item) => (
              item.action?.type === type
              && (typeof predicate !== 'function' || predicate(item.action))
            ));
            if (!target) return null;
            return {
              left: target.x,
              top: target.y,
              width: target.width,
              height: target.height,
              right: target.x + target.width,
              bottom: target.y + target.height,
            };
          },

      getGuideTargetRect(key) {
            return this.guideController?.getTargetRect?.(key) || null;
          },

      refreshTaskCenterGuideHighlight(action = {}) {
            return this.guideController?.refreshTaskCenterGuideHighlight?.(action) || false;
          },

      hasClaimableMainTask() {
            return false;
          },

      refreshCurrentGuideHighlight() {
            return false;
          },

      ensureGuideTargetVisible(key) {
            return false;
          },

      normalizeGuideHighlightRect(target) {
            if (!target) return null;
            const rawRect = typeof target.getRect === 'function'
              ? target.getRect()
              : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
            const left = Number(rawRect.left ?? rawRect.x);
            const top = Number(rawRect.top ?? rawRect.y);
            const width = Number(rawRect.width);
            const height = Number(rawRect.height);
            if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
            return {
              left,
              top,
              width,
              height,
              right: Number(rawRect.right) || left + width,
              bottom: Number(rawRect.bottom) || top + height,
            };
          },

      showGuideHighlight(target, message, options = {}) {
            return false;
          },

      hideGuideHighlight() {
            if (this.canvasShell && typeof this.canvasShell.hideTutorialHighlight === 'function') {
              const hidden = this.canvasShell.hideTutorialHighlight();
              this.tutorialHighlight = this.canvasShell.tutorialHighlight || null;
              return hidden;
            }
            const hadHighlight = Boolean(this.tutorialHighlight);
            this.tutorialHighlight = null;
            if (hadHighlight) this.renderCanvasSurface(this.state?.currentTab);
            return hadHighlight;
          },

      showGuideControllerHighlight(target, message) {
            return this.showGuideHighlight(target, message);
          },

      hideGuideControllerHighlight() {
            return this.hideGuideHighlight();
          },

      hasGuideControllerHighlight() {
            return false;
          },

      goToGuideTaskTarget(action = {}) {
            return false;
          },

      toggleCitySwitcher() {
            const target = this.canvasShell || this;
            target.showCitySwitcher = !target.showCitySwitcher;
            this.renderCanvasSurface(this.state?.currentTab);
          },

      closeCitySwitcher(options = {}) {
            const target = this.canvasShell || this;
            target.showCitySwitcher = false;
            if (options.skipRender) return true;
            this.renderCanvasSurface(this.state?.currentTab);
            return true;
          },

      openCityManagement(options = {}) {
            this.showCityManagement = true;
            this.activeCityManagementTab = options.tab || this.activeCityManagementTab || 'buildings';
            this.showSubcityList = false;
            this.activeCommandPanel = '';
            this.activeEventId = null;
            if (this.canvasShell) {
              this.canvasShell.showCityManagement = true;
              this.canvasShell.activeCityManagementTab = this.activeCityManagementTab;
              this.canvasShell.showSubcityList = false;
              this.canvasShell.activeCommandPanel = '';
              this.canvasShell.activeEventId = null;
            }
            return this.renderCanvasSurface(this.state?.currentTab);
          },

      closeCityManagement() {
            this.showCityManagement = false;
            if (this.canvasShell) this.canvasShell.showCityManagement = false;
            return this.renderCanvasSurface(this.state?.currentTab);
          },

      switchCityManagementTab(tab = 'buildings') {
            const allowed = ['buildings', 'people', 'military'];
            this.activeCityManagementTab = allowed.includes(tab) ? tab : 'buildings';
            if (this.canvasShell) this.canvasShell.activeCityManagementTab = this.activeCityManagementTab;
            return this.renderCanvasSurface(this.state?.currentTab);
          },

      getMissionRemainingSeconds(mission) {
            return this.presenter?.getScoutMissionRemainingSeconds?.(mission);
          },

      formatScoutCountdown(seconds) {
            return this.presenter?.formatScoutCountdown?.(seconds);
          },

      maybeShowNamingPrompt() {
            const prompt = this.state?.territoryState?.namingPrompt;
            const key = prompt ? `${prompt.type}:${prompt.territoryId || 'polity'}` : null;
            if (!prompt || this.activeNamingPromptKey === key) return;
            this.openNaming(prompt);
          },

      requestCityRename(prompt = {}) {
            if (!prompt.territoryId) return null;
            this.openNaming({
              type: 'city',
              territoryId: prompt.territoryId,
              title: t('world.site.rename.cityTitle'),
              message: t('world.site.rename.currentName', {
                name: prompt.currentName || t('world.site.rename.unnamedCity'),
              }),
            });
            return null;
          },

      closeNamingModal() {
            this.closeNaming();
          },

      renderSoftGuide(options = {}) {
            this.updateAdvisor(this.state?.softGuide || null, { skipSurface: true });
            this.hideGuideHighlight();
            if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
          },

      getActiveGuideNavigation() {
            return null;
          },

      hasActiveGuideTaskTarget(target) {
            return false;
          },

      getFallbackGuideTarget(target) {
            if (target === 'btn-advance-era') return 'tab-civilization';
            if (target === 'card-craftsman') return 'tab-resources';
            if (target === 'event-card-special' || target === 'btn-claim-event') return 'tab-events';
            if (target === 'scout-action-first') return 'tab-military';
            if (target === 'task-center-main-claim') return 'task-center-button';
            if (typeof target === 'string' && target.startsWith('card-')) return 'tab-buildings';
            return null;
          },

      updateAdvisor(guide, options = {}) {
            const view = this.presenter?.buildAdvisorViewState?.(guide) || {};
            this.activeAdvisor = view.activeAdvisor;
            if (!options.skipSurface) this.renderCanvasSurface(this.state?.currentTab);
          },

      goToAdvisorTarget() {
            const target = this.activeAdvisor?.target || this.state?.softGuide?.target || null;
            if (target === 'task-center-button') {
              const action = { type: 'openTaskCenter', tab: 'main', source: 'advisor' };
              this.showAdvisor = false;
              if (this.canvasShell) this.canvasShell.showAdvisor = false;
              this.canvasShell?.hideTutorialHighlight?.();
              if (this.canvasShell?.actionController?.handle_openTaskCenter) {
                this.canvasShell.actionController.handle_openTaskCenter(action);
              } else if (this.actionController?.handle_openTaskCenter) {
                this.actionController.handle_openTaskCenter(action);
              } else {
                this.showTaskCenter = true;
                this.activeTaskCenterTab = 'main';
                if (this.canvasShell) {
                  this.canvasShell.showTaskCenter = true;
                  this.canvasShell.activeTaskCenterTab = 'main';
                }
                this.renderCanvasSurface(this.state?.currentTab);
              }
              this.tutorialController?.refreshCurrentHighlight?.();
              return true;
            }
            if (target === 'scout-action-first') {
              return this.canvasShell?.goToGuideTaskTarget?.({
                target,
                nextAction: { type: 'switchMilitaryView', view: 'scout' },
              });
            }
            const tabId = this.presenter?.getAdvisorTargetTab?.(target);
            if (tabId) this.switchTab(tabId);
            return Boolean(tabId);
          },

      showFloatingText(message) {
            const shown = this.canvasShell?.showFloatingText?.(message);
            if (!shown && message) this.log(message);
            return shown;
          },

      cacheRequestLog(path, method, body, statusCode, response, duration) {
            this.requestLogs.unshift({
              path,
              method,
              body: body ? JSON.stringify(body).slice(0, 200) : '',
              statusCode,
              response: JSON.stringify(response).slice(0, 200),
              duration,
              timestamp: new Date().toLocaleTimeString(),
            });
            if (this.requestLogs.length > 100) this.requestLogs = this.requestLogs.slice(0, 100);
          },

      log(message) {
            if (this.externalLog) this.externalLog(message);
            const entry = { text: String(message ?? ''), timestamp: Date.now() };
            this.recentLogs.unshift(entry);
            if (this.recentLogs.length > 30) this.recentLogs = this.recentLogs.slice(0, 30);
          },

      getSelectedSite() {
            return (this.state.territoryState?.territories || []).find((site) => site.id === this.territoryUiState.selectedSiteId) || null;
          },

      getExpeditionSoldiers(site = this.getSelectedSite()) {
            const recommended = Math.max(1, Number(site?.recommendedSoldiers) || Number(site?.defense) || 1);
            return Math.max(1, Number(this.territoryUiState.expeditionSoldiers) || recommended);
          },
    });
    return true;
  }

  const api = { install };

  global.CanvasGameAppGuideUi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  function install(CanvasGameShell) {
    if (!CanvasGameShell?.prototype) return false;
    Object.assign(CanvasGameShell.prototype, {
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
    },

showRewardReveal(reveal) {
      if (!reveal) return false;
      this.rewardReveal = {
        ...reveal,
        createdAt: this.now(),
      };
      this.tutorialHighlight = null;
      this.startFloatTimer();
      this.renderActive();
      return true;
    },

closeRewardReveal() {
      const hadReveal = Boolean(this.rewardReveal);
      this.rewardReveal = null;
      if (hadReveal) {
        this.renderActive();
        this.lastGame?.tutorialController?.refreshCurrentHighlight?.();
      }
      return hadReveal;
    },

openConfirmDialog(view = {}) {
      this.confirmDialog = {
        visible: true,
        kind: view.kind || 'generic',
        source: view.source || '',
        title: view.title || '请确认',
        message: view.message || '',
        confirmLabel: view.confirmLabel || '确定',
        cancelLabel: view.cancelLabel || '取消',
        submitting: Boolean(view.submitting),
      };
      this.showSettings = false;
      this.showLogs = false;
      this.showResourceDetails = false;
      this.showCitySwitcher = false;
      this.showSubcityList = false;
      this.showCityManagement = false;
      this.showAdvisor = false;
      this.showFamousPersons = false;
      this.activeCommandPanel = '';
      this.activeEventId = null;
      this.renderActive();
      return true;
    },

openResetConfirm(options = {}) {
      return this.openConfirmDialog({
        kind: 'resetGame',
        source: options.source || '',
        title: '重置游戏进度',
        message: '当前账号的所有发展将回到初始状态。此操作不可撤销。',
        confirmLabel: '确认重置',
        cancelLabel: '取消',
      });
    },

closeConfirmDialog() {
      const hadDialog = Boolean(this.confirmDialog?.visible);
      this.confirmDialog = null;
      if (hadDialog) this.renderActive();
      return hadDialog;
    },

setConfirmDialogSubmitting(isSubmitting) {
      if (!this.confirmDialog?.visible) return false;
      this.confirmDialog = {
        ...this.confirmDialog,
        submitting: Boolean(isSubmitting),
      };
      this.renderActive();
      return true;
    },

getFloatingTextView(now = this.now()) {
      return this.floatingTexts
        .map((effect) => ({
          ...effect,
          progress: Math.max(0, Math.min(1, (now - effect.createdAt) / Math.max(1, effect.durationMs))),
        }))
        .filter((effect) => effect.progress < 1);
    },

pruneFloatingTexts(now = this.now()) {
      const next = this.floatingTexts.filter((effect) => now - effect.createdAt < effect.durationMs);
      const changed = next.length !== this.floatingTexts.length;
      this.floatingTexts = next;
      return changed;
    },

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
    },

stopFloatTimer() {
      if (!this.effectTimer) return;
      this.runtime?.clearInterval?.(this.effectTimer);
      this.effectTimer = null;
      this.floatTimer = null;
    },

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
    },

setLoginMessage(message) {
      this.applyAuthShell({
        ...(this.auth.view || {}),
        loginPanelVisible: true,
        appVisible: false,
        message: message || '',
      });
    },

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
    },

readCredentials() {
      const credentials = this.auth.credentials || {};
      return {
        username: String(credentials.usernameValue || '').trim().toLowerCase(),
        password: credentials.passwordValue || '',
        rememberPassword: Boolean(credentials.rememberPasswordChecked),
      };
    },

showLoading(message = '') {
      this.loading = {
        visible: true,
        percentage: 0,
        message: message || '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90',
      };
      this.renderActive();
      return true;
    },

updateLoading(progress = {}) {
      if (!this.loading.visible) return false;
      this.loading = {
        ...this.loading,
        percentage: Math.max(0, Math.min(100, Number(progress.percentage) || 0)),
        message: progress.message || this.loading.message,
      };
      this.renderActive();
      return true;
    },

hideLoading() {
      const hadLoading = Boolean(this.loading.visible);
      this.loading = {
        visible: false,
        percentage: 100,
        message: '',
      };
      if (hadLoading) this.renderActive();
      return hadLoading;
    },

preloadAssets(onProgress = null, assetPaths = null) {
      if (!this.renderer || typeof this.renderer.preloadAssets !== 'function') {
        onProgress?.({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
        return Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 });
      }
      return this.renderer.preloadAssets(assetPaths || undefined, onProgress).then((result) => {
        this.worldMapRenderer?.scheduleWorldTileCachePrewarm?.(
          assetPaths || this.renderer.getPreloadAssetPaths?.(),
          { deferPrewarm: true },
        );
        return result;
      });
    },

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
    },

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
    },

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
      this.showSubcityList = false;
      this.showCityManagement = false;
      this.showAdvisor = false;
      this.showFamousPersons = false;
      this.activeCommandPanel = '';
      this.activeEventId = null;
      this.renderActive();
      return true;
    },

closeNaming() {
      this.naming = {
        visible: false,
        view: null,
        inputValue: '',
        submitting: false,
      };
      this.renderActive();
      return true;
    },

getNamingName() {
      return String(this.naming?.inputValue || '').trim();
    },

setNamingSubmitting(isSubmitting) {
      this.naming = {
        ...this.naming,
        submitting: Boolean(isSubmitting),
      };
      this.renderActive();
    },

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
        const game = this.getCanvasGameHost?.() || this.lastGame || null;
        const refresh = () => game?.tutorialController?.refreshCurrentHighlight?.();
        if (typeof this.runtime?.setTimeout === 'function') this.runtime.setTimeout(refresh, 0);
        else refresh();
      }).catch(() => {});
      return true;
    },

setNetworkState(state = {}) {
      const previousStatus = this.networkState?.status || 'online';
      this.networkState = {
        ...(this.networkState || {}),
        ...(state || {}),
      };
      const nextStatus = this.networkState.status || 'online';
      if (previousStatus !== nextStatus || nextStatus === 'reconnecting') {
        this.renderActive({ invalidateWorldTileView: false });
      }
      if (nextStatus === 'reconnecting') this.startNetworkOverlayTimer();
      else this.stopNetworkOverlayTimer();
      return this.networkState;
    },

startNetworkOverlayTimer() {
      if (this.networkOverlayTimer || !this.runtime?.setInterval) return false;
      this.networkOverlayTimer = this.runtime.setInterval(() => {
        if (this.networkState?.status !== 'reconnecting') {
          this.stopNetworkOverlayTimer();
          return;
        }
        this.renderActive({ invalidateWorldTileView: false });
      }, 160);
      return true;
    },

stopNetworkOverlayTimer() {
      if (!this.networkOverlayTimer) return false;
      this.runtime?.clearInterval?.(this.networkOverlayTimer);
      this.networkOverlayTimer = null;
      return true;
    },

startBattleScene(report = null) {
      if (!report) return false;
      this.battleScene = {
        visible: true,
        report,
        turnIndex: 0,
      };
      return this.renderActive();
    },

closeBattleScene() {
      this.battleScene = null;
      return this.renderActive();
    }
    });
    return true;
  }

  const api = { install };

  global.CanvasGameShellSystemUi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

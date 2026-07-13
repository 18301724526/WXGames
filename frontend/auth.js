// ==================== 账号管理模块 ====================
// 挂载函数 — 由 app.js init() 调用，避免 IIFE 的竞态问题

window.mountAuthMethods = function(game, deps = {}) {
  const presenter = deps.presenter;
  const authStorage = deps.authStorage || game.authStorage;
  const authRuntime = deps.authRuntime || game.authRuntime;

  function setLoginMessage(message) {
    game.canvasShell?.setLoginMessage?.(message);
  }

  function applyAuthShellView(view) {
    game.authView = view;
    game.canvasShell?.applyAuthShell?.(view);
  }

  function showAuthenticatedShell() {
    applyAuthShellView(presenter.buildAuthShellViewState({ authenticated: true }));
  }

  async function waitForAuthenticatedAssets() {
    const message = '\u6b63\u5728\u6574\u7406\u5927\u5730\u56fe';
    if (typeof game.loadGameAssets === 'function') {
      await game.loadGameAssets({ message, hideWhenDone: false });
      return;
    }
    const trace = window.H5LoadTrace;
    trace?.phaseStart?.('assets:preload', { message, source: 'canvasShell' });
    game.canvasShell?.showLoading?.(message);
    try {
      const result = await (game.canvasShell?.preloadAssets?.((progress) => {
        const progressMessage = progress?.message || message;
        trace?.progress?.('assets:preload', { ...progress, message: progressMessage });
        game.canvasShell?.updateLoading?.({ ...progress, message: progressMessage });
      }) || Promise.resolve({ total: 0, completed: 0, loaded: 0, failed: 0, percentage: 100 }));
      game.canvasShell?.updateLoading?.({ percentage: 100, message: '\u8d44\u6e90\u51c6\u5907\u5b8c\u6210' });
      trace?.phaseEnd?.('assets:preload', result || {});
    } catch (error) {
      trace?.phaseFail?.('assets:preload', error);
      throw error;
    }
  }

  function startAuthenticatedSession() {
    const trace = window.H5LoadTrace;
    trace?.phaseStart?.('auth:session', {
      hasToken: Boolean(game.token),
      hasCanvasShell: Boolean(game.canvasShell),
    });
    game.showLoading?.('\u6b63\u5728\u6574\u7406\u5927\u5730\u56fe');
    showAuthenticatedShell();
    return waitForAuthenticatedAssets()
      .catch((error) => {
        trace?.warn?.('assets:preload:ignored-error', {
          error: error?.message || String(error || ''),
        });
        console.warn('[auth.js] asset preload failed before heartbeat', error);
      })
      .finally(() => {
        trace?.phaseEnd?.('auth:session', { next: 'state:first-sync' });
        return game.startHeartbeat();
      });
  }

  function persistRememberedCredentials(username, password, rememberPassword) {
    authStorage?.persistRememberedCredentials?.(username, password, rememberPassword);
  }

  function fillRememberedCredentials() {
    const view = presenter.buildAuthCredentialViewState(authStorage?.getCredentialSnapshot?.() || {});
    game.authCredentials = view;
    game.canvasShell?.applyCredentials?.(view);
  }

  async function parseResponsePayload(resp) {
    const text = await resp.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      return { message: text.trim() || null };
    }
  }

  game.handleAuthError = function(data) {
    console.error('Auth error:', data);
    this.token = null;
    this.playerId = null;
    authStorage?.clearSession?.();
    this.showLoginPanel(data?.message || '登录已过期，请重新登录');
  };

  game.showLoginPanel = function(message) {
    fillRememberedCredentials();
    applyAuthShellView(presenter.buildAuthShellViewState({
      authenticated: false,
      message,
    }));
  };

  game.handleLogin = function() {
    const credentials = this.canvasShell?.readCredentials?.() || this.authCredentials || {};
    const username = credentials.username;
    const password = credentials.password;
    const rememberPassword = credentials.rememberPassword;
    if (!username) { setLoginMessage('请输入用户名'); return; }
    if (!password) { setLoginMessage('请输入密码'); return; }
    return this.loginWithPassword(username, password, rememberPassword);
  };

  game.loginWithPassword = async function(username, password, rememberPassword) {
    const trace = window.H5LoadTrace;
    trace?.phaseStart?.('auth:login', {
      username: username || '',
      rememberPassword: Boolean(rememberPassword),
    });
    let span = null;
    let resp = null;
    let apiSettled = false;
    try {
      const url = `${this.apiBase}/player/login`;
      const body = JSON.stringify({ username, password });
      span = trace?.apiStart?.('POST', '/player/login', url, {
        hasToken: false,
        bodyBytes: body.length,
      });
      resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = await parseResponsePayload(resp);
      if (!resp.ok) {
        const error = new Error(data.message || `HTTP ${resp.status}`);
        trace?.apiFail?.(span, error, {
          status: resp.status,
          ok: false,
        });
        apiSettled = true;
        trace?.phaseEnd?.('auth:login', {
          status: resp.status,
          ok: false,
        });
        setLoginMessage(data.message || `服务器错误 (${resp.status})，请稍后再试`);
        return;
      }
      trace?.apiEnd?.(span, {
        status: resp.status,
        ok: true,
        hasGameState: Boolean(data.gameState),
      });
      apiSettled = true;
      if (data.token) {
        this.token = data.token; this.playerId = data.playerId;
        authStorage?.setToken?.(data.token);
        authStorage?.setUsername?.(username);
        persistRememberedCredentials(username, password, rememberPassword);
        if (this.buildingAPI) this.buildingAPI.setToken(data.token);
        this.showLoading?.('\u6b63\u5728\u6574\u7406\u5927\u5730\u56fe');
        showAuthenticatedShell();
        await waitForAuthenticatedAssets();
        if (data.gameState) {
          this.applyApiState(data);
        }
        trace?.phaseEnd?.('auth:login', {
          status: resp.status,
          hasGameState: Boolean(data.gameState),
          next: 'state:first-sync',
        });
        this.startHeartbeat();
      } else {
        trace?.phaseEnd?.('auth:login', {
          status: resp.status,
          ok: false,
          reason: 'missing token',
        });
        setLoginMessage(data.message || '登录失败');
      }
    } catch (e) {
      if (!apiSettled) {
        trace?.apiFail?.(span, e, {
          status: resp?.status || 0,
          ok: false,
        });
      }
      trace?.phaseFail?.('auth:login', e);
      setLoginMessage('网络错误：' + e.message);
    }
  };

  game.logout = function() {
    this.token = null;
    this.playerId = null;
    authStorage?.clearSession?.();
    authRuntime?.reload?.();
  };

  game.resetGame = async function(options = {}) {
    if (!options.confirmed) {
      if (typeof this.canvasShell?.openResetConfirm !== 'function') {
        authRuntime?.alertMessage?.('确认界面未就绪，请稍后再试');
        return false;
      }
      return this.canvasShell.openResetConfirm({ source: options.source || 'resetGame' }) !== false;
    }
    try {
      const result = await this.getGameApi().resetPlayer();
      if (!result.success) {
        authRuntime?.alertMessage?.(result.message || '重置失败');
        return false;
      }
      this.resetLocalViewToResources?.({ skipRender: true });
      this.canvasShell?.resetLocalViewToResources?.({ skipGame: true, skipRender: true });
      const actionController = this.actionController || this.canvasShell?.actionController || null;
      actionController?.resetWorldMapCamera?.({ source: 'accountReset', render: false, resetRuntimeState: true });
      this.applyApiState(result);
      actionController?.resetWorldMapCamera?.({ source: 'accountReset', render: true });
      this.canvasShell?.closeConfirmDialog?.();
      this.showFloatingText && this.showFloatingText(result.message || '进度已重置');
      this.log && this.log(`✅ ${result.message || '进度已重置'}`);
      authRuntime?.alertMessage?.(result.message || '进度已重置');
      return true;
    } catch (error) {
      authRuntime?.alertMessage?.(error.payload?.message || '请求失败');
      return false;
    }
  };

  game.toggleSettings = function() {
    if (!this.canvasShell) return false;
    this.canvasShell.showSettings = !this.canvasShell.showSettings;
    this.canvasShell.renderActive?.();
    return true;
  };
  game.closeSettings = function() {
    if (!this.canvasShell) return false;
    this.canvasShell.showSettings = false;
    this.canvasShell.renderActive?.();
    return true;
  };

  // 已有 token 时自动启动 heartbeat（刷新页面无需重新登录）
  if (game.token) {
    if (game.canvasShell) {
      startAuthenticatedSession();
    } else {
      game.onCanvasShellReady = startAuthenticatedSession;
      showAuthenticatedShell();
    }
  } else {
    // 无 token：显示登录面板
    game.showLoginPanel();
  }

};

// ==================== 账号管理模块 ====================
// 挂载函数 — 由 app.js init() 调用，避免 IIFE 的竞态问题

window.mountAuthMethods = function(game, deps = {}) {
  const presenter = deps.presenter;
  const authStorage = deps.authStorage || game.authStorage;
  const authRuntime = deps.authRuntime || game.authRuntime;

  function clearTutorialStorage() {
    authStorage?.clearTutorialStorage?.();
  }

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
    const message = '\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90';
    if (typeof game.loadGameAssets === 'function') {
      await game.loadGameAssets({ message });
      return;
    }
    game.canvasShell?.showLoading?.(message);
    try {
      await (game.canvasShell?.preloadAssets?.((progress) => {
        game.canvasShell?.updateLoading?.({ ...progress, message });
      }) || Promise.resolve());
    } finally {
      game.canvasShell?.hideLoading?.();
    }
  }

  function startAuthenticatedSession() {
    game.showLoading?.('\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90');
    showAuthenticatedShell();
    return waitForAuthenticatedAssets()
      .catch((error) => {
        console.warn('[auth.js] asset preload failed before heartbeat', error);
      })
      .finally(() => game.startHeartbeat());
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
    try {
      const url = `${this.apiBase}/player/login`;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await parseResponsePayload(resp);
      if (!resp.ok) {
        setLoginMessage(data.message || `服务器错误 (${resp.status})，请稍后再试`);
        return;
      }
      if (data.token) {
        this.token = data.token; this.playerId = data.playerId;
        authStorage?.setToken?.(data.token);
        authStorage?.setUsername?.(username);
        persistRememberedCredentials(username, password, rememberPassword);
        if (this.buildingAPI) this.buildingAPI.setToken(data.token);
        this.showLoading?.('\u6b63\u5728\u6574\u7406\u8425\u5730\u8d44\u6e90');
        showAuthenticatedShell();
        await waitForAuthenticatedAssets();
        if (data.gameState) {
          this.applyApiState(data);
        }
        this.startHeartbeat();
      } else {
        setLoginMessage(data.message || '登录失败');
      }
    } catch (e) {
      setLoginMessage('网络错误：' + e.message);
    }
  };

  game.logout = function() {
    this.token = null;
    this.playerId = null;
    authStorage?.clearSession?.();
    authRuntime?.reload?.();
  };

  game.resetGame = async function() {
    if (!authRuntime?.confirmReset?.()) return false;
    try {
      const result = await this.apiPost('/player/reset', {});
      if (!result.success) {
        authRuntime?.alertMessage?.(result.message || '重置失败');
        return false;
      }
      this.resetLocalViewToResources?.({ skipRender: true });
      this.canvasShell?.resetLocalViewToResources?.({ skipGame: true, skipRender: true });
      this.applyApiState(result);
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

  console.log('[auth.js] 账号管理模块已挂载');
};

// ==================== 账号管理模块 ====================
// 挂载函数 — 由 app.js init() 调用，避免 IIFE 的竞态问题

window.mountAuthMethods = function(game) {
  const authStorage = game.authStorage || window.H5AuthStorageAdapter?.fromRuntime(window);

  function clearTutorialStorage() {
    authStorage?.clearTutorialStorage?.();
  }

  function setLoginMessage(message) {
    game.authShell?.setMessage(message);
  }

  function applyAuthShellView(view) {
    game.authShell?.applyShell(view);
  }

  function showAuthenticatedShell() {
    applyAuthShellView(window.UIStatePresenter.buildAuthShellViewState({ authenticated: true }));
  }

  function persistRememberedCredentials(username, password, rememberPassword) {
    authStorage?.persistRememberedCredentials?.(username, password, rememberPassword);
  }

  function fillRememberedCredentials() {
    const view = window.UIStatePresenter.buildAuthCredentialViewState(authStorage?.getCredentialSnapshot?.() || {});
    game.authShell?.applyCredentials(view);
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
    applyAuthShellView(window.UIStatePresenter.buildAuthShellViewState({
      authenticated: false,
      message,
    }));
  };

  game.handleLogin = function() {
    const credentials = this.authShell?.readCredentials() || {};
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
        showAuthenticatedShell();
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
    location.reload();
  };

  game.resetGame = async function() {
    if (!confirm('⚠️ 确定重置游戏进度？\n当前账号的所有发展将回到初始状态。')) return;
    try {
      const result = await this.apiPost('/player/reset', {});
      if (!result.success) {
        alert(result.message || '重置失败');
        return;
      }
      this.applyApiState(result);
      this.showFloatingText && this.showFloatingText(result.message || '进度已重置');
      this.log && this.log(`✅ ${result.message || '进度已重置'}`);
      alert(result.message || '进度已重置');
    } catch (error) {
      alert(error.payload?.message || '请求失败');
    }
  };

  game.toggleSettings = function() { this.authShell?.toggleSettings(); };
  game.closeSettings = function() { this.authShell?.closeSettings(); };

  // 已有 token 时自动启动 heartbeat（刷新页面无需重新登录）
  if (game.token) {
    showAuthenticatedShell();
    game.startHeartbeat();
  } else {
    // 无 token：显示登录面板
    game.showLoginPanel();
  }

  game.authShell?.bindLoginEvents(() => game.handleLogin());

  console.log('[auth.js] 账号管理模块已挂载');
};

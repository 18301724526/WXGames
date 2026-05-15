// ==================== 账号管理模块 ====================
// 挂载函数 — 由 app.js init() 调用，避免 IIFE 的竞态问题

window.mountAuthMethods = function(game) {
  game.handleAuthError = function(data) {
    console.error('Auth error:', data);
    this.token = null;
    this.playerId = null;
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_deviceId');
        localStorage.removeItem('civilizationFirePhase2');
    this.showLoginPanel(data?.message || '登录已过期，请重新登录');
  };

  game.showLoginPanel = function(message) {
    const panel = document.getElementById('loginPanel');
    const msgEl = document.getElementById('loginMessage');
    const appEl = document.getElementById('app');
    if (panel) { panel.style.display = 'flex'; if (msgEl) msgEl.textContent = message || ''; }
    if (appEl) appEl.style.display = 'none';
  };

  game.handleLogin = function() {
    const deviceId = document.getElementById('loginDeviceId')?.value.trim();
    if (!deviceId) { document.getElementById('loginMessage').textContent = '请输入设备ID'; return; }
    this.loginOrRegister(deviceId, 'login');
  };

  game.handleRegister = function() {
    const deviceId = document.getElementById('loginDeviceId')?.value.trim() || ('dev_' + Date.now());
    this.loginOrRegister(deviceId, 'register');
  };

  game.loginOrRegister = async function(deviceId, mode) {
    try {
      const url = mode === 'login' ? `${this.apiBase}/player/login` : `${this.apiBase}/player/register`;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId }) });
      const data = await resp.json();
      if (data.token) {
        this.token = data.token; this.playerId = data.playerId;
        localStorage.setItem('cf_token', data.token); localStorage.setItem('cf_deviceId', deviceId);
        if (this.buildingAPI) this.buildingAPI.setToken(data.token);
        document.getElementById('loginPanel').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        this.startHeartbeat();
        // init由app.js自动流程接管
      } else {
        const el = document.getElementById('loginMessage'); if (el) el.textContent = data.message || '登录失败';
      }
    } catch (e) {
      const el = document.getElementById('loginMessage'); if (el) el.textContent = '网络错误：' + e.message;
    }
  };

    this.token = null;
    this.playerId = null;
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_deviceId');
    localStorage.removeItem('civilizationFirePhase2');
    location.reload();
  };

  game.resetGame = async function() {
    if (!confirm('⚠️ 确定重置游戏？\n所有进度将清空。')) return;
    try { const r = await this.apiPost('/player/reset', {}); if (r.success) this.logout(); else alert('重置失败'); } catch (e) { alert('请求失败'); }
  };

  game.toggleSettings = function() { const m = document.getElementById('settingsMenu'); if (m) m.classList.toggle('active'); };

  // 已有 token 时自动启动 heartbeat（刷新页面无需重新登录）
  if (game.token) {
    const panel = document.getElementById('loginPanel');
    const appEl = document.getElementById('app');
    if (panel) panel.style.display = 'none';
    if (appEl) appEl.style.display = 'block';
    game.startHeartbeat();
  } else {
    // 无 token：显示登录面板
    game.showLoginPanel();
  }

  console.log('[auth.js] 账号管理模块已挂载');
};


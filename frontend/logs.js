// ==================== 请求日志模块 ====================
// 挂载函数由 app.js init() 调用。日志展示由 Canvas shell 统一绘制。

window.mountLogMethods = function(game) {
  game.requestLogs = [];

  game.cacheRequestLog = function(path, method, body, statusCode, response, duration) {
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
  };

  game.showRequestLogs = function() {
    if (!this.canvasShell) return false;
    this.canvasShell.showLogs = true;
    this.canvasShell.showSettings = false;
    this.canvasShell.showResourceDetails = false;
    this.canvasShell.showCitySwitcher = false;
    this.canvasShell.showAdvisor = false;
    this.canvasShell.activeEventId = null;
    this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
    return true;
  };

  game.closeRequestLogs = function() {
    if (!this.canvasShell) return false;
    this.canvasShell.showLogs = false;
    this.canvasShell.renderReadOnly(this.state, this.state.currentTab);
    return true;
  };

  game.clearRequestLogs = function() {
    this.requestLogs = [];
    this.showRequestLogs?.();
  };

};

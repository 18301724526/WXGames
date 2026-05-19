// ==================== 请求日志模块 ====================
// 挂载函数 — 由 app.js init() 调用

window.mountLogMethods = function(game) {
  game.requestLogs = [];

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function renderRequestLogs(view) {
    if (view.isEmpty) {
      return `<div class="request-log-empty">${escapeHtml(view.emptyText)}</div>`;
    }
    const rows = view.items.map((log) => `
      <tr>
        <td>${escapeHtml(log.timestamp)}</td>
        <td>${escapeHtml(log.endpoint)}</td>
        <td class="${log.isError ? 'is-error' : 'is-ok'}">${escapeHtml(log.statusCode)}</td>
        <td>${escapeHtml(log.durationText)}</td>
      </tr>
    `).join('');
    return `
      <div class="request-log-table-wrap">
        <table class="request-log-table">
          <thead><tr><th>时间</th><th>API</th><th>状态</th><th>耗时</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  game.cacheRequestLog = function(path, method, body, statusCode, response, duration) {
    this.requestLogs.unshift({
      path, method,
      body: body ? JSON.stringify(body).slice(0, 200) : '',
      statusCode,
      response: JSON.stringify(response).slice(0, 200),
      duration,
      timestamp: new Date().toLocaleTimeString()
    });
    if (this.requestLogs.length > 100) this.requestLogs = this.requestLogs.slice(0, 100);
  };

  game.showRequestLogs = function() {
    const view = window.UIStatePresenter.buildRequestLogViewState(this.requestLogs);
    this.logModal?.open(renderRequestLogs(view));
  };

  game.closeRequestLogs = function() {
    this.logModal?.close();
  };

  console.log('[logs.js] 请求日志模块已挂载');
};


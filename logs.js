// ==================== 请求日志模块 ====================
// 挂载函数 — 由 app.js init() 调用

window.mountLogMethods = function(game) {
  game.requestLogs = [];
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
    const modal = document.getElementById('logModal');
    const content = document.getElementById('logModalContent');
    if (!modal || !content) return;
    let html = '<div style="max-height:60vh;overflow-y:auto;">';
    const logs = this.requestLogs.slice(0, 20);
    if (logs.length === 0) {
      html += '<div style="color:#888;text-align:center;padding:20px;">暂无请求记录</div>';
    } else {
      html += '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
      html += '<tr style="color:#aaa;border-bottom:1px solid rgba(255,255,255,0.1);"><th style="text-align:left;padding:4px;">时间</th><th style="text-align:left;padding:4px;">API</th><th style="text-align:left;padding:4px;">状态</th><th style="text-align:left;padding:4px;">耗时</th></tr>';
      for (const log of logs) {
        const isError = log.statusCode >= 400 || log.statusCode === 0;
        const color = isError ? '#e94560' : '#4ecca3';
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:4px;color:#888;">${log.timestamp}</td>
          <td style="padding:4px;color:#f1f1f1;">${log.method} ${log.path}</td>
          <td style="padding:4px;color:${color};font-weight:bold;">${log.statusCode}</td>
          <td style="padding:4px;color:#aaa;">${log.duration}ms</td>
        </tr>`;
      }
      html += '</table>';
    }
    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  };

  console.log('[logs.js] 请求日志模块已挂载');
};


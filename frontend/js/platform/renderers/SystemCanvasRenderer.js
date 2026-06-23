(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../domain/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class SystemCanvasRenderer {
    constructor(options = {}) {
      this.host = options.host || null;
      this.drawingSurface = options.drawingSurface || null;
    }

    get width() {
      return this.host?.width;
    }

    get height() {
      return this.host?.height;
    }

    get ctx() {
      return this.host?.ctx;
    }

    callDrawingSurface(method, args = []) {
      const explicitSurface = this.drawingSurface;
      if (explicitSurface && typeof explicitSurface[method] === 'function') {
        return explicitSurface[method](...Array.from(args));
      }
      const fallbackSurface = this.host;
      if (fallbackSurface && typeof fallbackSurface[method] === 'function') {
        return fallbackSurface[method](...Array.from(args));
      }
      return undefined;
    }

    addHitTarget(...args) {
      return this.callDrawingSurface('addHitTarget', args);
    }

    createGradient(...args) {
      return this.callDrawingSurface('createGradient', args);
    }

    drawAsset(...args) {
      return this.callDrawingSurface('drawAsset', args);
    }

    drawButton(...args) {
      return this.callDrawingSurface('drawButton', args);
    }

    drawCoverAsset(...args) {
      return this.callDrawingSurface('drawCoverAsset', args);
    }

    drawPanel(...args) {
      return this.callDrawingSurface('drawPanel', args);
    }

    drawProgressBar(...args) {
      return this.callDrawingSurface('drawProgressBar', args);
    }

    drawText(...args) {
      return this.callDrawingSurface('drawText', args);
    }

    drawTextLines(...args) {
      return this.callDrawingSurface('drawTextLines', args);
    }

    getLayout(...args) {
      return this.callDrawingSurface('getLayout', args);
    }

    getNow(...args) {
      return this.callDrawingSurface('getNow', args);
    }

    setHitTargets(...args) {
      return this.callDrawingSurface('setHitTargets', args);
    }

    truncateText(...args) {
      return this.callDrawingSurface('truncateText', args);
    }

    wrapTextLimit(...args) {
      return this.callDrawingSurface('wrapTextLimit', args);
    }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    renderLoginPanel(auth = {}) {
      const view = auth.view || {};
      if (!view.loginPanelVisible) return;
      const credentials = auth.credentials || {};
      this.setHitTargets([]);
      if (this.ctx) {
        this.ctx.fillStyle = '#14120f';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 12);
      const panelHeight = 344;
      const x = (this.width - panelWidth) / 2;
      const y = Math.max(72, (this.height - panelHeight) / 2 - 8);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.98)'],
            [1, 'rgba(22, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.24)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      const iconSize = 58;
      const iconX = x + panelWidth / 2 - iconSize / 2;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.92)',
        stroke: 'rgba(240, 180, 91, 0.42)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 12, iconY + 12, 34, 34);
      this.drawText(this.t('common.appName'), x + panelWidth / 2, y + 104, {
        size: 22,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const message = view.message || '';
      this.drawText(this.truncateText(message, panelWidth - 48, { size: 13 }), x + panelWidth / 2, y + 134, {
        size: 13,
        color: message ? '#e94560' : 'rgba(234, 234, 234, 0.42)',
        align: 'center',
      });

      const inputX = x + 24;
      const inputWidth = panelWidth - 48;
      const inputHeight = 42;
      const usernameY = y + 160;
      const passwordY = usernameY + 52;
      const drawInput = (fieldY, label, value, actionType, masked = false) => {
        this.drawPanel(inputX, fieldY, inputWidth, inputHeight, {
          fill: 'rgba(23, 18, 13, 0.56)',
          stroke: 'rgba(116, 211, 160, 0.24)',
          radius: 8,
          inset: 'rgba(116, 211, 160, 0.08)',
        });
        const displayValue = value
          ? (masked ? '\u2022'.repeat(Math.min(12, String(value).length)) : value)
          : label;
        this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, fieldY + 21, {
          size: 14,
          color: value ? '#f6e8c8' : 'rgba(234, 234, 234, 0.48)',
          baseline: 'middle',
        });
        this.addHitTarget({ x: inputX, y: fieldY, width: inputWidth, height: inputHeight }, { type: actionType });
      };
      drawInput(usernameY, this.t('shell.login.username'), credentials.usernameValue || '', 'requestLoginUsername');
      drawInput(passwordY, this.t('shell.login.password'), credentials.passwordValue || '', 'requestLoginPassword', true);

      const rememberY = passwordY + 54;
      const checkboxSize = 18;
      this.drawPanel(inputX, rememberY, checkboxSize, checkboxSize, {
        fill: credentials.rememberPasswordChecked ? 'rgba(116, 211, 160, 0.68)' : 'rgba(23, 18, 13, 0.56)',
        stroke: 'rgba(116, 211, 160, 0.34)',
        radius: 5,
      });
      if (credentials.rememberPasswordChecked) {
        this.drawText('\u2713', inputX + checkboxSize / 2, rememberY + checkboxSize / 2, {
          size: 13,
          bold: true,
          color: '#0d1510',
          baseline: 'middle',
          align: 'center',
        });
      }
      this.drawText(this.t('shell.login.rememberAccount'), inputX + checkboxSize + 9, rememberY + checkboxSize / 2, {
        size: 13,
        color: '#cbbd96',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: rememberY - 6, width: 112, height: 32 }, { type: 'toggleRememberPassword' });

      const loginY = y + panelHeight - 58;
      this.drawButton(inputX, loginY, inputWidth, 40, this.t('shell.login.submit'), {
        size: 14,
        bold: true,
        radius: 9,
        active: true,
      });
      this.addHitTarget({ x: inputX, y: loginY, width: inputWidth, height: 40 }, { type: 'submitLogin' });
    }

    renderLoadingScreen(loading = {}) {
      if (!loading.visible) return;
      this.setHitTargets([]);
      if (this.ctx) {
        const hasBackground = this.drawCoverAsset('assets/art/civilization-bg.webp', 0, 0, this.width, this.height, 1);
        if (!hasBackground) {
          this.ctx.fillStyle = this.createGradient(
            0, 0, this.width, this.height,
            [
              [0, '#1c241b'],
              [0.48, '#44321f'],
              [1, '#11140f'],
            ],
            '#14120f',
          );
          this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.ctx.fillStyle = 'rgba(10, 10, 8, 0.42)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 16);
      const panelHeight = 154;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.floor(this.height * 0.56);
      const percentage = Math.max(0, Math.min(100, Number(loading.percentage) || 0));

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(54, 39, 26, 0.92)'],
            [1, 'rgba(19, 17, 13, 0.94)'],
          ],
          'rgba(31, 25, 18, 0.94)',
        ),
        stroke: 'rgba(255, 226, 177, 0.3)',
        radius: 14,
        inset: 'rgba(255, 231, 184, 0.1)',
      });

      const iconSize = 52;
      const iconX = x + 22;
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSize, iconSize, {
        fill: 'rgba(92, 63, 34, 0.9)',
        stroke: 'rgba(240, 180, 91, 0.44)',
        radius: iconSize / 2,
        inset: 'rgba(255, 231, 184, 0.14)',
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 10, iconY + 10, 32, 32);
      this.drawText(this.t('common.appName'), iconX + iconSize + 14, y + 31, {
        size: 19,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(loading.message || this.t('shell.loading.defaultMessage'), iconX + iconSize + 14, y + 58, {
        size: 12,
        color: '#cbbd96',
      });

      const barX = x + 22;
      const barY = y + 98;
      const barWidth = panelWidth - 44;
      this.drawProgressBar(barX, barY, barWidth, 16, percentage);
      this.drawText(`${Math.round(percentage)}%`, x + panelWidth / 2, barY + 28, {
        size: 12,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'blockCanvasModal' });
    }

    renderNetworkOverlay(network = {}) {
      if (!network || network.status !== 'reconnecting') return false;
      const ctx = this.ctx;
      if (!ctx) return false;
      ctx.save?.();
      ctx.fillStyle = 'rgba(8, 10, 12, 0.46)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore?.();

      const panelWidth = Math.min(320, Math.max(240, this.width - 48));
      const panelHeight = 118;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.floor((this.height - panelHeight) / 2);
      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(20, 24, 26, 0.92)',
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 12,
        inset: 'rgba(255, 255, 255, 0.06)',
      });

      const now = this.getNow();
      const cx = x + 44;
      const cy = y + 42;
      const radius = 16;
      if (ctx.beginPath && ctx.arc) {
        ctx.save?.();
        ctx.strokeStyle = 'rgba(255, 217, 138, 0.22)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ffd98a';
        ctx.lineCap = 'round';
        const start = (now / 180) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, start, start + Math.PI * 1.35);
        ctx.stroke();
        ctx.restore?.();
      }

      this.drawText(this.t('shell.network.title'), x + 76, y + 28, {
        size: 15,
        bold: true,
        color: '#ffe6b5',
      });
      this.drawText(network.message || this.t('shell.network.reconnecting'), x + 76, y + 54, {
        size: 12,
        color: '#cbbd96',
      });
      const failText = Number(network.failureCount) > 0
        ? this.t('shell.network.failureCount', { count: Number(network.failureCount) })
        : '';
      if (failText) {
        this.drawText(failText, x + panelWidth / 2, y + 88, {
          size: 11,
          color: 'rgba(234, 234, 234, 0.56)',
          align: 'center',
        });
      }
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'blockCanvasModal' });
      return true;
    }

    renderSettingsPanel() {
      const layout = this.getLayout();
      const panelWidth = 200;
      const panelHeight = 164;
      const x = layout.contentRight - panelWidth - 8;
      const y = 62;

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 10,
      });

      this.drawText(this.t('shell.settings.title'), x + panelWidth / 2, y + 18, {
        size: 14,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 10, y + 28);
        this.ctx.lineTo(x + panelWidth - 10, y + 28);
        this.ctx.stroke();
      }

      const btnHeight = 36;
      const btnY1 = y + 38;
      this.drawButton(x + 10, btnY1, panelWidth - 20, btnHeight, this.t('shell.settings.resetGame'), {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY1, width: panelWidth - 20, height: btnHeight }, { type: 'requestResetGame' });

      const btnY2 = btnY1 + btnHeight + 8;
      this.drawButton(x + 10, btnY2, panelWidth - 20, btnHeight, this.t('shell.settings.exportOperationLog'), {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY2, width: panelWidth - 20, height: btnHeight }, { type: 'downloadClientOperationLog' });

      const btnY3 = btnY2 + btnHeight + 8;
      this.drawButton(x + 10, btnY3, panelWidth - 20, btnHeight, this.t('shell.settings.logout'), {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 10, y: btnY3, width: panelWidth - 20, height: btnHeight }, { type: 'logout' });

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSettings', background: true });
    }

    renderConfirmDialog(dialog = {}) {
      if (!dialog || !dialog.visible) return false;
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeConfirmDialog', background: true });
      if (this.ctx) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(348, layout.contentWidth - 18);
      const panelHeight = 222;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.max(86, Math.floor((this.height - panelHeight) / 2) - 12);

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: this.createGradient(
          x, y, x, y + panelHeight,
          [
            [0, 'rgba(58, 42, 28, 0.98)'],
            [1, 'rgba(23, 18, 13, 0.98)'],
          ],
          'rgba(36, 28, 20, 0.98)',
        ),
        stroke: 'rgba(255, 226, 177, 0.26)',
        radius: 13,
        inset: 'rgba(255, 231, 184, 0.1)',
      });
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      this.drawText(this.truncateText(dialog.title || this.t('shell.confirm.title'), panelWidth - 48, { size: 18, bold: true }), x + panelWidth / 2, y + 34, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });

      const messageLines = this.wrapTextLimit(dialog.message || '', panelWidth - 48, 3, { size: 13 });
      this.drawTextLines(messageLines, x + 24, y + 68, {
        size: 13,
        color: '#cbbd96',
        lineHeight: 19,
      });

      const submitting = Boolean(dialog.submitting);
      const buttonY = y + panelHeight - 54;
      const buttonGap = 10;
      const buttonWidth = Math.floor((panelWidth - 36 - buttonGap) / 2);
      const cancelX = x + 18;
      const confirmX = cancelX + buttonWidth + buttonGap;
      this.drawButton(cancelX, buttonY, buttonWidth, 36, dialog.cancelLabel || this.t('common.cancel'), {
        size: 13,
        radius: 9,
        active: false,
      });
      this.addHitTarget({ x: cancelX, y: buttonY, width: buttonWidth, height: 36 }, submitting ? { type: 'blockCanvasModal' } : { type: 'closeConfirmDialog' });

      this.drawButton(confirmX, buttonY, buttonWidth, 36, submitting ? this.t('common.processing') : (dialog.confirmLabel || this.t('common.confirm')), {
        size: 13,
        bold: true,
        radius: 9,
        active: true,
      });
      this.addHitTarget(
        { x: confirmX, y: buttonY, width: buttonWidth, height: 36 },
        submitting ? { type: 'blockCanvasModal' } : { type: 'confirmResetGame', source: dialog.source || '' },
      );
      return true;
    }

    renderLogsPanel(logs = []) {
      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 24);
      const panelHeight = 420;
      const x = (this.width - panelWidth) / 2;
      const y = (this.height - panelHeight) / 2;

      this.drawPanel(x, y, panelWidth, panelHeight, {
        fill: 'rgba(42, 35, 24, 0.96)',
        stroke: 'rgba(255, 226, 177, 0.2)',
        radius: 12,
      });

      this.drawText(this.t('shell.logs.title'), x + panelWidth / 2, y + 22, {
        size: 16,
        bold: true,
        color: '#ffd98a',
        align: 'center',
      });

      const closeBtnSize = 28;
      const closeBtnX = x + panelWidth - closeBtnSize - 10;
      const closeBtnY = y + 10;
      this.drawButton(closeBtnX, closeBtnY, closeBtnSize, closeBtnSize, '✕', {
        size: 14,
        radius: 6,
        active: false,
      });
      this.addHitTarget({ x: closeBtnX, y: closeBtnY, width: closeBtnSize, height: closeBtnSize }, { type: 'closeLogs' });

      if (this.ctx) {
        this.ctx.strokeStyle = 'rgba(255, 226, 177, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 12, y + 42);
        this.ctx.lineTo(x + panelWidth - 12, y + 42);
        this.ctx.stroke();
      }

      const listX = x + 12;
      const listY = y + 52;
      const listWidth = panelWidth - 24;
      const listHeight = panelHeight - 110;

      this.drawPanel(listX, listY, listWidth, listHeight, {
        fill: 'rgba(0, 0, 0, 0.2)',
        stroke: 'rgba(255, 255, 255, 0.05)',
        radius: 8,
      });

      const itemHeight = 28;
      const maxItems = Math.floor(listHeight / itemHeight);
      const displayLogs = logs.slice(0, maxItems);

      if (displayLogs.length === 0) {
        this.drawText(this.t('common.log.empty'), listX + listWidth / 2, listY + listHeight / 2, {
          size: 12,
          color: '#888',
          align: 'center',
        });
      } else {
        displayLogs.forEach((log, index) => {
          const itemY = listY + 6 + index * itemHeight;
          const time = log.timestamp || '';
          const method = (log.method || '') + ' ' + (log.path || '');
          const status = log.statusCode || 0;
          const isOk = status >= 200 && status < 300;
          const statusColor = isOk ? '#74d3a0' : '#ff6b6b';

          this.drawText(time, listX + 8, itemY + 10, { size: 10, color: '#aaa' });
          this.drawText(method, listX + 70, itemY + 10, { size: 10, color: '#f6e8c8' });
          this.drawText(String(status), listX + listWidth - 40, itemY + 10, { size: 10, color: statusColor });
        });
      }

      const clearBtnY = y + panelHeight - 48;
      this.drawButton(x + 12, clearBtnY, panelWidth - 24, 36, this.t('shell.logs.clear'), {
        size: 12,
        radius: 8,
        active: false,
      });
      this.addHitTarget({ x: x + 12, y: clearBtnY, width: panelWidth - 24, height: 36 }, { type: 'clearLogs' });

      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeLogs', background: true });
    }
  }

  global.SystemCanvasRenderer = SystemCanvasRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemCanvasRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);

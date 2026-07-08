(function (global) {
  const LocaleText = (() => {
    if (global.LocaleText) return global.LocaleText;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../ecs/resource/LocaleText');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const ModalPlate = (() => {
    if (global.ModalPlateRenderer) return global.ModalPlateRenderer;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ModalPlateRenderer');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  const UiThemeTokens = (() => {
    if (global.UiThemeTokens) return global.UiThemeTokens;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../../config/UiThemeTokens');
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
      return Number(this.host?.width) || 0;
    }

    get height() {
      return Number(this.host?.height) || 0;
    }

    get ctx() {
      return this.host?.ctx;
    }

    addHitTarget(...args) { const surface = this.drawingSurface; return surface && typeof surface.addHitTarget === 'function' ? surface.addHitTarget(...args) : this.host?.addHitTarget?.(...args); }
    createGradient(...args) { const surface = this.drawingSurface; return surface && typeof surface.createGradient === 'function' ? surface.createGradient(...args) : this.host?.createGradient?.(...args); }
    drawAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawAsset === 'function' ? surface.drawAsset(...args) : this.host?.drawAsset?.(...args); }
    drawButton(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawButton === 'function' ? surface.drawButton(...args) : this.host?.drawButton?.(...args); }
    drawCoverAsset(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawCoverAsset === 'function' ? surface.drawCoverAsset(...args) : this.host?.drawCoverAsset?.(...args); }
    drawPanel(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawPanel === 'function' ? surface.drawPanel(...args) : this.host?.drawPanel?.(...args); }
    drawProgressBar(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawProgressBar === 'function' ? surface.drawProgressBar(...args) : this.host?.drawProgressBar?.(...args); }
    drawText(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawText === 'function' ? surface.drawText(...args) : this.host?.drawText?.(...args); }
    drawTextLines(...args) { const surface = this.drawingSurface; return surface && typeof surface.drawTextLines === 'function' ? surface.drawTextLines(...args) : this.host?.drawTextLines?.(...args); }
    getLayout(...args) { const surface = this.drawingSurface; return surface && typeof surface.getLayout === 'function' ? surface.getLayout(...args) : this.host?.getLayout?.(...args); }
    getNow(...args) { const surface = this.drawingSurface; return surface && typeof surface.getNow === 'function' ? surface.getNow(...args) : this.host?.getNow?.(...args); }
    setHitTargets(...args) { const surface = this.drawingSurface; return surface && typeof surface.setHitTargets === 'function' ? surface.setHitTargets(...args) : this.host?.setHitTargets?.(...args); }
    truncateText(...args) { const surface = this.drawingSurface; return surface && typeof surface.truncateText === 'function' ? surface.truncateText(...args) : this.host?.truncateText?.(...args); }
    wrapTextLimit(...args) { const surface = this.drawingSurface; return surface && typeof surface.wrapTextLimit === 'function' ? surface.wrapTextLimit(...args) : this.host?.wrapTextLimit?.(...args); }

    t(key = '', params = {}) {
      return LocaleText ? LocaleText.t(key, params) : key;
    }

    renderLoginPanel(auth = {}) {
      const view = auth.view || {};
      if (!view.loginPanelVisible) return;
      const credentials = auth.credentials || {};
      this.setHitTargets([]);
      const palette = UiThemeTokens?.palette || {};
      const hairline = UiThemeTokens?.hairline || {};
      const typeScale = UiThemeTokens?.typeScale || {};
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
        this.ctx.fillStyle = 'rgba(5, 5, 4, 0.74)';
        this.ctx.fillRect(0, 0, this.width, this.height);
      }

      const layout = this.getLayout();
      const panelWidth = Math.min(360, layout.contentWidth - 14);
      const panelHeight = 342;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.max(86, Math.floor((this.height - panelHeight) / 2) - 8);
      ModalPlate.drawModalPlate(this, x, y, panelWidth, panelHeight, { radius: 11 });

      const iconSocket = 58;
      const iconX = Math.floor(x + panelWidth / 2 - iconSocket / 2);
      const iconY = y + 24;
      this.drawPanel(iconX, iconY, iconSocket, iconSocket, {
        fill: this.createGradient(
          iconX, iconY, iconX, iconY + iconSocket,
          [
            [0, 'rgba(73, 56, 35, 0.95)'],
            [1, 'rgba(26, 23, 18, 0.95)'],
          ],
          'rgba(50, 40, 28, 0.95)',
        ),
        stroke: palette.champagneGold || 'rgba(210, 181, 126, 0.72)',
        radius: iconSocket / 2,
        inset: hairline.insetHighlight,
      });
      this.drawPanel(iconX + 12, iconY + 12, iconSocket - 24, iconSocket - 24, {
        fill: 'rgba(6, 6, 5, 0.62)',
        stroke: 'rgba(229, 208, 165, 0.18)',
        radius: (iconSocket - 24) / 2,
      });
      this.drawAsset('assets/art/icon-fire-cutout.webp', iconX + 14, iconY + 14, 30, 30);
      this.drawText(this.t('common.appName'), x + panelWidth / 2, y + 104, {
        size: 22,
        bold: true,
        color: palette.champagneGoldBright || '#e5d0a5',
        align: 'center',
        fontFamily: UiThemeTokens?.fontFamily?.display,
      });

      const message = view.message || '';
      this.drawText(this.truncateText(message, panelWidth - 48, { size: 13 }), x + panelWidth / 2, y + 134, {
        size: 13,
        color: message ? (palette.accentAlertRed || '#e94560') : 'rgba(234, 234, 234, 0.32)',
        align: 'center',
      });

      const inputX = x + 24;
      const inputWidth = panelWidth - 48;
      const inputHeight = 42;
      const usernameY = y + 160;
      const passwordY = usernameY + 52;
      const drawInput = (fieldY, label, value, actionType, masked = false) => {
        this.drawPanel(inputX, fieldY, inputWidth, inputHeight, {
          fill: 'rgba(12, 13, 12, 0.74)',
          stroke: value ? 'rgba(210, 181, 126, 0.28)' : 'rgba(229, 208, 165, 0.12)',
          radius: 8,
          inset: 'rgba(229, 208, 165, 0.05)',
        });
        const displayValue = value
          ? (masked ? '\u2022'.repeat(Math.min(12, String(value).length)) : value)
          : label;
        this.drawText(this.truncateText(displayValue, inputWidth - 24, { size: 14 }), inputX + 12, fieldY + 21, {
          size: 14,
          color: value ? (palette.textPrimary || '#e1d3b7') : 'rgba(189, 178, 155, 0.58)',
          baseline: 'middle',
        });
        this.addHitTarget({ x: inputX, y: fieldY, width: inputWidth, height: inputHeight }, { type: actionType });
      };
      drawInput(usernameY, this.t('shell.login.username'), credentials.usernameValue || '', 'requestLoginUsername');
      drawInput(passwordY, this.t('shell.login.password'), credentials.passwordValue || '', 'requestLoginPassword', true);

      const rememberY = passwordY + 54;
      const checkboxSize = 18;
      this.drawPanel(inputX, rememberY, checkboxSize, checkboxSize, {
        fill: credentials.rememberPasswordChecked ? 'rgba(85, 171, 115, 0.68)' : 'rgba(16, 18, 16, 0.74)',
        stroke: credentials.rememberPasswordChecked ? 'rgba(85, 171, 115, 0.64)' : 'rgba(229, 208, 165, 0.14)',
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
        size: typeScale.body || 12,
        color: palette.textLabel || '#bdb29b',
        baseline: 'middle',
      });
      this.addHitTarget({ x: inputX, y: rememberY - 6, width: 112, height: 32 }, { type: 'toggleRememberPassword' });

      const loginY = y + panelHeight - 58;
      ModalPlate.drawModalButton(this, inputX, loginY, inputWidth, 40, this.t('shell.login.submit'), {
        variant: 'primary',
        size: 14,
        radius: 8,
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
      // UI-REDO knife 8: forged-iron modal via the shared ModalPlate painter
      // (⑦c fixed placement/mask/close; this knife swaps the skin only).
      // Reset game uses the unified danger button; export/logout secondary.
      this.addHitTarget({ x: 0, y: 0, width: this.width, height: this.height }, { type: 'closeSettings', background: true });
      ModalPlate.drawModalMask(this);

      const layout = this.getLayout();
      const panelWidth = Math.min(300, layout.contentWidth - 24);
      const panelHeight = 208;
      const x = Math.floor((this.width - panelWidth) / 2);
      const y = Math.max(86, Math.floor((this.height - panelHeight) / 2) - 12);

      ModalPlate.drawModalPlate(this, x, y, panelWidth, panelHeight);
      this.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

      const titleBar = ModalPlate.drawModalTitleBar(this, x, y, panelWidth, {
        title: this.t('shell.settings.title'),
        align: 'center',
        withClose: true,
      });
      if (titleBar.closeRect) this.addHitTarget(titleBar.closeRect, { type: 'closeSettings' });

      const btnHeight = 38;
      const btnX = x + 16;
      const btnWidth = panelWidth - 32;
      [
        { label: this.t('shell.settings.resetGame'), action: { type: 'requestResetGame' }, variant: 'danger' },
        { label: this.t('shell.settings.exportOperationLog'), action: { type: 'downloadClientOperationLog' }, variant: 'secondary' },
        { label: this.t('shell.settings.logout'), action: { type: 'logout' }, variant: 'secondary' },
      ].forEach((item, index) => {
        const btnY = y + 58 + index * (btnHeight + 10);
        ModalPlate.drawModalButton(this, btnX, btnY, btnWidth, btnHeight, item.label, {
          variant: item.variant,
          size: 13,
        });
        this.addHitTarget({ x: btnX, y: btnY, width: btnWidth, height: btnHeight }, item.action);
      });
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
        submitting
          ? { type: 'blockCanvasModal' }
          : (dialog.confirmAction || { type: 'confirmResetGame', source: dialog.source || '' }),
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

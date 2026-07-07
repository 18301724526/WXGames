(function (global) {
  // ModalPlateRenderer -- UI-REDO knife 8 shared painter for every sub-UI panel
  // (task center / civilization / famous / settings / world-city command).
  //
  // SINGLE SOURCE RULE: every color/size/radius here reads UiThemeTokens.modal
  // (plus palette/hairline/typeScale). Panels stop hand-painting plates,
  // title bars, tab strips, cards, buttons and progress bars; they call these
  // helpers with pure view props. The painter takes no decisions: it never
  // reads game state, and it never registers hit targets -- callers keep their
  // existing addHitTarget contracts (rects are returned where needed).
  //
  // All functions take the consuming renderer first (FamousPanelCanvasRenderer
  // convention) and draw through its delegation surface
  // (drawPanel/drawText/createGradient/drawLine/ctx), so drawing-surface
  // injection and node test sentinels keep working unchanged.
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

  function tokens() {
    return UiThemeTokens || {};
  }

  function modalTokens() {
    return tokens().modal || {};
  }

  function paletteTokens() {
    return tokens().palette || {};
  }

  function hairlineTokens() {
    return tokens().hairline || {};
  }

  function typeScaleTokens() {
    return tokens().typeScale || {};
  }

  function cloneStops(stops, fallback = []) {
    const source = Array.isArray(stops) && stops.length ? stops : fallback;
    return source.map((stop) => [stop[0], stop[1]]);
  }

  function verticalGradient(renderer, x, y, height, stops, fallback) {
    if (typeof renderer.createGradient !== 'function') return fallback;
    return renderer.createGradient(x, y, x, y + height, cloneStops(stops), fallback);
  }

  function horizontalGradient(renderer, x, y, width, stops, fallback) {
    if (typeof renderer.createGradient !== 'function') return fallback;
    return renderer.createGradient(x, y, x + width, y, cloneStops(stops), fallback);
  }

  // 1px horizontal hairline. Prefers the renderer's drawLine delegation (so
  // drawing-surface injection applies); falls back to raw ctx for renderers
  // without a drawLine wrapper; skips silently when neither exists.
  function drawHairline(renderer, x, y, width, color) {
    if (typeof renderer.drawLine === 'function') {
      renderer.drawLine(x, y + 0.5, x + width, y + 0.5, { color, width: 1 });
      return true;
    }
    const ctx = renderer.ctx;
    if (ctx && typeof ctx.fillRect === 'function') {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, 1);
      return true;
    }
    return false;
  }

  function drawVerticalHairline(renderer, x, y, height, color) {
    if (typeof renderer.drawLine === 'function') {
      renderer.drawLine(x + 0.5, y, x + 0.5, y + height, { color, width: 1 });
      return true;
    }
    const ctx = renderer.ctx;
    if (ctx && typeof ctx.fillRect === 'function') {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, height);
      return true;
    }
    return false;
  }

  // Dim backdrop behind blocking modals (one alpha for every panel).
  function drawModalMask(renderer) {
    const ctx = renderer.ctx;
    if (!ctx || typeof ctx.fillRect !== 'function') return false;
    ctx.fillStyle = modalTokens().maskFill || 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(0, 0, Number(renderer.width) || 0, Number(renderer.height) || 0);
    return true;
  }

  // Forged-iron modal plate: vertical iron gradient face, dark outer edge,
  // inner top light inset, 1px lit ridge under the top edge and a warm bottom
  // edge line -- the knife-4/6 dock tray language at modal scale.
  function drawModalPlate(renderer, x, y, width, height, options = {}) {
    const modal = modalTokens();
    const radius = Number(options.radius) || tokens().radius?.modal || 10;
    renderer.drawPanel(x, y, width, height, {
      fill: verticalGradient(renderer, x, y, height, modal.plateGradientStops, '#1D1C19'),
      stroke: modal.plateStroke || 'rgba(0, 0, 0, 0.62)',
      radius,
      inset: hairlineTokens().insetHighlight,
    });
    const lineInset = Math.max(2, radius);
    drawHairline(
      renderer,
      x + lineInset,
      y + 1,
      width - 2 * lineInset,
      modal.plateBevelLight || 'rgba(109, 100, 87, 0.85)',
    );
    drawHairline(
      renderer,
      x + lineInset,
      y + height - 2,
      width - 2 * lineInset,
      modal.plateBottomWarmLine || 'rgba(60, 53, 43, 0.9)',
    );
    return { x, y, width, height, radius };
  }

  // Unified close button (top-right X). Returns the rect so the CALLER
  // registers its own close action hit target (painter stays decision-free).
  function drawModalCloseButton(renderer, x, y) {
    const modal = modalTokens();
    const palette = paletteTokens();
    const size = Number(modal.closeButtonSizePx) || 28;
    renderer.drawPanel(x, y, size, size, {
      fill: modal.closeFill || 'rgba(0, 0, 0, 0.34)',
      stroke: hairlineTokens().dividerOnIron,
      radius: tokens().radius?.panel || 6,
    });
    renderer.drawText('✕', x + size / 2, y + size / 2, {
      size: typeScaleTokens().value || 14,
      bold: true,
      color: palette.champagneGold,
      baseline: 'middle',
      align: 'center',
      fontFamily: tokens().fontFamily?.numeric,
    });
    return { x, y, width: size, height: size };
  }

  // Title bar: serif display title (+optional secondary line), optional close
  // button, hairline divider under the bar. Returns { contentTop, closeRect }.
  function drawModalTitleBar(renderer, x, y, width, options = {}) {
    const modal = modalTokens();
    const palette = paletteTokens();
    const typeScale = typeScaleTokens();
    const spacing = tokens().spacing || {};
    const barHeight = Number(options.barHeight) || Number(modal.titleBarHeight) || 46;
    const padX = Number(options.padX) || spacing.xl || 16;
    const closeInset = Number(modal.closeInsetPx) || 10;
    const centered = options.align === 'center';
    let closeRect = null;
    if (options.withClose) {
      closeRect = drawModalCloseButton(
        renderer,
        x + width - (Number(modal.closeButtonSizePx) || 28) - closeInset,
        y + closeInset,
      );
    }
    const titleMaxWidth = width - padX * 2 - (closeRect ? closeRect.width + closeInset : 0);
    const titleText =
      typeof renderer.truncateText === 'function'
        ? renderer.truncateText(options.title || '', titleMaxWidth, {
            size: typeScale.headline || 18,
            bold: true,
          })
        : String(options.title || '');
    renderer.drawText(
      titleText,
      centered ? x + width / 2 : x + padX,
      y + (options.subtitle ? 14 : 16),
      {
        size: typeScale.headline || 18,
        bold: true,
        color: palette.champagneGoldBright,
        align: centered ? 'center' : 'left',
        fontFamily: tokens().fontFamily?.display,
      },
    );
    if (options.subtitle) {
      const subtitleText =
        typeof renderer.truncateText === 'function'
          ? renderer.truncateText(options.subtitle, titleMaxWidth, { size: typeScale.body || 12 })
          : String(options.subtitle);
      renderer.drawText(subtitleText, centered ? x + width / 2 : x + padX, y + 38, {
        size: typeScale.body || 12,
        color: palette.textLabel,
        align: centered ? 'center' : 'left',
      });
    }
    const dividerY = y + barHeight + (options.subtitle ? 10 : 0);
    drawHairline(renderer, x + padX, dividerY, width - padX * 2, hairlineTokens().dividerOnIron);
    return { contentTop: dividerY + (spacing.md || 8), closeRect };
  }

  // Recessed tab strip (task-center style): sunken well + equal cells with
  // hairline dividers; active cell = bright champagne label + gold underline;
  // optional red count badge. Returns per-tab rects for caller hit targets.
  function drawModalTabStrip(renderer, x, y, width, tabs = [], options = {}) {
    const modal = modalTokens();
    const palette = paletteTokens();
    const typeScale = typeScaleTokens();
    const height = Number(options.height) || Number(modal.tabHeight) || 34;
    const count = Math.max(1, tabs.length);
    renderer.drawPanel(x, y, width, height, {
      fill: verticalGradient(renderer, x, y, height, modal.tabWellGradientStops, '#141513'),
      stroke: palette.dockCellFrame,
      radius: tokens().radius?.panel || 6,
    });
    const cellWidth = width / count;
    const rects = [];
    tabs.forEach((tab, index) => {
      const cellX = x + index * cellWidth;
      if (index > 0) {
        drawVerticalHairline(
          renderer,
          Math.round(cellX),
          y + 4,
          height - 8,
          hairlineTokens().dividerOnIron,
        );
      }
      const active = Boolean(tab.isActive || tab.active);
      const labelSize = typeScale.body || 12;
      const label =
        typeof renderer.truncateText === 'function'
          ? renderer.truncateText(tab.label || '', cellWidth - 12, {
              size: labelSize,
              bold: active,
            })
          : String(tab.label || '');
      renderer.drawText(label, cellX + cellWidth / 2, y + height / 2 - 1, {
        size: labelSize,
        bold: active,
        color: active ? palette.champagneGoldBright : palette.dockLabelGold,
        baseline: 'middle',
        align: 'center',
      });
      if (active) {
        const underlinePx = Number(modal.tabActiveUnderlinePx) || 2;
        const underlineInset = Math.min(10, cellWidth * 0.18);
        const ctx = renderer.ctx;
        if (ctx && typeof ctx.fillRect === 'function') {
          ctx.fillStyle = palette.champagneGoldBright;
          ctx.fillRect(
            Math.round(cellX + underlineInset),
            y + height - underlinePx - 2,
            Math.round(cellWidth - underlineInset * 2),
            underlinePx,
          );
        } else {
          drawHairline(
            renderer,
            cellX + underlineInset,
            y + height - underlinePx - 2,
            cellWidth - underlineInset * 2,
            palette.champagneGoldBright,
          );
        }
      }
      if (Number(tab.badge) > 0) {
        const badgeWidth = 20;
        const badgeHeight = 18;
        const badgeX = cellX + cellWidth - badgeWidth + 2;
        const badgeY = y - 5;
        renderer.drawPanel(badgeX, badgeY, badgeWidth, badgeHeight, {
          fill: palette.accentAlertRed,
          stroke: 'rgba(255, 255, 255, 0.18)',
          radius: badgeHeight / 2,
        });
        renderer.drawText(String(tab.badge), badgeX + badgeWidth / 2, badgeY + badgeHeight / 2, {
          size: typeScale.caption || 9,
          bold: true,
          color: '#FFFFFF',
          baseline: 'middle',
          align: 'center',
        });
      }
      rects.push({ x: cellX, y, width: cellWidth, height });
    });
    return rects;
  }

  // Card plate inside a modal (task rows / stat cells / summaries).
  // tone: 'default' (dark iron face) | 'accent' (warm claimable/highlight)
  //     | 'muted' (completed/inactive). options.stroke overrides the edge
  // (famous quality colors keep their existing logic through it).
  function drawModalCard(renderer, x, y, width, height, options = {}) {
    const modal = modalTokens();
    const tone = options.tone || 'default';
    const radius = Number(options.radius) || tokens().radius?.plate || 8;
    let fill;
    let stroke;
    if (tone === 'accent') {
      fill = verticalGradient(renderer, x, y, height, modal.cardAccentGradientStops, '#2C2318');
      stroke = modal.cardAccentStroke;
    } else if (tone === 'muted') {
      fill = modal.cardMutedFill || '#1A1917';
      stroke = modal.cardMutedStroke;
    } else {
      fill = verticalGradient(renderer, x, y, height, modal.cardGradientStops, '#1D1B17');
      stroke = modal.cardStroke;
    }
    renderer.drawPanel(x, y, width, height, {
      fill: options.fill || fill,
      stroke: options.stroke || stroke,
      radius,
      inset: tone === 'accent' ? hairlineTokens().insetHighlight : undefined,
    });
    return { x, y, width, height };
  }

  function buttonStyle(options = {}) {
    const button = modalTokens().button || {};
    const palette = paletteTokens();
    if (options.disabled) {
      return {
        stops: null,
        fill: button.disabledFill || '#1D1B18',
        stroke: button.disabledStroke || 'rgba(229, 208, 165, 0.1)',
        text: palette.textDisabled || '#8D8F99',
        inset: undefined,
      };
    }
    if (options.variant === 'danger') {
      return {
        stops: button.dangerFaceStops,
        fill: '#2C1712',
        stroke: button.dangerStroke,
        text: button.dangerText,
        inset: button.dangerInset,
      };
    }
    if (options.variant === 'primary') {
      return {
        stops: button.primaryFaceStops,
        fill: '#37291A',
        stroke: button.primaryStroke,
        text: button.primaryText,
        inset: button.primaryInset,
      };
    }
    return {
      stops: button.secondaryFaceStops,
      fill: '#1E1C19',
      stroke: button.secondaryStroke,
      text: button.secondaryText,
      inset: button.secondaryInset,
    };
  }

  // Unified three-state modal button. variant: 'primary' | 'secondary' |
  // 'danger'; options.disabled wins over variant. Caller adds the hit target.
  function drawModalButton(renderer, x, y, width, height, label, options = {}) {
    const button = modalTokens().button || {};
    const style = buttonStyle(options);
    const radius = Number(options.radius) || Number(button.radius) || 8;
    renderer.drawPanel(x, y, width, height, {
      fill: style.stops
        ? verticalGradient(renderer, x, y, height, style.stops, style.fill)
        : style.fill,
      stroke: style.stroke,
      radius,
      inset: style.inset,
    });
    const size = Number(options.size) || Number(button.textSize) || 13;
    const text =
      typeof renderer.truncateText === 'function'
        ? renderer.truncateText(label || '', width - 10, { size, bold: options.bold !== false })
        : String(label || '');
    renderer.drawText(text, x + width / 2, y + height / 2, {
      size,
      bold: options.bold !== false && !options.disabled,
      color: style.text,
      baseline: 'middle',
      align: 'center',
    });
    return { x, y, width, height };
  }

  // Champagne progress bar (civilization era advance).
  function drawModalProgressBar(renderer, x, y, width, height, percentage) {
    const modal = modalTokens();
    renderer.drawPanel(x, y, width, height, {
      fill: modal.progressTrackFill || '#141513',
      stroke: hairlineTokens().dividerOnIron,
      radius: height / 2,
    });
    const clamped = Math.max(0, Math.min(100, Number(percentage) || 0));
    const fillWidth = (width * clamped) / 100;
    if (fillWidth < 1) return { fillWidth: 0 };
    renderer.drawPanel(x, y, fillWidth, height, {
      fill: horizontalGradient(renderer, x, y, fillWidth, modal.progressFillStops, '#C9B183'),
      stroke: 'rgba(0, 0, 0, 0)',
      radius: height / 2,
    });
    return { fillWidth };
  }

  const api = {
    drawModalMask,
    drawModalPlate,
    drawModalCloseButton,
    drawModalTitleBar,
    drawModalTabStrip,
    drawModalCard,
    drawModalButton,
    drawModalProgressBar,
  };

  global.ModalPlateRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

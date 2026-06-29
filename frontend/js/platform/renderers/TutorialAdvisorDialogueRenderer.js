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

  function t(key = '', params = {}) {
    return LocaleText ? LocaleText.t(key, params) : key;
  }

  function resolveDependency(globalKey, modulePath) {
    if (global[globalKey]) return global[globalKey];
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require(modulePath);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  const SharedTutorialIntroDialogueLayout = resolveDependency('TutorialIntroDialogueLayout', './TutorialIntroDialogueLayout');
  const SharedTutorialDialogueLayer = resolveDependency('TutorialDialogueLayer', './TutorialDialogueLayer');
  const DEFAULT_DIALOGUE_LEFT = 126;

  function buildLayout(renderer = {}, options = {}) {
    const layoutOptions = {
      width: renderer.width,
      height: renderer.height,
      bottomSafeArea: renderer.bottomSafeArea,
      layout: renderer.getLayout(),
    };
    if (options.dialogueLeft !== undefined) layoutOptions.dialogueLeft = Number(options.dialogueLeft) || DEFAULT_DIALOGUE_LEFT;
    return SharedTutorialIntroDialogueLayout.buildDialogueLayout({
      ...layoutOptions,
    });
  }

  function renderContent(renderer = {}, layout = {}, message = '', advisorName = t('tutorial.advisorName', {})) {
    const panel = layout.panel || {};
    const portrait = layout.portrait || {};
    renderer.renderTutorialIntroAdvisorPortrait?.(portrait.x, portrait.y, portrait.width, portrait.height);
    renderer.drawPanel(panel.x, panel.y, panel.width, panel.height, {
      fill: 'rgba(23, 17, 12, 0.94)',
      stroke: 'rgba(246, 214, 147, 0.3)',
      radius: 8,
      inset: 'rgba(255, 231, 184, 0.08)',
    });
    renderer.drawText(advisorName, panel.x + 24, panel.y + 24, {
      size: 14,
      bold: true,
      color: '#ffd98a',
    });
    const lines = renderer.wrapTextLimit(message, panel.width - 48, 3, { size: 13 });
    renderer.drawTextLines(lines, panel.x + 24, panel.y + 46, {
      size: 13,
      color: '#f7ecd0',
      lineHeight: 18,
    });
    renderer.drawText(t('tutorial.continue', {}), panel.x + panel.width - 24, panel.y + panel.height - 17, {
      size: 11,
      color: 'rgba(255, 230, 181, 0.66)',
      align: 'right',
      baseline: 'middle',
    });
  }

  function addClickTargets(renderer = {}, panel = {}, action = null) {
    if (!action || typeof renderer.addHitTarget !== 'function') return false;
    renderer.addHitTarget(
      { x: 0, y: 0, width: renderer.width, height: renderer.height },
      { type: 'blockCanvasModal' },
    );
    renderer.addHitTarget(
      { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
      action,
    );
    return true;
  }

  function render(renderer = {}, message = '', advisorName = t('tutorial.advisorName', {}), options = {}) {
    if (!SharedTutorialIntroDialogueLayout) return false;
    const layout = buildLayout(renderer, options);
    const dialogueCtx = SharedTutorialDialogueLayer?.begin?.(renderer) || null;
    const draw = () => renderContent(renderer, layout, message, advisorName);
    if (dialogueCtx) SharedTutorialDialogueLayer.withHostContext(renderer, dialogueCtx, draw);
    else draw();
    addClickTargets(renderer, layout.panel, options.action || null);
    return Boolean(dialogueCtx);
  }

  function clear(renderer = {}, hide = true) {
    return SharedTutorialDialogueLayer?.clear?.(renderer, hide) || false;
  }

  const api = {
    addClickTargets,
    buildLayout,
    clear,
    render,
    renderContent,
  };

  global.TutorialAdvisorDialogueRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('../platform/ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();
  function isVisuallyDisabled(action = {}) {
    return ClientCommandSemantics?.isVisuallyDisabled?.(action)
      ?? Boolean(action?.visualDisabled ?? action?.disabled);
  }

  const MODAL_TARGET_PANEL_BY_ACTION_TYPE = Object.freeze({
    acceptFamousPerson: 'famousPersons',
    assignFamousAttributePoint: 'famousPersons',
    changeFamousPersonsPage: 'famousPersons',
    clearFamousSkillTooltip: 'famousPersons',
    closeFamousPersonDetail: 'famousPersons',
    closeFamousPersons: 'famousPersons',
    dismissFamousPersonCandidate: 'famousPersons',
    openFamousPersonDetail: 'famousPersons',
    seekFamousPerson: 'famousPersons',
    showFamousSkillTooltip: 'famousPersons',
  });

  const TARGET_RESOLVER_KINDS = Object.freeze({
    HIT_TARGET: 'hitTarget',
    WORLD_SITE_ANCHOR: 'worldSiteAnchor',
    SOFT_GUIDE_ID: 'softGuideId',
  });

  const SOFT_GUIDE_TARGET_BY_ID = Object.freeze({
    'btn-advance-era': Object.freeze({ kind: 'tab', tabId: 'civilization' }),
    'card-craftsman': Object.freeze({ kind: 'tab', tabId: 'resources' }),
    'event-card-special': Object.freeze({ kind: 'tab', tabId: 'events' }),
    'btn-claim-event': Object.freeze({ kind: 'tab', tabId: 'events' }),
    'scout-action-first': Object.freeze({
      kind: 'guideTask',
      nextAction: Object.freeze({ type: 'switchMilitaryView', view: 'scout' }),
    }),
    'task-center-main-claim': Object.freeze({
      kind: 'action',
      action: Object.freeze({ type: 'openTaskCenter', tab: 'main', source: 'advisor' }),
    }),
    'task-center-button': Object.freeze({
      kind: 'action',
      action: Object.freeze({ type: 'openTaskCenter', tab: 'main', source: 'advisor' }),
    }),
    'tab-territory': Object.freeze({ kind: 'tab', tabId: 'territory' }),
  });

  function resolveSoftGuideId(id = '') {
    const targetId = String(id || '');
    const exact = SOFT_GUIDE_TARGET_BY_ID[targetId];
    if (exact) return { ...exact, id: targetId };
    if (targetId.startsWith('card-')) return { kind: 'tab', id: targetId, tabId: 'buildings' };
    if (targetId.startsWith('tab-')) return { kind: 'tab', id: targetId, tabId: targetId.slice(4) };
    return null;
  }

  class TutorialGuideTargetResolver {
    constructor(options = {}) {
      const candidate = options.context || options.host || options.controller || null;
      this.observerHost = candidate;
      if (typeof candidate?.queryCanvasTarget === 'function') {
        this.host = candidate;
        return;
      }
      const TutorialHostContext = global.TutorialHostContext
        || (typeof module !== 'undefined' && module.exports ? require('./TutorialHostContext') : null);
      this.host = TutorialHostContext
        ? new TutorialHostContext({ game: candidate?.game || options.game || null, targetResolver: this })
        : candidate;
    }

    setRetryingHighlight(value) {
      if (this.host) this.host.retryingHighlightAfterRender = value;
      if (this.observerHost && this.observerHost !== this.host) {
        this.observerHost.retryingHighlightAfterRender = value;
      }
    }

    getActiveRenderTab() {
      return this.host?.getTargetActiveRenderTab?.() || 'resources';
    }

    getCanvasTarget(type, predicate = null) {
      return this.host?.queryCanvasTarget?.(type, predicate) || null;
    }

    getTargetPanelKey(type, allowedAction = null) {
      return MODAL_TARGET_PANEL_BY_ACTION_TYPE[type]
        || MODAL_TARGET_PANEL_BY_ACTION_TYPE[allowedAction?.type]
        || '';
    }

    refreshTargetSurface(type, allowedAction = null) {
      const panelKey = this.getTargetPanelKey(type, allowedAction);
      return this.host?.refreshTargetSurface?.(panelKey) !== false;
    }

    getState() {
      return this.host?.getTargetState?.() || {};
    }

    resolveTarget(request = {}) {
      if (request.kind === TARGET_RESOLVER_KINDS.HIT_TARGET) {
        const selectable = (action) => (
          !isVisuallyDisabled(action)
          && (typeof request.predicate !== 'function' || request.predicate(action))
        );
        let target = this.getCanvasTarget(request.type, selectable);
        if (!target && request.retry !== false && this.host && !this.host.retryingHighlightAfterRender) {
          this.setRetryingHighlight(true);
          this.refreshTargetSurface(request.type, request.allowedAction);
          target = this.getCanvasTarget(request.type, selectable);
          this.setRetryingHighlight(false);
        }
        return { kind: request.kind, available: Boolean(target), target: target || null };
      }
      if (request.kind === TARGET_RESOLVER_KINDS.WORLD_SITE_ANCHOR) {
        const resolution = this.host?.resolveWorldSiteAnchorTarget?.(request.siteId || '')
          || { available: false, target: null };
        return {
          kind: request.kind,
          available: resolution.available === true,
          target: resolution.target || null,
        };
      }
      if (request.kind === TARGET_RESOLVER_KINDS.SOFT_GUIDE_ID) {
        const target = resolveSoftGuideId(request.id);
        return { kind: request.kind, available: Boolean(target), target };
      }
      return { kind: request.kind || '', available: false, target: null };
    }

    resolveWorldSiteAnchorTarget(siteId = '') {
      return this.host?.resolveWorldSiteAnchorTarget?.(siteId)?.target || null;
    }

    showHighlight(type, predicate, message, allowedAction, options = {}) {
      const target = this.resolveTarget({
        kind: TARGET_RESOLVER_KINDS.HIT_TARGET,
        type,
        predicate,
        allowedAction,
      }).target;
      if (!target) {
        this.host?.hideTutorialHighlight?.();
        return false;
      }
      return this.host?.showTutorialHighlight?.(
        target,
        message,
        { ...options, allowedAction, source: options.source || 'strongTutorial' },
      ) || false;
    }

    getCanvasTargetRect(target = {}) {
      const rect = typeof target.getRect === 'function'
        ? target.getRect()
        : (typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : target);
      const left = Number(rect?.left ?? rect?.x);
      const top = Number(rect?.top ?? rect?.y);
      const width = Number(rect?.width);
      const height = Number(rect?.height);
      if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
      return {
        left,
        top,
        width,
        height,
        right: Number(rect?.right) || left + width,
        bottom: Number(rect?.bottom) || top + height,
      };
    }

    isCanvasTargetVisible(target = {}, padding = 8) {
      const rect = this.getCanvasTargetRect(target);
      if (!rect) return false;
      const { width, height } = this.host?.getTutorialCanvasSize?.() || {};
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return true;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return centerX >= padding
        && centerX <= width - padding
        && centerY >= padding
        && centerY <= height - padding;
    }

    showOpenWorldSiteHighlight(options = {}) {
      const siteId = options.siteId || '';
      const anchorResolution = this.resolveTarget({
        kind: TARGET_RESOLVER_KINDS.WORLD_SITE_ANCHOR,
        siteId,
      });
      const anchorTarget = anchorResolution.target;
      if (anchorResolution.available && !anchorTarget) {
        this.host?.hideTutorialHighlight?.();
        return false;
      }
      const target = anchorTarget || this.getCanvasTarget(
        'openWorldSite',
        (action) => !isVisuallyDisabled(action) && (!siteId || action.siteId === siteId || action.territoryId === siteId),
      );
      if (!target || !this.isCanvasTargetVisible(target, options.padding)) {
        this.host?.hideTutorialHighlight?.();
        return false;
      }
      return this.host?.showTutorialHighlight?.(
        target,
        options.message || '',
        {
          allowedAction: options.allowedAction || { type: 'openWorldSite', siteId },
          targetAction: target.action || null,
          locator: {
            type: 'worldSite',
            siteId,
          },
          source: options.source || 'strongTutorial',
        },
      ) || false;
    }
  }

  global.TutorialGuideTargetResolver = TutorialGuideTargetResolver;
  TutorialGuideTargetResolver.MODAL_TARGET_PANEL_BY_ACTION_TYPE = MODAL_TARGET_PANEL_BY_ACTION_TYPE;
  TutorialGuideTargetResolver.SOFT_GUIDE_TARGET_BY_ID = SOFT_GUIDE_TARGET_BY_ID;
  TutorialGuideTargetResolver.TARGET_RESOLVER_KINDS = TARGET_RESOLVER_KINDS;
  TutorialGuideTargetResolver.resolveSoftGuideId = resolveSoftGuideId;
  if (typeof module !== 'undefined' && module.exports) module.exports = TutorialGuideTargetResolver;
})(typeof window !== 'undefined' ? window : globalThis);

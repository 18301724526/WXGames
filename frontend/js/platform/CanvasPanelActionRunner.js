(function (global) {
  const buildPanelActionContext = (() => {
    if (global.CanvasPanelActionContextAdapter) return global.CanvasPanelActionContextAdapter;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasPanelActionContextAdapter');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const CanvasPanelActionRegistry = (() => {
    if (global.CanvasPanelActionRegistry) return global.CanvasPanelActionRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasPanelActionRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasPanelActionRunner {
    constructor({ contextAdapter, scheduler, panelSurfaceManager, actionRegistry } = {}) {
      this.contextAdapter = contextAdapter || buildPanelActionContext;
      this.scheduler = scheduler || null;
      this.panelSurfaceManager = panelSurfaceManager || null;
      this.actionRegistry = actionRegistry || CanvasPanelActionRegistry;
    }

    normalizeContext(context) {
      if (context?.isPanelActionContext) return context;
      return this.contextAdapter ? this.contextAdapter(context?.host || context) : context;
    }

    getManager(context) {
      return this.panelSurfaceManager || context.getPanelSurfaceManager?.() || null;
    }

    getScheduler(context) {
      return this.scheduler || context.getScheduler?.() || null;
    }

    flushDirty(descriptor = {}, context, action) {
      const scheduler = this.getScheduler(context);
      const dirty = Array.isArray(descriptor.dirty) ? descriptor.dirty : [];
      if (!scheduler) {
        context.renderAction?.(action);
        return;
      }
      dirty.forEach((slot) => scheduler?.markDirty?.(slot, action?.type || descriptor.type, { action, descriptor }));
      if (!scheduler?.isAtomic?.()) scheduler?.flush?.(dirty);
    }

    executeDescriptor(descriptor, action, context) {
      const manager = this.getManager(context);
      if (!manager) return false;
      if (descriptor.operation === 'open') {
        return manager.openPanel(descriptor.panelKey, { action, context, render: false }) !== false;
      }
      if (descriptor.operation === 'close') {
        return manager.closePanel(descriptor.panelKey, { action, context, render: false }) !== false;
      }
      if (descriptor.operation === 'action') {
        return manager.runPanelAction(descriptor.panelKey, descriptor.actionName, action, {
          action,
          context,
          render: false,
        }) !== false;
      }
      if (descriptor.operation === 'outsideClick') {
        const entry = manager.getPanelEntry?.(descriptor.panelKey) || manager.getPanel?.(descriptor.panelKey);
        if (entry?.blocksBaseHitTargets && entry?.closesOnOutsideClick === false) return true;
        if (entry?.closesOnOutsideClick === false) return false;
        return this.run({ type: descriptor.closeActionType, source: 'panelOutsideClick' }, context);
      }
      return false;
    }

    run(action, context) {
      if (!action) return false;
      if (action.disabled) return true;
      const descriptor = this.actionRegistry?.resolve?.(action);
      if (!descriptor) return false;
      const normalizedContext = this.normalizeContext(context);
      if (!normalizedContext) return false;
      try {
        const handled = this.executeDescriptor(descriptor, action, normalizedContext) !== false;
        if (!handled) return false;
        if (descriptor.operation !== 'outsideClick') this.flushDirty(descriptor, normalizedContext, action);
        return true;
      } catch (error) {
        normalizedContext.log(error);
        this.flushDirty(descriptor, normalizedContext, action);
        return false;
      }
    }
  }

  global.CanvasPanelActionRunner = CanvasPanelActionRunner;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasPanelActionRunner;
})(typeof window !== 'undefined' ? window : globalThis);

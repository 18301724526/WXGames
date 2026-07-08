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

  function observePromise(result, log) {
    if (result && typeof result.then === 'function') result.catch((error) => log?.(error));
    return result;
  }

  const HOOKS = {
    tutorialCanOpenTab(context, action, descriptor) {
      const tutorial = context.getTutorialController();
      if (typeof tutorial?.canOpenTab !== 'function') return true;
      return tutorial.canOpenTab(descriptor.panelKey, action) !== false;
    },
    tutorialVetoFeedback(context) {
      const message = context.t('guide.completeCurrentStep');
      context.showFloatingText(message);
      return true;
    },
    tutorialOnOpened(context) {
      return observePromise(
        context.getTutorialController()?.onFamousPersonsOpened?.(),
        (error) => context.log(error),
      );
    },
    tutorialOnClosed(context) {
      const tutorial = context.getTutorialController();
      const result = typeof tutorial?.onFamousPersonsClosed === 'function'
        ? tutorial.onFamousPersonsClosed()
        : tutorial?.refreshCurrentHighlight?.();
      return observePromise(result, (error) => context.log(error));
    },
    tutorialOnDetailOpened(context, action) {
      return observePromise(
        context.getTutorialController()?.onFamousPersonDetailOpened?.(action.personId || ''),
        (error) => context.log(error),
      );
    },
    tutorialOnFamousPersonSought(context, _action, _descriptor, result) {
      return observePromise(
        context.getTutorialController()?.onFamousPersonSought?.(result || {}),
        (error) => context.log(error),
      );
    },
    tutorialRefreshNow(context) {
      return observePromise(
        context.getTutorialController()?.refreshCurrentHighlight?.(),
        (error) => context.log(error),
      );
    },
    tutorialRefreshNextTick(context) {
      const runtimeScheduler = context.getRuntimeScheduler();
      const tutorial = context.getTutorialController();
      runtimeScheduler?.setTimeout?.(() => {
        try {
          tutorial?.refreshCurrentHighlight?.();
        } catch (error) {
          context.log(error);
        }
      }, 0);
      return true;
    },
  };

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

    runHookList(names = [], context, action, descriptor, hookPayload) {
      for (const name of Array.isArray(names) ? names : []) {
        const hook = HOOKS[name];
        if (typeof hook !== 'function') continue;
        try {
          const result = hook(context, action, descriptor, hookPayload);
          if (result === false) return false;
          observePromise(result, (error) => context.log(error));
        } catch (error) {
          context.log(error);
          return false;
        }
      }
      return true;
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
      const hooks = descriptor.hooks || {};
      try {
        if (descriptor.operation === 'open' && action.bypassPanelOpenVeto !== true) {
          const canOpen = this.runHookList(hooks.beforeOpen, normalizedContext, action, descriptor);
          if (canOpen === false) {
            this.runHookList(hooks.veto, normalizedContext, action, descriptor);
            return false;
          }
        }
        const handled = this.executeDescriptor(descriptor, action, normalizedContext) !== false;
        if (!handled) return false;
        if (descriptor.operation !== 'outsideClick') this.flushDirty(descriptor, normalizedContext, action);
        let hooksHandled = true;
        if (descriptor.operation === 'open') hooksHandled = this.runHookList(hooks.afterOpen, normalizedContext, action, descriptor);
        else if (descriptor.operation === 'close') hooksHandled = this.runHookList(hooks.afterClose, normalizedContext, action, descriptor);
        else if (descriptor.operation === 'action') hooksHandled = this.runHookList(hooks.afterAction, normalizedContext, action, descriptor);
        if (hooksHandled === false) return false;
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

(function (global) {
  const CanvasActionDispatchRegistry = (() => {
    if (global.CanvasActionDispatchRegistry) return global.CanvasActionDispatchRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasActionDispatchRegistry');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  const ClientCommandSemantics = (() => {
    if (global.ClientCommandSemantics) return global.ClientCommandSemantics;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./ClientCommandSemantics');
      } catch (_error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasActionDispatcher {
    constructor(options = {}) {
      this.log = typeof options.log === 'function' ? options.log : null;
      this.registry = options.registry || CanvasActionDispatchRegistry;
      this.panelActionRunner = options.panelActionRunner || null;
    }

    finishHandled(result, context = {}, action = {}) {
      const renderAfterSuccess = (value) => {
        const handled = value !== false;
        if (handled && typeof context.render === 'function') context.render(action);
        return handled;
      };
      if (result && typeof result.then === 'function') {
        result.then(renderAfterSuccess).catch((error) => this.log?.(error));
        return true;
      }
      return renderAfterSuccess(result);
    }

    canHandle(action, context = null) {
      return Boolean(this.registry?.canHandle?.(action, context));
    }

    handle(action, context = {}) {
      if (!this.canHandle(action, context)) return false;
      const normalizedAction = ClientCommandSemantics?.normalizeAction?.(action) || action;
      if (normalizedAction.disabled) return true;
      const commandBlockReason = ClientCommandSemantics?.getCommandBlockReason?.(normalizedAction) || '';
      if (commandBlockReason) {
        const logger = context?.clientOperationLog || global.ClientOperationLog;
        logger?.record?.('command:localBlock', {
          commandType: normalizedAction.type || '',
          commandKey: ClientCommandSemantics?.getCommandKey?.(normalizedAction) || normalizedAction.type || '',
          reason: commandBlockReason,
        }, { flush: true });
        return true;
      }
      return this.registry.dispatch(normalizedAction, context, {
        finishHandled: (result) => this.finishHandled(result, context, normalizedAction),
        panelActionRunner: this.panelActionRunner,
      });
    }

    static supportedActions() {
      return CanvasActionDispatchRegistry?.supportedActions?.() || [];
    }
  }

  global.CanvasActionDispatcher = CanvasActionDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);

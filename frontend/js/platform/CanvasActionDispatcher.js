(function (global) {
  const CanvasActionDispatchRegistry = (() => {
    if (global.CanvasActionDispatchRegistry) return global.CanvasActionDispatchRegistry;
    if (typeof module !== 'undefined' && module.exports) {
      try {
        return require('./CanvasActionDispatchRegistry');
      } catch (error) {
        return null;
      }
    }
    return null;
  })();

  class CanvasActionDispatcher {
    constructor(options = {}) {
      this.log = typeof options.log === 'function' ? options.log : null;
      this.registry = options.registry || CanvasActionDispatchRegistry;
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

    canHandle(action) {
      return Boolean(this.registry?.canHandle?.(action));
    }

    handle(action, context = {}) {
      if (!this.canHandle(action)) return false;
      if (action.disabled) return true;
      return this.registry.dispatch(action, context, {
        finishHandled: (result) => this.finishHandled(result, context, action),
      });
    }

    static supportedActions() {
      return CanvasActionDispatchRegistry?.supportedActions?.() || [];
    }
  }

  global.CanvasActionDispatcher = CanvasActionDispatcher;
  if (typeof module !== 'undefined' && module.exports) module.exports = CanvasActionDispatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);

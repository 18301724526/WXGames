(function (global) {
  const TRACE_SCHEMA = 'client-action-trace-v1';
  const TRACE_TEXT_LIMIT = TRACE_SCHEMA.length * 'sourceSurface'.length;
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

  let actionTraceSequence = 0;

  function cleanTraceValue(value, fallback = '') {
    const text = String(value ?? fallback ?? '').trim();
    return text.replace(/[^a-zA-Z\d:._-]/g, '_').slice(0, TRACE_TEXT_LIMIT);
  }

  function createClientActionTraceId(action = {}, context = {}) {
    const explicit = action.clientActionTraceId
      || action.tapTraceId
      || action.__tapTraceId
      || context.tapTraceId
      || global.__actorPickingDiagActiveTapTraceId;
    if (explicit) return cleanTraceValue(explicit);
    actionTraceSequence += 1;
    return cleanTraceValue(`cat-${action['type'] || 'action'}-${Date.now().toString(36)}-${actionTraceSequence}`);
  }

  function buildClientActionTrace(action = {}, context = {}) {
    return {
      schema: TRACE_SCHEMA,
      clientActionTraceId: createClientActionTraceId(action, context),
      sourceSurface: cleanTraceValue(
        action.sourceSurface || action.surface || context.sourceSurface || context.currentSurface,
        'canvas',
      ),
      hitTargetId: cleanTraceValue(
        action.hitTargetId
          || action.targetId
          || action.target
          || action.buildingId
          || action.techId
          || action.taskId
          || action.siteId
          || action.territoryId
          || action.missionId,
      ),
      actionType: cleanTraceValue(action['type']),
      actionDescriptorId: cleanTraceValue(action.actionDescriptorId || action.descriptorId || action['type']),
      visualDisabled: ClientCommandSemantics?.isVisualDisabled?.(action) || false,
    };
  }

  function recordUiLocalTrace(action = {}, context = {}) {
    if (ClientCommandSemantics?.isCommandAction?.(action)) return null;
    const logger = context?.clientOperationLog || global.ClientOperationLog;
    return logger?.record?.('action:uiLocal', {
      ...(action.clientActionTrace || buildClientActionTrace(action, context)),
      uiOwner: context.uiOwner || 'CanvasActionDispatchRegistry',
      runtimeStore: context.runtimeStore || '',
      triggersRender: typeof context.render === 'function',
    });
  }

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
      const descriptor = this.registry?.resolveDescriptor?.(normalizedAction, context) || null;
      const tracedAction = descriptor && !normalizedAction.actionDescriptorId
        ? { ...normalizedAction, actionDescriptorId: descriptor.id || descriptor.actionType }
        : normalizedAction;
      tracedAction.clientActionTrace = tracedAction.clientActionTrace || buildClientActionTrace(tracedAction, context);
      const commandBlockReason = ClientCommandSemantics?.getCommandBlockReason?.(normalizedAction) || '';
      if (commandBlockReason) {
        const logger = context?.clientOperationLog || global.ClientOperationLog;
        logger?.record?.('command:localBlock', {
          ...(tracedAction.clientActionTrace || {}),
          commandType: normalizedAction.type || '',
          commandKey: ClientCommandSemantics?.getCommandKey?.(normalizedAction) || normalizedAction.type || '',
          reason: commandBlockReason,
        }, { flush: true });
        return true;
      }
      recordUiLocalTrace(tracedAction, context);
      return this.registry.dispatch(tracedAction, context, {
        finishHandled: (result) => this.finishHandled(result, context, tracedAction),
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

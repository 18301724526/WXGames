(function (global) {
  'use strict';

  const BUILDING_TRACE_FIELDS = Object.freeze([
    'buildingId',
    'clientActionTraceId',
    'sourceSurface',
    'hitTargetId',
  ]);

  const DESCRIPTORS = Object.freeze({
    buildBuilding: Object.freeze({
      id: 'building.build',
      actionType: 'buildBuilding',
      owner: 'player',
      surface: 'city:buildings',
      kind: 'command-submit',
      commandType: 'build',
      payloadBuilder: 'buildingId',
      traceFields: BUILDING_TRACE_FIELDS,
      visualStateSource: 'BuildingPresenter.buildBuildingViewState',
    }),
    upgradeBuilding: Object.freeze({
      id: 'building.upgrade',
      actionType: 'upgradeBuilding',
      owner: 'player',
      surface: 'city:buildings',
      kind: 'command-submit',
      commandType: 'upgrade',
      payloadBuilder: 'buildingId',
      traceFields: BUILDING_TRACE_FIELDS,
      visualStateSource: 'BuildingPresenter.buildBuildingViewState',
    }),
  });

  function cloneDescriptor(descriptor = null) {
    if (!descriptor) return null;
    return {
      ...descriptor,
      traceFields: Array.isArray(descriptor.traceFields) ? [...descriptor.traceFields] : [],
    };
  }

  function resolve(action = {}) {
    const type = action?.type || '';
    return cloneDescriptor(DESCRIPTORS[type] || null);
  }

  function has(action = {}) {
    return Boolean(resolve(action));
  }

  function supportedActions() {
    return Object.keys(DESCRIPTORS);
  }

  function buildPayload(action = {}) {
    const descriptor = resolve(action);
    if (!descriptor) return null;
    if (descriptor.payloadBuilder === 'buildingId') {
      return { buildingId: String(action.buildingId || '') };
    }
    return {};
  }

  function getCommandHost(context = {}) {
    if (typeof context?.getCanvasGameHost === 'function') {
      const game = context.getCanvasGameHost();
      if (game && typeof game === 'object') return game;
    }
    if (context?.lastGame && typeof context.lastGame === 'object') return context.lastGame;
    return context && typeof context === 'object' ? context : null;
  }

  function getCommandHandlerName(descriptor = {}) {
    if (descriptor.commandType === 'upgrade') return 'upgradeBuilding';
    if (descriptor.commandType === 'build') return 'buildBuilding';
    return '';
  }

  function resolveCommandHandler(action = {}, context = {}) {
    const descriptor = resolve(action);
    if (!descriptor) return null;
    const handlerName = getCommandHandlerName(descriptor);
    const commandHost = getCommandHost(context);
    const candidates = [
      commandHost,
      context,
      commandHost?.commandService,
      context?.commandService,
    ].filter(Boolean);
    for (const candidate of candidates) {
      if (typeof candidate?.[handlerName] === 'function') {
        return {
          descriptor,
          handlerName,
          receiver: candidate,
          invoke(payload) {
            return candidate[handlerName](payload.buildingId, {
              action,
              descriptor,
              payload,
            });
          },
        };
      }
    }
    const api = commandHost?.api || context?.api || null;
    if (api && typeof api[descriptor.commandType] === 'function') {
      return {
        descriptor,
        handlerName: descriptor.commandType,
        receiver: api,
        invoke(payload) {
          const submit = () => api[descriptor.commandType](payload.buildingId);
          return typeof context?.runAction === 'function' ? context.runAction(submit) : submit();
        },
      };
    }
    return null;
  }

  function canDispatch(action = {}, context = null) {
    if (!has(action)) return false;
    if (!context) return true;
    return Boolean(resolveCommandHandler(action, context));
  }

  function dispatch(action = {}, context = {}) {
    const command = resolveCommandHandler(action, context);
    if (!command) return false;
    const payload = buildPayload(action) || {};
    return command.invoke(payload);
  }

  const api = Object.freeze({
    buildPayload,
    canDispatch,
    dispatch,
    getCommandHost,
    has,
    resolve,
    resolveCommandHandler,
    supportedActions,
  });

  global.CanvasActionDescriptorRegistry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

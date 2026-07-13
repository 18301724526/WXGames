'use strict';

const EcsCoreBoundary = (() => {
  if (typeof require === 'function') return require('../core/EcsCoreBoundary');
  return globalThis.EcsCoreBoundary;
})();

const { Types, defineComponent } = EcsCoreBoundary || {};

if (!Types || !defineComponent) {
  throw new Error('ECS mode components require EcsCoreBoundary primitives');
}

const ModeState = defineComponent({
  baseModeId: Types.ui8,
  modalMask: Types.ui32,
  debugActive: Types.ui8,
  blockingOverlayActive: Types.ui8,
  techTreeBlockingOverlayActive: Types.ui8,
  entityBattleActive: Types.ui8,
  worldMapHomeActive: Types.ui8,
  techTreeActive: Types.ui8,
  formationEditorActive: Types.ui8,
  topCaptureModeId: Types.ui8,
});

const api = Object.freeze({ ModeState });

if (typeof globalThis !== 'undefined') globalThis.EcsModeComponents = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

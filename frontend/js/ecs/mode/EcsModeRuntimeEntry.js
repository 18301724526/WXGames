'use strict';

const ModeKeys = require('./ModeKeys');
const ModeComponents = require('./ModeComponents');
const ModeResolver = require('./ModeResolver');
const ModeWorld = require('./ModeWorld');
const InputIntent = require('../input/InputIntent');
const InputIntentResolver = require('../input/InputIntentResolver');
const RendererSnapshotBoundary = require('../snapshot/RendererSnapshotBoundary');
const FogProjection = require('../projection/FogProjection');
const FogRevealModel = require('../system/FogRevealModel');
const WorldClock = require('../foundation/WorldClock');
const WorldMapVisibilityModel = require('../projection/WorldMapVisibilityModel');

const EcsModeRuntime = Object.freeze({
  ...ModeKeys,
  ...ModeResolver,
  ...ModeWorld,
  ...InputIntentResolver,
  ModeComponents,
  FogProjection,
  FogRevealModel,
  WorldClock,
  WorldMapVisibilityModel,
  RendererSnapshotBoundary,
  InputIntent,
  version: 'ecs-mode-runtime-modal-store-deshell-v1',
});

if (typeof globalThis !== 'undefined') {
  globalThis.EcsModeRuntime = EcsModeRuntime;
}

module.exports = EcsModeRuntime;

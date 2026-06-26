'use strict';

const ModeKeys = require('./ModeKeys');
const ModeComponents = require('./ModeComponents');
const ModeResolver = require('./ModeResolver');
const ModeWorld = require('./ModeWorld');
const ModalWorld = require('./ModalWorld');
const InputIntent = require('../input/InputIntent');
const InputIntentResolver = require('../input/InputIntentResolver');
const RendererSnapshotBoundary = require('../snapshot/RendererSnapshotBoundary');
const BattleDomainOwner = require('../domain/BattleDomainOwner');

const EcsModeRuntime = Object.freeze({
  ...ModeKeys,
  ...ModeResolver,
  ...ModeWorld,
  ...InputIntentResolver,
  ModeComponents,
  BattleDomainOwner,
  ModalWorld,
  RendererSnapshotBoundary,
  InputIntent,
  version: 'ecs-mode-runtime-batch-7a',
});

if (typeof globalThis !== 'undefined') {
  globalThis.EcsModeRuntime = EcsModeRuntime;
}

module.exports = EcsModeRuntime;

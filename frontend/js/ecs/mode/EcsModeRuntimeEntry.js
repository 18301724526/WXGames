'use strict';

const ModeKeys = require('./ModeKeys');
const ModeComponents = require('./ModeComponents');
const ModeResolver = require('./ModeResolver');
const ModeWorld = require('./ModeWorld');
const ModalWorld = require('./ModalWorld');
const InputIntent = require('../input/InputIntent');
const InputIntentResolver = require('../input/InputIntentResolver');

const EcsModeRuntime = Object.freeze({
  ...ModeKeys,
  ...ModeResolver,
  ...ModeWorld,
  ...InputIntentResolver,
  ModeComponents,
  ModalWorld,
  InputIntent,
  version: 'ecs-mode-runtime-batch-5a',
});

if (typeof globalThis !== 'undefined') {
  globalThis.EcsModeRuntime = EcsModeRuntime;
}

module.exports = EcsModeRuntime;

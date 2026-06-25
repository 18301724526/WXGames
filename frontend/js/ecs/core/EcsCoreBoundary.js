'use strict';

const bitecsCore = require('bitecs');
const bitecsLegacy = require('bitecs/legacy');

const EcsCoreBoundary = Object.freeze({
  createWorld: bitecsCore.createWorld,
  addEntity: bitecsCore.addEntity,
  removeEntity: bitecsCore.removeEntity,
  defineComponent: bitecsLegacy.defineComponent,
  Types: bitecsLegacy.Types,
  addComponent: bitecsLegacy.addComponent,
  removeComponent: bitecsLegacy.removeComponent,
  hasComponent: bitecsLegacy.hasComponent,
  defineQuery: bitecsLegacy.defineQuery,
  enterQuery: bitecsLegacy.enterQuery,
  exitQuery: bitecsLegacy.exitQuery,
  pipe: bitecsCore.pipe,
});

module.exports = EcsCoreBoundary;

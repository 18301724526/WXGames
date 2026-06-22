'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Policy = require('./BattleCameraPolicy');

// Stage: a 390-wide, 400-tall battlefield viewport; arena 720x1280 (9:16 portrait).
const STAGE = { x: 0, y: 30, w: 390, h: 400 };
const ARENA = { w: 720, h: 1280 };

test('createCamera defaults to a readable zoom within limits', () => {
  const cam = Policy.createCamera();
  assert.equal(cam.zoom, Policy.DEFAULT_ZOOM);
  assert.equal(cam.offsetX, 0);
  assert.equal(cam.offsetY, 0);
  assert.ok(cam.zoom >= Policy.MIN_ZOOM && cam.zoom <= Policy.MAX_ZOOM);
});

test('computeFit contains the arena inside the stage (letterbox), keeps aspect', () => {
  const fit = Policy.computeFit(ARENA, STAGE);
  // height-limited: 400/1280 < 390/720
  assert.ok(Math.abs(fit.scale - 400 / 1280) < 1e-9);
  assert.ok(fit.contentW <= STAGE.w + 1e-9);
  assert.ok(fit.contentH <= STAGE.h + 1e-9);
});

test('getViewTransform centers content in the stage at zoom 1, no offset', () => {
  const fit = Policy.computeFit(ARENA, STAGE);
  const t = Policy.getViewTransform({ zoom: 1, offsetX: 0, offsetY: 0 }, fit);
  assert.ok(Math.abs(t.scale - fit.scale) < 1e-9);
  // centered horizontally within the stage
  assert.ok(Math.abs(t.offsetX - (STAGE.x + (STAGE.w - fit.contentW) / 2)) < 1e-9);
  assert.ok(Math.abs(t.offsetY - (STAGE.y + (STAGE.h - fit.contentH) / 2)) < 1e-9);
});

test('zoomAt keeps the world point under the cursor fixed on screen', () => {
  const fit = Policy.computeFit(ARENA, STAGE);
  const cam = Policy.createCamera({ zoom: 1 });
  const point = { x: 200, y: 220 };
  const before = Policy.getViewTransform(cam, fit);
  const worldX = (point.x - before.offsetX) / before.scale;
  const worldY = (point.y - before.offsetY) / before.scale;
  const zoomed = Policy.zoomAt(cam, fit, point, 2);
  const after = Policy.getViewTransform(zoomed, fit);
  // the same world point should still map under the cursor (within clamp tolerance)
  const screenX = after.offsetX + worldX * after.scale;
  const screenY = after.offsetY + worldY * after.scale;
  assert.ok(Math.abs(screenX - point.x) < 0.5, `x stayed: ${screenX}`);
  assert.ok(Math.abs(screenY - point.y) < 0.5, `y stayed: ${screenY}`);
  assert.ok(zoomed.zoom > cam.zoom);
});

test('zoom is clamped to [MIN_ZOOM, MAX_ZOOM]', () => {
  const fit = Policy.computeFit(ARENA, STAGE);
  const inHard = Policy.zoomAt(Policy.createCamera({ zoom: 1 }), fit, { x: 195, y: 230 }, 1000);
  assert.equal(inHard.zoom, Policy.MAX_ZOOM);
  const outHard = Policy.zoomAt(Policy.createCamera({ zoom: 5 }), fit, { x: 195, y: 230 }, 0.0001);
  assert.equal(outHard.zoom, Policy.MIN_ZOOM);
});

test('panBy is clamped so content cannot be dragged off the stage', () => {
  const fit = Policy.computeFit(ARENA, STAGE);
  const cam = Policy.createCamera({ zoom: 2 });
  const panned = Policy.panBy(cam, fit, 100000, 100000);
  const zoomedW = fit.contentW * cam.zoom;
  const zoomedH = fit.contentH * cam.zoom;
  const slackX = Math.max(0, (zoomedW - fit.stageW) / 2);
  const slackY = Math.max(0, (zoomedH - fit.stageH) / 2);
  assert.ok(panned.offsetX <= slackX + 1e-9 && panned.offsetX >= -slackX - 1e-9);
  assert.ok(panned.offsetY <= slackY + 1e-9 && panned.offsetY >= -slackY - 1e-9);
});

test('at zoom 1 an axis narrower than the stage locks centered (offset 0)', () => {
  const fit = Policy.computeFit(ARENA, STAGE);
  // content width (~225) < stage width (390) at zoom 1 -> no horizontal slack
  const panned = Policy.panBy(Policy.createCamera({ zoom: 1 }), fit, 500, 0);
  assert.equal(panned.offsetX, 0);
});

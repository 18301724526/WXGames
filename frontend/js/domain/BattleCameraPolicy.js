// Pure battle-camera policy (no DOM, no rendering, no input).
// Owns the math for the entity-battle camera: contain-fit of the arena into the
// stage rect, zoom (about a screen point), pan, and clamping. Mirrors the
// established WorldMapRuntimeCameraPolicy split: the renderer reads the transform,
// the scene controller holds the {zoom, offset} state, this module does the math.
// Deterministic and unit-testable.
//
// The 9:16 portrait arena aspect is NEVER changed here — the camera only scales
// (>= fit) and pans within the content, so sprites stay proportional to the scene
// across devices (no giant/ant effect); zooming enlarges the whole battlefield.
(function (global) {
  'use strict';

  const MIN_ZOOM = 1; // 1 = whole battlefield fits the stage (contain)
  const MAX_ZOOM = 5;
  const DEFAULT_ZOOM = 1.6; // open slightly zoomed-in so units read on a phone

  function clampNumber(value, lo, hi) {
    const n = Number(value);
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }

  function createCamera(options = {}) {
    return {
      zoom: clampNumber(options.zoom != null ? options.zoom : DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM),
      offsetX: Number(options.offsetX) || 0,
      offsetY: Number(options.offsetY) || 0,
    };
  }

  // Contain-fit mapping of the arena (world) into the stage rect at zoom = 1.
  // stage: { x, y, w, h } in screen px. Returns the base transform pieces.
  function computeFit(arena = {}, stage = {}) {
    const aw = Math.max(1, Number(arena.w) || 1);
    const ah = Math.max(1, Number(arena.h) || 1);
    const stageX = Number(stage.x) || 0;
    const stageY = Number(stage.y) || 0;
    const stageW = Math.max(1, Number(stage.w) || 1);
    const stageH = Math.max(1, Number(stage.h) || 1);
    const scale = Math.min(stageW / aw, stageH / ah) || 1;
    return { scale, contentW: aw * scale, contentH: ah * scale, stageX, stageY, stageW, stageH };
  }

  // Final screen transform: world (x,y) -> screen (offsetX + x*scale, offsetY + y*scale).
  // The zoomed content is centered in the stage, then shifted by the camera offset.
  function getViewTransform(camera = {}, fit = {}) {
    const zoom = clampNumber(camera.zoom, MIN_ZOOM, MAX_ZOOM);
    const zoomedW = (Number(fit.contentW) || 0) * zoom;
    const zoomedH = (Number(fit.contentH) || 0) * zoom;
    const centeredX = (Number(fit.stageX) || 0) + ((Number(fit.stageW) || 0) - zoomedW) / 2;
    const centeredY = (Number(fit.stageY) || 0) + ((Number(fit.stageH) || 0) - zoomedH) / 2;
    return {
      zoom,
      scale: (Number(fit.scale) || 1) * zoom,
      offsetX: centeredX + (Number(camera.offsetX) || 0),
      offsetY: centeredY + (Number(camera.offsetY) || 0),
    };
  }

  // Clamp the offset so the (zoomed) content cannot be dragged past the stage
  // edges; when the content is smaller than the stage on an axis it locks centered.
  function clampCamera(camera = {}, fit = {}) {
    const zoom = clampNumber(camera.zoom, MIN_ZOOM, MAX_ZOOM);
    const zoomedW = (Number(fit.contentW) || 0) * zoom;
    const zoomedH = (Number(fit.contentH) || 0) * zoom;
    const slackX = Math.max(0, (zoomedW - (Number(fit.stageW) || 0)) / 2);
    const slackY = Math.max(0, (zoomedH - (Number(fit.stageH) || 0)) / 2);
    return {
      zoom,
      offsetX: clampNumber(camera.offsetX, -slackX, slackX),
      offsetY: clampNumber(camera.offsetY, -slackY, slackY),
    };
  }

  // Zoom by scaleDelta keeping the world point under `point` fixed on screen.
  function zoomAt(camera = {}, fit = {}, point = {}, scaleDelta = 1) {
    const before = getViewTransform(camera, fit);
    const px = Number(point.x) || 0;
    const py = Number(point.y) || 0;
    const worldX = before.scale ? (px - before.offsetX) / before.scale : 0;
    const worldY = before.scale ? (py - before.offsetY) / before.scale : 0;
    const nextZoom = clampNumber((Number(camera.zoom) || MIN_ZOOM) * (Number(scaleDelta) || 1), MIN_ZOOM, MAX_ZOOM);
    const zoomedW = (Number(fit.contentW) || 0) * nextZoom;
    const zoomedH = (Number(fit.contentH) || 0) * nextZoom;
    const centeredX = (Number(fit.stageX) || 0) + ((Number(fit.stageW) || 0) - zoomedW) / 2;
    const centeredY = (Number(fit.stageY) || 0) + ((Number(fit.stageH) || 0) - zoomedH) / 2;
    const nextScale = (Number(fit.scale) || 1) * nextZoom;
    return clampCamera({
      zoom: nextZoom,
      offsetX: px - worldX * nextScale - centeredX,
      offsetY: py - worldY * nextScale - centeredY,
    }, fit);
  }

  function panBy(camera = {}, fit = {}, dx = 0, dy = 0) {
    return clampCamera({
      zoom: clampNumber(camera.zoom, MIN_ZOOM, MAX_ZOOM),
      offsetX: (Number(camera.offsetX) || 0) + (Number(dx) || 0),
      offsetY: (Number(camera.offsetY) || 0) + (Number(dy) || 0),
    }, fit);
  }

  const api = {
    MIN_ZOOM,
    MAX_ZOOM,
    DEFAULT_ZOOM,
    createCamera,
    computeFit,
    getViewTransform,
    clampCamera,
    zoomAt,
    panBy,
  };

  global.BattleCameraPolicy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

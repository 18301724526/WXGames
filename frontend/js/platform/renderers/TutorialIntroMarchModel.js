(function (global) {
  const DEFAULT_UNIT_ID = 'spearman';
  const DEFAULT_ANIMATION = 'move';
  const DEFAULT_FRAME_MS = 80;

  function easeInOutCubic(value = 0) {
    const t = Math.max(0, Math.min(1, Number(value) || 0));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function normalizeTargetRect(target = {}) {
    const x = Number(target.x ?? target.left) || 0;
    const y = Number(target.y ?? target.top) || 0;
    const width = Math.max(24, Number(target.width) || 0);
    const height = Math.max(24, Number(target.height) || 0);
    return {
      x,
      y,
      width,
      height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  }

  function getStartPoint(target = {}, viewport = {}) {
    const width = Number(viewport.width) || 0;
    const height = Number(viewport.height) || 0;
    const bottomSafeArea = Number(viewport.bottomSafeArea) || 0;
    const horizontalDistance = Math.max(180, width * 0.55);
    const x = Math.min(-42, (Number(target.centerX) || 0) - horizontalDistance);
    const lowerLaneY = (Number(target.centerY) || 0) + Math.max(150, height * 0.28);
    const maxY = Math.max(96, height - bottomSafeArea - 102);
    const y = Math.max(72, Math.min(maxY, lowerLaneY));
    return { x, y };
  }

  function getEndPoint(target = {}, start = {}) {
    const centerX = Number(target.centerX) || 0;
    const centerY = Number(target.centerY) || 0;
    const halfWidth = Math.max(16, Number(target.width) / 2 || 0);
    const halfHeight = Math.max(16, Number(target.height) / 2 || 0);
    const dx = (Number(start.x) || 0) - centerX || -1;
    const dy = (Number(start.y) || 0) - centerY || 1;
    const edgeScale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 0.001);
    const length = Math.max(1, Math.hypot(dx, dy));
    const standOff = Math.max(4, Math.min(8, Math.min(Number(target.width) || 0, Number(target.height) || 0) * 0.12));
    return {
      x: centerX + dx * edgeScale + (dx / length) * standOff,
      y: centerY + dy * edgeScale + (dy / length) * standOff,
    };
  }

  function getMarchRoute(target = {}, progress = 0, viewport = {}) {
    const rect = normalizeTargetRect(target);
    const start = getStartPoint(rect, viewport);
    const end = getEndPoint(rect, start);
    const arcLift = Math.min(84, Math.max(40, (Number(viewport.height) || 0) * 0.08));
    const control = {
      x: (start.x + end.x) / 2,
      y: Math.min(start.y, end.y) - arcLift,
    };
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const oneMinusT = 1 - t;
    return {
      start,
      end,
      control,
      progress: t,
      x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
      y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
    };
  }

  function getEnterRoute(target = {}, intro = {}, now = Date.now(), viewport = {}) {
    const base = getMarchRoute(target, 1, viewport);
    const rect = normalizeTargetRect(target);
    const startedAt = Number(intro.enterStartedAt) || now;
    const duration = Math.max(1, Number(intro.enterDurationMs) || 780);
    const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
    const eased = easeInOutCubic(progress);
    return {
      ...base,
      progress,
      x: base.end.x + (rect.centerX - base.end.x) * eased,
      y: base.end.y + (rect.centerY + rect.height * 0.05 - base.end.y) * eased,
      alpha: Math.max(0, 1 - Math.max(0, progress - 0.28) / 0.72),
    };
  }

  function getFramePaths(manifest, unitId = DEFAULT_UNIT_ID, animation = DEFAULT_ANIMATION) {
    return manifest?.getFramePaths?.(unitId, animation) || [];
  }

  function getFramePath(options = {}) {
    const {
      manifest,
      now = Date.now(),
      intro = {},
      unitId = DEFAULT_UNIT_ID,
      animation = DEFAULT_ANIMATION,
    } = options;
    const frames = getFramePaths(manifest, unitId, animation);
    if (!frames.length) return '';
    if (intro.freezeFrame) return frames[0];
    const startedAt = Number(intro.startedAt) || now;
    const frameMs = manifest?.getFrameDurationMs?.(unitId, animation) || DEFAULT_FRAME_MS;
    const frameIndex = Math.floor(Math.max(0, now - startedAt) / frameMs) % frames.length;
    return frames[frameIndex];
  }

  const api = {
    DEFAULT_ANIMATION,
    DEFAULT_UNIT_ID,
    easeInOutCubic,
    getEndPoint,
    getEnterRoute,
    getFramePath,
    getFramePaths,
    getMarchRoute,
    getStartPoint,
    normalizeTargetRect,
  };

  global.TutorialIntroMarchModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  const BASELINE_FRAME = Object.freeze({
    width: 430,
    height: 430 * (16 / 9),
  });

  const TUNED_ADVISOR_SPINE_LAYOUT = Object.freeze({
    targetRect: Object.freeze({
      x: 0,
      y: 433,
      width: 158,
      height: 330,
    }),
    view: Object.freeze({
      viewScale: 1.41,
      viewOffsetX: 2,
      viewOffsetY: 85,
      fitPadding: 1,
    }),
    clip: Object.freeze({
      mode: 'autoFromSkeletonBounds',
      clipPadding: 4,
    }),
    dialogueLeft: 126,
  });

  function getFrame(options = {}) {
    const width = Math.max(1, Number(options.width) || BASELINE_FRAME.width);
    const height = Math.max(1, Number(options.height) || BASELINE_FRAME.height);
    return { width, height };
  }

  function getScale(options = {}) {
    const frame = getFrame(options);
    return {
      x: frame.width / BASELINE_FRAME.width,
      y: frame.height / BASELINE_FRAME.height,
    };
  }

  function roundPixel(value = 0) {
    return Math.round(Number(value) || 0);
  }

  function projectRect(rect = {}, options = {}) {
    const scale = getScale(options);
    return {
      x: roundPixel((Number(rect.x) || 0) * scale.x),
      y: roundPixel((Number(rect.y) || 0) * scale.y),
      width: Math.max(1, roundPixel((Number(rect.width) || 1) * scale.x)),
      height: Math.max(1, roundPixel((Number(rect.height) || 1) * scale.y)),
    };
  }

  function projectX(value = 0, options = {}) {
    return roundPixel((Number(value) || 0) * getScale(options).x);
  }

  function projectLength(value = 0, options = {}, axis = 'x') {
    const scale = getScale(options);
    return (Number(value) || 0) * (axis === 'y' ? scale.y : scale.x);
  }

  function getAdvisorPortraitRect(options = {}) {
    return projectRect(TUNED_ADVISOR_SPINE_LAYOUT.targetRect, options);
  }

  function getAdvisorDialogueLeft(options = {}) {
    return projectX(TUNED_ADVISOR_SPINE_LAYOUT.dialogueLeft, options);
  }

  function getAdvisorSpineView(options = {}) {
    const view = TUNED_ADVISOR_SPINE_LAYOUT.view;
    return {
      fitPadding: Number(view.fitPadding) || 1,
      viewScale: Math.max(0.01, Number(view.viewScale) || 1),
      viewOffsetX: projectLength(view.viewOffsetX, options, 'x'),
      viewOffsetY: projectLength(view.viewOffsetY, options, 'y'),
    };
  }

  function getAdvisorSpineClip(options = {}) {
    return {
      mode: TUNED_ADVISOR_SPINE_LAYOUT.clip.mode,
      clipPadding: Math.max(
        0,
        roundPixel(projectLength(TUNED_ADVISOR_SPINE_LAYOUT.clip.clipPadding, options, 'x')),
      ),
    };
  }

  function getAdvisorLayout(options = {}) {
    return {
      portrait: getAdvisorPortraitRect(options),
      dialogueLeft: getAdvisorDialogueLeft(options),
      view: getAdvisorSpineView(options),
      clip: getAdvisorSpineClip(options),
    };
  }

  const api = {
    BASELINE_FRAME,
    TUNED_ADVISOR_SPINE_LAYOUT,
    getAdvisorDialogueLeft,
    getAdvisorLayout,
    getAdvisorPortraitRect,
    getAdvisorSpineClip,
    getAdvisorSpineView,
    getFrame,
    getScale,
    projectLength,
    projectRect,
  };

  global.TutorialAdvisorSpineLayoutConfig = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

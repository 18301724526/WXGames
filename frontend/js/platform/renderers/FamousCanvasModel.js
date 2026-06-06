(function (global) {
  const QUALITY_STYLES = Object.freeze({
    gold: Object.freeze({
      fill: 'rgba(66, 49, 24, 0.96)',
      stroke: '#f2c45f',
      inset: 'rgba(255, 237, 160, 0.38)',
      glow: 'rgba(242, 196, 95, 0.22)',
      text: '#ffe6a3',
    }),
    purple: Object.freeze({
      fill: 'rgba(48, 35, 63, 0.96)',
      stroke: '#b68cff',
      inset: 'rgba(214, 182, 255, 0.28)',
      glow: 'rgba(182, 140, 255, 0.18)',
      text: '#dec7ff',
    }),
    blue: Object.freeze({
      fill: 'rgba(28, 45, 67, 0.96)',
      stroke: '#77b7ff',
      inset: 'rgba(145, 198, 255, 0.24)',
      glow: 'rgba(119, 183, 255, 0.16)',
      text: '#b9dcff',
    }),
    white: Object.freeze({
      fill: 'rgba(43, 43, 42, 0.96)',
      stroke: '#d9d8cf',
      inset: 'rgba(255, 255, 255, 0.18)',
      glow: 'rgba(255, 255, 255, 0.1)',
      text: '#eeeee8',
    }),
  });

  function isSameFamousSkillTooltipAction(left = null, right = null) {
    return Boolean(left && right
      && left.type === 'showFamousSkillTooltip'
      && right.type === 'showFamousSkillTooltip'
      && left.cardId === right.cardId
      && left.skillIndex === right.skillIndex);
  }

  function clearFamousSkillTooltip(renderer) {
    const changed = Boolean(renderer.hoverPoint || renderer.activeFamousSkillTooltip || renderer.pinnedFamousSkillTooltip);
    renderer.hoverPoint = null;
    renderer.activeFamousSkillTooltip = null;
    renderer.pinnedFamousSkillTooltip = null;
    return changed;
  }

  function setPinnedFamousSkillTooltip(renderer, action = null) {
    if (!action || action.type !== 'showFamousSkillTooltip') return clearFamousSkillTooltip(renderer);
    if (isSameFamousSkillTooltipAction(renderer.pinnedFamousSkillTooltip, action)) {
      return clearFamousSkillTooltip(renderer);
    }
    renderer.pinnedFamousSkillTooltip = { ...action };
    return true;
  }

  function getFamousSkillTooltipAction(renderer, point = {}) {
    if (!point) return null;
    const targets = Array.isArray(renderer.famousSkillHitTargets) ? renderer.famousSkillHitTargets : [];
    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (renderer.containsPoint(target, point)) return target.action || null;
    }
    return null;
  }

  function getFamousQualityStyle(frame = 'white') {
    return { ...(QUALITY_STYLES[frame] || QUALITY_STYLES.white) };
  }

  function normalizeFamousPersonsPage(total, page, pageSize) {
    const pages = Math.max(1, Math.ceil(Math.max(0, Number(total) || 0) / Math.max(1, pageSize)));
    const index = Math.max(0, Math.min(pages - 1, Math.floor(Number(page) || 0)));
    return { index, pages };
  }

  const api = {
    isSameFamousSkillTooltipAction,
    clearFamousSkillTooltip,
    setPinnedFamousSkillTooltip,
    getFamousSkillTooltipAction,
    getFamousQualityStyle,
    normalizeFamousPersonsPage,
  };

  global.FamousCanvasModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

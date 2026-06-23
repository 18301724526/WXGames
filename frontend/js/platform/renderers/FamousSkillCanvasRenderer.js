(function (global) {
  function renderSkillBadges(renderer, card, x, y, width, options = {}) {
    const skillDetails = Array.isArray(card.skillDetails) && card.skillDetails.length
      ? card.skillDetails
      : (Array.isArray(card.skills)
        ? card.skills.map((skill) => ({
          name: skill,
          kindText: renderer.t?.('famous.skill.generic', {}) || '技能',
          effectText: '',
          meta: '',
          summary: skill,
        }))
        : []);
    const skillBadges = Array.isArray(card.skillBadges) && card.skillBadges.length
      ? card.skillBadges
      : skillDetails.map((skill) => ({
        id: skill.id,
        label: skill.kindText || renderer.t?.('famous.skill.generic', {}) || '技能',
        name: skill.name || renderer.t?.('famous.skill.generic', {}) || '技能',
        text: renderer.t?.(
          'famous.skill.badge',
          {
            kind: skill.kindText || renderer.t?.('famous.skill.generic', {}) || '技能',
            name: skill.name || renderer.t?.('famous.skill.generic', {}) || '技能',
          }) || `${skill.kindText || '技能'}：${skill.name || '技能'}`,
      }));
    const badgeHeight = options.badgeHeight || 22;
    const rowGap = options.rowGap || 5;
    skillBadges.slice(0, 2).forEach((badge, index) => {
      const skill = skillDetails[index] || {};
      const badgeY = y + index * (badgeHeight + rowGap);
      renderer.drawPanel(x, badgeY, width, badgeHeight, {
        fill: index === 0 ? 'rgba(47, 92, 69, 0.54)' : 'rgba(96, 73, 35, 0.54)',
        stroke: index === 0 ? 'rgba(116, 211, 160, 0.28)' : 'rgba(255, 217, 138, 0.28)',
        radius: 7,
      });
      renderer.drawText(renderer.truncateText(badge.text || skill.name || renderer.t?.('famous.skill.generic', {}) || '技能', width - 16, { size: options.detail ? 11 : 10, bold: true }), x + (options.detail ? 10 : 8), badgeY + badgeHeight / 2, {
        size: options.detail ? 11 : 10,
        bold: true,
        color: index === 0 ? '#bdf2cf' : '#ffe0a3',
        baseline: 'middle',
      });
      const action = {
        type: 'showFamousSkillTooltip',
        cardId: options.cardId || '',
        skillIndex: index,
        skill,
      };
      const rect = { x, y: badgeY, width, height: badgeHeight };
      renderer.famousSkillHitTargets.push({ ...rect, action });
      renderer.addHitTarget(rect, action);
      if (renderer.hoverPoint && renderer.containsPoint(rect, renderer.hoverPoint)) renderer.activeFamousSkillTooltip = action;
    });
  }

  function renderFamousSkillTooltip(renderer, action = null) {
    const skill = action?.skill;
    if (!skill || !renderer.ctx) return;
    const width = Math.min(300, Math.max(238, renderer.width - 44));
    const lines = [
      skill.description
        ? renderer.t?.('famous.skill.effectPrefix', { description: skill.description }) || `效果：${skill.description}`
        : '',
      skill.meta ? skill.meta : '',
    ].filter(Boolean);
    const wrapped = lines.flatMap((line) => renderer.wrapTextLimit(line, width - 28, 4, { size: 11 }));
    const height = Math.min(164, 50 + wrapped.length * 16);
    const anchor = renderer.famousSkillHitTargets.find((target) => (
      target.action?.cardId === action.cardId
      && target.action?.skillIndex === action.skillIndex
    ));
    const preferredX = anchor ? anchor.x : Math.max(16, (renderer.width - width) / 2);
    const preferredY = anchor ? anchor.y - height - 8 : 80;
    const tooltipX = Math.max(14, Math.min(renderer.width - width - 14, preferredX));
    const tooltipY = Math.max(58, Math.min(renderer.height - height - 18, preferredY));
    renderer.drawPanel(tooltipX, tooltipY, width, height, {
      fill: 'rgba(16, 18, 16, 0.96)',
      stroke: 'rgba(116, 211, 160, 0.36)',
      radius: 8,
      inset: 'rgba(255, 255, 255, 0.05)',
    });
    const skillKind = skill.kindText || renderer.t?.('famous.skill.generic', {}) || '技能';
    const skillName = skill.name || renderer.t?.('famous.skill.generic', {}) || '技能';
    renderer.drawText(`${skillKind} · ${skillName}`, tooltipX + 14, tooltipY + 14, {
      size: 13,
      bold: true,
      color: '#fff1cf',
    });
    renderer.drawTextLines(wrapped.slice(0, 7), tooltipX + 14, tooltipY + 38, {
      size: 11,
      color: '#cbd6c8',
      lineHeight: 16,
    });
  }

  function syncVisibleFamousSkillTooltip(renderer) {
    const hoverTooltip = renderer.hoverPoint ? renderer.getFamousSkillTooltipAction(renderer.hoverPoint) : null;
    if (hoverTooltip) renderer.activeFamousSkillTooltip = hoverTooltip;
    const pinnedStillVisible = renderer.pinnedFamousSkillTooltip
      && renderer.famousSkillHitTargets.some((target) => (
        renderer.isSameFamousSkillTooltipAction(target.action, renderer.pinnedFamousSkillTooltip)
      ));
    if (!pinnedStillVisible) renderer.pinnedFamousSkillTooltip = null;
    renderer.renderFamousSkillTooltip(renderer.activeFamousSkillTooltip || renderer.pinnedFamousSkillTooltip);
  }

  const api = {
    renderSkillBadges,
    renderFamousSkillTooltip,
    syncVisibleFamousSkillTooltip,
  };

  global.FamousSkillCanvasRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

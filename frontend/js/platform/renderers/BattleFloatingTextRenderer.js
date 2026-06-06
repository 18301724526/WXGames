(function (global) {
  function drawBattleDamageFloat(renderer, activeTurn = null, phase = 'prepare', phaseProgress = 0, targetArea = null) {
    if (!renderer || !activeTurn || phase !== 'impact' || !targetArea) return;
    const text = renderer.getBattleDamageFloatText(activeTurn);
    if (!text) return;
    const progress = Math.max(0, Math.min(1, Number(phaseProgress) || 0));
    const rise = progress * 42;
    const pop = 1 + Math.sin(progress * Math.PI) * 0.16;
    const alpha = Math.max(0, Math.min(1, 1 - Math.max(0, progress - 0.68) / 0.32));
    const isSkill = activeTurn.action === 'skill';
    const x = renderer.width / 2 + (activeTurn.target === 'defender' ? 34 : -34);
    const y = targetArea.y + Math.max(34, targetArea.height * 0.22) - rise;
    const previousAlpha = typeof renderer.ctx?.globalAlpha === 'number' ? renderer.ctx.globalAlpha : 1;
    if (renderer.ctx && typeof renderer.ctx.globalAlpha === 'number') renderer.ctx.globalAlpha = previousAlpha * alpha;
    renderer.drawText(text, x + 1, y + 1, {
      size: Math.round(19 * pop),
      bold: true,
      color: 'rgba(24, 15, 10, 0.82)',
      align: 'center',
      baseline: 'middle',
    });
    renderer.drawText(text, x, y, {
      size: Math.round(19 * pop),
      bold: true,
      color: isSkill ? '#ffd66e' : '#ff8a72',
      align: 'center',
      baseline: 'middle',
    });
    if (renderer.ctx && typeof renderer.ctx.globalAlpha === 'number') renderer.ctx.globalAlpha = previousAlpha;
  }

  function drawBattleStatusFloatingTexts(renderer, activeTurn = null, phase = 'prepare', phaseProgress = 0, areas = {}) {
    if (!renderer || !activeTurn || !['prepare', 'impact', 'settle'].includes(phase)) return;
    const texts = Array.isArray(activeTurn.floatingTexts) ? activeTurn.floatingTexts : [];
    if (!texts.length) return;
    const progress = Math.max(0, Math.min(1, Number(phaseProgress) || 0));
    const phaseOffset = phase === 'prepare' ? 0 : (phase === 'impact' ? 0.34 : 0.68);
    const alpha = Math.max(0, Math.min(1, 1 - Math.max(0, phaseOffset + progress - 0.72) / 0.28));
    const previousAlpha = typeof renderer.ctx?.globalAlpha === 'number' ? renderer.ctx.globalAlpha : 1;
    if (renderer.ctx && typeof renderer.ctx.globalAlpha === 'number') renderer.ctx.globalAlpha = previousAlpha * alpha;
    texts.slice(0, 4).forEach((item, index) => {
      const target = item?.target === 'attacker' ? 'attacker' : 'defender';
      const area = target === 'attacker' ? areas.attacker : areas.defender;
      if (!area) return;
      const kind = item.kind || 'status';
      const color = kind === 'shield'
        ? '#84d7ff'
        : (kind === 'damageOverTime' ? '#ffb45e' : '#d9c6ff');
      const x = area.x + area.width / 2 + (target === 'attacker' ? -18 : 18);
      const y = area.y + Math.max(22, area.height * 0.16) - progress * 28 - index * 17;
      const text = String(item.text || '').trim();
      if (!text) return;
      renderer.drawText(text, x + 1, y + 1, {
        size: 13,
        bold: true,
        color: 'rgba(19, 14, 10, 0.86)',
        align: 'center',
        baseline: 'middle',
      });
      renderer.drawText(text, x, y, {
        size: 13,
        bold: true,
        color,
        align: 'center',
        baseline: 'middle',
      });
    });
    if (renderer.ctx && typeof renderer.ctx.globalAlpha === 'number') renderer.ctx.globalAlpha = previousAlpha;
  }

  const api = {
    drawBattleDamageFloat,
    drawBattleStatusFloatingTexts,
  };

  global.BattleFloatingTextRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

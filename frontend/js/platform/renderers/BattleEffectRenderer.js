(function (global) {
  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function drawBattleActionEffect(renderer, activeTurn = null, progress = 0) {
    if (!renderer || !activeTurn) return;
    const isSkill = activeTurn.action === 'skill' || activeTurn.actionType === 'skill';
    const impactProgress = clamp01(progress);
    if (impactProgress <= 0) return;
    const x = activeTurn.target === 'defender' ? renderer.width * 0.58 : renderer.width * 0.42;
    const y = Math.max(270, renderer.height * 0.48);
    const pulse = Math.sin(impactProgress * Math.PI);
    renderer.drawCircle(x, y, (isSkill ? 42 : 24) * pulse, {
      fill: isSkill ? 'rgba(255, 196, 76, 0.20)' : 'rgba(255, 245, 210, 0.14)',
      stroke: isSkill ? 'rgba(255, 226, 122, 0.72)' : 'rgba(255, 245, 210, 0.42)',
      width: isSkill ? 3 : 2,
    });
    if (isSkill) {
      renderer.drawText(activeTurn.skillName || '\u6280\u80fd', x, y - 54 * pulse, {
        size: 14,
        bold: true,
        color: '#ffe6b5',
        align: 'center',
      });
    }
  }

  function drawBattleSkillCutIn(renderer, activeTurn = null, progress = 0) {
    if (!renderer) return;
    const shouldShowCutIn = activeTurn?.presentation?.cutIn || activeTurn?.action === 'skill' || activeTurn?.actionType === 'skill';
    if (!shouldShowCutIn) return;
    const cutInProgress = clamp01(progress);
    if (cutInProgress <= 0) return;
    const actorSide = activeTurn.actor === 'defender' ? 'defender' : 'attacker';
    const easeOut = (value) => 1 - Math.pow(1 - clamp01(value), 3);
    const easeIn = (value) => Math.pow(clamp01(value), 3);
    const getFlyProgress = (value) => {
      if (value < 0.28) return { stage: 'enter', ratio: easeOut(value / 0.28) };
      if (value < 0.76) return { stage: 'hold', ratio: 1 };
      return { stage: 'exit', ratio: easeIn((value - 0.76) / 0.24) };
    };
    const flyProgress = getFlyProgress(cutInProgress);
    const fadeIn = Math.min(1, cutInProgress / 0.16);
    const fadeOut = cutInProgress < 0.82 ? 1 : Math.max(0, 1 - (cutInProgress - 0.82) / 0.18);
    const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const portraitSize = Math.min(142, Math.max(104, renderer.width * 0.34));
    const portraitY = Math.max(104, renderer.height * 0.25);
    const portraitCenterX = renderer.width / 2 - Math.min(84, renderer.width * 0.22);
    const portraitHoldX = portraitCenterX - portraitSize / 2;
    const portraitStartX = -portraitSize - 28;
    const portraitEndX = renderer.width + 28;
    const portraitX = flyProgress.stage === 'exit'
      ? portraitHoldX + (portraitEndX - portraitHoldX) * flyProgress.ratio
      : portraitStartX + (portraitHoldX - portraitStartX) * flyProgress.ratio;
    const titleWidth = Math.min(238, renderer.width * 0.58);
    const titleHeight = 72;
    const titleY = portraitY + portraitSize * 0.3;
    const titleCenterX = renderer.width / 2 + Math.min(74, renderer.width * 0.19);
    const titleHoldX = titleCenterX - titleWidth / 2;
    const titleStartX = renderer.width + 28;
    const titleEndX = -titleWidth - 28;
    const titleX = flyProgress.stage === 'exit'
      ? titleHoldX + (titleEndX - titleHoldX) * flyProgress.ratio
      : titleStartX + (titleHoldX - titleStartX) * flyProgress.ratio;
    const previousAlpha = typeof renderer.ctx?.globalAlpha === 'number' ? renderer.ctx.globalAlpha : 1;
    if (renderer.ctx && typeof renderer.ctx.globalAlpha === 'number') {
      renderer.ctx.globalAlpha = previousAlpha * alpha;
    }

    if (renderer.ctx && typeof renderer.ctx.fillRect === 'function') {
      renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
      renderer.ctx.fillRect(0, Math.max(0, portraitY - 34), renderer.width, portraitSize + 70);
    }
    renderer.drawPanel(portraitX, portraitY, portraitSize, portraitSize, {
      fill: actorSide === 'attacker' ? 'rgba(20, 56, 45, 0.90)' : 'rgba(84, 40, 32, 0.90)',
      stroke: 'rgba(255, 226, 177, 0.44)',
      radius: 10,
      inset: 'rgba(255, 231, 184, 0.12)',
    });
    const portraitDrawn = renderer.drawFamousPortrait(
      { appearance: activeTurn.actorPortrait || {} },
      portraitX,
      portraitY,
      portraitSize,
      {
        frameWidth: portraitSize,
        frameHeight: portraitSize,
        radius: 10,
        scale: 1.7,
        offsetY: 0.12,
      },
    );
    if (!portraitDrawn) {
      renderer.drawText(String(activeTurn.actorName || '\u5c06').slice(0, 1), portraitX + portraitSize / 2, portraitY + portraitSize / 2, {
        size: 26,
        bold: true,
        color: '#f6e8c8',
        align: 'center',
        baseline: 'middle',
      });
    }

    renderer.drawPanel(titleX, titleY, titleWidth, titleHeight, {
      fill: 'rgba(20, 16, 12, 0.88)',
      stroke: actorSide === 'attacker' ? 'rgba(116, 211, 160, 0.48)' : 'rgba(224, 123, 98, 0.48)',
      radius: 8,
      inset: 'rgba(255, 231, 184, 0.10)',
    });
    const accentX = actorSide === 'attacker' ? titleX + 10 : titleX + titleWidth - 14;
    renderer.drawPanel(accentX, titleY + 12, 4, titleHeight - 24, {
      fill: actorSide === 'attacker' ? '#74d3a0' : '#e07b62',
      stroke: actorSide === 'attacker' ? '#74d3a0' : '#e07b62',
      radius: 2,
    });
    const textX = titleX + (actorSide === 'attacker' ? 24 : 14);
    const textWidth = titleWidth - 38;
    renderer.drawText(renderer.truncateText(activeTurn.actorName || '', textWidth, { size: 13, bold: true }), textX, titleY + 12, {
      size: 13,
      bold: true,
      color: '#cbbd96',
    });
    renderer.drawText(renderer.truncateText(activeTurn.skillName || '\u6218\u6cd5', textWidth, { size: 24, bold: true }), textX, titleY + 36, {
      size: 24,
      bold: true,
      color: '#ffe6b5',
    });
    if (renderer.ctx && typeof renderer.ctx.globalAlpha === 'number') renderer.ctx.globalAlpha = previousAlpha;
  }

  const api = {
    drawBattleActionEffect,
    drawBattleSkillCutIn,
  };

  global.BattleEffectRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

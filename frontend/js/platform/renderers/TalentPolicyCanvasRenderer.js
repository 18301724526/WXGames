(function (global) {
  function renderTalentPolicyPanel(renderer, state = {}, options = {}) {
    if (!renderer.presenter || typeof renderer.presenter.buildTalentPolicyViewState !== 'function') return;
    const view = renderer.presenter.buildTalentPolicyViewState(state, options.talentPolicyUiState || {});
    const layout = renderer.getLayout();
    const panelWidth = Math.min(380, layout.contentWidth - 10);
    const panelHeight = Math.min(612, Math.max(500, renderer.height - 150));
    const x = (renderer.width - panelWidth) / 2;
    const y = Math.max(52, (renderer.height - panelHeight) / 2 - 8);

    renderer.addHitTarget({ x: 0, y: 0, width: renderer.width, height: renderer.height }, { type: 'closeTalentPolicy' });
    if (renderer.ctx) {
      renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
      renderer.ctx.fillRect(0, 0, renderer.width, renderer.height);
    }
    renderer.drawPanel(x, y, panelWidth, panelHeight, {
      fill: renderer.createGradient(
        x, y, x, y + panelHeight,
        [
          [0, 'rgba(49, 38, 26, 0.99)'],
          [1, 'rgba(20, 18, 15, 0.99)'],
        ],
        'rgba(34, 27, 21, 0.99)',
      ),
      stroke: 'rgba(255, 226, 177, 0.24)',
      radius: 12,
      inset: 'rgba(255, 231, 184, 0.1)',
    });
    renderer.addHitTarget({ x, y, width: panelWidth, height: panelHeight }, { type: 'blockCanvasModal' });

    const closeSize = 28;
    const closeX = x + panelWidth - closeSize - 10;
    const closeY = y + 10;
    renderer.drawText(view.text.title, x + 18, y + 16, { size: 18, bold: true, color: '#ffe6b5' });
    renderer.drawText(renderer.truncateText(view.text.subtitle, panelWidth - 76, { size: 12 }), x + 18, y + 43, {
      size: 12,
      color: '#cbbd96',
    });
    renderer.drawButton(closeX, closeY, closeSize, closeSize, 'x', { size: 14, radius: 7 });
    renderer.addHitTarget({ x: closeX, y: closeY, width: closeSize, height: closeSize }, { type: 'closeTalentPolicy' });

    const innerX = x + 14;
    const innerWidth = panelWidth - 28;
    let cursorY = y + 72;
    renderer.drawPanel(innerX, cursorY, innerWidth, 44, {
      fill: 'rgba(24, 22, 17, 0.62)',
      stroke: 'rgba(116, 211, 160, 0.22)',
      radius: 8,
    });
    renderer.drawText('预览', innerX + 12, cursorY + 9, { size: 12, bold: true, color: '#74d3a0' });
    renderer.drawText(
      renderer.truncateText(view.preview.allocationText || '暂无人才', innerWidth - 74, { size: 13, bold: true }),
      innerX + 64,
      cursorY + 22,
      { size: 13, bold: true, color: '#fff1cf', baseline: 'middle' },
    );
    cursorY += 58;

    cursorY = renderPresetPolicies(renderer, view, innerX, cursorY, innerWidth);
    cursorY = renderSavedPolicies(renderer, view, innerX, cursorY, innerWidth);
    renderCustomDraft(renderer, view, innerX, cursorY, innerWidth, y + panelHeight - 16);
  }

  function renderPresetPolicies(renderer, view, innerX, cursorY, innerWidth) {
    renderer.drawText(view.text.presetTitle, innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
    cursorY += 22;
    const presets = (view.systemPolicies || []).slice(0, 5);
    const presetGap = 6;
    const presetHeight = 34;
    const presetWidth = Math.max(84, Math.floor((innerWidth - presetGap) / 2));
    presets.forEach((policy, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const buttonX = innerX + column * (presetWidth + presetGap);
      const buttonY = cursorY + row * (presetHeight + presetGap);
      const width = column === 1 ? innerX + innerWidth - buttonX : presetWidth;
      const selected = Boolean(policy.selected);
      const active = Boolean(policy.active);
      renderer.drawButton(buttonX, buttonY, width, presetHeight, renderer.truncateText(policy.label, width - 12, { size: 12, bold: true }), {
        disabled: policy.disabled,
        active: selected,
        size: 12,
        bold: selected || active,
        radius: 8,
      });
      if (selected && !active) drawCornerTag(renderer, '预览', buttonX, buttonY, width, '#74d3a0');
      if (active) drawCornerTag(renderer, '当前', buttonX, buttonY, width, '#ffd98a');
      renderer.addHitTarget(
        { x: buttonX, y: buttonY, width, height: presetHeight },
        { type: 'selectTalentPolicyBase', policyId: policy.id, resetTiers: true, disabled: policy.disabled },
      );
    });
    return cursorY + Math.ceil(presets.length / 2) * (presetHeight + presetGap) + 10;
  }

  function drawCornerTag(renderer, label, x, y, width, color) {
    renderer.drawText(label, x + width - 18, y + 8, {
      size: 9,
      bold: true,
      color,
      align: 'center',
      baseline: 'middle',
    });
  }

  function renderSavedPolicies(renderer, view, innerX, cursorY, innerWidth) {
    const customPolicies = view.customPolicies || [];
    renderer.drawText('已保存', innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
    cursorY += 20;
    if (!customPolicies.length) {
      renderer.drawPanel(innerX, cursorY, innerWidth, 34, {
        fill: 'rgba(23, 18, 13, 0.38)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 8,
      });
      renderer.drawText(view.text.emptyCustom, innerX + 12, cursorY + 17, {
        size: 12,
        color: '#aeb0b8',
        baseline: 'middle',
      });
      return cursorY + 44;
    }
    customPolicies.slice(0, 2).forEach((policy) => {
      const rowHeight = 36;
      const applyWidth = 54;
      const deleteWidth = 44;
      const applyX = innerX + innerWidth - applyWidth - deleteWidth - 8;
      const deleteX = innerX + innerWidth - deleteWidth;
      renderer.drawPanel(innerX, cursorY, innerWidth, rowHeight, {
        fill: policy.active ? 'rgba(64, 49, 27, 0.82)' : 'rgba(27, 22, 17, 0.72)',
        stroke: policy.active ? 'rgba(247, 215, 116, 0.42)' : 'rgba(255, 226, 177, 0.12)',
        radius: 8,
      });
      renderer.drawText(renderer.truncateText(policy.label, applyX - innerX - 18, { size: 12, bold: true }), innerX + 10, cursorY + 18, {
        size: 12,
        bold: true,
        color: policy.active ? '#ffd98a' : '#fff1cf',
        baseline: 'middle',
      });
      renderer.drawButton(applyX, cursorY + 5, applyWidth, 26, '应用', { size: 11, active: !policy.active, radius: 7 });
      renderer.drawButton(deleteX, cursorY + 5, deleteWidth, 26, '删', { size: 11, radius: 7 });
      renderer.addHitTarget({ x: applyX, y: cursorY + 5, width: applyWidth, height: 26 }, { type: 'applyTalentPolicy', policyId: policy.id });
      renderer.addHitTarget({ x: deleteX, y: cursorY + 5, width: deleteWidth, height: 26 }, { type: 'deleteTalentPolicy', policyId: policy.id });
      cursorY += rowHeight + 8;
    });
    return cursorY;
  }

  function renderCustomDraft(renderer, view, innerX, cursorY, innerWidth, draftBottom) {
    const actionHeight = 34;
    const actionY = draftBottom - actionHeight;
    const tuningBottom = actionY - 10;
    renderer.drawText(view.text.customTitle, innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
    renderer.drawText(renderer.truncateText(view.text.customName, innerWidth - 104, { size: 12, bold: true }), innerX + 92, cursorY + 1, {
      size: 12,
      bold: true,
      color: '#74d3a0',
    });
    cursorY += 24;
    cursorY = renderTendencyTiers(renderer, view, innerX, cursorY, innerWidth, tuningBottom);
    renderBaseDraftButtons(renderer, view, innerX, cursorY, innerWidth, tuningBottom);

    const applyWidth = Math.floor((innerWidth - 8) / 2);
    renderer.drawPrimaryActionButton(innerX, actionY, applyWidth, actionHeight, view.text.applyDraft, { radius: 8 });
    renderer.drawButton(innerX + applyWidth + 8, actionY, innerWidth - applyWidth - 8, actionHeight, view.text.saveDraft, {
      size: 12,
      bold: true,
      active: true,
      radius: 8,
    });
    renderer.addHitTarget({ x: innerX, y: actionY, width: applyWidth, height: actionHeight }, { type: 'confirmTalentPolicy' });
    renderer.addHitTarget({ x: innerX + applyWidth + 8, y: actionY, width: innerWidth - applyWidth - 8, height: actionHeight }, { type: 'saveTalentPolicyDraft' });
  }

  function renderTendencyTiers(renderer, view, innerX, cursorY, innerWidth, tuningBottom) {
    const tierRowHeight = 30;
    (view.tendencies || []).slice(0, 3).forEach((tendency) => {
      if (cursorY + tierRowHeight > tuningBottom) return;
      renderer.drawText(tendency.label, innerX + 2, cursorY + 15, {
        size: 12,
        bold: true,
        color: tendency.disabled ? '#8d8f99' : '#fff1cf',
        baseline: 'middle',
      });
      const tierButtonWidth = 44;
      const tierGap = 5;
      [1, 2, 3].forEach((tier, index) => {
        const tierX = innerX + innerWidth - (3 - index) * tierButtonWidth - (2 - index) * tierGap;
        const active = Number(tendency.tier) === tier;
        const label = { 1: '低', 2: '稳', 3: '高' }[tier];
        renderer.drawButton(tierX, cursorY, tierButtonWidth, tierRowHeight, label, {
          disabled: tendency.disabled,
          active,
          size: 11,
          bold: active,
          radius: 7,
        });
        renderer.addHitTarget(
          { x: tierX, y: cursorY, width: tierButtonWidth, height: tierRowHeight },
          { type: 'setTalentPolicyTier', tendency: tendency.id, tier, disabled: tendency.disabled },
        );
      });
      cursorY += tierRowHeight + 7;
    });
    return cursorY;
  }

  function renderBaseDraftButtons(renderer, view, innerX, cursorY, innerWidth, tuningBottom) {
    const basePolicies = (view.systemPolicies || []).slice(0, 4);
    const baseButtonHeight = 24;
    if (!basePolicies.length || cursorY + baseButtonHeight + 6 > tuningBottom) return;
    renderer.drawText('底稿', innerX + 2, cursorY + 12, {
      size: 11,
      bold: true,
      color: '#cbbd96',
      baseline: 'middle',
    });
    const availableWidth = innerWidth - 42;
    const baseGap = 4;
    const baseWidth = Math.max(50, Math.floor((availableWidth - baseGap * (basePolicies.length - 1)) / basePolicies.length));
    basePolicies.forEach((policy, index) => {
      const buttonX = innerX + 42 + index * (baseWidth + baseGap);
      const buttonWidth = index === basePolicies.length - 1 ? innerX + innerWidth - buttonX : baseWidth;
      const active = policy.id === view.draft?.basePolicyId;
      renderer.drawButton(buttonX, cursorY, buttonWidth, baseButtonHeight, renderer.truncateText(policy.label, buttonWidth - 8, { size: 10, bold: active }), {
        disabled: policy.disabled,
        active,
        size: 10,
        bold: active,
        radius: 7,
      });
      renderer.addHitTarget(
        { x: buttonX, y: cursorY, width: buttonWidth, height: baseButtonHeight },
        { type: 'selectTalentPolicyBase', policyId: policy.id, disabled: policy.disabled },
      );
    });
  }

  const api = { renderTalentPolicyPanel };

  global.TalentPolicyCanvasRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

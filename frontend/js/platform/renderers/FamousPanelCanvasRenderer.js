(function (global) {
  const FamousSkillCanvasRenderer = global.FamousSkillCanvasRenderer || (typeof require !== 'undefined' ? require('./FamousSkillCanvasRenderer') : null);

  function drawFamousAvatarCard(renderer, card = {}, x, y, width, height, options = {}) {
    const style = renderer.getFamousQualityStyle(card.qualityFrame);
    const selected = Boolean(options.selected);
    renderer.drawPanel(x - 2, y - 2, width + 4, height + 4, {
      fill: selected ? style.glow : 'rgba(0, 0, 0, 0.18)',
      stroke: selected ? style.stroke : 'rgba(255, 255, 255, 0.06)',
      radius: 10,
    });
    renderer.drawPanel(x, y, width, height, {
      fill: style.fill,
      stroke: style.stroke,
      radius: 9,
      inset: style.inset,
    });
    const portraitSize = Math.min(width - 14, height - 42);
    const portraitX = x + (width - portraitSize) / 2;
    const portraitY = y + 7;
    const portraitDrawn = renderer.drawFamousPortrait(card, portraitX, portraitY, portraitSize, {
      radius: 8,
      scale: 1.84,
      offsetY: 0.12,
      fill: 'rgba(23, 20, 17, 0.8)',
      stroke: style.stroke,
    });
    if (!portraitDrawn) {
      renderer.drawText(String(card.name || renderer.t?.('famous.unknownInitial', {}) || '名').slice(0, 1), x + width / 2, portraitY + portraitSize / 2, {
        size: 18,
        bold: true,
        color: style.text,
        baseline: 'middle',
        align: 'center',
      });
    }
    const badgeText = card.qualityLabel || '';
    if (badgeText) {
      const badgeW = Math.min(width - 16, Math.max(34, badgeText.length * 12 + 12));
      renderer.drawPanel(x + 6, y + 6, badgeW, 18, {
        fill: 'rgba(15, 14, 12, 0.7)',
        stroke: style.stroke,
        radius: 6,
      });
      renderer.drawText(badgeText, x + 6 + badgeW / 2, y + 15, {
        size: 9,
        bold: true,
        color: style.text,
        baseline: 'middle',
        align: 'center',
      });
    }
    const freePoints = Number(card.freeAttributePoints) || 0;
    if (freePoints > 0) {
      const dotSize = 22;
      renderer.drawPanel(x + width - dotSize - 4, y + 4, dotSize, dotSize, {
        fill: '#e94560',
        stroke: 'rgba(255, 255, 255, 0.24)',
        radius: 11,
      });
      renderer.drawText(String(Math.min(99, freePoints)), x + width - dotSize / 2 - 4, y + 15, {
        size: 10,
        bold: true,
        color: '#fff',
        baseline: 'middle',
        align: 'center',
      });
    }
    renderer.drawText(renderer.truncateText(card.name || renderer.t?.('famous.unknown', {}) || '无名之士', width - 10, { size: 11, bold: true }), x + width / 2, y + height - 28, {
      size: 11,
      bold: true,
      color: '#fff1cf',
      align: 'center',
    });
    renderer.drawText(`Lv.${card.level || 1}`, x + width / 2, y + height - 12, {
      size: 9,
      color: freePoints > 0 ? '#f4c86d' : 'rgba(234, 234, 234, 0.62)',
      align: 'center',
    });
    renderer.addHitTarget(
      { x, y, width, height },
      card.openDetailAction || { type: 'openFamousPersonDetail', personId: card.id || '' },
    );
  }

  function renderFamousRosterGrid(renderer, people = [], x, y, width, maxBottom, page = 0) {
    if (!Array.isArray(people) || !people.length) return { nextY: y, pageInfo: { index: 0, pages: 1 } };
    const gap = 8;
    const columns = width >= 330 ? 3 : 2;
    const cardWidth = Math.floor((width - gap * (columns - 1)) / columns);
    const cardHeight = 118;
    const rowHeight = cardHeight + gap;
    const pagerReserve = people.length > columns * 2 ? 34 : 0;
    const availableHeight = Math.max(rowHeight, maxBottom - y - pagerReserve);
    const rows = Math.max(1, Math.floor(availableHeight / rowHeight));
    const pageSize = Math.max(columns, columns * rows);
    const pageInfo = renderer.normalizeFamousPersonsPage(people.length, page, pageSize);
    people.slice(pageInfo.index * pageSize, pageInfo.index * pageSize + pageSize).forEach((card, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cardX = x + col * (cardWidth + gap);
      const cardY = y + row * rowHeight;
      renderer.drawFamousAvatarCard(card, cardX, cardY, cardWidth, cardHeight);
    });
    const usedRows = Math.ceil(Math.min(pageSize, people.length - pageInfo.index * pageSize) / columns);
    return {
      nextY: y + usedRows * rowHeight,
      pageInfo,
    };
  }

  function renderFamousPersonDetail(renderer, card = {}, x, y, width, height) {
    const style = renderer.getFamousQualityStyle(card.qualityFrame);
    const headerH = 144;
    renderer.drawPanel(x, y, width, height, {
      fill: 'rgba(23, 21, 18, 0.74)',
      stroke: style.stroke,
      radius: 10,
      inset: style.inset,
    });
    const portraitW = 96;
    const portraitH = 116;
    const portraitX = x + 12;
    const portraitY = y + 10;
    renderer.drawPanel(portraitX, portraitY, portraitW, portraitH, {
      fill: style.fill,
      stroke: style.stroke,
      radius: 10,
      inset: style.inset,
    });
    renderer.drawFamousPortrait(card, portraitX, portraitY, Math.min(portraitW, portraitH), {
      radius: 10,
      scale: 1.75,
      offsetY: 0.12,
      frameWidth: portraitW,
      frameHeight: portraitH,
      fill: style.fill,
      stroke: style.stroke,
    });
    const textX = portraitX + portraitW + 12;
    const textWidth = width - portraitW - 38;
    renderer.drawText(renderer.truncateText(card.name || renderer.t?.('famous.unknown', {}) || '无名之士', textWidth, { size: 18, bold: true }), textX, y + 15, {
      size: 18,
      bold: true,
      color: '#fff1cf',
    });
    renderer.drawText(renderer.truncateText(card.title || renderer.t?.('famous.genericTitle', {}) || '名人', textWidth, { size: 11 }), textX, y + 41, {
      size: 11,
      color: '#cbbd96',
    });
    renderer.drawText(renderer.t?.(
      'famous.detailMeta',
      {
        quality: card.qualityLabel || renderer.t?.('famous.quality.common', {}) || '一般',
        role: card.roleText || renderer.t?.('famous.genericRole', {}) || '人才',
        status: card.statusText || renderer.t?.('famous.status.idle', {}) || '待命',
      }) || `${card.qualityLabel || '一般'} · ${card.roleText || '人才'} · ${card.statusText || '待命'}`, textX, y + 61, {
      size: 10,
      color: style.text,
    });
    renderer.drawText(card.growthText || renderer.t?.('famous.growth.level', { level: card.level || 1 }) || `等级 ${card.level || 1}`, textX, y + 82, {
      size: 11,
      color: '#f4c86d',
    });
    renderer.drawText(card.pointText || renderer.t?.('famous.pointText', { points: 0 }) || '可分配属性点 0', textX, y + 101, {
      size: 11,
      bold: true,
      color: Number(card.freeAttributePoints) > 0 ? '#f4c86d' : 'rgba(234, 234, 234, 0.62)',
    });
    if (card.attributePointHint) {
      renderer.drawText(renderer.truncateText(card.attributePointHint, textWidth, { size: 10 }), textX, y + 118, {
        size: 10,
        color: Number(card.freeAttributePoints) > 0 ? '#ffd98a' : '#aeb0b8',
      });
    }
    if (card.autoGrowthText) {
      renderer.drawText(renderer.truncateText(card.autoGrowthText, textWidth, { size: 10 }), textX, y + 136, {
        size: 10,
        color: '#74d3a0',
      });
    }

    const radarSize = 118;
    const radarX = x + width - radarSize - 14;
    const radarY = y + headerH + 12;
    renderer.drawFamousAttributeRadar(card.attributes || [], radarX, radarY, radarSize);
    const attrX = x + 14;
    const attrY = y + headerH + 14;
    const attrWidth = Math.max(150, radarX - attrX - 12);
    renderer.drawText(renderer.t?.('famous.attribute.title', {}) || '六维', attrX, attrY - 2, { size: 13, bold: true, color: '#ffe6b5' });
    const controlsHeight = renderer.drawFamousAttributePointControls(card, attrX, attrY + 18, attrWidth);
    if (!controlsHeight) renderReadOnlyAttributes(renderer, card, attrX, attrY, attrWidth);

    const skillY = Math.min(y + height - 92, y + headerH + 150);
    renderer.drawText(renderer.t?.('famous.skill.title', {}) || '技能', x + 14, skillY, { size: 13, bold: true, color: '#ffe6b5' });
    renderer.renderSkillBadges(card, x + 14, skillY + 20, width - 28, {
      cardId: card.id || '',
      badgeHeight: 24,
      rowGap: 6,
      detail: true,
    });
  }

  function renderReadOnlyAttributes(renderer, card, attrX, attrY, attrWidth) {
    const rowGap = 6;
    const rowH = 22;
    const colW = Math.floor((attrWidth - 8) / 2);
    (card.attributes || []).forEach((attr, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const itemX = attrX + col * (colW + 8);
      const itemY = attrY + 18 + row * (rowH + rowGap);
      renderer.drawPanel(itemX, itemY, colW, rowH, {
        fill: 'rgba(31, 52, 41, 0.42)',
        stroke: 'rgba(116, 211, 160, 0.16)',
        radius: 6,
      });
      renderer.drawText(`${attr.label || ''} ${Math.floor(Number(attr.value) || 0)}`, itemX + 7, itemY + rowH / 2, {
        size: 10,
        color: '#d8e8d5',
        baseline: 'middle',
      });
    });
  }

  function renderFamousPersonItem(renderer, card = {}, x, y, width, options = {}) {
    const candidate = Boolean(options.candidate);
    const hasAttributeControls = !candidate && Number(card.freeAttributePoints) > 0 && Array.isArray(card.attributeActions) && card.attributeActions.length > 0;
    const height = candidate ? 136 : (hasAttributeControls ? 204 : (card.pointText ? 136 : 124));
    renderer.drawPanel(x, y, width, height, {
      fill: candidate ? 'rgba(52, 39, 27, 0.86)' : 'rgba(27, 23, 18, 0.74)',
      stroke: candidate ? 'rgba(240, 180, 91, 0.34)' : 'rgba(255, 226, 177, 0.12)',
      radius: 8,
      inset: candidate ? 'rgba(255, 231, 184, 0.08)' : 'rgba(255, 231, 184, 0.04)',
    });
    const portraitWidth = 74;
    const portraitHeight = 98;
    const portraitX = x + 10;
    const portraitY = y + 10;
    renderer.drawPanel(portraitX, portraitY, portraitWidth, portraitHeight, {
      fill: 'rgba(44, 32, 23, 0.94)',
      stroke: 'rgba(240, 180, 91, 0.32)',
      radius: 10,
      inset: 'rgba(255, 231, 184, 0.1)',
    });
    const portraitDrawn = renderer.drawFamousPortrait(card, portraitX, portraitY, Math.min(portraitWidth, portraitHeight), {
      radius: 10,
      scale: 1.74,
      offsetY: 0.14,
      fill: 'rgba(44, 32, 23, 0.94)',
      stroke: 'rgba(240, 180, 91, 0.32)',
      frameWidth: portraitWidth,
      frameHeight: portraitHeight,
    });
    if (!portraitDrawn) {
      renderer.drawText(String(card.name || renderer.t?.('famous.unknownInitial', {}) || '名').slice(0, 1), portraitX + portraitWidth / 2, portraitY + portraitHeight / 2, {
        size: 18,
        bold: true,
        color: '#ffe6b5',
        baseline: 'middle',
        align: 'center',
      });
    }
    const textX = x + 96;
    const buttonW = candidate ? 58 : 0;
    const actionPad = candidate ? buttonW + 20 : 0;
    const radarSize = Math.min(92, Math.max(74, width * 0.24));
    const radarX = x + width - radarSize - 10 - actionPad;
    const radarY = y + (height - radarSize) / 2 + (candidate ? -3 : 0);
    const textWidth = Math.max(112, radarX - textX - 10);
    renderer.drawText(renderer.truncateText(card.name || renderer.t?.('famous.unknown', {}) || '无名之士', textWidth, { size: 15, bold: true }), textX, y + 13, {
      size: 15,
      bold: true,
      color: '#fff1cf',
    });
    renderer.drawText(renderer.truncateText(card.title || renderer.t?.('famous.genericTitle', {}) || '名人', textWidth, { size: 10 }), textX, y + 35, {
      size: 10,
      color: '#cbbd96',
    });
    if (!candidate && card.growthText) {
      const growthColor = card.pointText ? '#f4c86d' : 'rgba(234, 234, 234, 0.64)';
      renderer.drawText(renderer.truncateText(card.growthText, textWidth, { size: 10 }), textX, y + 48, {
        size: 10,
        color: growthColor,
      });
      if (card.pointText) {
        renderer.drawText(renderer.truncateText(card.pointText, textWidth, { size: 10, bold: true }), textX, y + 61, {
          size: 10,
          bold: true,
          color: '#f4c86d',
        });
      }
    }
    renderer.drawFamousAttributeRadar(card.attributes || [], radarX, radarY, radarSize);
    const attributeControlHeight = hasAttributeControls ? renderer.drawFamousAttributePointControls(card, textX, y + 78, textWidth) : 0;
    const badgeStartY = y + (candidate ? 58 : hasAttributeControls ? 86 + attributeControlHeight : (card.pointText ? 76 : 64));
    renderer.renderSkillBadges(card, textX, badgeStartY, textWidth, {
      cardId: card.id || '',
      badgeHeight: 22,
      rowGap: 5,
    });
    if (candidate) {
      const acceptX = x + width - buttonW - 10;
      renderer.drawButton(acceptX, y + 30, buttonW, 28, renderer.t?.('famous.action.accept', {}) || '接纳', { size: 12, bold: true, active: true, radius: 8 });
      renderer.drawButton(acceptX, y + 70, buttonW, 28, renderer.t?.('famous.action.dismiss', {}) || '放弃', { size: 12, radius: 8 });
      renderer.addHitTarget({ x: acceptX, y: y + 30, width: buttonW, height: 28 }, card.acceptAction);
      renderer.addHitTarget({ x: acceptX, y: y + 70, width: buttonW, height: 28 }, card.dismissAction);
    }
    return y + height + 10;
  }

  function renderFamousPersonsPager(renderer, x, y, width, page, pages) {
    if (pages <= 1) return;
    const buttonW = 64;
    const buttonH = 24;
    const prevX = x;
    const nextX = x + width - buttonW;
    const canPrev = page > 0;
    const canNext = page < pages - 1;
    renderer.drawButton(prevX, y, buttonW, buttonH, renderer.t?.('common.previousPage', {}) || '上一页', { disabled: !canPrev, size: 11, radius: 7 });
    renderer.drawText(`${page + 1}/${pages}`, x + width / 2, y + buttonH / 2, {
      size: 11,
      bold: true,
      color: '#ffe6b5',
      baseline: 'middle',
      align: 'center',
    });
    renderer.drawButton(nextX, y, buttonW, buttonH, renderer.t?.('common.nextPage', {}) || '下一页', { disabled: !canNext, size: 11, radius: 7 });
    renderer.addHitTarget({ x: prevX, y, width: buttonW, height: buttonH }, { type: 'changeFamousPersonsPage', delta: -1, disabled: !canPrev });
    renderer.addHitTarget({ x: nextX, y, width: buttonW, height: buttonH }, { type: 'changeFamousPersonsPage', delta: 1, disabled: !canNext });
  }

  function renderFamousPersonsPanel(renderer, state = {}, options = {}) {
    if (!renderer.presenter || typeof renderer.presenter.buildFamousPersonViewState !== 'function') return;
    const view = renderer.presenter.buildFamousPersonViewState(state, {
      selectedPersonId: options.selectedFamousPersonId,
    });
    const layout = renderer.getLayout();
    const panelWidth = Math.min(390, layout.contentWidth - 6);
    const panelHeight = Math.min(620, Math.max(470, renderer.height - 112));
    const x = (renderer.width - panelWidth) / 2;
    const y = Math.max(48, (renderer.height - panelHeight) / 2 - 8);
    const selectedPerson = view.selectedPerson || null;

    renderer.addHitTarget({ x: 0, y: 0, width: renderer.width, height: renderer.height }, { type: 'closeFamousPersons' });
    if (renderer.ctx) {
      renderer.ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
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
    renderer.addHitTarget(
      { x, y, width: panelWidth, height: panelHeight },
      renderer.pinnedFamousSkillTooltip ? { type: 'clearFamousSkillTooltip' } : { type: 'blockCanvasModal' },
    );

    const backW = 58;
    renderer.drawButton(x + 12, y + 12, backW, 30, renderer.t?.('common.back', {}) || '返回', { size: 12, radius: 8 });
    renderer.addHitTarget(
      { x: x + 12, y: y + 12, width: backW, height: 30 },
      selectedPerson ? { type: 'closeFamousPersonDetail' } : { type: 'closeFamousPersons' },
    );
    renderer.drawText(view.title || renderer.t?.('famous.title', {}) || '名人', x + panelWidth / 2, y + 18, {
      size: 18,
      bold: true,
      color: '#ffe6b5',
      align: 'center',
    });
    renderer.drawText(renderer.truncateText(view.subtitle || '', panelWidth - 32, { size: 11 }), x + panelWidth / 2, y + 46, {
      size: 11,
      color: '#cbbd96',
      align: 'center',
    });

    const innerX = x + 14;
    const innerWidth = panelWidth - 28;
    let cursorY = y + 72;

    if (selectedPerson) {
      renderer.renderFamousPersonDetail(selectedPerson, innerX, cursorY, innerWidth, y + panelHeight - 90 - cursorY);
      FamousSkillCanvasRenderer.syncVisibleFamousSkillTooltip(renderer);
      return;
    }

    renderer.drawPanel(innerX, cursorY, innerWidth, 58, {
      fill: 'rgba(24, 22, 17, 0.62)',
      stroke: 'rgba(240, 180, 91, 0.2)',
      radius: 9,
    });
    renderer.drawText(renderer.t?.(
      'famous.summary',
      { peopleCount: view.peopleCount, candidateCount: view.candidateCount, maxCandidates: view.maxCandidates }) || `已加入 ${view.peopleCount} 位 · 候选 ${view.candidateCount}/${view.maxCandidates}`, innerX + 12, cursorY + 10, {
      size: 12,
      bold: true,
      color: '#ffd98a',
    });
    renderer.drawText(renderer.truncateText(view.seek.message || '', innerWidth - 104, { size: 10 }), innerX + 12, cursorY + 33, {
      size: 10,
      color: '#aeb0b8',
    });
    const seekW = 82;
    const seekX = innerX + innerWidth - seekW - 10;
    renderer.drawButton(seekX, cursorY + 14, seekW, 30, view.seek.text || renderer.t?.('famous.seek.available', {}) || '寻访', {
      disabled: !view.seek.available,
      active: view.seek.available,
      size: 12,
      bold: true,
      radius: 8,
    });
    renderer.addHitTarget({ x: seekX, y: cursorY + 14, width: seekW, height: 30 }, view.seek.action);
    cursorY += 72;

    const candidates = Array.isArray(view.candidates) ? view.candidates : [];
    if (candidates.length) {
      renderer.drawText(renderer.t?.('famous.section.candidates', {}) || '候选', innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
      cursorY += 22;
      candidates.slice(0, 2).forEach((card) => {
        if (cursorY + 158 > y + panelHeight - 94) return;
        cursorY = renderer.renderFamousPersonItem(card, innerX, cursorY, innerWidth, { candidate: true });
      });
    }

    const people = Array.isArray(view.people) ? view.people : [];
    renderer.drawText(renderer.t?.('famous.section.joined', {}) || '已加入', innerX, cursorY, { size: 13, bold: true, color: '#ffe6b5' });
    cursorY += 22;
    if (!people.length) {
      renderer.drawPanel(innerX, cursorY, innerWidth, 78, {
        fill: 'rgba(27, 23, 18, 0.6)',
        stroke: 'rgba(255, 226, 177, 0.1)',
        radius: 9,
      });
      renderer.drawTextLines(renderer.wrapTextLimit(view.emptyText || '', innerWidth - 28, 2, { size: 12 }), innerX + 14, cursorY + 18, {
        size: 12,
        color: '#aeb0b8',
        lineHeight: 17,
      });
    } else {
      const grid = renderer.renderFamousRosterGrid(
        people,
        innerX,
        cursorY,
        innerWidth,
        y + panelHeight - 52,
        options.famousPersonsPage,
      );
      const pageInfo = grid.pageInfo;
      if (pageInfo.pages > 1) renderer.renderFamousPersonsPager(innerX, y + panelHeight - 42, innerWidth, pageInfo.index, pageInfo.pages);
    }
    FamousSkillCanvasRenderer.syncVisibleFamousSkillTooltip(renderer);
  }

  const api = {
    drawFamousAvatarCard,
    renderFamousRosterGrid,
    renderFamousPersonDetail,
    renderFamousPersonItem,
    renderFamousPersonsPager,
    renderFamousPersonsPanel,
  };

  global.FamousPanelCanvasRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

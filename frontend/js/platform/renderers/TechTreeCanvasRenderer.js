(function (global) {
  function renderTechTreePanel(renderer, view = {}, treePanel = {}, options = {}) {
    const tree = view.tree || {};
    const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
    const treeX = Number(treePanel.x) || 0;
    const treeTop = Number(treePanel.y) || 0;
    const treeWidth = Number(treePanel.width) || 0;
    const treeHeight = Number(treePanel.height) || 0;
    const treeBottom = treeTop + treeHeight;
    let renderedCards = 0;

    if (!nodes.length || treeWidth <= 0) return { renderedCards };

    const layoutInfo = renderer.getTechTreeLayout(view, treePanel, options);
    const {
      eraPositions,
      nodeRects,
      panX,
      minPanX,
      maxPanX,
      panY,
      minPanY,
      maxPanY,
      minContentY,
      maxContentY,
      contentLeft,
      contentRight,
      scaledContentWidth,
      scaledContentHeight,
      zoom,
      routeGuides,
      linkPaths,
      eraRailWidth,
      eraRailX,
    } = layoutInfo;

    renderer.lastTechTreeScroll = {
      maxPanY,
      minPanY,
      minPanX,
      maxPanX,
      panX,
      panY,
      zoom,
      panel: treePanel,
    };

    const toScreenRect = (rect = {}) => ({
      x: treeX + panX + (rect.x - treeX) * zoom,
      y: treeTop + panY + (rect.y - treeTop) * zoom,
      width: rect.width * zoom,
      height: rect.height * zoom,
    });
    const toScreenY = (value) => treeTop + panY + (value - treeTop) * zoom;

    renderer.withTransformedClip(treeX, treeTop, treeWidth, treeHeight, panX, panY, zoom, () => {
      eraPositions.forEach((era) => {
        renderer.drawPanel(contentLeft, era.top, Math.max(80, contentRight - contentLeft), era.bottom - era.top, {
          fill: era.closed ? 'rgba(42, 60, 43, 0.28)' : 'rgba(56, 44, 32, 0.28)',
          stroke: 'rgba(255, 226, 177, 0.08)',
          radius: 4,
        });
        renderer.drawLine(contentLeft, era.top, contentRight, era.top, {
          color: 'rgba(255, 226, 177, 0.16)',
          width: 1,
        });
      });

      routeGuides.forEach((route) => {
        renderer.drawLine(route.x, minContentY, route.x, maxContentY, {
          color: `${route.color}44`,
          width: 2,
        });
        renderer.drawText(renderer.truncateText(route.label, 54, { size: 10, bold: true }), route.x, minContentY + 8, {
          size: 10,
          bold: true,
          color: route.color,
          align: 'center',
        });
      });

      linkPaths.forEach((link) => {
        renderer.drawCurvePath(link.curve, {
          color: link.researched || link.active ? `${link.color}cc` : (link.locked ? 'rgba(174, 176, 184, 0.18)' : `${link.color}66`),
          width: link.researched || link.active ? 3 : 2,
        });
      });

      nodes.forEach((node) => {
        const rect = nodeRects[node.id];
        if (!rect) return;
        renderer.renderTechNode(node, rect, { selected: node.id === view.selectedTechId });
        const screenRect = toScreenRect(rect);
        if (screenRect.y + screenRect.height < treeTop || screenRect.y > treeBottom) return;
        if (screenRect.x + screenRect.width < treeX || screenRect.x > treeX + treeWidth) return;
        renderer.addHitTarget(screenRect, {
          type: 'selectTechNode',
          techId: node.id,
          dragType: 'techTreeDrag',
        });
        renderedCards += 1;
      });
    });

    renderer.withTranslatedClip(treeX, treeTop, treeWidth, treeHeight, 0, 0, () => {
      eraPositions.forEach((era) => {
        const eraTopScreen = toScreenY(era.top + 10);
        const eraBottomScreen = toScreenY(era.bottom - 10);
        const eraYScreen = toScreenY(era.y);
        renderer.drawPanel(eraRailX, eraTopScreen, eraRailWidth, Math.max(28, eraBottomScreen - eraTopScreen), {
          fill: 'rgba(70, 72, 74, 0.84)',
          stroke: 'rgba(255, 226, 177, 0.16)',
          radius: 7,
        });
        renderer.drawText(renderer.truncateText(era.name || `时代 ${era.era}`, eraRailWidth - 10, { size: 11, bold: true }), eraRailX + eraRailWidth / 2, eraYScreen - 18, {
          size: 11,
          bold: true,
          color: era.closed ? '#74d3a0' : '#f0b45b',
          align: 'center',
        });
        renderer.drawText(renderer.truncateText(era.choiceText || '', eraRailWidth - 12, { size: 9 }), eraRailX + eraRailWidth / 2, eraYScreen + 2, {
          size: 9,
          color: 'rgba(234, 234, 234, 0.64)',
          align: 'center',
        });
      });
    });

    renderer.addHitTarget(treePanel, { type: 'techTreeDrag', background: true });
    renderHorizontalScrollbar(renderer, {
      treeX,
      treeWidth,
      treeBottom,
      scaledContentWidth,
      panX,
      minPanX,
      maxPanX,
    });
    renderVerticalScrollbar(renderer, {
      treeX,
      treeTop,
      treeWidth,
      treeHeight,
      scaledContentHeight,
      panY,
      minPanY,
      maxPanY,
    });

    return { renderedCards, layoutInfo };
  }

  function renderHorizontalScrollbar(renderer, context = {}) {
    const {
      treeX,
      treeWidth,
      treeBottom,
      scaledContentWidth,
      panX,
      minPanX,
      maxPanX,
    } = context;
    if (!(minPanX < maxPanX)) return;
    const trackY = treeBottom - 6;
    const contentWidth = Math.max(treeWidth, scaledContentWidth);
    const thumbW = Math.max(34, treeWidth * (treeWidth / Math.max(treeWidth, contentWidth)));
    const thumbX = treeX + (treeWidth - thumbW) * ((panX - minPanX) / Math.max(1, maxPanX - minPanX));
    renderer.drawPanel(treeX + 4, trackY, treeWidth - 8, 4, {
      fill: 'rgba(255, 226, 177, 0.08)',
      stroke: 'rgba(255, 226, 177, 0.08)',
      radius: 2,
    });
    renderer.drawPanel(thumbX, trackY - 1, thumbW, 6, {
      fill: 'rgba(240, 180, 91, 0.48)',
      stroke: 'rgba(255, 226, 177, 0.18)',
      radius: 3,
    });
  }

  function renderVerticalScrollbar(renderer, context = {}) {
    const {
      treeX,
      treeTop,
      treeWidth,
      treeHeight,
      scaledContentHeight,
      panY,
      minPanY,
      maxPanY,
    } = context;
    if (!(minPanY < maxPanY)) return;
    const trackX = treeX + treeWidth - 6;
    const contentHeight = Math.max(treeHeight, scaledContentHeight);
    const thumbH = Math.max(28, treeHeight * (treeHeight / Math.max(treeHeight, contentHeight)));
    const thumbY = treeTop + (treeHeight - thumbH) * ((panY - minPanY) / Math.max(1, maxPanY - minPanY));
    renderer.drawPanel(trackX, treeTop + 4, 4, treeHeight - 8, {
      fill: 'rgba(255, 226, 177, 0.08)',
      stroke: 'rgba(255, 226, 177, 0.08)',
      radius: 2,
    });
    renderer.drawPanel(trackX - 1, thumbY, 6, thumbH, {
      fill: 'rgba(240, 180, 91, 0.6)',
      stroke: 'rgba(255, 226, 177, 0.22)',
      radius: 3,
    });
  }

  function renderEmptyTechTree(renderer, view = {}, context = {}) {
    const { x = 0, width = 0, panelY = 0, panelH = 0 } = context;
    const centerY = panelY + Math.max(66, panelH / 2 + 6);
    renderer.drawAsset('assets/art/icon-science-cutout.webp', x + width / 2 - 34, centerY - 52, 68, 68, 0.62);
    renderer.drawText(view.text?.placeholder || '暂无科技', x + width / 2, centerY + 24, {
      size: 15,
      bold: true,
      color: '#cbbd96',
      align: 'center',
    });
    renderer.drawText(view.text?.subtitle || '', x + width / 2, centerY + 48, {
      size: 11,
      color: 'rgba(234, 234, 234, 0.58)',
      align: 'center',
    });
  }

  const api = {
    renderTechTreePanel,
    renderEmptyTechTree,
  };

  global.TechTreeCanvasRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

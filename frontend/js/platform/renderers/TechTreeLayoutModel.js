(function (global) {
  const DEFAULT_ROUTE_CATALOG = Object.freeze({
    agriculture: Object.freeze({ lane: -4, label: '\u519c\u4e1a', color: '#5fcb6b', icon: 'assets/art/tech-agriculture-cutout.png' }),
    livelihood: Object.freeze({ lane: -3, label: '\u6c11\u751f', color: '#d9b35d', icon: 'assets/art/tech-livelihood-cutout.png' }),
    administration: Object.freeze({ lane: -2, label: '\u79e9\u5e8f', color: '#c9a47a', icon: 'assets/art/tech-administration-cutout.png' }),
    knowledge: Object.freeze({ lane: -1, label: '\u77e5\u8bc6', color: '#57a6ff', icon: 'assets/art/tech-knowledge-cutout.png' }),
    culture: Object.freeze({ lane: 0, label: '\u6587\u5316', color: '#b48cff', icon: 'assets/art/tech-culture-cutout.png' }),
    engineering: Object.freeze({ lane: 1, label: '\u5de5\u7a0b', color: '#83c8d9', icon: 'assets/art/tech-engineering-cutout.png' }),
    industry: Object.freeze({ lane: 2, label: '\u5de5\u4e1a', color: '#d9904f', icon: 'assets/art/tech-industry-cutout.png' }),
    exploration: Object.freeze({ lane: 3, label: '\u63a2\u7d22', color: '#62c9a7', icon: 'assets/art/tech-exploration-cutout.png' }),
    trade: Object.freeze({ lane: 4, label: '\u8d38\u6613', color: '#d5c46a', icon: 'assets/art/tech-trade-cutout.png' }),
    military: Object.freeze({ lane: 5, label: '\u519b\u4e8b', color: '#e35d5d', icon: 'assets/art/tech-military-cutout.png' }),
  });

  function getTechRouteCatalog() {
    return Object.fromEntries(
      Object.entries(DEFAULT_ROUTE_CATALOG).map(([route, meta]) => [route, { ...meta }]),
    );
  }

  function getTechRouteMeta(route, catalog = DEFAULT_ROUTE_CATALOG) {
    if (route && catalog[route]) return catalog[route];
    return { lane: 0, label: route || '\u8def\u7ebf', color: '#f0b45b', icon: 'assets/art/icon-science-cutout.webp' };
  }

  function getTechNodeRoutes(node = {}) {
    const treeRoutes = Array.isArray(node.tree?.routes) ? node.tree.routes : [];
    const routes = treeRoutes.length ? treeRoutes : (node.route ? [node.route] : []);
    return Array.from(new Set(routes.filter(Boolean)));
  }

  function getTechNodeRouteLabel(node = {}, catalog = DEFAULT_ROUTE_CATALOG) {
    const routes = getTechNodeRoutes(node);
    if (!routes.length) return node.routeLabel || '\u8def\u7ebf';
    if (routes.length === 1) return node.routeLabel || getTechRouteMeta(routes[0], catalog).label;
    return routes.map((route) => getTechRouteMeta(route, catalog).label).join('/');
  }

  function getTechNodePrimaryRoute(node = {}) {
    const routes = getTechNodeRoutes(node);
    return node.route || routes[0] || '';
  }

  function getTechNodeLane(node = {}, catalog = DEFAULT_ROUTE_CATALOG) {
    const route = getTechNodePrimaryRoute(node);
    const routeLane = getTechRouteMeta(route, catalog).lane;
    if (node.route && Number.isFinite(routeLane)) return routeLane;
    const configuredLane = Number(node.tree?.lane);
    if (Number.isFinite(configuredLane)) return configuredLane;
    if (route && Number.isFinite(routeLane)) return routeLane;
    return 0;
  }

  function getTechNodeColor(node = {}, catalog = DEFAULT_ROUTE_CATALOG) {
    const routeColor = getTechRouteMeta(getTechNodePrimaryRoute(node), catalog).color;
    if (node.researched) {
      return {
        fill: 'rgba(39, 82, 59, 0.88)',
        stroke: routeColor,
        accent: routeColor,
        text: '#f6e8c8',
        muted: 'rgba(214, 235, 203, 0.64)',
      };
    }
    if (!node.disabled) {
      return {
        fill: 'rgba(80, 54, 29, 0.94)',
        stroke: routeColor,
        accent: routeColor,
        text: '#fff2d2',
        muted: 'rgba(255, 226, 177, 0.72)',
      };
    }
    if (node.status === 'locked') {
      return {
        fill: 'rgba(28, 30, 32, 0.82)',
        stroke: 'rgba(170, 176, 184, 0.22)',
        accent: '#7d8590',
        text: '#aeb0b8',
        muted: 'rgba(174, 176, 184, 0.52)',
      };
    }
    return {
      fill: 'rgba(45, 34, 24, 0.82)',
      stroke: 'rgba(255, 226, 177, 0.18)',
      accent: routeColor,
      text: '#ddd0ad',
      muted: 'rgba(203, 189, 150, 0.58)',
    };
  }

  function getTechTreeLayout(view = {}, panel = {}, options = {}) {
    const tree = view.tree || {};
    const nodes = Array.isArray(tree.nodes) ? tree.nodes : [];
    const eras = (Array.isArray(tree.eras) && tree.eras.length
      ? tree.eras
      : (view.eras || []).map((era) => ({ ...era, column: era.era })))
      .slice()
      .sort((a, b) => (Number(a.column) || Number(a.era) || 0) - (Number(b.column) || Number(b.era) || 0));
    const width = Number(panel.width) || 0;
    const height = Number(panel.height) || 0;
    const panelX = Number(panel.x) || 0;
    const panelY = Number(panel.y) || 0;
    const zoom = Math.max(0.65, Math.min(1.6, Number(options.techTreeZoom) || 1));
    const routeCatalog = getTechRouteCatalog();
    const nodeWidth = Math.max(82, Math.min(102, width * 0.3));
    const nodeHeight = 76;
    const baseEraHeight = Math.max(280, Math.min(360, height * 0.78));
    const localRowGap = nodeHeight + 38;
    const collisionGap = 18;
    const laneGap = Math.max(nodeWidth + 42, Math.min(168, width * 0.44));
    const eraRailWidth = 58;
    const eraRailX = panelX + width - eraRailWidth - 8;
    const panelCenterX = panelX + width / 2;
    const routeEntries = Object.entries(routeCatalog);
    const fallbackRoutes = nodes.flatMap((node) => getTechNodeRoutes(node));
    fallbackRoutes.forEach((route) => {
      if (!routeCatalog[route]) routeEntries.push([route, getTechRouteMeta(route, routeCatalog)]);
    });
    const lanes = routeEntries.map(([, meta]) => Number(meta.lane) || 0);
    nodes.forEach((node) => lanes.push(getTechNodeLane(node, routeCatalog)));
    const minLane = Math.min(...lanes, 0);
    const maxLane = Math.max(...lanes, 0);
    const startY = panelY + 66;
    const minContentY = panelY + 18;
    const getNodeColumn = (node) => Number(node.tree?.column ?? node.era) || 1;
    const getNodeRow = (node) => Number(node.tree?.row ?? node.tree?.column ?? node.era) || getNodeColumn(node);
    const getLocalRowOffset = (node) => Math.max(0, getNodeRow(node) - getNodeColumn(node));
    const nodeColumns = nodes.map((node) => getNodeColumn(node));
    const firstColumn = nodeColumns.length ? Math.min(...nodeColumns) : (Number(eras[0]?.column ?? eras[0]?.era) || 1);
    const focusLanes = nodes
      .filter((node) => getNodeColumn(node) === firstColumn)
      .map((node) => getTechNodeLane(node, routeCatalog));
    const focusLane = focusLanes.length ? (Math.min(...focusLanes) + Math.max(...focusLanes)) / 2 : 0;
    const contentCenterX = panelCenterX - focusLane * laneGap;
    const laneToX = (lane) => contentCenterX + (Number(lane) || 0) * laneGap;
    const nodeRects = {};
    const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const nodesByColumn = new Map();
    nodes.forEach((node) => {
      const column = getNodeColumn(node);
      if (!nodesByColumn.has(column)) nodesByColumn.set(column, []);
      nodesByColumn.get(column).push(node);
    });
    let eraTopCursor = minContentY;
    const eraPositions = eras.map((era, eraIndex) => {
      const column = Number(era.column) || Number(era.era) || eraIndex + 1;
      const eraNodes = (nodesByColumn.get(column) || [])
        .slice()
        .sort((a, b) => {
          const rowA = getLocalRowOffset(a);
          const rowB = getLocalRowOffset(b);
          if (rowA !== rowB) return rowA - rowB;
          return (Number(a.tree?.lane) || 0) - (Number(b.tree?.lane) || 0);
        });
      const top = eraTopCursor;
      const placed = [];
      eraNodes.forEach((node) => {
        const localRow = getLocalRowOffset(node);
        const lane = getTechNodeLane(node, routeCatalog);
        const centerX = laneToX(lane);
        let centerY = Math.max(startY, top + 92) + localRow * localRowGap;
        const makeRect = () => ({
          x: centerX - nodeWidth / 2,
          y: centerY - nodeHeight / 2,
          width: nodeWidth,
          height: nodeHeight,
        });
        let rect = makeRect();
        let guard = 0;
        const overlapsPlaced = (candidate) => placed.some((other) => (
          candidate.x < other.x + other.width + 14
          && candidate.x + candidate.width + 14 > other.x
          && candidate.y < other.y + other.height + collisionGap
          && candidate.y + candidate.height + collisionGap > other.y
        ));
        while (overlapsPlaced(rect) && guard < 24) {
          centerY += nodeHeight + collisionGap;
          rect = makeRect();
          guard += 1;
        }
        const routes = getTechNodeRoutes(node);
        const routeLanes = routes.length ? routes.map((route) => getTechRouteMeta(route, routeCatalog).lane) : [lane];
        nodeRects[node.id] = {
          ...rect,
          centerX,
          centerY,
          row: getNodeRow(node),
          localRow,
          column,
          lane,
          routeLanes,
          routes,
          eraColumn: column,
        };
        placed.push(nodeRects[node.id]);
      });
      const nodesBottom = placed.length ? Math.max(...placed.map((rect) => rect.y + rect.height)) : top + baseEraHeight;
      const bottom = Math.max(top + baseEraHeight, nodesBottom + 78);
      eraTopCursor = bottom;
      return { ...era, x: eraRailX, y: top + (bottom - top) / 2, top, bottom, column, nodes: eraNodes };
    });
    const routeGuides = routeEntries.map(([route, meta]) => ({
      id: route,
      label: meta.label || route,
      color: meta.color,
      lane: Number(meta.lane) || 0,
      x: laneToX(Number(meta.lane) || 0),
    }));
    const linkPaths = nodes.flatMap((node) => (
      (node.tree?.parents || [])
        .filter((parentId) => nodeRects[parentId] && nodeRects[node.id])
        .map((parentId) => buildLinkPath({
          parentId,
          childNode: node,
          parentNode: nodesById[parentId] || {},
          parentRect: nodeRects[parentId],
          childRect: nodeRects[node.id],
          routeCatalog,
          laneGap,
          laneToX,
        }))
    ));
    return buildLayoutBounds({
      nodes,
      eras,
      eraPositions,
      nodeRects,
      panelX,
      panelY,
      width,
      height,
      zoom,
      minLane,
      maxLane,
      laneToX,
      nodeWidth,
      routeGuides,
      linkPaths,
      minContentY,
      eraRailWidth,
      eraRailX,
      routeCatalog,
      panelCenterX,
      options,
    });
  }

  function buildLinkPath(context = {}) {
    const {
      parentId,
      childNode,
      parentNode,
      parentRect,
      childRect,
      routeCatalog,
      laneGap,
      laneToX,
    } = context;
    const parentRoutes = getTechNodeRoutes(parentNode);
    const childRoutes = getTechNodeRoutes(childNode);
    const sharedRoute = childRoutes.find((route) => parentRoutes.includes(route)) || childRoutes[0] || parentRoutes[0] || '';
    const routeMeta = getTechRouteMeta(sharedRoute, routeCatalog);
    const routeX = laneToX(routeMeta.lane);
    const start = { x: parentRect.centerX, y: parentRect.centerY + Math.min(34, parentRect.height * 0.44) };
    const end = { x: childRect.centerX, y: childRect.centerY - Math.min(34, childRect.height * 0.44) };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const signY = dy >= 0 ? 1 : -1;
    const side = Math.abs(dx) > 6 ? Math.sign(dx) : ((Number(childRect.lane) || Number(parentRect.lane) || 0) >= 0 ? 1 : -1);
    const curveBend = Math.max(24, Math.min(88, Math.abs(dx) * 0.28 + laneGap * 0.16));
    const verticalBend = Math.max(42, Math.min(150, Math.abs(dy) * 0.38 + 24));
    const lanePull = Number.isFinite(routeX) ? Math.max(-72, Math.min(72, (routeX - (start.x + end.x) / 2) * 0.18)) : 0;
    return {
      from: parentId,
      to: childNode.id,
      color: routeMeta.color,
      curve: {
        start,
        c1: { x: start.x + dx * 0.16 + side * curveBend + lanePull, y: start.y + signY * verticalBend },
        c2: { x: end.x - dx * 0.16 - side * curveBend + lanePull, y: end.y - signY * verticalBend },
        end,
      },
      active: Boolean(parentNode.researched && childNode.available),
      researched: Boolean(parentNode.researched && childNode.researched),
      locked: childNode.status === 'locked',
    };
  }

  function buildLayoutBounds(context = {}) {
    const {
      nodes,
      eras,
      eraPositions,
      nodeRects,
      panelX,
      panelY,
      width,
      height,
      zoom,
      minLane,
      maxLane,
      laneToX,
      nodeWidth,
      routeGuides,
      linkPaths,
      minContentY,
      eraRailWidth,
      eraRailX,
      routeCatalog,
      panelCenterX,
      options,
    } = context;
    const contentBottom = Math.max(
      minContentY + height + 1,
      ...eraPositions.map((era) => era.bottom + 42),
      ...Object.values(nodeRects).map((rect) => rect.y + rect.height + 44),
    );
    const contentLeft = Math.min(
      laneToX(minLane) - nodeWidth / 2 - 64,
      ...routeGuides.map((guide) => guide.x - 40),
      ...Object.values(nodeRects).map((rect) => rect.x - 24),
    );
    const contentRight = Math.max(
      laneToX(maxLane) + nodeWidth / 2 + 80,
      ...routeGuides.map((guide) => guide.x + 40),
      ...Object.values(nodeRects).map((rect) => rect.x + rect.width + 24),
    );
    const contentHeight = Math.max(height + 1, contentBottom - minContentY);
    const overscroll = 96;
    const innerLeft = panelX + 16;
    const innerRight = panelX + width - 16;
    const innerTop = panelY + 8;
    const innerBottom = panelY + height - 12;
    const scaleX = (value) => panelX + (value - panelX) * zoom;
    const scaleY = (value) => panelY + (value - panelY) * zoom;
    const scaledContentLeft = scaleX(contentLeft);
    const scaledContentRight = scaleX(contentRight);
    const scaledContentTop = scaleY(minContentY);
    const scaledContentBottom = scaleY(contentBottom);
    const minPanX = Math.min(-overscroll, innerRight - scaledContentRight);
    const maxPanX = Math.max(overscroll, innerLeft - scaledContentLeft);
    const minPanY = Math.min(-overscroll, innerBottom - scaledContentBottom);
    const maxPanY = Math.max(overscroll, innerTop - scaledContentTop);
    const rawPanX = Number(options.techTreePanX) || 0;
    const rawPanY = Number(options.techTreePanY) || 0;
    const panX = Math.max(minPanX, Math.min(rawPanX, maxPanX));
    const panY = Math.max(minPanY, Math.min(rawPanY, maxPanY));
    return {
      nodes,
      eras,
      eraPositions,
      nodeRects,
      panX,
      panY,
      zoom,
      minPanX,
      maxPanX,
      minPanY,
      maxPanY,
      contentHeight,
      scaledContentWidth: Math.max(1, scaledContentRight - scaledContentLeft),
      scaledContentHeight: Math.max(1, scaledContentBottom - scaledContentTop),
      contentLeft,
      contentRight,
      minContentY,
      maxContentY: minContentY + contentHeight,
      routeGuides,
      linkPaths,
      eraRailWidth,
      eraRailX,
      routeCatalog,
      laneToX,
      spineX: panelCenterX,
    };
  }

  const api = {
    getTechRouteCatalog,
    getTechRouteMeta,
    getTechNodeRoutes,
    getTechNodeRouteLabel,
    getTechNodePrimaryRoute,
    getTechNodeLane,
    getTechNodeColor,
    getTechTreeLayout,
  };

  global.TechTreeLayoutModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

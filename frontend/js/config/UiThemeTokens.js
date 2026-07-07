(function (global) {
  // UI-REDO single source of truth for the reworked UI theme.
  //
  // Every color below was sampled from the approved reference image
  // docs/design/ui-hud-reference/user-references/layout-reference-v2.webp
  // (853x1844). Sample method: median of a clean patch for surfaces,
  // median of top-brightness pixels inside a text/line box for strokes.
  // Source patch coordinates are noted per token as [x0,y0,x1,y1].
  //
  // RULE: all UI-REDO renderers read colors/typography/spacing from this
  // file. No scattered hardcoded UI colors in redesigned surfaces.
  const UI_THEME_TOKENS_VERSION = 'ui-theme-tokens-v1';

  const palette = Object.freeze({
    // --- top bar iron plate (上暗层) ---
    plateIronTop: '#101110', // plate interior upper band [320,45,800,53]
    plateIronBottom: '#0B0E0D', // plate interior lower band [300,126,800,133]
    plateBevelHighlight: '#59503F', // top bevel rows [20,38,830,41]
    plateFrameLine: '#3C3935', // bottom outer frame line [20,137,830,139]

    // --- bottom dock warm copper (下暖层) ---
    dockCopperTop: '#23211F', // dock bar upper band [250,1575,620,1595]
    dockCopperBottom: '#141311', // dock bar lower band [250,1790,620,1820]
    dockTrayCell: '#1A1A17', // dock tray cell face (mean of [196,1690,250,1730] / [590,1610,650,1640])
    dockLabelGold: '#AEA491', // dock button label [205,1690,265,1720]
    dockIconGold: '#BCA37C', // dock icon strokes [205,1600,265,1665]

    // --- knife-6 dock tray anatomy (reference tray band y1553-1755) ---
    // The tray is ONE forged plate: top bevel light, upper ledge, recessed
    // well ridge, well interior, dark apron, warm bottom edge line.
    dockTrayLedge: '#25221F', // upper ledge face [320,1558,760,1568]
    dockTrayLedgeLow: '#22211F', // ledge lower band [320,1586,760,1597]
    dockWellTop: '#23221F', // recessed well interior top [600,1604,650,1614]
    dockWellBottom: '#111313', // recessed well interior bottom [600,1690,650,1712]
    dockApron: '#101211', // tray apron below the well [300,1722,700,1748]
    dockBevelLight: '#6D6457', // tray top bevel + well ridge light (max-of-window medians y1552-1558 / y1598-1603)
    dockWellRim: '#332D27', // well bottom inner rim light (max-of-window y1714-1719)
    dockCellFrame: '#3D3A35', // command cell frame hairline (median of divider cols x286/386/484/574 y1610-1700)
    // 用户在定稿里读到的"极细暗红勾线": PIL 全帧红色猎扫(r-max(g,b) 最大仅 18)
    // 证明定稿并无真红线 — 它是近黑底上的暖棕边线, 观感偏暗红. 按实测色收录.
    plateEdgeWarmLine: '#3C352B', // tray bottom edge warm line (max-of-window y1750-1756)

    // --- bronze badges / round buttons (后续刀使用) ---
    badgeBronzeFace: '#604C31', // capital badge face [55,1600,130,1640]
    badgeRing: '#CCB48E', // badge ring highlight [20,1570,170,1740]
    badgeTextGold: '#BFA57E', // badge caption [55,1685,130,1725]
    roundButtonFace: '#32291E', // floating round button face [762,1070,815,1090]
    roundButtonRing: '#CCB899', // floating round button ring [745,1050,835,1140]

    // --- squad panel (后续刀使用) ---
    squadPanelBg: '#13110C', // squad row background [120,1215,220,1250]
    squadChipBlue: '#18334B', // squad 1 chip [38,1212,52,1224]
    squadChipRed: '#471C18', // squad 2 chip [38,1270,52,1282]
    squadChipGreen: '#18371E', // scout chip [38,1327,52,1339]

    // --- champagne gold linework ---
    champagneGold: '#D2B57E', // icon strokes (wheat/scroll) [720,52,760,90]
    champagneGoldBright: '#E5D0A5', // brightest gold highlights (user-approved accent)

    // --- text ---
    textPrimary: '#E1D3B7', // resource values [178,100,242,124]
    textLabel: '#BDB29B', // resource labels [205,56,252,82]
    textSecondary: '#B6A991', // clock / secondary lines [22,104,100,126]

    // --- debug status block ---
    debugFpsGreen: '#8BB891', // FPS readout [30,53,102,77]
    debugSignalGreen: '#6BAB6A', // signal bars [24,80,50,100]
    debugLatencyText: '#889274', // latency text [53,80,108,100]

    // --- accents ---
    accentJade: '#55AB73', // march arrow body [280,700,330,730]
    accentMarchGreen: '#15A46A', // march arrow saturated core
    accentCityLevelBlue: '#263F4B', // city level corner chip [108,676,130,698]
  });

  // Hairlines: 1px separators/edges drawn over the iron plate.
  const hairline = Object.freeze({
    widthPx: 1,
    dividerOnIron: 'rgba(229, 208, 165, 0.10)', // slot divider (ref divider col x=261 is +4 lum over plate)
    insetHighlight: 'rgba(229, 208, 165, 0.06)', // inner top light edge
    frameShadow: 'rgba(0, 0, 0, 0.55)', // outer drop edge under plates
    wellInnerShadow: 'rgba(0, 0, 0, 0.55)', // recessed well top inner shadow (1st px)
    wellInnerShadowSoft: 'rgba(0, 0, 0, 0.28)', // recessed well top inner shadow (2nd px)
    badgeSocketShadow: 'rgba(0, 0, 0, 0.50)', // socket disc under the embedded dock badges
    badgeSocketRim: 'rgba(109, 100, 87, 0.35)', // socket lower lip catching the top light (dockBevelLight @ 0.35)
  });

  // Type scale (logical px). Numeric values render with the mono stack.
  const typeScale = Object.freeze({
    micro: 8,
    caption: 9,
    label: 10,
    body: 12,
    value: 14,
    title: 16,
    headline: 18,
  });

  const fontFamily = Object.freeze({
    numeric: '"Roboto Mono", "SF Mono", Consolas, "Courier New", monospace',
  });

  const spacing = Object.freeze({
    xxs: 2,
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
  });

  const radius = Object.freeze({
    chip: 4,
    panel: 6,
    plate: 8,
    button: 12,
  });

  // Top resource bar composition (world-map home HUD).
  const topBar = Object.freeze({
    height: 64, // topBarBottom contract (CanvasSurfaceRenderer.getTopBarBottom isMapHome)
    plateMarginX: 4,
    plateMarginTop: 4,
    plateHeight: 56,
    contentPaddingX: 12,
    plateAssetPath: 'assets/art/ui-hud/hud-plate-top.png',
    plateSlice: Object.freeze({
      sourceWidth: 256,
      sourceHeight: 101,
      sourceInset: 20,
      destInset: 10,
    }),
    debugBlockWidth: 66,
    iconSize: 18,
    labelIconGap: 4,
  });

  // Bottom map-command dock composition (world-map home HUD).
  //
  // UI-REDO knife 6 (dock 一体化): geometry re-measured with PIL on
  // layout-reference-v2.webp (853px wide; pt values = 390pt equivalents):
  //   - tray band       y1553-1755 => 23.7%W (~92pt), ONE forged plate
  //   - badge diameter  ring outer x14-195 => ~21.2%W; drawn sprite covers
  //     the diamond-accent envelope so the ratio is 0.218 (~85pt)
  //   - badge overshoot ZERO — every row above the tray top (y<1553) is pure
  //     black across the badge zone; the badge is fully EMBEDDED and
  //     vertically centered in the tray (previous 0.35 overshoot was wrong)
  //   - ledge           tray top -> well ridge (1600-1553)/202 = 23.3% of tray
  //   - recessed well   y1600-1717 => 57.8% of tray height (~53pt @390)
  //   - badge edge inset: ref ring solid edge ~x30-36 (~4.2%W to the circle);
  //     our sprite bbox includes the diamond tips, so 3.0%W sprite inset puts
  //     the visible ring at the reference distance
  // No fixed-px dock sizing anywhere else: every consumer that used the old
  // `height - 64` contract must call getDockMetrics(width).top instead.
  const dock = Object.freeze({
    heightRatio: 0.237,
    minHeightPx: 68,
    maxHeightPx: 118,
    badgeDiameterRatio: 0.218,
    badgeOvershootRatio: 0,
    badgeEdgeInsetRatio: 0.03,
    badgeIconRatio: 0.4,
    ledgeRatio: 0.233,
    wellHeightRatio: 0.578,
    wellGapPx: 8,
    wellPadX: 3,
    cellIconRatio: 0.5,
    badgeAssetPath: 'assets/art/ui-hud/hud-dock-badge-round.png',
    badgeSocketPadPx: 3,
    disabledAlpha: 0.38,
    // Gradient stops (single-source; consumed via createGradient):
    // tray face ledge -> apron, and recessed well top -> bottom.
    trayGradientStops: Object.freeze([
      Object.freeze([0, '#25221F']),
      Object.freeze([0.35, '#201F1D']),
      Object.freeze([1, '#101211']),
    ]),
    wellGradientStops: Object.freeze([
      Object.freeze([0, '#23221F']),
      Object.freeze([1, '#111313']),
    ]),
  });

  // Single source for the reworked dock geometry. The effective width clamps
  // so tablet canvases do not blow the bar up; every px value derives from
  // the same clamped width, keeping the reference proportions intact.
  function getDockMetrics(width, height) {
    const canvasWidth = Number(width) || 0;
    const canvasHeight = Number(height) || 0;
    const effectiveWidth = Math.max(
      dock.minHeightPx / dock.heightRatio,
      Math.min(canvasWidth, dock.maxHeightPx / dock.heightRatio),
    );
    const barHeight = Math.round(effectiveWidth * dock.heightRatio);
    const badgeDiameter = Math.round(effectiveWidth * dock.badgeDiameterRatio);
    const ledgeHeight = Math.round(barHeight * dock.ledgeRatio);
    const wellHeight = Math.min(barHeight - 6, Math.round(barHeight * dock.wellHeightRatio));
    return {
      height: barHeight,
      top: canvasHeight ? canvasHeight - barHeight : 0,
      badgeDiameter,
      badgeOvershoot: Math.round(badgeDiameter * dock.badgeOvershootRatio),
      badgeInset: Math.round(effectiveWidth * dock.badgeEdgeInsetRatio),
      badgeIconSize: Math.round(badgeDiameter * dock.badgeIconRatio),
      ledgeHeight,
      wellHeight,
      wellGap: dock.wellGapPx,
      wellPadX: dock.wellPadX,
      cellIconSize: Math.round(wellHeight * dock.cellIconRatio),
    };
  }

  // Right-edge floating round buttons (subcity / events / account).
  // Reference anchors: ring diameter ~10.5%W (~41pt), vertical pitch ~11.5%W,
  // right inset ~8px.
  const floatButton = Object.freeze({
    diameterRatio: 0.105,
    minDiameterPx: 40,
    maxDiameterPx: 56,
    gapPx: 10,
    rightInsetPx: 8,
    iconRatio: 0.46,
    ringWidthPx: 1.5,
  });

  function getFloatButtonMetrics(width) {
    const canvasWidth = Number(width) || 0;
    const size = Math.max(
      floatButton.minDiameterPx,
      Math.min(floatButton.maxDiameterPx, Math.round(canvasWidth * floatButton.diameterRatio)),
    );
    return {
      size,
      gap: floatButton.gapPx,
      rightInset: floatButton.rightInsetPx,
      iconSize: Math.round(size * floatButton.iconRatio),
      ringWidth: floatButton.ringWidthPx,
    };
  }

  // Bottom-left squad quick panel (map home). Reference anchors: panel width
  // ~25.6%W, row chips with colored crest square + name + chevron.
  const squadPanel = Object.freeze({
    widthRatio: 0.3,
    minWidthPx: 118,
    maxWidthPx: 156,
    rowHeightPx: 32,
    rowGapPx: 6,
    chipSizePx: 22,
    edgeInsetPx: 10,
  });

  // World-map city nameplate chip (dark plate + level corner + name).
  // Knife 6 (气质收敛): one notch more presence on device — slightly larger
  // plate and type (user judged the knife-5 plate too faint on the map).
  const cityPlate = Object.freeze({
    heightPx: 18,
    levelBoxPx: 14,
    paddingXPx: 6,
    gapPx: 4,
    maxNameWidthPx: 96,
    liftPx: 6,
    nameFontPx: 10,
    levelFontPx: 9,
  });

  const UiThemeTokens = Object.freeze({
    version: UI_THEME_TOKENS_VERSION,
    source: 'docs/design/ui-hud-reference/user-references/layout-reference-v2.webp',
    palette,
    hairline,
    typeScale,
    fontFamily,
    spacing,
    radius,
    topBar,
    dock,
    getDockMetrics,
    floatButton,
    getFloatButtonMetrics,
    squadPanel,
    cityPlate,
  });

  global.UiThemeTokens = UiThemeTokens;
  if (typeof module !== 'undefined' && module.exports) module.exports = UiThemeTokens;
})(typeof window !== 'undefined' ? window : globalThis);

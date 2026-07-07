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
  // Bar height 64 is a cross-renderer layout contract (Advisor/CityCanvas/
  // CanvasFrame/WorldMapLayer all position against `height - 64`); the round
  // badges intentionally overshoot the bar's top edge by drawing taller.
  const dock = Object.freeze({
    height: 64,
    badgeDiameter: 76,
    badgeBottomInset: 2,
    badgeIconSize: 34,
    badgeAssetPath: 'assets/art/ui-hud/hud-dock-badge-round.png',
    cellSize: 46,
    cellGap: 8,
    cellTopInset: 3,
    cellIconSize: 24,
    cellAssetPath: 'assets/art/ui-hud/hud-dock-button-cell.png',
    disabledAlpha: 0.38,
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
  });

  global.UiThemeTokens = UiThemeTokens;
  if (typeof module !== 'undefined' && module.exports) module.exports = UiThemeTokens;
})(typeof window !== 'undefined' ? window : globalThis);

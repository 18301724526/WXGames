const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..', '..');

function iconUrlPattern(assetName) {
  return `assets/art/${assetName}(?:\\?v=[^']+)?`;
}

test('H5 document adapters require an explicit document argument', () => {
  const uiDir = path.join(projectRoot, 'frontend', 'js', 'ui');
  const files = fs.readdirSync(uiDir)
    .filter((name) => name.endsWith('.js'));

  for (const file of files) {
    const source = fs.readFileSync(path.join(uiDir, file), 'utf8');
    assert.doesNotMatch(source, /fromDocument\(doc\s*=\s*(?:document|global\.document)/, file);
  }
});

test('canvas resource HUD uses dedicated resource icon assets without DOM resource detail styles', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const canvasRenderer = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');
  const assets = [
    'icon-food-cutout.webp',
    'icon-happiness-cutout.webp',
    'icon-iron-cutout.webp',
    'icon-knowledge-cutout.webp',
    'icon-stone-cutout.webp',
    'icon-wood-cutout.webp',
  ];

  for (const asset of assets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', asset)), true);
  }
  assert.match(canvasRenderer, /assets\/art\/icon-food-cutout\.webp/);
  assert.match(canvasRenderer, /assets\/art\/icon-iron-cutout\.webp/);
  assert.match(canvasRenderer, /assets\/art\/icon-knowledge-cutout\.webp/);
  assert.match(canvasRenderer, /assets\/art\/icon-stone-cutout\.webp/);
  assert.match(canvasRenderer, /assets\/art\/icon-wood-cutout\.webp/);
  assert.match(canvasRenderer, /assets\/art\/icon-happiness-cutout\.webp/);
  assert.doesNotMatch(css, /\.wood-card \.resource-icon \{ background-image: url\('assets\/art\/icon-fire-cutout\.webp'\); \}/);
  assert.doesNotMatch(css, /resource-detail/);
  assert.doesNotMatch(css, /\.(?:resource-panel|resource-card|resource-icon|resource-value)\b/);
  assert.doesNotMatch(css, /civ-overview|civ-features|btn-era|era-panel/);
});

test('military tab is owned by canvas without H5 tab or page DOM', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');

  assert.doesNotMatch(html, /class="page|data-page=|class="tab-btn|data-tab=|id="tabMilitary"/);
  assert.match(renderer, /\['military', '.*?', 'assets\/art\/icon-soldier-cutout\.webp'\]/);
  assert.match(renderer, /type: 'switchTab', tab: id/);
});

test('world scouting uses dedicated site icons and canvas military controls', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');
  const controller = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'controllers', 'TerritoryController.js'), 'utf8');
  const presenter = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'state', 'UIStatePresenter.js'), 'utf8');
  const assets = [
    'world-site-outpost-cutout.png',
    'world-site-town-cutout.png',
    'world-site-city-cutout.png',
    'world-site-camp-cutout.png',
    'world-site-ruins-cutout.png',
  ];

  for (const asset of assets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', asset)), true);
  }
  assert.doesNotMatch(html, /id="tabTerritory"/);
  assert.doesNotMatch(html, /data-tab="territory"/);
  assert.doesNotMatch(html, /id="militarySubTabs"|data-military-view|data-military-page|id="scoutDirectionGrid"|id="territoryGrid"/);
  assert.doesNotMatch(css, /military-subtab|military-panel|scout-compass|btn-scout|world-radar|world-site|territory-panel/);
  assert.match(renderer, /renderMilitarySubTabs/);
  assert.match(renderer, /renderMilitaryScoutView/);
  assert.match(renderer, /renderMilitaryWorldView/);
  assert.match(renderer, /renderWorldSiteModal/);
  assert.match(renderer, /renderNamingModal/);
  assert.match(renderer, /renderFloatingTexts/);
  assert.match(renderer, /type: 'switchMilitaryView'/);
  assert.match(renderer, /type: cell\.action === 'claim' \? 'claimScout' : 'scoutTerritory'/);
  assert.match(renderer, /type: 'openWorldSite'/);
  assert.match(renderer, /type:.*conquer/s);
  assert.match(renderer, /type:.*launchExpedition/s);
  assert.match(renderer, /type:.*claimConquest/s);
  assert.match(renderer, /type:.*manageCity/s);
  assert.match(renderer, /type:.*renameCity/s);
  assert.match(controller, /this\.uiState\.selectedSiteId/);
  assert.match(controller, /getUiState\(\)/);
  assert.match(presenter, /visualOffset/);
  assert.match(presenter, /buildWorldRadarViewState/);
  assert.match(html, /style\.css\?v=[^"]+/);
  assert.doesNotMatch(css, /naming-modal-content|naming-input|naming-message/);
  assert.doesNotMatch(html, /floating-text\.js|id="fxLayer"/);
  assert.doesNotMatch(css, /fx-layer|floating-text|particleFly|screen-flash|floatUp/);
  assert.match(html, /UIStatePresenter\.js\?v=resource-buildings-v1/);
  assert.match(html, /FamousPortraitLayout\.js\?v=famous-portrait-lab-runtime-v1/);
  assert.doesNotMatch(html, /BuildingUIRenderer|BuildingActionAdapter|buildingGrid|building-panel|building-card/);
  assert.doesNotMatch(html, /EventUIRenderer\.js/);
  assert.doesNotMatch(html, /RuntimeLogAdapter\.js|LogModalAdapter\.js/);
  assert.doesNotMatch(html, /AuthShellAdapter\.js|id="loginPanel"|id="loginUsername"|id="loginPassword"|id="rememberPassword"|id="btnLogin"/);
  assert.doesNotMatch(html, /PopulationPanelAdapter\.js\?v=explicit-doc-v1/);
  assert.doesNotMatch(html, /AdvisorPanelAdapter\.js\?v=explicit-doc-v1/);
  assert.doesNotMatch(html, /NamingModalAdapter\.js|id="namingModal"|id="namingInput"/);
  assert.match(html, /GameAPI\.js\?v=version-cache-bust-v2/);
  assert.match(html, /TerritoryController\.js\?v=territory-rename-adapter-v1/);
  assert.doesNotMatch(html, /TerritoryActionAdapter\.js|TerritoryUIRenderer\.js|MilitaryPanelAdapter\.js/);
  assert.match(html, /TutorialCanvasRenderer\.js\?v=tutorial-canvas-v1/);
  assert.doesNotMatch(html, /TutorialUIRenderer\.js|TutorialTargetAdapter\.js|id="tutorialOverlay"|id="tutorialBubble"|id="tutorialPointer"/);
  assert.doesNotMatch(css, /tutorial-overlay|tutorial-bubble|tutorial-pointer|tutorial-highlight|tutorial-bounce/);
  assert.match(html, /H5GameBootstrap\.js\?v=h5-bootstrap-explicit-doc-v1/);
  assert.doesNotMatch(html, /H5TextAdapter\.js|NavigationShellAdapter\.js/);
  assert.match(html, /H5AuthRuntimeAdapter\.js\?v=h5-auth-runtime-v2/);
  assert.match(html, /H5UpdateRuntimeAdapter\.js\?v=h5-update-runtime-v5/);
  assert.match(html, /H5AuthStorageAdapter\.js\?v=h5-storage-runtime-v1/);
  assert.match(html, /H5TutorialStorageAdapter\.js\?v=h5-storage-runtime-v1/);
  assert.match(html, /GameStateSync\.js\?v=sync-scheduler-v2/);
  assert.match(html, /UpdateChecker\.js\?v=update-scheduler-v2/);
  assert.match(html, /GameStateManager\.js\?v=guidebook-planning-v1/);
  assert.match(html, /H5ShellAdapter\.js\?v=h5-shell-registry-v1/);
  assert.doesNotMatch(html, /DOMHelper\.js/);
  assert.match(html, /TutorialController\.js\?v=tutorial-guide-task-v1/);
  assert.match(html, /app\.js\?v=h5-bootstrap-explicit-doc-v3/);
  assert.match(html, /auth\.js\?v=h5-module-deps-v1/);
  assert.match(html, /population\.js\?v=h5-module-deps-v1/);
  assert.match(html, /logs\.js\?v=h5-module-deps-v1/);
  assert.doesNotMatch(html, /id="advisorBtn"/);
  assert.doesNotMatch(html, /id="advisorModal"/);
  assert.doesNotMatch(css, /login-panel|login-box|btn-login|login-remember/);
  assert.doesNotMatch(html, /id="logButton"/);
  assert.doesNotMatch(html, /id="logModal"/);
  assert.doesNotMatch(html, /id="settingsBtn"/);
  assert.doesNotMatch(html, /id="settingsMenu"/);
  assert.doesNotMatch(html, /id="resourcePanel"/);
  assert.doesNotMatch(html, /id="resourceDetailModal"/);
  assert.doesNotMatch(html, /ResourceRenderer|ResourceDetailModalAdapter/);
  assert.doesNotMatch(html, /id="gameTime"/);
  assert.doesNotMatch(html, /\son[a-z]+="/);
  assert.doesNotMatch(css, /\.advisor-btn/);
  assert.doesNotMatch(css, /\.advisor-modal-content/);
  assert.doesNotMatch(css, /\.top-actions/);
  assert.doesNotMatch(css, /\.hud-btn/);
  assert.doesNotMatch(css, /\.log-panel/);
  assert.doesNotMatch(css, /\.tab-btn|\.tab-bar|\.page-container|\.page\b|\.top-bar|\.modal-overlay|offline-/);
  assert.match(renderer, /scoutReports/);
  assert.doesNotMatch(renderer, /river_plain|north_forest|hill_outpost|old_ruins/);
});

test('tech tree uses standalone transparent route icons', () => {
  const renderer = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasGameRenderer.js'), 'utf8');
  const assets = [
    'tech-agriculture-cutout.png',
    'tech-livelihood-cutout.png',
    'tech-administration-cutout.png',
    'tech-knowledge-cutout.png',
    'tech-culture-cutout.png',
    'tech-engineering-cutout.png',
    'tech-industry-cutout.png',
    'tech-exploration-cutout.png',
    'tech-trade-cutout.png',
    'tech-military-cutout.png',
  ];

  for (const asset of assets) {
    assert.equal(fs.existsSync(path.join(projectRoot, 'frontend', 'assets', 'art', asset)), true);
    assert.match(renderer, new RegExp(iconUrlPattern(asset)));
  }
  assert.match(renderer, /renderTechDetailModal/);
  assert.match(renderer, /type: 'closeTechDetail'/);
});

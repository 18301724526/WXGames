const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CanvasGameRenderer = require('../js/platform/CanvasGameRenderer');

const projectRoot = path.join(__dirname, '..', '..');

function makeCtx() {
  const calls = [];
  const gradient = { addColorStop() {} };
  return {
    calls,
    ctx: {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textBaseline: '',
      textAlign: '',
      globalAlpha: 1,
      scale() {},
      clearRect(...args) { calls.push(['clearRect', ...args]); },
      fillRect(...args) { calls.push(['fillRect', ...args]); },
      beginPath() { calls.push(['beginPath']); },
      rect(...args) { calls.push(['rect', ...args]); },
      roundRect(...args) { calls.push(['roundRect', ...args]); },
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      createLinearGradient() { calls.push(['gradient']); return gradient; },
      fillText(...args) { calls.push(['fillText', ...args]); },
      drawImage(...args) { calls.push(['drawImage', ...args]); },
    },
  };
}

test('population management has no DOM panel, adapter, or style surface', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'frontend', 'style.css'), 'utf8');
  const populationJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'population.js'), 'utf8');
  const h5ShellJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'ui', 'H5ShellAdapter.js'), 'utf8');

  assert.match(html, /<div id="app" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(html, /class="page|data-page=|class="tab-btn|data-tab=/);
  assert.match(html, /population\.js\?v=h5-module-deps-v1/);
  assert.doesNotMatch(html, /PopulationPanelAdapter|population-panel|craftsmanCard|farmerCount|scholarCount|craftsmanCount|totalPop|maxPop|unassignedPop|happinessValue/);
  assert.doesNotMatch(css, /\.population-panel|\.pop-stat|\.job-card|\.job-controls|\.job-icon|\.job-count/);
  assert.doesNotMatch(h5ShellJs, /PopulationPanelAdapter|populationPanel/);

  assert.match(populationJs, /window\.mountPopulationMethods/);
  assert.doesNotMatch(populationJs, /game\.assignJob = async function assignJob/);
  assert.doesNotMatch(populationJs, /action: 'assign'/);
  assert.doesNotMatch(populationJs, /PopulationPanelAdapter|populationPanel|renderPopulation|updatePopulationButtons|bindPopulationEvents/);
  assert.doesNotMatch(populationJs, /\bdocument\b|querySelector|getElementById|classList|addEventListener/);
});

test('resource HUD renders population management through Canvas hit targets', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  const assets = [];
  renderer.drawAsset = (assetPath) => {
    assets.push(assetPath);
    return true;
  };
  renderer.setPresenter({
    buildResourceViewState: () => ({
      hasWood: true,
      text: {
        foodValue: '10',
        foodRate: '+1/s',
        knowledgeValue: '5',
        knowledgeRate: '+0/s',
        woodValue: '2',
        woodRate: '+0/s',
      },
    }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildPopulationViewState: () => ({
      text: { total: '4', max: '6', unassigned: '1' },
      jobs: [
        { id: 'farmer', visible: true, count: 2, canIncrease: true, canDecrease: true },
        { id: 'scholar', visible: true, count: 1, canIncrease: true, canDecrease: true },
        { id: 'craftsman', visible: true, count: 1, canIncrease: true, canDecrease: true },
      ],
    }),
  });

  renderer.render({ currentTab: 'resources', happiness: 92 }, { activeTab: 'resources', mode: 'hud' });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人才分配'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '方针'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人才'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '待分配人才'));
  assert.ok(calls.some((call) => call[0] === 'roundRect' && call[2] >= 120 && call[4] === 268));
  assert.ok(calls.some((call) => call[0] === 'roundRect' && call[2] >= 112 && call[4] === 42));
  assert.ok(assets.includes('assets/art/icon-population-cutout.webp'));
  assert.ok(assets.includes('assets/art/icon-happiness-cutout.webp'));
  assert.ok(assets.includes('assets/art/icon-farmer-cutout.webp'));
  assert.ok(assets.includes('assets/art/icon-scholar-cutout.webp'));
  assert.ok(assets.includes('assets/art/icon-craftsman-cutout.webp'));

  const plusTarget = renderer.hitTargets.find((target) => (
    target.action?.type === 'assignJob'
    && target.action.job === 'craftsman'
    && target.action.delta === 1
  ));
  const minusTarget = renderer.hitTargets.find((target) => (
    target.action?.type === 'assignJob'
    && target.action.job === 'farmer'
    && target.action.delta === -1
  ));
  const craftsmanMinusTarget = renderer.hitTargets.find((target) => (
    target.action?.type === 'assignJob'
    && target.action.job === 'craftsman'
    && target.action.delta === -1
  ));
  const policyTarget = renderer.hitTargets.find((target) => target.action?.type === 'openTalentPolicy');
  assert.ok(plusTarget);
  assert.ok(minusTarget);
  assert.ok(craftsmanMinusTarget);
  assert.ok(policyTarget);
  assert.ok(plusTarget.x - (craftsmanMinusTarget.x + craftsmanMinusTarget.width) >= 52);
  assert.equal(371 - (plusTarget.x + plusTarget.width), 8);
  assert.equal(renderer.getHitTarget({
    x: plusTarget.x + plusTarget.width / 2,
    y: plusTarget.y + plusTarget.height / 2,
  }).type, 'assignJob');
});

test('talent policy panel renders presets, tier controls, and save/apply hit targets', () => {
  const { ctx, calls } = makeCtx();
  const renderer = new CanvasGameRenderer({ ctx, width: 390, height: 844, pixelRatio: 1 });
  renderer.setPresenter({
    buildResourceViewState: () => ({ hasWood: true, text: {} }),
    buildCitySwitcherViewState: () => ({ hidden: true }),
    buildAdvisorViewState: () => ({ hidden: true }),
    buildPopulationViewState: () => ({
      text: { total: '4', max: '6', unassigned: '0' },
      jobs: [],
    }),
    buildTaskCenterViewState: () => ({ summary: { claimableCount: 0 } }),
    buildTalentPolicyViewState: () => ({
      text: {
        title: '人才方针',
        subtitle: '当前：均衡发展',
        presetTitle: '系统方针',
        customTitle: '自定义微调',
        customName: '均衡发展·偏农业',
        emptyCustom: '暂无自定义方针',
        applyDraft: '应用微调',
        saveDraft: '保存微调',
      },
      systemPolicies: [
        { id: 'balanced', label: '均衡发展', active: true, selected: true },
        { id: 'agriculture', label: '农业优先' },
      ],
      customPolicies: [],
      tendencies: [
        { id: 'agriculture', label: '农业', tier: 3 },
        { id: 'knowledge', label: '知识', tier: 2 },
        { id: 'industry', label: '工业', tier: 1 },
      ],
      preview: { allocationText: '农民 2 / 学者 1 / 工匠 1' },
    }),
  });

  renderer.render({ currentTab: 'resources', population: { total: 4 } }, {
    activeTab: 'resources',
    mode: 'hud',
    showTalentPolicy: true,
  });

  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '人才方针'));
  assert.ok(calls.some((call) => call[0] === 'fillText' && call[1] === '应用微调'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'applyTalentPolicy' && target.action.policyId === 'balanced'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'setTalentPolicyTier' && target.action.tendency === 'agriculture' && target.action.tier === 3));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'applyTalentPolicyDraft'));
  assert.ok(renderer.hitTargets.some((target) => target.action?.type === 'saveTalentPolicyDraft'));
});

test('H5 app dispatches population Canvas actions without DOM render methods', () => {
  const appJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'app.js'), 'utf8');
  const actionControllerJs = fs.readFileSync(path.join(projectRoot, 'frontend', 'js', 'platform', 'CanvasActionController.js'), 'utf8');

  assert.doesNotMatch(appJs, /action\?\.type === 'assignJob'/);
  assert.doesNotMatch(appJs, /this\.assignJob\(action\.job, action\.delta\)/);
  assert.match(actionControllerJs, /handle_assignJob\(action\)/);
  assert.match(actionControllerJs, /host\.api\.assignJob\(action\.job, action\.delta\)/);
  assert.doesNotMatch(appJs, /bindPopulationEvents|updatePopulationButtons|this\.renderPopulation\(\)/);
});

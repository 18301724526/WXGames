const test = require('node:test');
const assert = require('node:assert/strict');

const CivilizationPanelAdapter = require('../js/ui/CivilizationPanelAdapter');

function createElement() {
  return {
    textContent: '',
    innerHTML: '',
    disabled: false,
    style: {},
  };
}

test('civilization panel adapter renders H5 era progress and condition state', () => {
  const texts = new Map();
  const progressBar = createElement();
  const advanceButton = createElement();
  const advanceLabel = createElement();
  const features = createElement();
  const conditions = createElement();
  const adapter = new CivilizationPanelAdapter({
    setText: (id, value) => texts.set(id, value),
    progressBar,
    advanceButton,
    advanceLabel,
    features,
    conditions,
  });

  adapter.render({
    text: {
      eraName: '农耕时代',
      civOverviewEraName: '农耕时代',
      civOverviewDay: '第 3 天',
      civOverviewPop: 4,
      civOverviewBuildings: 2,
      civOverviewTechs: '0/0',
      civOverviewHappiness: '100%',
      eraProgressText: '总进度: 60%',
      eraTargetName: '聚落时代',
      advanceLabel: '条件不足，无法进阶',
      featureDescription: '农耕时代：<继续建设>',
    },
    progress: { width: '60%' },
    advanceButton: { disabled: true },
    conditions: [
      { className: 'met', name: '食物', progressText: '120/120' },
      { className: 'unmet', name: '知识', progressText: '3/5' },
    ],
  });

  assert.equal(texts.get('eraName'), '农耕时代');
  assert.equal(texts.get('civOverviewDay'), '第 3 天');
  assert.equal(texts.get('eraTargetName'), '聚落时代');
  assert.equal(progressBar.style.width, '60%');
  assert.equal(advanceButton.disabled, true);
  assert.equal(advanceLabel.textContent, '条件不足，无法进阶');
  assert.match(features.innerHTML, /&lt;继续建设&gt;/);
  assert.match(conditions.innerHTML, /era-condition-item met/);
  assert.match(conditions.innerHTML, /120\/120/);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const MilitaryPanelAdapter = require('../js/ui/MilitaryPanelAdapter');

function createElement() {
  return {
    innerHTML: '',
    style: {},
  };
}

test('military panel adapter renders army stats and scout compass controls', () => {
  const texts = new Map();
  const progress = createElement();
  const scoutGrid = createElement();
  const adapter = new MilitaryPanelAdapter({
    setText: (id, value) => texts.set(id, value),
    panel: createElement(),
    trainingProgress: progress,
    scoutGrid,
  });

  const rendered = adapter.renderMilitary({
    text: {
      soldierCount: '2/5',
      militaryDefense: 1,
      availableSoldierCount: 2,
      soldiersOnMission: 0,
      soldierTrainingText: '下一名 12/30 秒',
    },
    training: { progressWidth: '40%' },
  });
  adapter.renderScoutControls({
    statusText: '选择方向派出侦察队。',
    cells: [
      { type: 'center', label: '城', subLabel: '本城' },
      {
        type: 'button',
        className: 'direction-n status-available',
        disabled: false,
        action: 'scout',
        actionValue: 'n',
        ariaLabel: '向北派出侦察',
        label: '北',
        actionText: '派出',
      },
      {
        type: 'button',
        className: 'direction-e status-ready',
        disabled: false,
        action: 'claim',
        actionValue: 'mission-east',
        ariaLabel: '东侦察报告',
        label: '东',
        actionText: '报告',
      },
    ],
  });

  assert.equal(rendered, true);
  assert.equal(texts.get('soldierCount'), '2/5');
  assert.equal(texts.get('soldierTrainingText'), '下一名 12/30 秒');
  assert.equal(texts.get('scoutStatus'), '选择方向派出侦察队。');
  assert.equal(progress.style.width, '40%');
  assert.match(scoutGrid.innerHTML, /scout-center/);
  assert.match(scoutGrid.innerHTML, /data-scout-direction="n"/);
  assert.match(scoutGrid.innerHTML, /data-scout-claim="mission-east"/);
});

test('military panel adapter reports false when army panel is absent', () => {
  const adapter = new MilitaryPanelAdapter();
  assert.equal(adapter.renderMilitary({}), false);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const TerritoryUIRenderer = require('../js/ui/TerritoryUIRenderer');

function createHost() {
  const elements = new Map();
  return {
    dataset: {},
    querySelector(selector) {
      return elements.get(selector) || null;
    },
    set innerHTML(value) {
      this.html = value;
      if (value.includes('data-world-map-host')) {
        const mapHost = {
          dataset: {},
          html: '',
          set innerHTML(next) {
            this.html = next;
            this.renderCount = (this.renderCount || 0) + 1;
          },
          get innerHTML() {
            return this.html;
          },
        };
        const dynamicHost = {
          html: '',
          set innerHTML(next) {
            this.html = next;
          },
          get innerHTML() {
            return this.html;
          },
        };
        elements.set('[data-world-map-host]', mapHost);
        elements.set('[data-world-dynamic-host]', dynamicHost);
      }
    },
    get innerHTML() {
      return this.html || '';
    },
    getMapHost() {
      return elements.get('[data-world-map-host]');
    },
  };
}

function createState(reportText = '第一份报告') {
  return {
    currentEra: 5,
    territoryState: {
      territories: [
        {
          id: 'capital',
          x: 0,
          y: 0,
          visualOffset: { x: 0, y: 0 },
          status: 'occupied',
          owner: 'player',
          type: 'capital',
          art: 'assets/art/world-site-city-cutout.png',
          naturalName: '起源之地',
          cityName: '首都',
          distance: 0,
        },
      ],
      scoutReports: [{ id: 'report-1', title: '侦察报告', text: reportText }],
    },
  };
}

test('territory renderer keeps the radar map DOM when only reports change', () => {
  const host = createHost();
  const renderer = new TerritoryUIRenderer(host);

  renderer.render(createState('第一份报告'));
  const mapHost = host.getMapHost();
  assert.equal(mapHost.renderCount, 1);

  renderer.render(createState('第二份报告'));

  assert.equal(host.getMapHost(), mapHost);
  assert.equal(mapHost.renderCount, 1);
});

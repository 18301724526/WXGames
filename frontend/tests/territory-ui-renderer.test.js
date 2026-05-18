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
          dataset: {},
          html: '',
          set innerHTML(next) {
            this.html = next;
            this.renderCount = (this.renderCount || 0) + 1;
            if (next.includes('data-world-dialog-host')) {
              const dialogHost = {
                dataset: {},
                html: '',
                set innerHTML(content) {
                  this.html = content;
                  this.renderCount = (this.renderCount || 0) + 1;
                },
                get innerHTML() {
                  return this.html;
                },
                querySelector() {
                  return null;
                },
                querySelectorAll() {
                  return [];
                },
              };
              const reportHost = {
                dataset: {},
                html: '',
                set innerHTML(content) {
                  this.html = content;
                  this.renderCount = (this.renderCount || 0) + 1;
                },
                get innerHTML() {
                  return this.html;
                },
              };
              elements.set('[data-world-dialog-host]', dialogHost);
              elements.set('[data-world-report-host]', reportHost);
            }
          },
          get innerHTML() {
            return this.html;
          },
          querySelector(selector) {
            return elements.get(selector) || null;
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
    getDialogHost() {
      return elements.get('[data-world-dialog-host]');
    },
    getReportHost() {
      return elements.get('[data-world-report-host]');
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

test('territory renderer keeps the site dialog skeleton when only reports change', () => {
  const host = createHost();
  const renderer = new TerritoryUIRenderer(host);

  renderer.render(createState('第一份报告'));
  const dialogHost = host.getDialogHost();
  const reportHost = host.getReportHost();
  assert.equal(dialogHost.renderCount, 1);
  assert.equal(reportHost.renderCount, 1);

  renderer.render(createState('第二份报告'));

  assert.equal(host.getDialogHost(), dialogHost);
  assert.equal(dialogHost.renderCount, 1);
  assert.equal(reportHost.renderCount, 2);
});

test('territory renderer shows placeholder actions for unowned sites', () => {
  const host = createHost();
  const renderer = new TerritoryUIRenderer(host);
  const html = renderer.getAction({
    id: 'site_e_1',
    status: 'discovered',
    owner: 'neutral',
    occupationMode: 'settlement',
    recommendedSoldiers: 1,
    defense: 3,
  }, {
    availableSoldiers: 4,
  });

  assert.match(html, /交涉/);
  assert.match(html, /掠夺/);
  assert.match(html, /data-territory-action="conquer"/);
  assert.match(html, /无主，派 1 人即可建立据点/);
});

test('territory renderer shows expedition config for owned sites when expanded', () => {
  const host = createHost();
  host.dataset.selectedSiteId = 'tribe_site';
  host.dataset.expeditionConfigSiteId = 'tribe_site';
  host.dataset.expeditionSoldiers = '6';
  const renderer = new TerritoryUIRenderer(host);
  const html = renderer.getAction({
    id: 'tribe_site',
    status: 'discovered',
    owner: 'tribe',
    occupationMode: 'conquest',
    recommendedSoldiers: 5,
    defense: 5,
  }, {
    availableSoldiers: 8,
  });

  assert.match(html, /data-territory-action="open-expedition"/);
  assert.match(html, /出征数量/);
  assert.match(html, /data-expedition-field="troopType"/);
  assert.match(html, /data-expedition-field="leader"/);
  assert.match(html, /data-expedition-field="soldiers"/);
  assert.match(html, /data-territory-action="launch-expedition"/);
});

test('territory renderer formats new owner tiers and map classes', () => {
  const host = createHost();
  const renderer = new TerritoryUIRenderer(host);

  assert.equal(renderer.formatOwner({ owner: 'city_state' }), '有主 · 城邦');
  assert.equal(renderer.formatOwner({ owner: 'ruin_guardians' }), '有主 · 遗迹守军');

  const html = renderer.renderMap([
    { id: 'neutral_site', x: 1, y: 0, visualOffset: { x: 0, y: 0 }, owner: 'neutral', status: 'discovered', type: 'town', art: 'assets/art/world-site-town-cutout.png', naturalName: '河湾村镇' },
    { id: 'city_site', x: 2, y: 0, visualOffset: { x: 0, y: 0 }, owner: 'city_state', status: 'discovered', type: 'city', art: 'assets/art/world-site-city-cutout.png', naturalName: '石桥城邦' },
  ]);

  assert.match(html, /owner-neutral/);
  assert.match(html, /owner-city_state/);
  assert.match(html, /type-city/);
});

test('territory radar spreads near sites away from the center when outer rings exist', () => {
  const renderer = new TerritoryUIRenderer({ dataset: {} });
  const near = renderer.getRadarPosition({
    x: 1,
    y: 0,
    visualOffset: { x: 0, y: 0 },
  }, 6);
  const far = renderer.getRadarPosition({
    x: 6,
    y: 0,
    visualOffset: { x: 0, y: 0 },
  }, 6);

  assert.ok(near.radius > 12);
  assert.ok(far.radius > near.radius);
});

test('territory radar prevents overlapping placements for clustered outer sites', () => {
  const renderer = new TerritoryUIRenderer({ dataset: {} });
  const layout = renderer.buildRadarLayout([
    { id: 'capital', x: 0, y: 0, visualOffset: { x: 0, y: 0 } },
    { id: 'site_a', x: 4, y: 0, visualOffset: { x: 0, y: 0 } },
    { id: 'site_b', x: 5, y: 0, visualOffset: { x: 0, y: 0 } },
    { id: 'site_c', x: 6, y: 0, visualOffset: { x: 0, y: 0 } },
    { id: 'site_d', x: 6, y: 1, visualOffset: { x: 0, y: 0 } },
  ]);
  const points = ['site_a', 'site_b', 'site_c', 'site_d'].map((id) => ({
    id,
    left: Number(layout.get(id).left),
    top: Number(layout.get(id).top),
  }));

  for (let index = 0; index < points.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < points.length; nextIndex += 1) {
      const distance = Math.hypot(points[index].left - points[nextIndex].left, points[index].top - points[nextIndex].top);
      assert.ok(distance >= 9.5, `${points[index].id} and ${points[nextIndex].id} overlap too closely: ${distance}`);
    }
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UIStatePresenter = require('./UIStatePresenter');
const BuildingPresenter = require('./presenters/BuildingPresenter');
const FamousPersonPresenter = require('./presenters/FamousPersonPresenter');
const TalentPolicyPresenter = require('./presenters/TalentPolicyPresenter');

test('UIStatePresenter merges server-planned explorer tiles into the world tile view', () => {
  const view = UIStatePresenter.buildWorldTileMapViewState({
    worldMap: {
      version: 1,
      seed: 'presenter-explorer-seed',
      tiles: [{
        id: 'tile_0_0',
        q: 0,
        r: 0,
        terrain: 'capital',
        visibility: 'controlled',
        siteId: 'capital',
      }],
    },
    territories: [{
      id: 'capital',
      x: 0,
      y: 0,
      type: 'capital',
      owner: 'player',
      status: 'occupied',
      cityName: 'Capital',
    }],
    scoutMissions: [],
  }, {
    worldExplorerState: {
      activeMission: {
        id: 'explore-1',
        status: 'active',
        route: [
          { q: 1, r: 0, step: 1, tileId: 'tile_1_0', revealed: false },
          { q: 2, r: 0, step: 2, tileId: 'tile_2_0', revealed: false },
        ],
        plannedTiles: [
          { id: 'tile_1_0', q: 1, r: 0, terrain: 'plains', visibility: 'scouted' },
          { id: 'tile_2_0', q: 2, r: 0, terrain: 'forest', visibility: 'scouted' },
        ],
        revealedTileIds: [],
      },
    },
  });

  assert.equal(view.tiles.some((tile) => tile.id === 'tile_1_0' && tile.terrain === 'plains'), true);
  assert.equal(view.tiles.some((tile) => tile.id === 'tile_2_0' && tile.terrain === 'forest'), true);
  assert.equal(view.activeScouts.length, 1);
  assert.equal(view.activeScouts[0].kind, 'worldExplore');
  assert.equal(view.activeScouts[0].route.length, 2);
});

test('UIStatePresenter delegates famous person view state while preserving facade contracts', () => {
  const state = {
    famousPersons: {
      count: 2,
      maxCandidates: 3,
      seek: { available: true, count: 1, message: 'Ready' },
      people: [
        {
          id: 'hero-common',
          name: 'Common Hero',
          quality: 'common',
          level: 1,
          attributes: { command: 10, force: 10, intelligence: 10, politics: 10, charisma: 10, speed: 10 },
        },
        {
          id: 'hero-great',
          name: 'Great Hero',
          quality: 'great',
          level: 12,
          freeAttributePoints: 1,
          attributes: { command: 40, force: 33, intelligence: 54, politics: 24, charisma: 41, speed: 29 },
          abilityKit: {
            abilities: [{
              id: 'skill-1',
              name: 'Trail Sense',
              slot: 'scoutTrait',
              kind: 'civil',
              effects: [{ key: 'scoutReportBonusPct', value: 0.2 }],
            }],
          },
        },
      ],
      candidates: [{ id: 'candidate-1', name: 'Candidate', quality: 'good', attributes: {} }],
    },
  };

  const view = UIStatePresenter.buildFamousPersonViewState(state, { selectedPersonId: 'hero-great' });
  const direct = FamousPersonPresenter.buildFamousPersonViewState(state, { selectedPersonId: 'hero-great' });

  assert.deepEqual(view, direct);
  assert.equal(view.people[0].id, 'hero-great');
  assert.equal(view.selectedPerson.id, 'hero-great');
  assert.equal(view.selectedPerson.skillDetails[0].kindText, '斥候特质');
  assert.deepEqual(view.candidates[0].acceptAction, { type: 'acceptFamousPerson', candidateId: 'candidate-1' });
  assert.equal(UIStatePresenter.formatFamousPersonSkill({ name: 'Aptitude', effects: [{ key: 'knowledgeOutputPct', value: 0.15 }] }).includes('知识产出提高 15%'), true);
});

test('UIStatePresenter delegates building view state while preserving facade contracts', () => {
  const buildingConfig = {
    categories: {
      agriculture: { label: '农业', order: 1 },
      livelihood: { label: '民生', order: 2 },
      military: { label: '军事', order: 3 },
    },
    house: {
      id: 'house',
      name: '民居',
      category: 'livelihood',
      maxLevel: 3,
      effects: { perLevel: { populationCap: 2 } },
      ui: {
        description: '容纳更多人口。',
        effectText: [{ field: 'populationCapBonus', label: '人口上限' }],
      },
      maintenance: { habitabilityPressure: 0.5, perLevelPerMinute: { food: 0.3 } },
    },
    farm: {
      id: 'farm',
      name: '农田',
      category: 'agriculture',
      maxLevel: 5,
      effects: { perLevel: { foodOutputMultiplier: 0.2 } },
      ui: {
        description: '提供稳定粮食。',
        effectText: [{ field: 'foodOutputBonus', label: '粮食', format: 'percent' }],
      },
      maintenance: { habitabilityPressure: 0, perLevelPerMinute: {} },
    },
    barracks: {
      id: 'barracks',
      name: '兵营',
      category: 'military',
      maxLevel: 2,
      military: {
        soldierCapByLevel: [0, 20, 40],
        trainingIntervalSecondsByLevel: [0, 30, 20],
        trainingBatchSizeByLevel: [0, 1, 2],
      },
      effects: { perLevel: { defense: 1 } },
      ui: { effectText: [] },
      maintenance: { habitabilityPressure: 1.2, perLevelPerMinute: { food: 0.6 } },
    },
  };
  const state = {
    unlockedBuildings: ['house', 'farm', 'barracks'],
    buildings: { house: { level: 1 }, farm: 0, barracks: 1 },
    buildingCosts: {
      house: { wood: 15 },
      farm: { food: 5, wood: 10 },
      barracks: { wood: 50 },
    },
    resources: { food: 20, wood: 12 },
    softGuide: { mode: 'strong', target: 'card-farm' },
    military: { soldiers: 3, soldierCap: 20, trainingProgress: 4, trainingIntervalSeconds: 30, trainingBatchSize: 1, defense: 2 },
    buildingEffects: {
      byBuilding: { house: { level: 1, populationCapBonus: 2 } },
      threatDefense: 1,
    },
  };
  const tutorial = { currentStep: 7, completed: false };

  const view = UIStatePresenter.buildBuildingViewState(state, tutorial, buildingConfig, { activeCategory: 'all' });
  const direct = BuildingPresenter.buildBuildingViewState(state, tutorial, buildingConfig, { activeCategory: 'all' });

  assert.deepEqual(view, direct);
  assert.equal(typeof UIStatePresenter.buildBuildingViewState, 'function');
  assert.equal(view.cards.length, 3);
  assert.equal(view.cards.find((card) => card.id === 'farm').button.disabled, false);
  assert.equal(view.cards.find((card) => card.id === 'house').button.label, '引导中锁定');
  assert.equal(view.cards.find((card) => card.id === 'barracks').militaryLines[0], '士兵 3/20 · 防御 3');
  assert.deepEqual(UIStatePresenter.buildCostViewState({ wood: 1234 }).parts[0], { resource: 'wood', value: 1234, text: '1.2k' });
});

test('UIStatePresenter delegates talent policy view state while preserving facade contracts', () => {
  const state = {
    currentEra: 2,
    population: { total: 9 },
    talentPolicies: {
      activePolicyId: 'balanced',
      defaultTiers: { agriculture: 2, knowledge: 2, industry: 2 },
      systemPolicies: [
        { id: 'balanced', label: '均衡发展', weights: { farmer: 1, scholar: 1, craftsman: 1 }, priority: ['farmer', 'scholar', 'craftsman'] },
        { id: 'knowledge', label: '知识优先', weights: { farmer: 1, scholar: 3, craftsman: 1 }, priority: ['scholar', 'farmer', 'craftsman'] },
      ],
      tendencies: [
        { id: 'agriculture', label: '农业', role: 'farmer' },
        { id: 'knowledge', label: '知识', role: 'scholar' },
        { id: 'industry', label: '工业', role: 'craftsman' },
      ],
    },
  };
  const uiState = { selectedBasePolicyId: 'knowledge', tiers: { agriculture: 1, knowledge: 3, industry: 2 } };

  const view = UIStatePresenter.buildTalentPolicyViewState(state, uiState);
  const direct = TalentPolicyPresenter.buildTalentPolicyViewState(state, uiState);

  assert.deepEqual(view, direct);
  assert.equal(view.draft.displayName, '知识优先·偏知识');
  assert.equal(view.preview.allocation.scholar > view.preview.allocation.farmer, true);
  assert.deepEqual(UIStatePresenter.getTalentPolicyAvailableRoles(state), ['farmer', 'scholar', 'craftsman']);
});

test('index.html loads focused state presenters before UIStatePresenter facade', () => {
  const htmlPath = path.resolve(__dirname, '../../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const expectedOrder = [
    'TechPresenter.js',
    'BuildingPresenter.js',
    'FamousPersonPresenter.js',
    'TalentPolicyPresenter.js',
    'UIStatePresenter.js',
  ];
  const positions = expectedOrder.map((name) => html.indexOf(name));

  positions.forEach((position, index) => {
    assert.notEqual(position, -1, `${expectedOrder[index]} should be loaded`);
    if (index > 0) assert.equal(positions[index - 1] < position, true, `${expectedOrder[index - 1]} should load before ${expectedOrder[index]}`);
  });
});

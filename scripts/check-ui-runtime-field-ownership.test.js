const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { inspectUiRuntimeOwnership } = require('./check-ui-runtime-field-ownership');

function writeFile(root, relativePath, text) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function createFixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-runtime-ownership-'));
  const stores = overrides.stores || [
    {
      store: 'UiRuntimeStateStore',
      path: 'frontend/js/state/UiRuntimeStateStore.js',
      fields: overrides.uiFields || ['activeTab', 'militaryView'],
      approvedCompatibilityFiles: ['frontend/js/platform/AllowedAdapter.js'],
    },
    {
      store: 'ModalStore',
      path: 'frontend/js/state/ModalStore.js',
      fields: ['showLogs'],
      approvedCompatibilityFiles: [],
    },
    {
      store: 'BattleStore',
      path: 'frontend/js/state/BattleStore.js',
      fields: ['entityBattle'],
      approvedCompatibilityFiles: [],
    },
    {
      store: 'TerritoryUiStateStore',
      path: 'frontend/js/state/TerritoryUiStateStore.js',
      fields: ['worldPanX'],
      approvedCompatibilityFiles: [],
    },
    {
      store: 'TutorialRuntimeStore',
      path: 'frontend/js/state/TutorialRuntimeStore.js',
      fields: ['tutorialHighlight'],
      approvedCompatibilityFiles: [],
    },
  ];
  stores.forEach((store) => {
    const exportedFields = overrides.exportedFields?.[store.store] || store.fields;
    writeFile(root, store.path, `
      module.exports = Object.freeze({
        OWNED_UI_RUNTIME_FIELDS: ${JSON.stringify(exportedFields)}
      });
    `);
  });
  writeFile(root, 'frontend/js/state/UiRuntimeFieldOwnershipManifest.json', JSON.stringify({
    schema: 'ui-runtime-field-ownership-v1',
    stores,
  }, null, 2));
  writeFile(root, 'frontend/js/platform/AllowedAdapter.js', 'module.exports = host => host.activeTab;\n');
  if (overrides.extraSource) {
    Object.entries(overrides.extraSource).forEach(([relativePath, text]) => writeFile(root, relativePath, text));
  }
  return root;
}

test('ui runtime field ownership gate accepts the live repo', () => {
  const report = inspectUiRuntimeOwnership();
  assert.deepEqual(report.violations, []);
});

test('ui runtime field ownership FIRE: duplicate field owners are blocked', () => {
  const root = createFixture({
    stores: [
      {
        store: 'UiRuntimeStateStore',
        path: 'frontend/js/state/UiRuntimeStateStore.js',
        fields: ['activeTab'],
        approvedCompatibilityFiles: [],
      },
      {
        store: 'ModalStore',
        path: 'frontend/js/state/ModalStore.js',
        fields: ['activeTab'],
        approvedCompatibilityFiles: [],
      },
    ],
  });
  const report = inspectUiRuntimeOwnership({ repoRoot: root });
  assert.equal(report.violations.some((violation) => violation.includes('owned by both')), true);
});

test('ui runtime field ownership FIRE: store fields must match the manifest', () => {
  const root = createFixture({
    exportedFields: {
      UiRuntimeStateStore: ['activeTab', 'militaryView', 'armyFormationEditor'],
    },
  });
  const report = inspectUiRuntimeOwnership({ repoRoot: root });
  assert.equal(
    report.violations.some((violation) =>
      violation.includes('UiRuntimeStateStore.OWNED_UI_RUNTIME_FIELDS does not match manifest'),
    ),
    true,
  );
});

test('ui runtime field ownership FIRE: UiRuntimeStateStore cannot own ECS simulation fields', () => {
  const root = createFixture({
    uiFields: ['activeTab', 'worldFrame'],
  });
  const report = inspectUiRuntimeOwnership({ repoRoot: root });
  assert.equal(
    report.violations.some((violation) =>
      violation.includes('UiRuntimeStateStore owns ECS simulation-like field: worldFrame'),
    ),
    true,
  );
});

test('ui runtime field ownership FIRE: unapproved direct host field access is blocked', () => {
  const root = createFixture({
    extraSource: {
      'frontend/js/platform/NewBypass.js': 'module.exports = function read(host) { return host.activeTab; };\n',
    },
  });
  const report = inspectUiRuntimeOwnership({ repoRoot: root });
  assert.equal(
    report.violations.some((violation) =>
      violation.includes('NewBypass.js') && violation.includes('outside UiRuntimeStateStore'),
    ),
    true,
  );
});

test('ui runtime field ownership FIRE: bypass scan covers the existing store family', () => {
  const root = createFixture({
    extraSource: {
      'frontend/js/platform/ModalBypass.js': 'module.exports = function read(host) { return host.showLogs; };\n',
      'frontend/js/platform/BattleBypass.js': 'module.exports = function read(game) { return game.entityBattle; };\n',
      'frontend/js/platform/TerritoryBypass.js': 'module.exports = function read(owner) { return owner.worldPanX; };\n',
      'frontend/js/platform/TutorialBypass.js': 'module.exports = function read(shell) { return shell.tutorialHighlight; };\n',
    },
  });
  const report = inspectUiRuntimeOwnership({ repoRoot: root });

  assert.equal(
    report.violations.some((violation) =>
      violation.includes('ModalBypass.js') && violation.includes('outside ModalStore'),
    ),
    true,
  );
  assert.equal(
    report.violations.some((violation) =>
      violation.includes('BattleBypass.js') && violation.includes('outside BattleStore'),
    ),
    true,
  );
  assert.equal(
    report.violations.some((violation) =>
      violation.includes('TerritoryBypass.js') && violation.includes('outside TerritoryUiStateStore'),
    ),
    true,
  );
  assert.equal(
    report.violations.some((violation) =>
      violation.includes('TutorialBypass.js') && violation.includes('outside TutorialRuntimeStore'),
    ),
    true,
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  findRetiredLayerReferencesInText,
  parseFormat,
  renderText,
  scanFrontendEcsSourceLayout,
} = require('./check-frontend-ecs-source-layout');

const RETIRED = ['do', 'main'].join('');
const RETIRED_MODEL_TOKEN = `${'Do'}${'main'}`;

function writeFile(repoRoot, file, text) {
  const fullPath = path.join(repoRoot, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, text);
}

test('frontend ECS source layout guard flags retired layer paths', () => {
  const findings = findRetiredLayerReferencesInText(
    `frontend/js/${RETIRED}/WorldMapVisibilityModel.js`,
    'const x = 1;\n',
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'retired-path');
});

test('frontend ECS source layout guard flags pseudo-migrated ECS retired paths', () => {
  const findings = findRetiredLayerReferencesInText(
    `frontend/js/ecs/${RETIRED}/FogOwner.js`,
    'const x = 1;\n',
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'retired-path');
});

test('frontend ECS source layout guard flags runtime imports and entry scripts', () => {
  const findings = findRetiredLayerReferencesInText(
    'frontend/js/platform/Foo.js',
    [
      `const TileCoord = require('../${RETIRED}/TileCoord');`,
      `<script src="js/${RETIRED}/WorldMapVisibilityModel.js"></script>`,
      "import x from './ecs/World.js';",
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ['retired-import', 'retired-import'],
  );
});

test('frontend ECS source layout guard flags retired owner symbols', () => {
  const findings = findRetiredLayerReferencesInText(
    'frontend/js/ecs/owner/Foo.js',
    [
      `const namespace = ${RETIRED_MODEL_TOKEN}Namespace;`,
      `const owner = Battle${RETIRED_MODEL_TOKEN}Owner.create();`,
      'const ok = EcsBattleOwner.createBattleOwner();',
    ].join('\n'),
  );
  assert.deepEqual(
    findings.map((finding) => finding.kind),
    ['retired-symbol', 'retired-symbol'],
  );
});

test('frontend ECS source layout guard scans production frontend files and skips tests', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecs-source-layout-'));
  writeFile(repoRoot, `frontend/js/${RETIRED}/Bad.js`, 'global.Bad = {};\n');
  writeFile(repoRoot, 'frontend/js/platform/Bad.js', `require('../${RETIRED}/Bad');\n`);
  writeFile(
    repoRoot,
    'frontend/js/platform/SymbolBad.js',
    `global.Bad = ${RETIRED_MODEL_TOKEN}Namespace;\n`,
  );
  writeFile(repoRoot, 'frontend/js/platform/Bad.test.js', `require('../${RETIRED}/Bad');\n`);
  writeFile(repoRoot, 'frontend/index.html', `<script src="js/${RETIRED}/Bad.js"></script>\n`);
  writeFile(repoRoot, 'frontend/js/ecs/system/Good.js', 'global.Good = {};\n');

  const report = scanFrontendEcsSourceLayout({ repoRoot });

  assert.equal(report.summary.totalViolations, 4);
  assert.equal(
    report.violations.some((violation) => violation.file === 'frontend/js/platform/Bad.test.js'),
    false,
  );
  assert.equal(renderText(report).includes('frontend-ecs-source-layout'), true);
});

test('frontend ECS source layout guard rejects unknown CLI flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
});

test('frontend ECS source layout guard allows json format', () => {
  assert.equal(parseFormat(['--json']), 'json');
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  STEP1_CHECKS,
  buildReport,
  renderSummary,
} = require('./report-command-owner-step1');
const { classifyFixtureSample } = require('./command-owner-step1/anti-evasion');
const { scanFrontendDirectSubmits } = require('./command-owner-step1/scanner');

const repoRoot = path.resolve(__dirname, '..');

test('command owner Step1 report runs and emits all 12 checks', () => {
  const report = buildReport({ repoRoot });
  assert.equal(report.checks.length, 12);
  assert.deepEqual(report.checks.map((check) => check.id), STEP1_CHECKS.map((check) => check.id));
  assert.equal(report.summary.totalChecks, 12);
  assert.equal(report.summary.inventoryDriftFindings, 0);
  const scannedDirectSubmitKeys = new Set(
    report.scanResults.frontendDirectSubmits.map((item) => item.callSiteKey),
  );
  assert.ok(scannedDirectSubmitKeys.has('frontend/js/platform/GameCommandService.js:143:research'));
  assert.ok(scannedDirectSubmitKeys.has('frontend/js/platform/GameCommandService.js:173:switchCity'));
  assert.match(renderSummary(report), /checks defined: 12/);
});

test('command owner Step1 drift detection reports a synthetic undeclared write route', () => {
  const base = buildReport({ repoRoot }).scanResults;
  const scanResults = {
    ...base,
    serverWriteRoutes: [
      ...base.serverWriteRoutes,
      {
        key: 'POST /api/synthetic/uninventoried-write',
        route: '/api/synthetic/uninventoried-write',
        method: 'POST',
        file: 'backend/routes/syntheticRoutes.js',
        line: 7,
        evidence: ['backend/routes/syntheticRoutes.js:7'],
        classification: 'write-route',
        summary: 'POST /api/synthetic/uninventoried-write',
      },
    ],
  };
  const report = buildReport({ repoRoot, scanResults });
  const writeInventory = report.checks.find((check) => check.id === 'write-command-inventory');
  assert.ok(writeInventory.findings.some((finding) => (
    finding.classification === 'inventory-drift-undeclared-server-write-route'
    && finding.summary.includes('/api/synthetic/uninventoried-write')
  )));
});

test('direct-submit anti-evasion catches an aliased GameAPI receiver', () => {
  const actual = classifyFixtureSample('const svc = this.host.api; return svc.claimConquest(action.territoryId);');
  assert.ok(actual.includes('direct-submit'));
});

test('direct-submit anti-evasion catches a getApi accessor receiver', () => {
  const actual = classifyFixtureSample('return this.getApi().research(techId);');
  assert.ok(actual.includes('direct-submit'));
});

test('frontend direct-submit scanner catches an aliased GameAPI receiver fixture', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'command-owner-step1-'));
  try {
    const fixtureDir = path.join(tempRoot, 'frontend', 'js', 'controllers');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'AliasController.js'), [
      "'use strict';",
      'function submit(host, territoryId) {',
      '  const svc = host.api;',
      '  return svc.claimConquest(territoryId);',
      '}',
      'module.exports = { submit };',
      '',
    ].join('\n'), 'utf8');
    const hits = scanFrontendDirectSubmits(tempRoot);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].helper, 'claimConquest');
    assert.equal(hits[0].file, 'frontend/js/controllers/AliasController.js');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('frontend direct-submit scanner catches a getApi accessor receiver fixture', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'command-owner-step1-'));
  try {
    const fixtureDir = path.join(tempRoot, 'frontend', 'js', 'platform');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'GameCommandService.js'), [
      "'use strict';",
      'class GameCommandService {',
      '  getApi() { return this.api; }',
      '  submit(techId) {',
      '    return this.getApi().research(techId);',
      '  }',
      '}',
      'module.exports = GameCommandService;',
      '',
    ].join('\n'), 'utf8');
    const hits = scanFrontendDirectSubmits(tempRoot);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].helper, 'research');
    assert.equal(hits[0].file, 'frontend/js/platform/GameCommandService.js');
    assert.equal(hits[0].submissionClassification, 'compatibility-direct-submit');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  classifyLayer,
  collectSignals,
  findDomainBusinessCandidatesInText,
  isAllowedDomainOwner,
  isSourceFile,
  parseFormat,
  scanDomainBusinessCandidates,
} = require('./report-domain-business-candidates');

test('domain business scan classifies authority owners and review layers by structure', () => {
  assert.equal(isSourceFile('frontend/js/platform/renderers/FamousRenderer.js'), true);
  assert.equal(isSourceFile('frontend/js/platform/renderers/FamousRenderer.test.js'), false);
  assert.equal(isAllowedDomainOwner('backend/services/FamousPersonService.js'), true);
  assert.equal(isAllowedDomainOwner('backend/routes/gameRoutes.js'), false);
  assert.deepEqual(classifyLayer('frontend/js/platform/renderers/FamousRenderer.js'), {
    layer: 'frontend-renderer',
    reviewRequired: true,
    note: 'renderer should consume snapshots and emit intents, not own gameplay rules',
  });
  assert.equal(classifyLayer('backend/services/FamousPersonService.js').reviewRequired, false);
});

test('domain business scan detects feature behavior, not the word domain', () => {
  const findings = findDomainBusinessCandidatesInText(
    'frontend/js/platform/renderers/FamousRenderer.js',
    [
      'if (player.gold >= summonCost) acceptFamousPerson(person);',
      'gameState.resources.gold -= summonCost;',
      'const portraitWidth = 180;',
    ].join('\n'),
  );

  assert.equal(findings.length, 2);
  assert.equal(findings[0].signals.includes('gameplay-rule-branch'), true);
  assert.equal(findings[0].signals.includes('gameplay-result-verb'), true);
  assert.equal(findings[1].signals.includes('authority-state-mutation'), true);
  assert.equal(findings[1].signals.includes('resource-or-stat-delta'), true);
  assert.equal(findings.every((finding) => finding.severity === 'high'), true);
});

test('domain business scan ignores comments, strings, render constants, and owner services', () => {
  assert.deepEqual(
    findDomainBusinessCandidatesInText(
      'frontend/js/platform/renderers/FamousRenderer.js',
      [
        '// gameState.resources.gold -= 100;',
        "const text = 'reward gold 100';",
        'const tileWidth = 128;',
        'const territory = this.getTerritoryController();',
        'if (!battleScene?.visible) return false;',
      ].join('\n'),
    ),
    [],
  );
  assert.deepEqual(
    findDomainBusinessCandidatesInText(
      'backend/services/FamousPersonService.js',
      'gameState.resources.gold -= summonCost;\n',
    ),
    [],
  );
});

test('domain business scan ignores pure action routing in platform controllers', () => {
  assert.deepEqual(
    findDomainBusinessCandidatesInText(
      'frontend/js/platform/CanvasActionController.js',
      [
        "case 'advanceEra': return this.handle_advanceEra;",
        "if (typeof game?.research === 'function') return game.research(action.techId);",
        'return this.api.claimConquest(territoryId);',
      ].join('\n'),
    ),
    [],
  );
});

test('domain business scan distinguishes backend route rule math from delegation', () => {
  const direct = findDomainBusinessCandidatesInText(
    'backend/routes/gameRoutes.js',
    'state.resources.food += 50;\n',
  );
  assert.equal(direct.length, 1);
  assert.equal(direct[0].layer, 'backend-route');
  assert.equal(direct[0].severity, 'medium');

  const delegation = findDomainBusinessCandidatesInText(
    'backend/routes/gameRoutes.js',
    'const result = FamousPersonService.acceptFamousPerson(req.body);\n',
  );
  assert.deepEqual(delegation, []);
});

test('domain business scan can scan a temporary repo baseline', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-business-candidates-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(repoRoot, 'backend', 'services'), { recursive: true });
    fs.mkdirSync(path.join(repoRoot, 'backend', 'routes'), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers', 'FamousRenderer.js'),
      'gameState.resources.gold -= summonCost;\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'backend', 'services', 'FamousPersonService.js'),
      'gameState.resources.gold -= summonCost;\n',
    );
    fs.writeFileSync(
      path.join(repoRoot, 'backend', 'routes', 'gameRoutes.js'),
      'state.resources.food += 50;\n',
    );

    const report = scanDomainBusinessCandidates({ repoRoot });
    assert.equal(report.summary.totalFindings, 2);
    assert.deepEqual(report.summary.byLayer, {
      'backend-route': 1,
      'frontend-renderer': 1,
    });
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('domain business scan format parser rejects unknown flags', () => {
  assert.throws(() => parseFormat(['--wat']), /unknown arguments/);
  assert.equal(parseFormat(['--json', '--summary']), 'json');
  assert.equal(parseFormat(['--markdown']), 'markdown');
});

test('domain business signal collector requires structural gameplay evidence', () => {
  assert.deepEqual(collectSignals('const width = 100;'), []);
  assert.equal(
    collectSignals('if (player.gold >= summonCost) grantReward(person);').includes(
      'gameplay-rule-branch',
    ),
    true,
  );
});

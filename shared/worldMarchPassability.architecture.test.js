const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

// ENFORCEMENT GATE (architecture fitness function).
//
// The world-march passability rule — "ocean blocks a land march" — must live in
// exactly ONE file: shared/worldMarchPassability.js. No consumer (route policy,
// route planner, HUD, hit-targets, handlers, API) may re-derive it with a raw
// terrain comparison; they must call the shared rule and consume its verdict.
//
// This test FAILS THE BUILD if the rule is re-scattered, so the architecture
// standard (docs/architecture/module-pipeline-and-observability-standard.md) is
// machine-checked, not advisory. This is the answer to "the gates are for show".
const RULE_FILE = 'shared/worldMarchPassability.js';
const CONSUMERS = [
  'frontend/js/domain/WorldMarchRoutePolicy.js',
  'backend/services/worldExplorer/WorldExplorerRoutePlanner.js',
  'frontend/js/platform/renderers/WorldMarchHudCanvasRenderer.js',
  'frontend/js/platform/renderers/WorldMapHitTargetModel.js',
  'frontend/js/platform/renderers/WorldMapHitTargetFacade.js',
  'frontend/js/platform/CanvasTerritoryActionHandlers.js',
  'frontend/js/platform/CanvasGameAppCommands.js',
  'frontend/js/api/GameAPI.js',
];
// Matches a tile's terrain being compared to ocean — `.terrain === 'ocean'` /
// `?.terrain !== 'ocean'` — i.e. a raw march-passability decision. Deliberately
// does NOT match terrain-classification on a plain variable (e.g.
// `mapTerrain === 'ocean'` mapping to a 'coast' planning terrain), which is a
// different concern from "can this army march here".
const RAW_OCEAN_RULE = /\.terrain\s*[!=]==\s*['"]ocean['"]/;

test('world-march passability rule is defined only in shared/worldMarchPassability.js', () => {
  const ruleSrc = fs.readFileSync(path.join(repoRoot, RULE_FILE), 'utf8');
  assert.ok(
    ruleSrc.includes('LAND_IMPASSABLE_TERRAIN'),
    'the passability rule must be defined in the shared C module',
  );

  const offenders = [];
  for (const rel of CONSUMERS) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    if (RAW_OCEAN_RULE.test(fs.readFileSync(abs, 'utf8'))) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    `These files re-derive the march passability rule with a raw 'ocean' comparison instead of calling shared/worldMarchPassability:\n${offenders.join('\n')}`,
  );
});

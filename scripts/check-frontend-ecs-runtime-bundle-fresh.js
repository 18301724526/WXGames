'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { build, outfile } = require('./build-frontend-ecs-runtime');

// Blocking gate: frontend/js/ecs/runtime/EcsModeRuntimeBundle.js is the ONLY approved
// ECS runtime surface, and it is a GENERATED artifact (esbuild + prettier) of the
// ecs/mode|input|snapshot sources via EcsModeRuntimeEntry.js. If someone edits an ecs
// source but forgets `npm run build:ecs-runtime`, the bundle silently drifts from its
// sources -- the runtime then runs stale code. This guard regenerates the bundle in
// memory and asserts it byte-matches the committed file (ignoring only EOL/trailing
// whitespace), so drift becomes a loud build failure instead of a runtime mystery.

function normalize(text) {
  return `${String(text)
    .replace(/\r\n/g, '\n')
    .replace(/[\s]+$/, '')}\n`;
}

async function checkBundleFresh() {
  const fresh = await build({ write: false });
  const committed = fs.readFileSync(outfile, 'utf8');
  return { drifted: normalize(fresh) !== normalize(committed), outfile };
}

function renderText(result) {
  const rel = path.relative(process.cwd(), result.outfile).replace(/\\/g, '/');
  if (!result.drifted) {
    return `[frontend-ecs-runtime-bundle-fresh] passed: ${rel} matches a fresh build of its ecs sources`;
  }
  return [
    '[frontend-ecs-runtime-bundle-fresh] FAILED: committed bundle is STALE',
    `  ${rel} does not match a fresh build of the ecs sources.`,
    '  Run:  npm run build:ecs-runtime   (then commit the regenerated bundle).',
  ].join('\n');
}

if (require.main === module) {
  checkBundleFresh()
    .then((result) => {
      console.log(renderText(result));
      process.exit(result.drifted ? 1 : 0);
    })
    .catch((error) => {
      console.error(`[frontend-ecs-runtime-bundle-fresh] error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { checkBundleFresh, normalize, renderText };

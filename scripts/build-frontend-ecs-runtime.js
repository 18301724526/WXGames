const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
const prettier = require('prettier');

const repoRoot = path.resolve(__dirname, '..');
const entryPoint = path.join(repoRoot, 'frontend/js/ecs/mode/EcsModeRuntimeEntry.js');
const outfile = path.join(repoRoot, 'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js');

async function build() {
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format: 'iife',
    globalName: 'EcsModeRuntime',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: false,
    legalComments: 'none',
    logLevel: 'silent',
  });
  const source = await fs.readFile(outfile, 'utf8');
  const config = (await prettier.resolveConfig(outfile)) || {};
  const formatted = await prettier.format(`/* eslint-disable */\n${source}`, {
    ...config,
    filepath: outfile,
  });
  await fs.writeFile(outfile, formatted);
  console.log(
    `[build-frontend-ecs-runtime] wrote ${path.relative(repoRoot, outfile).replace(/\\/g, '/')}`,
  );
}

if (require.main === module) {
  build().catch((error) => {
    console.error(`[build-frontend-ecs-runtime] failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { build, entryPoint, outfile };

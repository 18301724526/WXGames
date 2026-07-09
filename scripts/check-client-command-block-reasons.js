const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_ROOTS = [
  path.join(ROOT, 'frontend/js'),
];
const ALLOWED_REASONS = new Set(['IN_FLIGHT', 'DUPLICATE_COMMAND_ID', 'PAYLOAD_SHAPE', 'UI_NOT_READY']);
const DOMAIN_REASONS = /resources?|tutorial|era|tech|cooldown|march|candidate|territory|reward|encounter|loot|boss|eligible|claimable|ready|can[A-Z]/i;
const failures = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

for (const file of SCAN_ROOTS.flatMap(walk).filter((item) => item.endsWith('.js') && !item.endsWith('.test.js'))) {
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes('commandDisabled')) return;
    const literal = line.match(/commandDisabled\s*:\s*['"]([^'"]+)['"]/);
    if (literal && !ALLOWED_REASONS.has(literal[1])) {
      failures.push(`${relative}:${index + 1} invalid commandDisabled reason ${literal[1]}`);
    }
    if (DOMAIN_REASONS.test(line) && !/commandDisabled\s*:\s*(?:false|['"](?:IN_FLIGHT|DUPLICATE_COMMAND_ID|PAYLOAD_SHAPE|UI_NOT_READY)['"])/.test(line)) {
      failures.push(`${relative}:${index + 1} domain signal appears in commandDisabled`);
    }
  });
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('client command block reason guard passed');

// Blocking guard: no module-load-time capture of the locale runtime.
//
// `const LocaleText = (() => global.LocaleText || ... )()` freezes whatever existed
// when the script loaded; a bare script that loads before LocaleText.js captures null
// and renders raw keys forever (seen live: the world-map march actor label showed
// `military.formation.default`). Locale access must resolve AT CALL TIME
// (`resolveLocaleText()` pattern), which is immune to script order everywhere.
//
// Scope: frontend/js/ecs (bare-loaded early) is where the trap has bitten; keep the
// whole frontend honest so new files copy the safe pattern, with the platform layer
// grandfathered until its own cleanup batch.
const fs = require('node:fs');
const path = require('node:path');

const SCAN_ROOTS = ['frontend/js/ecs'];
const LOAD_TIME_CAPTURE = /const\s+LocaleText\s*=\s*\(\s*\(\s*\)\s*=>/;

function collectFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, files);
    else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(entryPath);
    }
  }
  return files;
}

const violations = [];
for (const root of SCAN_ROOTS) {
  for (const file of collectFiles(root)) {
    if (file.replace(/\\/g, '/').endsWith('ecs/runtime/EcsModeRuntimeBundle.js')) continue;
    const source = fs.readFileSync(file, 'utf8');
    const match = source.match(LOAD_TIME_CAPTURE);
    if (!match) continue;
    const line = source.slice(0, source.indexOf(match[0])).split('\n').length;
    violations.push(`${file.replace(/\\/g, '/')}:${line}`);
  }
}

if (violations.length) {
  console.error('Blocked module-load-time LocaleText capture (resolve at call time instead):');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('Use the resolveLocaleText() call-time pattern; see FogRevealModel.js for the shape.');
  process.exit(1);
}

console.log('[locale-lazy-resolution] passed');

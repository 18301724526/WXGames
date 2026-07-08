// Blocking guard: every locale key referenced as a string literal in a frontend
// t()/translate() call must exist in LocaleTextRegistry (zh-CN). A miss renders the
// raw key on the canvas (LocaleText.t falls back to the key), which is exactly the
// `military.formation.default` class of leak seen live. Dynamic keys (t(variable),
// template strings) cannot be verified statically and are out of scope here — keep
// their sources enumerable and registered.
const fs = require('node:fs');
const path = require('node:path');

const LocaleTextRegistry = require('../frontend/js/config/LocaleTextRegistry');

const SCAN_ROOTS = ['frontend/js', 'frontend/minigame'];
const EXCLUDED_FILES = [/\.test\.js$/, /ecs[\\/]runtime[\\/]EcsModeRuntimeBundle\.js$/, /vendor[\\/]/];
// A locale key literal: dotted lowercase-led segments, no spaces or slashes.
const KEY_SHAPE = /^[a-z][a-zA-Z0-9_-]*(\.[a-zA-Z0-9_-]+)+$/;
// Call sites that translate: t('...'), this.t('...'), translate('...'), tr('...', ...)
// including fallback-literal forms like t(x || 'key'). We take every key-shaped string
// literal on a line that contains a translator call.
const TRANSLATOR_LINE = /(^|[^a-zA-Z0-9_.])(t|translate)\s*\(/;
const CANVAS_TRANSLATE = /(ctx|context|surface|canvas|\w*[Cc]tx)\s*\.\s*translate\s*\(/;
const STRING_LITERAL = /(['"])((?:\\.|(?!\1).)*)\1/g;

function collectFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'vendor') continue;
      collectFiles(entryPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      if (EXCLUDED_FILES.some((pattern) => pattern.test(entryPath))) continue;
      files.push(entryPath);
    }
  }
  return files;
}

function hasKey(key) {
  const text = LocaleTextRegistry.getText?.(key, 'zh-CN');
  return text !== null && text !== undefined;
}

const missing = new Map();
for (const root of SCAN_ROOTS) {
  for (const file of collectFiles(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (!TRANSLATOR_LINE.test(line)) return;
      if (CANVAS_TRANSLATE.test(line) && !/\bthis\.t\(|[^.\w]t\(/.test(line)) return;
      for (const match of line.matchAll(STRING_LITERAL)) {
        const literal = match[2];
        if (!KEY_SHAPE.test(literal)) continue;
        if (hasKey(literal)) continue;
        const site = `${file.replace(/\\/g, '/')}:${index + 1}`;
        if (!missing.has(literal)) missing.set(literal, []);
        missing.get(literal).push(site);
      }
    });
  }
}

if (missing.size) {
  console.error('Blocked unregistered locale keys (would render as raw keys on canvas):');
  for (const [key, sites] of missing) {
    console.error(`- '${key}' referenced at ${sites.slice(0, 3).join(', ')}`);
  }
  console.error('Register the key in LocaleTextRegistry (zh-CN AND en-US) or fix the call.');
  process.exit(1);
}

console.log('[locale-key-coverage] passed');

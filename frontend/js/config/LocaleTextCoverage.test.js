const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LocaleTextRegistry = require('./LocaleTextRegistry');

const FRONTEND_JS = path.join(__dirname, '..');

// Files that legitimately do not resolve runtime keys against the catalog.
const SKIP_FILES = new Set(['LocaleTextRegistry.js', 'LocaleText.js']);

function collectSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'vendor') continue;
      collectSourceFiles(full, acc);
    } else if (
      entry.name.endsWith('.js') &&
      !entry.name.endsWith('.test.js') &&
      !SKIP_FILES.has(entry.name)
    ) {
      acc.push(full);
    }
  }
  return acc;
}

// Matches translator calls (t / this.t / renderer.t?.) whose first argument is a
// string-literal key, e.g. t('a.b'), this.t("a.b"), renderer.t?.('a.b').
// The lookbehind keeps `submit(`, `getText(`, `format(` etc. from matching.
const KEY_CALL_RE = /(?<![\w$])t\s*(?:\?\.)?\(\s*(['"])([a-zA-Z0-9_.]+)\1/g;

function collectReferencedKeys() {
  const refs = new Map(); // key -> first "file:line" seen
  for (const file of collectSourceFiles(FRONTEND_JS)) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    KEY_CALL_RE.lastIndex = 0;
    while ((match = KEY_CALL_RE.exec(source))) {
      const key = match[2];
      if (!refs.has(key)) {
        const line = source.slice(0, match.index).split('\n').length;
        refs.set(key, `${path.relative(FRONTEND_JS, file).replace(/\\/g, '/')}:${line}`);
      }
    }
  }
  return refs;
}

test('every t() key referenced in frontend code exists in the locale catalog', () => {
  const refs = collectReferencedKeys();
  assert.ok(refs.size > 0, 'expected to find translator keys in frontend source');

  const missing = [];
  for (const [key, where] of refs) {
    if (!LocaleTextRegistry.hasKey(key, LocaleTextRegistry.defaultLocale)) {
      missing.push(`${key}  (first seen at ${where})`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `frontend references locale keys missing from the catalog:\n  ${missing.join('\n  ')}`,
  );
});

test('locale catalogs stay complete against the default locale', () => {
  const missing = LocaleTextRegistry.getMissingKeys(LocaleTextRegistry.defaultLocale);
  for (const [locale, keys] of Object.entries(missing)) {
    assert.deepEqual(keys, [], `${locale} is missing keys: ${keys.join(', ')}`);
  }
});

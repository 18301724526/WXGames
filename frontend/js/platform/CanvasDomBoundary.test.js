const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Zero-DOM stage rendering boundary: the platform layer draws on offscreen surfaces and
// composites onto ONE visible canvas; DOM machinery is confined to the boot edge. This
// guard is a ratchet — the allowlisted counts may only shrink, never grow. Adding DOM
// usage anywhere else in the platform layer breaks wx mini-program portability (no
// document there) and reintroduces the WebView multi-canvas compositing quirk class.
const PLATFORM_ROOT = path.resolve(__dirname);

const DOM_PATTERNS = [
  { label: 'document.', regex: /(?:^|[^.\w])document\??\./g },
  { label: '.appendChild(', regex: /\.appendChild\(/g },
  { label: '.insertBefore(', regex: /\.insertBefore\(/g },
  { label: 'createElement(', regex: /createElement\(/g },
  { label: 'getComputedStyle', regex: /getComputedStyle/g },
  { label: 'ownerDocument', regex: /ownerDocument/g },
];

// Boot-edge allowlist: file -> maximum allowed total DOM-pattern hits (ratchet).
const ALLOWLIST = new Map([
  // ensureCanvas (the ONE visible canvas) + the legacy per-layer DOM fallback used when
  // OffscreenCanvas is unavailable. All access goes through the injected this.document.
  ['H5CanvasRuntime.js', 4],
  // Legacy-browser fallback for template work canvases (OffscreenCanvas-first).
  ['renderers/CanvasAssetRenderer.js', 2],
]);

function walkPlatformSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPlatformSources(fullPath, out);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) out.push(fullPath);
  }
  return out;
}

test('platform layer keeps DOM machinery confined to the boot edge (ratchet)', () => {
  const violations = [];
  for (const filePath of walkPlatformSources(PLATFORM_ROOT)) {
    const relativePath = path.relative(PLATFORM_ROOT, filePath).split(path.sep).join('/');
    const source = fs.readFileSync(filePath, 'utf8');
    let total = 0;
    const hits = [];
    for (const { label, regex } of DOM_PATTERNS) {
      const matches = source.match(regex);
      if (matches) {
        total += matches.length;
        hits.push(`${label}×${matches.length}`);
      }
    }
    if (total === 0) continue;
    const allowed = ALLOWLIST.get(relativePath) ?? 0;
    if (total > allowed) {
      violations.push(
        `${relativePath}: ${total} DOM references (${hits.join(', ')}), allowed ${allowed}`,
      );
    }
  }
  assert.deepEqual(
    violations,
    [],
    `DOM usage escaped the boot edge:\n${violations.join('\n')}\n` +
      'Render/game code must stay DOM-free (offscreen surfaces + compositeStage). ' +
      'If this is genuinely boot-edge platform glue, shrink it or justify raising the ratchet.',
  );
});

test('boot-edge allowlist stays honest (no stale entries)', () => {
  for (const [relativePath, allowed] of ALLOWLIST) {
    const fullPath = path.join(PLATFORM_ROOT, relativePath);
    assert.equal(fs.existsSync(fullPath), true, `allowlisted file missing: ${relativePath}`);
    const source = fs.readFileSync(fullPath, 'utf8');
    let total = 0;
    for (const { regex } of DOM_PATTERNS) {
      const matches = source.match(regex);
      if (matches) total += matches.length;
    }
    assert.equal(total > 0, true, `allowlist entry no longer needed, remove it: ${relativePath}`);
    assert.equal(
      total <= allowed,
      true,
      `${relativePath} exceeds its ratchet: ${total} > ${allowed}`,
    );
  }
});

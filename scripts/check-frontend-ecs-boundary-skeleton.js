const fs = require('node:fs');
const path = require('node:path');

const ECS_ROOT = 'frontend/js/ecs';
const PRODUCTION_SOURCE_ROOTS = Object.freeze(['frontend/js', 'frontend/minigame', 'shared']);
const ALLOWED_BITECS_IMPORT_FILES = Object.freeze(['frontend/js/ecs/core/EcsCoreBoundary.js']);
const ALLOWED_BITECS_IMPORTS = Object.freeze(['bitecs', 'bitecs/legacy', 'bitecs/serialization']);
const BLOCKED_ECS_DEPENDENCY_SEGMENTS = Object.freeze([
  'api',
  'backend',
  'controllers',
  'platform',
  'renderers',
  'services',
  'ui',
  'vendor',
]);
const RUNTIME_ENTRY_FILES = Object.freeze(['frontend/index.html', 'frontend/minigame/game.js']);
const APPROVED_RUNTIME_ECS_LOADS = Object.freeze([
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
]);
const APPROVED_RUNTIME_ECS_LOAD_DIRS = Object.freeze([
  'debug',
  'foundation',
  'input',
  'projection',
  'resource',
  'system',
]);
const BLOCKED_RUNTIME_ECS_LOAD_DIRS = Object.freeze([
  'core',
  'mode',
  'owner',
  'registry',
  'snapshot',
]);
const GENERATED_ECS_RUNTIME_FILES = Object.freeze([
  'frontend/js/ecs/runtime/EcsModeRuntimeBundle.js',
]);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);
const IMPORT_PATTERN =
  /\b(?:from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))/g;
const HTML_SCRIPT_PATTERN = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
const RUNTIME_OBJECT_PATTERNS = Object.freeze([
  {
    kind: 'dom-reference',
    symbol: 'document',
    pattern: /\bdocument\./,
  },
  {
    kind: 'dom-reference',
    symbol: 'window',
    pattern: /\bwindow\./,
  },
  {
    kind: 'canvas-reference',
    symbol: 'CanvasRenderingContext2D',
    pattern: /\bCanvasRenderingContext2D\b|\bHTMLCanvasElement\b|\bgetContext\s*\(/,
  },
  {
    kind: 'browser-event-reference',
    symbol: 'Event',
    pattern: /\b(?:MouseEvent|TouchEvent|PointerEvent|KeyboardEvent|Event)\b/,
  },
  {
    kind: 'promise-reference',
    symbol: 'Promise',
    pattern: /\bnew\s+Promise\b|\bPromise\./,
  },
  {
    kind: 'class-instance-reference',
    symbol: 'class/new',
    pattern: /\bclass\s+[A-Za-z_$][\w$]*\b|\bnew\s+[A-Z][A-Za-z0-9_$]*\b/,
  },
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function collectFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function isEcsProductionFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(`${ECS_ROOT}/`)) return false;
  if (!/\.(?:js|mjs|cjs)$/.test(normalized)) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isProductionSourceFile(filePath) {
  const normalized = normalizePath(filePath);
  if (
    !PRODUCTION_SOURCE_ROOTS.some(
      (root) => normalized.startsWith(`${root}/`) || normalized === root,
    )
  ) {
    return false;
  }
  if (!/\.(?:js|mjs|cjs)$/.test(normalized)) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isAllowedBitecsImportFile(filePath) {
  return ALLOWED_BITECS_IMPORT_FILES.includes(normalizePath(filePath));
}

function isBitecsSpecifier(specifier = '') {
  return specifier === 'bitecs' || specifier.startsWith('bitecs/');
}

function isAllowedBitecsSpecifier(specifier = '') {
  return ALLOWED_BITECS_IMPORTS.includes(String(specifier || ''));
}

function isRelativeSpecifier(specifier = '') {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function stripQueryAndHash(specifier = '') {
  return String(specifier || '').split(/[?#]/)[0];
}

function resolveRelativeSpecifier(fromFile, specifier) {
  const fromDir = path.posix.dirname(normalizePath(fromFile));
  return normalizePath(
    path.posix.normalize(path.posix.join(fromDir, stripQueryAndHash(specifier))),
  );
}

function withJsExtension(filePath = '') {
  const normalized = normalizePath(filePath);
  return /\.[a-z0-9]+$/i.test(normalized) ? normalized : `${normalized}.js`;
}

function isBlockedEcsDependency(fromFile, specifier) {
  if (!isRelativeSpecifier(specifier)) return false;
  const resolved = resolveRelativeSpecifier(fromFile, specifier);
  return BLOCKED_ECS_DEPENDENCY_SEGMENTS.some((segment) => {
    if (segment === 'backend') return resolved.startsWith('backend/');
    return resolved.startsWith(`frontend/js/${segment}/`) || resolved === `frontend/js/${segment}`;
  });
}

function isRuntimeEntryLoadingEcs(fromFile, specifier) {
  return Boolean(resolveRuntimeEcsLoad(fromFile, specifier));
}

function resolveRuntimeEcsLoad(fromFile, specifier) {
  const normalized = normalizePath(stripQueryAndHash(specifier));
  if (!normalized) return '';
  if (isRelativeSpecifier(normalized)) {
    const resolved = withJsExtension(resolveRelativeSpecifier(fromFile, normalized));
    return resolved.startsWith(ECS_ROOT) ? resolved : '';
  }
  if (normalized.startsWith('frontend/js/ecs/')) return withJsExtension(normalized);
  if (normalized.startsWith('/js/ecs/')) return withJsExtension(`frontend${normalized}`);
  if (normalized.startsWith('js/ecs/')) return withJsExtension(`frontend/${normalized}`);
  if (normalized.startsWith('./js/ecs/')) return withJsExtension(`frontend/${normalized.slice(2)}`);
  return '';
}

function isApprovedRuntimeEcsLoad(fromFile, specifier) {
  const resolved = resolveRuntimeEcsLoad(fromFile, specifier);
  if (APPROVED_RUNTIME_ECS_LOADS.includes(resolved)) return true;
  const segment = getEcsTopLevelSegment(resolved);
  return APPROVED_RUNTIME_ECS_LOAD_DIRS.includes(segment);
}

function isBlockedRuntimeEcsLoad(fromFile, specifier) {
  const resolved = resolveRuntimeEcsLoad(fromFile, specifier);
  if (!resolved) return false;
  if (APPROVED_RUNTIME_ECS_LOADS.includes(resolved)) return false;
  return BLOCKED_RUNTIME_ECS_LOAD_DIRS.includes(getEcsTopLevelSegment(resolved));
}

function getEcsTopLevelSegment(filePath = '') {
  const normalized = normalizePath(filePath);
  const prefix = `${ECS_ROOT}/`;
  if (!normalized.startsWith(prefix)) return '';
  return normalized.slice(prefix.length).split('/')[0] || '';
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*<!--/.test(line);
}

function makeViolation({ file, line = 1, kind, symbol, evidence, note }) {
  return {
    file: normalizePath(file),
    line,
    kind,
    symbol,
    evidence: String(evidence || '')
      .trim()
      .replace(/\s+/g, ' '),
    note,
  };
}

function isGeneratedEcsRuntimeFile(filePath = '') {
  return GENERATED_ECS_RUNTIME_FILES.includes(normalizePath(filePath));
}

function shouldSkipRuntimeObjectViolation(filePath = '', kind = '', line = '') {
  if (isGeneratedEcsRuntimeFile(filePath)) return true;
  if (kind === 'class-instance-reference' && /\bnew\s+Error\b/.test(line)) return true;
  return false;
}

function shouldCheckRuntimeObjectPattern(filePath = '', kind = '') {
  if (isGeneratedEcsRuntimeFile(filePath)) return false;
  if (kind !== 'class-instance-reference') return true;
  return BLOCKED_RUNTIME_ECS_LOAD_DIRS.includes(getEcsTopLevelSegment(filePath));
}

function findBoundaryViolationsInText(filePath, text = '') {
  const violations = [];
  const normalized = normalizePath(filePath);
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((line, index) => {
    if (isSkippableLine(line)) return;

    for (const match of line.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] || match[2] || match[3] || '';
      if (isBitecsSpecifier(specifier)) {
        if (!isAllowedBitecsImportFile(normalized)) {
          violations.push(
            makeViolation({
              file: normalized,
              line: index + 1,
              kind: 'direct-bitecs-import',
              symbol: specifier,
              evidence: line,
              note: 'production code must access bitecs only through frontend/js/ecs/core/EcsCoreBoundary.js',
            }),
          );
        } else if (!isAllowedBitecsSpecifier(specifier)) {
          violations.push(
            makeViolation({
              file: normalized,
              line: index + 1,
              kind: 'unsupported-bitecs-boundary-import',
              symbol: specifier,
              evidence: line,
              note: 'the Batch 2 boundary allows only bitecs and bitecs/legacy',
            }),
          );
        }
      }

      if (isEcsProductionFile(normalized) && isBlockedEcsDependency(normalized, specifier)) {
        violations.push(
          makeViolation({
            file: normalized,
            line: index + 1,
            kind: 'ecs-reverse-dependency',
            symbol: specifier,
            evidence: line,
            note: 'frontend/js/ecs must not depend on platform, renderer, API, controller, UI, service, vendor, or backend code',
          }),
        );
      }

      if (
        RUNTIME_ENTRY_FILES.includes(normalized) &&
        isRuntimeEntryLoadingEcs(normalized, specifier) &&
        isBlockedRuntimeEcsLoad(normalized, specifier)
      ) {
        violations.push(
          makeViolation({
            file: normalized,
            line: index + 1,
            kind: 'runtime-entry-loads-ecs',
            symbol: specifier,
            evidence: line,
            note: 'H5 and minigame entrypoints may load ECS gameplay surfaces, but not raw core, registry, mode, owner, or snapshot internals',
          }),
        );
      }
    }

    if (!isEcsProductionFile(normalized)) return;
    RUNTIME_OBJECT_PATTERNS.forEach(({ kind, symbol, pattern }) => {
      if (!shouldCheckRuntimeObjectPattern(normalized, kind)) return;
      if (!pattern.test(line)) return;
      if (shouldSkipRuntimeObjectViolation(normalized, kind, line)) return;
      violations.push(
        makeViolation({
          file: normalized,
          line: index + 1,
          kind,
          symbol,
          evidence: line,
          note: 'ECS runtime surfaces must stay free of DOM, canvas, browser event, and Promise references; internal surfaces also stay class-instance free',
        }),
      );
    });
  });

  if (RUNTIME_ENTRY_FILES.includes(normalized)) {
    for (const match of String(text || '').matchAll(HTML_SCRIPT_PATTERN)) {
      const specifier = match[1] || '';
      if (!isRuntimeEntryLoadingEcs(normalized, specifier)) continue;
      if (!isBlockedRuntimeEcsLoad(normalized, specifier)) continue;
      const prefix = String(text || '').slice(0, match.index);
      const line = prefix.split(/\r?\n/).length;
      violations.push(
        makeViolation({
          file: normalized,
          line,
          kind: 'runtime-entry-loads-ecs',
          symbol: specifier,
          evidence: match[0],
          note: 'H5 and minigame entrypoints may load ECS gameplay surfaces, but not raw core, registry, mode, owner, or snapshot internals',
        }),
      );
    }
  }

  return violations;
}

function findPackageVersionViolations(repoRoot = process.cwd()) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.dependencies?.bitecs;
  if (version === '0.4.0') return [];
  return [
    makeViolation({
      file: 'package.json',
      kind: 'bitecs-version-drift',
      symbol: 'bitecs',
      evidence: version ? `"bitecs": "${version}"` : 'missing bitecs dependency',
      note: 'Batch 2 pins bitecs exactly at 0.4.0; changes require ADR review',
    }),
  ];
}

function buildSummary(violations = []) {
  const byKind = new Map();
  violations.forEach((violation) => {
    byKind.set(violation.kind, (byKind.get(violation.kind) || 0) + 1);
  });
  return {
    totalViolations: violations.length,
    byKind: Object.fromEntries(Array.from(byKind.entries()).sort()),
  };
}

function scanEcsBoundarySkeleton(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const ecsRoot = path.join(repoRoot, ECS_ROOT);
  if (!fs.existsSync(ecsRoot)) throw new Error(`ECS root not found: ${ECS_ROOT}`);

  const sourceFiles = PRODUCTION_SOURCE_ROOTS.flatMap((root) =>
    collectFiles(path.join(repoRoot, root)).map((filePath) => toPosixRelative(filePath, repoRoot)),
  )
    .filter(isProductionSourceFile)
    .sort();
  const ecsFiles = sourceFiles.filter(isEcsProductionFile).sort();
  const nonEcsSourceFiles = sourceFiles.filter((file) => !isEcsProductionFile(file)).sort();
  const markdownEcsFiles = collectFiles(ecsRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter((file) => file.endsWith('.md'))
    .sort();
  const runtimeEntries = RUNTIME_ENTRY_FILES.filter((file) =>
    fs.existsSync(path.join(repoRoot, file)),
  );
  const files = Array.from(
    new Set([...sourceFiles, ...markdownEcsFiles, ...runtimeEntries]),
  ).sort();
  const violations = [
    ...findPackageVersionViolations(repoRoot),
    ...files.flatMap((file) =>
      findBoundaryViolationsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
    ),
  ];

  return {
    report: 'frontend-ecs-boundary-skeleton-guard',
    mode: 'blocking',
    ecsRoot: ECS_ROOT,
    sourceRoots: PRODUCTION_SOURCE_ROOTS,
    filesScanned: files.length,
    ecsFilesScanned: ecsFiles.length,
    nonEcsSourceFilesScanned: nonEcsSourceFiles.length,
    allowedBitecsImportFiles: ALLOWED_BITECS_IMPORT_FILES,
    allowedBitecsImports: ALLOWED_BITECS_IMPORTS,
    approvedRuntimeEcsLoads: APPROVED_RUNTIME_ECS_LOADS,
    approvedRuntimeEcsLoadDirs: APPROVED_RUNTIME_ECS_LOAD_DIRS,
    blockedRuntimeEcsLoadDirs: BLOCKED_RUNTIME_ECS_LOAD_DIRS,
    violations,
    summary: buildSummary(violations),
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-boundary-skeleton] blocking gate',
    `ecs root: ${report.ecsRoot}`,
    `source roots: ${report.sourceRoots.join(', ')}`,
    `files scanned: ${report.filesScanned}`,
    `ecs files scanned: ${report.ecsFilesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  Object.entries(report.summary.byKind).forEach(([kind, count]) => {
    lines.push(`- ${kind}: ${count}`);
  });
  if (report.violations.length > 0) {
    lines.push('', 'Blocked ECS boundary violations:');
    report.violations.forEach((violation) => {
      lines.push(
        `- ${violation.file}:${violation.line} ${violation.kind} ${violation.symbol}: ${violation.evidence}`,
      );
      lines.push(`  ${violation.note}`);
    });
  } else {
    lines.push('passed');
  }
  return `${lines.join('\n')}\n`;
}

function parseFormat(argv = process.argv.slice(2)) {
  const unknown = argv.filter((arg) => arg !== '--json');
  if (unknown.length > 0) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

function main() {
  try {
    const format = parseFormat();
    const report = scanEcsBoundarySkeleton();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length > 0) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-boundary-skeleton] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ALLOWED_BITECS_IMPORT_FILES,
  ALLOWED_BITECS_IMPORTS,
  APPROVED_RUNTIME_ECS_LOADS,
  APPROVED_RUNTIME_ECS_LOAD_DIRS,
  BLOCKED_ECS_DEPENDENCY_SEGMENTS,
  BLOCKED_RUNTIME_ECS_LOAD_DIRS,
  ECS_ROOT,
  PRODUCTION_SOURCE_ROOTS,
  RUNTIME_ENTRY_FILES,
  buildSummary,
  getEcsTopLevelSegment,
  findBoundaryViolationsInText,
  findPackageVersionViolations,
  isApprovedRuntimeEcsLoad,
  isAllowedBitecsImportFile,
  isBlockedEcsDependency,
  isBlockedRuntimeEcsLoad,
  isEcsProductionFile,
  isGeneratedEcsRuntimeFile,
  isProductionSourceFile,
  isRuntimeEntryLoadingEcs,
  parseFormat,
  renderText,
  resolveRuntimeEcsLoad,
  shouldCheckRuntimeObjectPattern,
  scanEcsBoundarySkeleton,
  shouldSkipRuntimeObjectViolation,
};

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js', 'frontend/minigame', 'shared']);
const PACKAGE_DEPENDENCY_SECTIONS = Object.freeze([
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]);
const ALLOWED_ECS_IMPORTS = Object.freeze(['bitecs', 'bitecs/legacy', 'bitecs/serialization']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)__tests__\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

const CORE_FILE_NAME_PATTERN =
  /^(?:ECSCore|EcsCore|EcsWorld|ECSWorld|EntityStore|ComponentStore|QueryEngine|SystemScheduler)\.(?:js|mjs|cjs)$/;
const LOCAL_CORE_IMPORT_PATTERN =
  /\b(?:from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))/g;
const ECS_PACKAGE_NAME_PATTERN =
  /^(?:ecs|ecsy|ape-ecs|bitecs|tiny-ecs|wolf-ecs|perform-ecs|miniplex|geotic|koota|goodluck)$|(?:^|[-_/])ecs(?:$|[-_/])/i;

const CORE_DECLARATION_PATTERNS = Object.freeze([
  {
    kind: 'local-core-primitive',
    symbol: 'createWorld',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+createWorld\b|\b(?:export\s+)?(?:const|let|var)\s+createWorld\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'createEntity',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+createEntity\b|\b(?:export\s+)?(?:const|let|var)\s+createEntity\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'addEntity',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+addEntity\b|\b(?:export\s+)?(?:const|let|var)\s+addEntity\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'removeEntity',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+removeEntity\b|\b(?:export\s+)?(?:const|let|var)\s+removeEntity\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'defineComponent',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+defineComponent\b|\b(?:export\s+)?(?:const|let|var)\s+defineComponent\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'registerComponent',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+registerComponent\b|\b(?:export\s+)?(?:const|let|var)\s+registerComponent\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'addComponent',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+addComponent\b|\b(?:export\s+)?(?:const|let|var)\s+addComponent\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'removeComponent',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+removeComponent\b|\b(?:export\s+)?(?:const|let|var)\s+removeComponent\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'defineQuery',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+defineQuery\b|\b(?:export\s+)?(?:const|let|var)\s+defineQuery\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'registerQuery',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+registerQuery\b|\b(?:export\s+)?(?:const|let|var)\s+registerQuery\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'registerSystem',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+registerSystem\b|\b(?:export\s+)?(?:const|let|var)\s+registerSystem\s*=/,
  },
  {
    kind: 'local-core-primitive',
    symbol: 'runSystems',
    pattern:
      /\b(?:export\s+)?(?:async\s+)?function\s+runSystems\b|\b(?:export\s+)?(?:const|let|var)\s+runSystems\s*=/,
  },
  {
    kind: 'local-core-storage',
    symbol: 'entityStore',
    pattern: /\b(?:this\.|(?:const|let|var)\s+)entityStore\s*=/i,
  },
  {
    kind: 'local-core-storage',
    symbol: 'componentStore',
    pattern: /\b(?:this\.|(?:const|let|var)\s+)componentStore\s*=/i,
  },
  {
    kind: 'local-core-storage',
    symbol: 'queryStore',
    pattern: /\b(?:this\.|(?:const|let|var)\s+)queryStore\s*=/i,
  },
  {
    kind: 'local-core-storage',
    symbol: 'queryEngine',
    pattern: /\b(?:this\.|(?:const|let|var)\s+)queryEngine\s*=/i,
  },
  {
    kind: 'local-core-storage',
    symbol: 'systemScheduler',
    pattern: /\b(?:this\.|(?:const|let|var)\s+)systemScheduler\s*=/i,
  },
  {
    kind: 'local-core-class',
    symbol: 'ECSCore',
    pattern:
      /\bclass\s+(?:ECSCore|EcsCore|EcsWorld|ECSWorld|EntityStore|ComponentStore|QueryEngine|SystemScheduler)\b/,
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

function isProductionSource(filePath) {
  const normalized = normalizePath(filePath);
  if (!SOURCE_ROOTS.some((root) => normalized.startsWith(`${root}/`) || normalized === root)) {
    return false;
  }
  if (!/\.(?:js|mjs|cjs)$/.test(normalized)) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isAllowedEcsImport(specifier = '') {
  return ALLOWED_ECS_IMPORTS.includes(String(specifier || ''));
}

function getPackageName(specifier = '') {
  const value = String(specifier || '');
  if (value.startsWith('@')) return value.split('/').slice(0, 2).join('/');
  return value.split('/')[0];
}

function isRelativeSpecifier(specifier = '') {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function isForbiddenEcsPackage(packageName = '') {
  const normalized = String(packageName || '').toLowerCase();
  if (!normalized || normalized === 'bitecs') return false;
  return ECS_PACKAGE_NAME_PATTERN.test(normalized);
}

function isUnsupportedBitecsSubpath(specifier = '') {
  return specifier.startsWith('bitecs/') && !isAllowedEcsImport(specifier);
}

function isCoreLikeLocalSpecifier(specifier = '') {
  const normalized = normalizePath(specifier);
  return /(?:^|\/)(?:ECSCore|EcsCore|EcsWorld|ECSWorld|EntityStore|ComponentStore|QueryEngine|SystemScheduler)(?:\.(?:js|mjs|cjs))?$/i.test(
    normalized,
  );
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
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

function findEcsCoreViolationsInText(filePath, text = '') {
  const violations = [];
  const normalized = normalizePath(filePath);

  if (CORE_FILE_NAME_PATTERN.test(path.basename(normalized))) {
    violations.push(
      makeViolation({
        file: normalized,
        kind: 'local-core-file',
        symbol: path.basename(normalized),
        evidence: path.basename(normalized),
        note: 'local ECS core file names are blocked; use the external bitecs boundary instead',
      }),
    );
  }

  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isSkippableLine(line)) return;

    for (const match of line.matchAll(LOCAL_CORE_IMPORT_PATTERN)) {
      const specifier = match[1] || match[2] || '';
      if (isAllowedEcsImport(specifier)) continue;
      if (isUnsupportedBitecsSubpath(specifier)) {
        violations.push(
          makeViolation({
            file: normalized,
            line: index + 1,
            kind: 'unsupported-bitecs-import',
            symbol: specifier,
            evidence: line,
            note: 'only bitecs and bitecs/serialization are approved ECS imports',
          }),
        );
        continue;
      }
      if (isRelativeSpecifier(specifier) && isCoreLikeLocalSpecifier(specifier)) {
        violations.push(
          makeViolation({
            file: normalized,
            line: index + 1,
            kind: 'local-core-import',
            symbol: specifier,
            evidence: line,
            note: 'local ECS core modules are blocked; import primitives from bitecs',
          }),
        );
        continue;
      }
      if (!isRelativeSpecifier(specifier) && isForbiddenEcsPackage(getPackageName(specifier))) {
        violations.push(
          makeViolation({
            file: normalized,
            line: index + 1,
            kind: 'non-bitecs-ecs-import',
            symbol: specifier,
            evidence: line,
            note: 'non-bitecs ECS core package imports are not approved',
          }),
        );
      }
    }

    CORE_DECLARATION_PATTERNS.forEach(({ kind, symbol, pattern }) => {
      if (!pattern.test(line)) return;
      violations.push(
        makeViolation({
          file: normalized,
          line: index + 1,
          kind,
          symbol,
          evidence: line,
          note: 'project source must not implement ECS core primitives locally',
        }),
      );
    });
  });

  return violations;
}

function findPackageDependencyViolations(repoRoot = process.cwd()) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const violations = [];
  PACKAGE_DEPENDENCY_SECTIONS.forEach((section) => {
    const entries = packageJson[section] || {};
    Object.keys(entries).forEach((dependencyName) => {
      if (!isForbiddenEcsPackage(dependencyName)) return;
      violations.push(
        makeViolation({
          file: 'package.json',
          kind: 'non-bitecs-ecs-dependency',
          symbol: dependencyName,
          evidence: `"${dependencyName}": "${entries[dependencyName]}"`,
          note: `${section} must not add an ECS core package other than bitecs`,
        }),
      );
    });
  });
  return violations;
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

function scanEcsCoreGuard(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) =>
    collectFiles(path.join(repoRoot, root)).map((filePath) => toPosixRelative(filePath, repoRoot)),
  )
    .filter(isProductionSource)
    .sort();
  const violations = [
    ...findPackageDependencyViolations(repoRoot),
    ...files.flatMap((file) =>
      findEcsCoreViolationsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
    ),
  ];

  return {
    report: 'frontend-ecs-core-guard',
    mode: 'blocking',
    sourceRoots: SOURCE_ROOTS,
    allowedImports: ALLOWED_ECS_IMPORTS,
    filesScanned: files.length,
    violations,
    summary: buildSummary(violations),
  };
}

function renderText(report) {
  const lines = [
    '[frontend-ecs-core-guard] blocking gate',
    `source roots: ${report.sourceRoots.join(', ')}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  Object.entries(report.summary.byKind).forEach(([kind, count]) => {
    lines.push(`- ${kind}: ${count}`);
  });
  if (report.violations.length > 0) {
    lines.push('', 'Blocked ECS core violations:');
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
    const report = scanEcsCoreGuard();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.violations.length > 0) process.exit(1);
  } catch (error) {
    console.error(`[frontend-ecs-core-guard] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ALLOWED_ECS_IMPORTS,
  CORE_DECLARATION_PATTERNS,
  EXCLUDED_PATH_PATTERNS,
  SOURCE_ROOTS,
  buildSummary,
  findEcsCoreViolationsInText,
  findPackageDependencyViolations,
  isAllowedEcsImport,
  isForbiddenEcsPackage,
  isProductionSource,
  parseFormat,
  renderText,
  scanEcsCoreGuard,
};

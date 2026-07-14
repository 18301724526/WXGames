const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MANIFEST = 'frontend/js/state/UiRuntimeFieldOwnershipManifest.json';
const FRONTEND_ROOT = 'frontend/js';
const BYPASS_SCAN_STORES = new Set([
  'UiRuntimeStateStore',
  'ModalStore',
  'BattleStore',
  'TerritoryUiStateStore',
]);
const HOST_RECEIVERS = ['this', 'host', 'game', 'shell', 'owner', 'lastGame', 'canvasShell'];
const ECS_SIMULATION_FIELD_PATTERN = /(?:world|fog|frame|mode|ecs|bitecs|component|eid|entity|simulation|velocity|position)/i;
const EXCLUDED_FILE_PATTERNS = [
  /\.test\.js$/,
  /\.contract\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
];

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function resolveRepoPath(repoRoot, relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function isProductionFrontendFile(relativePath) {
  const normalized = normalizePath(relativePath);
  return normalized.startsWith(`${FRONTEND_ROOT}/`)
    && normalized.endsWith('.js')
    && !EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function loadStoreModule(repoRoot, storePath) {
  const fullPath = resolveRepoPath(repoRoot, storePath);
  delete require.cache[require.resolve(fullPath)];
  return require(fullPath);
}

function fieldAccessPattern(field) {
  const receiver = HOST_RECEIVERS.join('|');
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `\\b(?:${receiver})\\s*(?:\\?\\.|\\.)\\s*${escaped}\\b|\\b(?:${receiver})\\s*\\[\\s*['"\`]${escaped}['"\`]\\s*\\]`,
  );
}

function indirectFieldWritePattern(field) {
  const receiver = HOST_RECEIVERS.join('|');
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hostExpression = `(?:${receiver})(?:\\s*(?:\\?\\.|\\.)\\s*[A-Za-z_$][\\w$]*)*`;
  return new RegExp(
    `\\b(?:setIfChanged|writeIfChanged|setHostField|setRuntimeField)\\s*\\(\\s*${hostExpression}\\s*,\\s*['"\`]${escaped}['"\`]`
      + `|\\bReflect\\.set\\s*\\(\\s*${hostExpression}\\s*,\\s*['"\`]${escaped}['"\`]`
      + `|\\bObject\\.defineProperty\\s*\\(\\s*${hostExpression}\\s*,\\s*['"\`]${escaped}['"\`]`,
  );
}

function lineIsSkippable(line = '') {
  return /^\s*(?:\/\/|\*)/.test(line);
}

function findBypassAccesses(repoRoot, manifestStore) {
  if (!BYPASS_SCAN_STORES.has(manifestStore.store)) return [];
  const approved = new Set([
    manifestStore.path,
    ...(manifestStore.approvedCompatibilityFiles || []),
  ].map(normalizePath));
  const files = collectFiles(resolveRepoPath(repoRoot, FRONTEND_ROOT))
    .map((file) => normalizePath(path.relative(repoRoot, file)))
    .filter(isProductionFrontendFile)
    .filter((file) => !approved.has(file));
  const patterns = manifestStore.fields.map((field) => [
    field,
    fieldAccessPattern(field),
    indirectFieldWritePattern(field),
  ]);
  const findings = [];
  files.forEach((file) => {
    const lines = fs.readFileSync(resolveRepoPath(repoRoot, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (lineIsSkippable(line)) return;
      patterns.forEach(([field, directPattern, indirectPattern]) => {
        if (!directPattern.test(line) && !indirectPattern.test(line)) return;
        findings.push({
          file,
          line: index + 1,
          field,
          evidence: line.trim().replace(/\s+/g, ' '),
        });
      });
    });
  });
  return findings;
}

function inspectUiRuntimeOwnership(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST;
  const manifest = options.manifest || readJson(resolveRepoPath(repoRoot, manifestPath));
  const violations = [];
  const warnings = [];

  if (manifest.schema !== 'ui-runtime-field-ownership-v1') {
    violations.push(`manifest schema unsupported: ${manifest.schema || '(missing)'}`);
  }
  if (!Array.isArray(manifest.stores) || manifest.stores.length === 0) {
    violations.push('manifest has no stores');
    return { manifestPath, violations, warnings, summary: { stores: 0, fields: 0 } };
  }

  const fieldOwners = new Map();
  manifest.stores.forEach((store) => {
    if (!store.store) violations.push('manifest store entry missing store name');
    if (!store.path || !fs.existsSync(resolveRepoPath(repoRoot, store.path))) {
      violations.push(`${store.store || '(missing store)'}.path missing: ${store.path || ''}`);
      return;
    }
    if (!Array.isArray(store.fields) || store.fields.length === 0) {
      violations.push(`${store.store} has no fields`);
      return;
    }
    store.fields.forEach((field) => {
      if (fieldOwners.has(field)) {
        violations.push(`${field} owned by both ${fieldOwners.get(field)} and ${store.store}`);
      } else {
        fieldOwners.set(field, store.store);
      }
    });

    const moduleApi = loadStoreModule(repoRoot, store.path);
    const exportedFields = Array.isArray(moduleApi.OWNED_UI_RUNTIME_FIELDS)
      ? [...moduleApi.OWNED_UI_RUNTIME_FIELDS].sort()
      : [];
    const manifestFields = [...store.fields].sort();
    if (JSON.stringify(exportedFields) !== JSON.stringify(manifestFields)) {
      violations.push(`${store.store}.OWNED_UI_RUNTIME_FIELDS does not match manifest`);
    }

    if (store.store === 'UiRuntimeStateStore') {
      store.fields
        .filter((field) => ECS_SIMULATION_FIELD_PATTERN.test(field))
        .forEach((field) => violations.push(`UiRuntimeStateStore owns ECS simulation-like field: ${field}`));
    }

    findBypassAccesses(repoRoot, store).forEach((finding) => {
      violations.push(
        `${finding.file}:${finding.line} reads/writes ${finding.field} outside ${store.store}: ${finding.evidence}`,
      );
    });
  });

  return {
    manifestPath,
    violations,
    warnings,
    summary: {
      stores: manifest.stores.length,
      fields: fieldOwners.size,
      bypassScanStores: [...BYPASS_SCAN_STORES],
    },
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { json: false, manifestPath: DEFAULT_MANIFEST };
  argv.forEach((arg) => {
    if (arg === '--json') options.json = true;
    else if (arg.startsWith('--manifest=')) options.manifestPath = arg.slice('--manifest='.length);
    else throw new Error(`unknown argument: ${arg}`);
  });
  return options;
}

function renderText(report) {
  const lines = [
    '[ui-runtime-field-ownership] blocking gate',
    `manifest: ${report.manifestPath}`,
    `stores: ${report.summary.stores}`,
    `fields: ${report.summary.fields}`,
    `bypass scan stores: ${report.summary.bypassScanStores.join(', ')}`,
    `violations: ${report.violations.length}`,
    `warnings: ${report.warnings.length}`,
  ];
  report.violations.forEach((violation) => lines.push(`  violation: ${violation}`));
  report.warnings.forEach((warning) => lines.push(`  warning: ${warning}`));
  lines.push(report.violations.length > 0 ? 'FAILED' : 'passed');
  return `${lines.join('\n')}\n`;
}

function main() {
  try {
    const options = parseArgs();
    const report = inspectUiRuntimeOwnership(options);
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    process.exitCode = report.violations.length > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`[ui-runtime-field-ownership] failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  DEFAULT_MANIFEST,
  inspectUiRuntimeOwnership,
  fieldAccessPattern,
  indirectFieldWritePattern,
};

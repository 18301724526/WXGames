const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_SOURCE_ROOT = 'frontend/js';

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

const IGNORED_NUMERIC_LITERALS = new Set(['-1', '0', '1', '2']);
const STRING_LITERAL_PATTERN = /(['"`])((?:\\.|(?!\1).)*)\1/g;
const HEX_COLOR_PATTERN = /#[0-9A-Fa-f]{3,8}\b/g;
const NUMERIC_LITERAL_PATTERN = /(?<![A-Za-z_$.\d])-?\d+(?:\.\d+)?(?![A-Za-z_$.\d])/g;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function isProductionFrontendSource(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(`${FRONTEND_SOURCE_ROOT}/`)) return false;
  if (!normalized.endsWith('.js')) return false;
  return !EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
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

function isRegistryOwnedPath(filePath) {
  return /(config|manifest|registry|constants|assets|catalog|schema)/i.test(
    normalizePath(filePath),
  );
}

function ownerCandidateFor(kind, filePath) {
  const normalized = normalizePath(filePath);
  if (kind === 'action-string') return 'action/input owner';
  if (kind === 'api-path') return 'network/api owner';
  if (kind === 'asset-path') return 'asset manifest owner';
  if (
    /renderers\//.test(normalized) ||
    /Renderer|Render|WorldMapRuntime/.test(path.basename(normalized))
  ) {
    return 'render owner';
  }
  if (/Input|Action|Command/.test(path.basename(normalized))) return 'input/action owner';
  if (kind === 'color' || kind === 'numeric') return 'config owner';
  return 'owner candidate';
}

function roleForFinding(kind, filePath, isDuplicate = false) {
  if (isRegistryOwnedPath(filePath)) return 'registry-owned';
  if (isDuplicate || kind === 'helper' || kind === 'condition') return 'duplicate-candidate';
  return 'runtime-candidate';
}

function stripStringLiterals(line = '') {
  return String(line || '').replace(STRING_LITERAL_PATTERN, '""');
}

function extractStringLiterals(line = '') {
  const values = [];
  for (const match of String(line || '').matchAll(STRING_LITERAL_PATTERN)) values.push(match[2]);
  return values;
}

function isApiPathLiteral(value = '') {
  return /(^\/api\/|\/api\/|\/wxgame-[^/\s]+-api\/|^https?:\/\/)/.test(value);
}

function isAssetPathLiteral(value = '') {
  return /(^assets\/|\/assets\/|^frontend\/|^config\/|\/config\/|\.(?:png|jpe?g|webp|gif|json|atlas|skel|mp3|wav|ogg|glb|gltf|svg)(?:$|\?))/i.test(
    value,
  );
}

function extractActionStrings(line = '') {
  const actionStrings = new Set();
  const patterns = [
    /\btype\s*:\s*['"`]([^'"`]+)['"`]/g,
    /\baction\.type\s*(?:={2,3}|!==?)\s*['"`]([^'"`]+)['"`]/g,
    /\bcase\s+['"`]([^'"`]+)['"`]\s*:/g,
    /\bregister(?:Action|Command|Handler)?\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of String(line || '').matchAll(pattern)) actionStrings.add(match[1]);
  });
  return Array.from(actionStrings).sort();
}

function extractHelperName(line = '') {
  const text = String(line || '');
  const patterns = [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
    /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
    /^\s{2,}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*{/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && !['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) return match[1];
  }
  return null;
}

function extractNormalizedCondition(line = '') {
  const text = String(line || '');
  const match = text.match(/\b(?:if|else\s+if)\s*\((.*)\)\s*{?/);
  if (!match) return null;
  const normalized = match[1]
    .replace(STRING_LITERAL_PATTERN, '"?"')
    .replace(NUMERIC_LITERAL_PATTERN, '#')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length < 8) return null;
  return normalized;
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

function makeFinding({ kind, key, file, line, evidence, duplicate = false }) {
  const role = roleForFinding(kind, file, duplicate);
  return {
    kind,
    key,
    file: normalizePath(file),
    line,
    role,
    evidence: String(evidence || '')
      .trim()
      .replace(/\s+/g, ' '),
    ownerCandidate: ownerCandidateFor(kind, file),
    note:
      role === 'registry-owned'
        ? 'declared registry/config baseline'
        : duplicate
          ? 'repeated owner/condition/helper candidate'
          : 'unowned literal candidate',
  };
}

function findLiteralCandidatesInText(filePath, text = '') {
  const findings = [];
  const helperOccurrences = [];
  const conditionOccurrences = [];
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((line, index) => {
    if (isSkippableLine(line)) return;
    const lineNumber = index + 1;

    extractActionStrings(line).forEach((key) => {
      findings.push(
        makeFinding({
          kind: 'action-string',
          key,
          file: filePath,
          line: lineNumber,
          evidence: line,
        }),
      );
    });

    extractStringLiterals(line).forEach((value) => {
      if (isApiPathLiteral(value)) {
        findings.push(
          makeFinding({
            kind: 'api-path',
            key: value,
            file: filePath,
            line: lineNumber,
            evidence: line,
          }),
        );
      } else if (isAssetPathLiteral(value)) {
        findings.push(
          makeFinding({
            kind: 'asset-path',
            key: value,
            file: filePath,
            line: lineNumber,
            evidence: line,
          }),
        );
      }
    });

    for (const match of line.matchAll(HEX_COLOR_PATTERN)) {
      findings.push(
        makeFinding({
          kind: 'color',
          key: match[0].toLowerCase(),
          file: filePath,
          line: lineNumber,
          evidence: line,
        }),
      );
    }

    for (const match of stripStringLiterals(line).matchAll(NUMERIC_LITERAL_PATTERN)) {
      const key = match[0];
      if (IGNORED_NUMERIC_LITERALS.has(key)) continue;
      findings.push(
        makeFinding({
          kind: 'numeric',
          key,
          file: filePath,
          line: lineNumber,
          evidence: line,
        }),
      );
    }

    const helperName = extractHelperName(line);
    if (helperName) {
      helperOccurrences.push({
        kind: 'helper',
        key: helperName,
        file: normalizePath(filePath),
        line: lineNumber,
        evidence: line,
      });
    }

    const condition = extractNormalizedCondition(line);
    if (condition) {
      conditionOccurrences.push({
        kind: 'condition',
        key: condition,
        file: normalizePath(filePath),
        line: lineNumber,
        evidence: line,
      });
    }
  });

  return {
    findings,
    helperOccurrences,
    conditionOccurrences,
  };
}

function repeatedOccurrences(occurrences = []) {
  const byKey = new Map();
  occurrences.forEach((entry) => {
    const bucket = byKey.get(entry.key) || [];
    bucket.push(entry);
    byKey.set(entry.key, bucket);
  });
  return Array.from(byKey.values())
    .filter((bucket) => bucket.length > 1)
    .flat();
}

function buildSummary(findings = []) {
  const byKind = new Map();
  const byRole = new Map();
  const byOwnerCandidate = new Map();
  findings.forEach((finding) => {
    byKind.set(finding.kind, (byKind.get(finding.kind) || 0) + 1);
    byRole.set(finding.role, (byRole.get(finding.role) || 0) + 1);
    byOwnerCandidate.set(
      finding.ownerCandidate,
      (byOwnerCandidate.get(finding.ownerCandidate) || 0) + 1,
    );
  });
  return {
    totalFindings: findings.length,
    byKind: Object.fromEntries(Array.from(byKind.entries()).sort()),
    byRole: Object.fromEntries(Array.from(byRole.entries()).sort()),
    byOwnerCandidate: Object.fromEntries(Array.from(byOwnerCandidate.entries()).sort()),
  };
}

function scanLiteralDuplicates(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sourceRoot = path.join(repoRoot, FRONTEND_SOURCE_ROOT);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`frontend source root not found: ${FRONTEND_SOURCE_ROOT}`);
  }
  const files = collectFiles(sourceRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionFrontendSource)
    .sort();

  const findings = [];
  const helperOccurrences = [];
  const conditionOccurrences = [];
  files.forEach((file) => {
    const fullPath = path.join(repoRoot, file);
    const result = findLiteralCandidatesInText(file, fs.readFileSync(fullPath, 'utf8'));
    findings.push(...result.findings);
    helperOccurrences.push(...result.helperOccurrences);
    conditionOccurrences.push(...result.conditionOccurrences);
  });

  repeatedOccurrences(helperOccurrences).forEach((entry) => {
    findings.push(makeFinding({ ...entry, duplicate: true }));
  });
  repeatedOccurrences(conditionOccurrences).forEach((entry) => {
    findings.push(makeFinding({ ...entry, duplicate: true }));
  });

  findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind),
  );

  return {
    report: 'frontend-ecs-literal-duplicate',
    mode: 'report-only',
    sourceRoot: FRONTEND_SOURCE_ROOT,
    filesScanned: files.length,
    findings,
    summary: buildSummary(findings),
  };
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function renderSummary(report) {
  const lines = [
    '[frontend-ecs-literal-duplicate] report-only baseline',
    `source root: ${report.sourceRoot}`,
    `files scanned: ${report.filesScanned}`,
    `findings: ${report.summary.totalFindings}`,
    'by kind:',
  ];
  Object.entries(report.summary.byKind).forEach(([kind, count]) => {
    lines.push(`- ${kind}: ${count}`);
  });
  lines.push('by role:');
  Object.entries(report.summary.byRole).forEach(([role, count]) => {
    lines.push(`- ${role}: ${count}`);
  });
  lines.push('by owner candidate:');
  Object.entries(report.summary.byOwnerCandidate).forEach(([owner, count]) => {
    lines.push(`- ${owner}: ${count}`);
  });
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Frontend ECS Literal / Duplicate Report',
    '',
    'Mode: report-only. Historical findings do not fail the architecture gate.',
    '',
    '## Summary',
    '',
    '| Dimension | Key | Findings |',
    '| --- | --- | ---: |',
  ];
  Object.entries(report.summary.byKind).forEach(([kind, count]) => {
    lines.push(`| Kind | ${escapeMarkdownCell(kind)} | ${count} |`);
  });
  Object.entries(report.summary.byRole).forEach(([role, count]) => {
    lines.push(`| Role | ${escapeMarkdownCell(role)} | ${count} |`);
  });
  Object.entries(report.summary.byOwnerCandidate).forEach(([owner, count]) => {
    lines.push(`| Owner Candidate | ${escapeMarkdownCell(owner)} | ${count} |`);
  });
  lines.push(
    '',
    '## Findings',
    '',
    '| Kind | Key | File | Line | Role | Evidence | Owner Candidate | Note |',
    '| --- | --- | --- | ---: | --- | --- | --- | --- |',
  );
  report.findings.forEach((finding) => {
    lines.push(
      `| ${escapeMarkdownCell(finding.kind)} | \`${escapeMarkdownCell(finding.key)}\` | ${escapeMarkdownCell(finding.file)} | ${finding.line} | ${escapeMarkdownCell(finding.role)} | \`${escapeMarkdownCell(finding.evidence)}\` | ${escapeMarkdownCell(finding.ownerCandidate)} | ${escapeMarkdownCell(finding.note)} |`,
    );
  });
  return `${lines.join('\n')}\n`;
}

function parseFormat(argv = process.argv.slice(2)) {
  const formats = argv.filter((arg) => ['--summary', '--json', '--markdown'].includes(arg));
  const unknown = argv.filter((arg) => !['--summary', '--json', '--markdown'].includes(arg));
  if (unknown.length > 0) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  if (formats.includes('--json')) return 'json';
  if (formats.includes('--markdown')) return 'markdown';
  return 'summary';
}

function main() {
  try {
    const format = parseFormat();
    const report = scanLiteralDuplicates();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[frontend-ecs-literal-duplicate] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXCLUDED_PATH_PATTERNS,
  buildSummary,
  extractActionStrings,
  extractHelperName,
  extractNormalizedCondition,
  findLiteralCandidatesInText,
  isProductionFrontendSource,
  isRegistryOwnedPath,
  parseFormat,
  renderMarkdown,
  renderSummary,
  scanLiteralDuplicates,
};

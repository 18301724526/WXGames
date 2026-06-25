const fs = require('node:fs');
const path = require('node:path');

const FRONTEND_SOURCE_ROOT = 'frontend/js';

const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /\.test\.js$/,
  /\.contract\.test\.js$/,
]);

const RENDERER_FILE_PATTERN =
  /(Renderer|RenderingRuntime|RenderPipeline|Layer|Cache|WorldMapRuntime)/;
const EXTERNAL_WRITE_PATTERN =
  /\b(host|game|shell|canvasShell|lastGame|controller|state)\.([A-Za-z_$][\w$]*)\s*(=(?!=|>)|\+=|-=|\*=|\/=|%=|\|\|=|&&=|\?\?=|\+\+|--)/g;
const SELF_WRITE_PATTERN =
  /\bthis\.([A-Za-z_$][\w$]*)\s*(=(?!=|>)|\+=|-=|\*=|\/=|%=|\|\|=|&&=|\?\?=|\+\+|--)/g;
const SELF_RENDER_AUTHORITY_FIELD_PATTERN =
  /(hit|target|baked|bake|layer|cache|dirty|layout|context|ctx|canvas|buffer|viewport|camera|tile|map|render|hover|tooltip|sprite|animation|last[A-Z].*State)/i;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function isRendererAuthoritySurface(filePath) {
  const normalized = normalizePath(filePath);
  if (!isProductionFrontendSource(normalized)) return false;
  if (/frontend\/js\/platform\/renderers\//.test(normalized)) return true;
  return RENDERER_FILE_PATTERN.test(path.basename(normalized));
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

function classifySurface(filePath) {
  const normalized = normalizePath(filePath);
  if (/RenderPipeline/.test(path.basename(normalized))) return 'render-pipeline';
  if (/WorldMapRuntime/.test(path.basename(normalized))) return 'world-map-runtime';
  if (/RenderingRuntime/.test(path.basename(normalized))) return 'render-runtime';
  if (/frontend\/js\/platform\/renderers\//.test(normalized) || /Renderer/.test(normalized))
    return 'renderer';
  return 'render-runtime';
}

function classifyTarget(prefix, field) {
  if (prefix === 'game') return 'app';
  if (prefix === 'shell' || prefix === 'canvasShell' || prefix === 'lastGame') return 'shell';
  if (prefix === 'host') return 'host';
  if (prefix === 'controller') return 'controller';
  if (prefix === 'state') return 'state';
  if (SELF_RENDER_AUTHORITY_FIELD_PATTERN.test(field)) return 'self-cache';
  return 'unknown';
}

function countPropertyOccurrences(line = '', property = '') {
  const pattern = new RegExp(`\\b${escapeRegExp(property)}\\b`, 'g');
  return Array.from(String(line || '').matchAll(pattern)).length;
}

function classifyAccess(line = '', property = '') {
  return countPropertyOccurrences(line, property) > 1 ? 'read-write' : 'write';
}

function classifyRole(target, field) {
  if (target === 'self-cache') {
    if (/(hit|target|hover|tooltip)/i.test(field)) return 'authority-write';
    return 'cache';
  }
  if (/(last|cache|dirty|layout|context|bake|baked|layer|map|tile)/i.test(field)) {
    return 'cache';
  }
  if (target === 'host' || target === 'app' || target === 'shell' || target === 'controller') {
    return 'write-through';
  }
  if (target === 'state') return 'authority-write';
  return 'unknown';
}

function noteForFinding(target, role, field) {
  if (target === 'self-cache') return 'renderer-owned cache or hit-target state candidate';
  if (role === 'cache') return 'render pipeline cache/layout state write';
  if (role === 'write-through') return 'renderer writes through to host/app/shell/controller';
  if (role === 'authority-write') return 'renderer-side authority state write candidate';
  return `review target ownership for ${field}`;
}

function isSkippableLine(line = '') {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

function findRendererAuthorityInText(filePath, text = '') {
  const findings = [];
  if (!isRendererAuthoritySurface(filePath)) return findings;

  const surface = classifySurface(filePath);
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isSkippableLine(line)) return;

    for (const match of line.matchAll(EXTERNAL_WRITE_PATTERN)) {
      const prefix = match[1];
      const field = match[2];
      const property = `${prefix}.${field}`;
      const target = classifyTarget(prefix, field);
      const access = classifyAccess(line, property);
      const role = classifyRole(target, field);
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        surface,
        target,
        access,
        role,
        evidence: line.trim().replace(/\s+/g, ' '),
        note: noteForFinding(target, role, field),
      });
    }

    for (const match of line.matchAll(SELF_WRITE_PATTERN)) {
      const field = match[1];
      if (!SELF_RENDER_AUTHORITY_FIELD_PATTERN.test(field)) continue;
      const target = classifyTarget('this', field);
      const access = classifyAccess(line, `this.${field}`);
      const role = classifyRole(target, field);
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        surface,
        target,
        access,
        role,
        evidence: line.trim().replace(/\s+/g, ' '),
        note: noteForFinding(target, role, field),
      });
    }
  });

  return findings;
}

function buildSummary(findings = []) {
  const bySurface = new Map();
  const byTarget = new Map();
  const byRole = new Map();
  findings.forEach((finding) => {
    bySurface.set(finding.surface, (bySurface.get(finding.surface) || 0) + 1);
    byTarget.set(finding.target, (byTarget.get(finding.target) || 0) + 1);
    byRole.set(finding.role, (byRole.get(finding.role) || 0) + 1);
  });
  return {
    totalFindings: findings.length,
    bySurface: Object.fromEntries(Array.from(bySurface.entries()).sort()),
    byTarget: Object.fromEntries(Array.from(byTarget.entries()).sort()),
    byRole: Object.fromEntries(Array.from(byRole.entries()).sort()),
  };
}

function scanRendererAuthority(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sourceRoot = path.join(repoRoot, FRONTEND_SOURCE_ROOT);
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`frontend source root not found: ${FRONTEND_SOURCE_ROOT}`);
  }
  const files = collectFiles(sourceRoot)
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isRendererAuthoritySurface)
    .sort();
  const findings = files.flatMap((file) => {
    const fullPath = path.join(repoRoot, file);
    return findRendererAuthorityInText(file, fs.readFileSync(fullPath, 'utf8'));
  });
  return {
    report: 'frontend-ecs-renderer-authority',
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
    '[frontend-ecs-renderer-authority] report-only baseline',
    `source root: ${report.sourceRoot}`,
    `files scanned: ${report.filesScanned}`,
    `findings: ${report.summary.totalFindings}`,
    'by surface:',
  ];
  Object.entries(report.summary.bySurface).forEach(([surface, count]) => {
    lines.push(`- ${surface}: ${count}`);
  });
  lines.push('by target:');
  Object.entries(report.summary.byTarget).forEach(([target, count]) => {
    lines.push(`- ${target}: ${count}`);
  });
  lines.push('by role:');
  Object.entries(report.summary.byRole).forEach(([role, count]) => {
    lines.push(`- ${role}: ${count}`);
  });
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Frontend ECS Renderer Authority Report',
    '',
    'Mode: report-only. Historical findings do not fail the architecture gate.',
    '',
    '## Summary',
    '',
    '| Dimension | Key | Findings |',
    '| --- | --- | ---: |',
  ];
  Object.entries(report.summary.bySurface).forEach(([surface, count]) => {
    lines.push(`| Surface | ${escapeMarkdownCell(surface)} | ${count} |`);
  });
  Object.entries(report.summary.byTarget).forEach(([target, count]) => {
    lines.push(`| Target | ${escapeMarkdownCell(target)} | ${count} |`);
  });
  Object.entries(report.summary.byRole).forEach(([role, count]) => {
    lines.push(`| Role | ${escapeMarkdownCell(role)} | ${count} |`);
  });
  lines.push(
    '',
    '## Findings',
    '',
    '| File | Line | Surface | Target | Access | Role | Evidence | Note |',
    '| --- | ---: | --- | --- | --- | --- | --- | --- |',
  );
  report.findings.forEach((finding) => {
    lines.push(
      `| ${escapeMarkdownCell(finding.file)} | ${finding.line} | ${escapeMarkdownCell(finding.surface)} | ${escapeMarkdownCell(finding.target)} | ${escapeMarkdownCell(finding.access)} | ${escapeMarkdownCell(finding.role)} | \`${escapeMarkdownCell(finding.evidence)}\` | ${escapeMarkdownCell(finding.note)} |`,
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
    const report = scanRendererAuthority();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[frontend-ecs-renderer-authority] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXCLUDED_PATH_PATTERNS,
  buildSummary,
  classifyAccess,
  classifyRole,
  classifySurface,
  classifyTarget,
  findRendererAuthorityInText,
  isProductionFrontendSource,
  isRendererAuthoritySurface,
  parseFormat,
  renderMarkdown,
  renderSummary,
  scanRendererAuthority,
};

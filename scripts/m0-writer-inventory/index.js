'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  CATEGORIES,
  EMPTY_CATEGORY_REASONS,
  WRITER_DECLARATIONS,
} = require('./declarations');
const { scanStaticWriters } = require('./scanner');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs', 'architecture', 'm0');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'writer-inventory.json');
const MARKDOWN_OUTPUT = path.join(OUTPUT_DIR, 'writer-inventory.md');

function finding(code, id, category, summary, evidence = []) {
  return { code, id, category, summary, evidence };
}

function compareDeclarations(declarations, discovered, emptyReasons = EMPTY_CATEGORY_REASONS) {
  const findings = [];
  const declaredRows = CATEGORIES.flatMap((category) => (
    (declarations[category] || []).map((entry) => ({ ...entry, category }))
  ));
  const declaredById = new Map();
  declaredRows.forEach((entry) => {
    if (declaredById.has(entry.id)) {
      findings.push(finding(
        'DUPLICATE_DECLARATION',
        entry.id,
        entry.category,
        `writer 声明重复：${entry.id}`,
      ));
    }
    declaredById.set(entry.id, entry);
  });

  const discoveredById = new Map();
  discovered.forEach((entry) => {
    if (discoveredById.has(entry.id)) {
      findings.push(finding(
        'DUPLICATE_DISCOVERY',
        entry.id,
        entry.category,
        `源码扫描重复发现：${entry.id}`,
        entry.evidence,
      ));
    }
    discoveredById.set(entry.id, entry);
    if (!declaredById.has(entry.id)) {
      findings.push(finding(
        'SOURCE_UNDECLARED',
        entry.id,
        entry.category,
        `源码存在但清单未声明：${entry.id}`,
        entry.evidence,
      ));
    } else if (declaredById.get(entry.id).category !== entry.category) {
      findings.push(finding(
        'CATEGORY_MISMATCH',
        entry.id,
        entry.category,
        `writer 类别不一致：声明=${declaredById.get(entry.id).category} 源码=${entry.category}`,
        entry.evidence,
      ));
    }
  });

  declaredRows.forEach((entry) => {
    if (discoveredById.has(entry.id)) return;
    findings.push(finding(
      'DECLARATION_MISSING_SOURCE',
      entry.id,
      entry.category,
      `清单已声明但源码不存在：${entry.id}`,
    ));
  });

  CATEGORIES.forEach((category) => {
    const categoryEntries = discovered.filter((entry) => entry.category === category);
    if (categoryEntries.length > 0 || emptyReasons[category]) return;
    findings.push(finding(
      'EMPTY_CATEGORY_REASON_MISSING',
      `category:${category}`,
      category,
      `writer 类别为空但未说明原因：${category}`,
    ));
  });

  return findings.sort((left, right) => `${left.code}:${left.id}`.localeCompare(`${right.code}:${right.id}`));
}

function buildReport(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || REPO_ROOT);
  const declarations = options.declarations || WRITER_DECLARATIONS;
  const emptyReasons = options.emptyReasons || EMPTY_CATEGORY_REASONS;
  const discovered = options.discovered || scanStaticWriters(repoRoot);
  const findings = compareDeclarations(declarations, discovered, emptyReasons);
  const categories = CATEGORIES.map((category) => ({
    category,
    emptyReason: emptyReasons[category] || '',
    entries: discovered.filter((entry) => entry.category === category),
  }));
  return {
    schema: 'm0-writer-inventory-v1',
    sourceScanner: 'scripts/m0-writer-inventory/scanner.js',
    declarationSource: 'scripts/m0-writer-inventory/declarations.js',
    categories,
    findings,
    summary: {
      categoryCount: CATEGORIES.length,
      declaredWriterCount: CATEGORIES.reduce(
        (total, category) => total + (declarations[category] || []).length,
        0,
      ),
      discoveredWriterCount: discovered.length,
      driftFindingCount: findings.length,
      writersByCategory: Object.fromEntries(
        categories.map((item) => [item.category, item.entries.length]),
      ),
    },
  };
}

function renderJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderMarkdown(report) {
  const lines = [
    '# M0 Writer Inventory',
    '',
    `- 扫描类别：${report.summary.categoryCount}`,
    `- 源码发现：${report.summary.discoveredWriterCount}`,
    `- 清单声明：${report.summary.declaredWriterCount}`,
    `- drift finding：${report.summary.driftFindingCount}`,
  ];
  report.categories.forEach((category) => {
    lines.push('', `## ${category.category}`, '');
    if (category.entries.length === 0) {
      lines.push(`该类为空。原因：${category.emptyReason}`);
      return;
    }
    lines.push('| Writer | 证据 | 说明 |', '| --- | --- | --- |');
    category.entries.forEach((entry) => {
      lines.push(
        `| ${escapeCell(entry.id)} | ${escapeCell(entry.evidence.join(', '))} | ${escapeCell(entry.summary)} |`,
      );
    });
  });
  lines.push('', '## Drift Findings', '');
  if (report.findings.length === 0) lines.push('无。');
  else report.findings.forEach((item) => lines.push(`- ${item.code}: ${item.summary}`));
  return `${lines.join('\n')}\n`;
}

function expectedOutputs(report) {
  return new Map([
    [JSON_OUTPUT, renderJson(report)],
    [MARKDOWN_OUTPUT, renderMarkdown(report)],
  ]);
}

function checkOutputs(report) {
  const findings = [];
  expectedOutputs(report).forEach((expected, filePath) => {
    const relative = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
    if (!fs.existsSync(filePath)) {
      findings.push(`OUTPUT_MISSING ${relative}`);
      return;
    }
    const actual = fs.readFileSync(filePath, 'utf8');
    if (actual !== expected) findings.push(`OUTPUT_STALE ${relative}`);
  });
  return findings;
}

function writeOutputs(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  expectedOutputs(report).forEach((content, filePath) => {
    fs.writeFileSync(filePath, content, 'utf8');
  });
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = { check: false };
  argv.forEach((arg) => {
    if (arg === '--check') args.check = true;
    else throw new Error(`unknown argument: ${arg}`);
  });
  return args;
}

function main() {
  const args = parseArgs();
  const report = buildReport();
  if (!args.check) writeOutputs(report);
  const outputFindings = args.check ? checkOutputs(report) : [];
  report.findings.forEach((item) => {
    const evidence = item.evidence.length ? ` (${item.evidence.join(', ')})` : '';
    process.stderr.write(`[m0-writer-inventory] ${item.code} ${item.summary}${evidence}\n`);
  });
  outputFindings.forEach((item) => process.stderr.write(`[m0-writer-inventory] ${item}\n`));
  process.stdout.write(
    `[m0-writer-inventory] discovered=${report.summary.discoveredWriterCount} `
      + `declared=${report.summary.declaredWriterCount} `
      + `drift=${report.summary.driftFindingCount + outputFindings.length}\n`,
  );
  if (report.findings.length > 0 || outputFindings.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[m0-writer-inventory] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildReport,
  checkOutputs,
  compareDeclarations,
  parseArgs,
  renderJson,
  renderMarkdown,
  writeOutputs,
};

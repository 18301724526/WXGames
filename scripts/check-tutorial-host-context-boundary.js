const fs = require('node:fs');
const path = require('node:path');
const espree = require('espree');

const TUTORIAL_ROOT = 'frontend/js/tutorial';
const ADAPTER_FILE = `${TUTORIAL_ROOT}/TutorialHostContext.js`;

function normalizePath(value = '') {
  return String(value || '').replace(/\\/g, '/');
}

function unwrap(node) {
  return node?.type === 'ChainExpression' ? node.expression : node;
}

function visit(node, callback, parent = null) {
  if (!node || typeof node !== 'object') return;
  callback(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) value.forEach((entry) => visit(entry, callback, node));
    else if (value && typeof value === 'object' && value.type) visit(value, callback, node);
  }
}

function staticProperty(member) {
  if (!member?.computed && member?.property?.type === 'Identifier') return member.property.name;
  if (member?.property?.type === 'Literal') return String(member.property.value);
  return '';
}

function rootShape(node) {
  const value = unwrap(node);
  if (!value) return '';
  if (value.type === 'Identifier') return value.name;
  if (value.type === 'ThisExpression') return 'this';
  if (value.type === 'MemberExpression') {
    const object = rootShape(value.object);
    const property = staticProperty(value) || '*dynamic*';
    return `${object}.${property}`;
  }
  if (value.type === 'CallExpression') return rootShape(value.callee);
  return '';
}

function isForbiddenMember(node) {
  const shape = rootShape(node);
  return /^(?:game|canvasShell)\./.test(shape)
    || /^(?:host|this)\.game(?:\.|$)/.test(shape)
    || /^(?:host|this)\.canvasShell(?:\.|$)/.test(shape);
}

function scanTutorialHostBoundarySource(file, source) {
  const normalizedFile = normalizePath(file);
  if (normalizedFile === ADAPTER_FILE) return [];
  const ast = espree.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    loc: true,
    range: true,
  });
  const findings = [];
  const seen = new Set();
  visit(ast, (node, parent) => {
    const value = unwrap(node);
    const parentValue = unwrap(parent);
    if (value?.type !== 'MemberExpression' || !isForbiddenMember(value)) return;
    if (parentValue?.type === 'MemberExpression' && parentValue.object === value) return;
    const key = `${value.loc.start.line}:${value.range[0]}:${value.range[1]}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      file: normalizedFile,
      line: value.loc.start.line,
      access: rootShape(value),
      evidence: source.slice(value.range[0], value.range[1]),
    });
  });
  return findings;
}

function inspectTutorialHostContextBoundary(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const tutorialRoot = path.join(repoRoot, TUTORIAL_ROOT);
  const files = fs.readdirSync(tutorialRoot)
    .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
    .map((file) => `${TUTORIAL_ROOT}/${file}`)
    .filter((file) => file !== ADAPTER_FILE)
    .sort();
  const findings = files.flatMap((file) => scanTutorialHostBoundarySource(
    file,
    fs.readFileSync(path.join(repoRoot, file), 'utf8'),
  ));
  return {
    root: TUTORIAL_ROOT,
    adapterExemption: ADAPTER_FILE,
    filesScanned: files.length,
    findings,
  };
}

function renderText(report) {
  const lines = [
    '[tutorial-host-context-boundary] blocking gate',
    `root: ${report.root}`,
    `adapter exemption: ${report.adapterExemption}`,
    `files scanned: ${report.filesScanned}`,
    `violations: ${report.findings.length}`,
  ];
  report.findings.forEach((finding) => {
    lines.push(`  ${finding.file}:${finding.line} ${finding.access}: ${finding.evidence}`);
  });
  lines.push(report.findings.length > 0 ? 'FAILED' : 'passed');
  return `${lines.join('\n')}\n`;
}

function main() {
  const report = inspectTutorialHostContextBoundary();
  process.stdout.write(renderText(report));
  process.exitCode = report.findings.length > 0 ? 1 : 0;
}

if (require.main === module) main();

module.exports = {
  ADAPTER_FILE,
  inspectTutorialHostContextBoundary,
  scanTutorialHostBoundarySource,
};

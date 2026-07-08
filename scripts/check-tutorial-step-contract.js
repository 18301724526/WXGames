'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Blocking gate: the tutorial step table and its ordering logic have a single
// source of truth in shared/tutorialFlowConfig.js.
//
// (a) No file outside the canonical module (+ its two thin readers) may declare
//     a step-name -> number table (or the reverse number -> step-name table).
//     Those tables are exactly the duplication this gate retired.
// (b) No file may compare tutorial steps with relational operators against
//     `TUTORIAL_STEPS.x` / `tutorialSteps.x` or `.currentStep`, or run
//     Math.floor/min/max over `.currentStep`. Steps are NAMES now; ordering
//     must go through the shared helpers (stepIndex/compareSteps/stepAtLeast/
//     stepAtMost/stepBefore/stepEquals).
const CANONICAL = 'shared/tutorialFlowConfig.js';
const SCAN_ROOTS = Object.freeze(['backend', 'frontend', 'scripts', 'shared']);
const TABLE_ALLOWLIST = Object.freeze([
  CANONICAL,
  // Thin readers over the shared table:
  'backend/config/TutorialFlowConfig.js',
  'frontend/js/tutorial/TutorialGuideStepPolicy.js',
]);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)scripts\/check-tutorial-step-contract\.js$/,
]);

const STEP_NAMES = require('../shared/tutorialFlowConfig').STEP_ORDER;

// 'initial' and 'completed' are generic identifiers (asset loaders, progress
// meters); keying a numeric off them is not a tutorial-step table signature.
const GENERIC_STEP_NAMES = new Set(['initial', 'completed']);
const TABLE_STEP_NAMES = STEP_NAMES.filter((name) => !GENERIC_STEP_NAMES.has(name));
const STEP_NAME_ALTERNATION = STEP_NAMES.join('|');
const TABLE_STEP_NAME_ALTERNATION = TABLE_STEP_NAMES.join('|');
// `houseBuilt: 4` style rows (object key -> numeric literal).
const NAME_TO_NUMBER_ROW = new RegExp(
  `(?:^|[{,\\s'"])(?:${TABLE_STEP_NAME_ALTERNATION})['"]?\\s*:\\s*-?\\d`,
);
// `4: 'houseBuilt'` style rows (reverse lookup tables).
const NUMBER_TO_NAME_ROW = new RegExp(
  `(?:^|[{,\\s'"])\\d+['"]?\\s*:\\s*['"](?:${STEP_NAME_ALTERNATION})['"]`,
);
// Relational operator that is not part of `=>`, `<<`, `>>`, `<=` handled explicitly.
const REL = '(?:[<>]=|(?<![=<>])[<>](?![=<>]))';
const COMPARISON_PATTERNS = Object.freeze([
  {
    kind: 'relational-vs-tutorial-steps',
    pattern: new RegExp(`(?:TUTORIAL_STEPS|tutorialSteps)\\.\\w+\\s*${REL}`),
  },
  {
    kind: 'relational-vs-tutorial-steps',
    pattern: new RegExp(`${REL}\\s*(?:this\\.)?(?:TUTORIAL_STEPS|tutorialSteps)\\.\\w+`),
  },
  {
    kind: 'relational-vs-current-step',
    pattern: new RegExp(`\\.currentStep\\)?\\s*${REL}`),
  },
  {
    kind: 'relational-vs-current-step',
    pattern: new RegExp(`${REL}\\s*[\\w.?$()\\[\\]]*\\.currentStep\\b`),
  },
  {
    kind: 'numeric-math-on-current-step',
    pattern: /Math\.(?:floor|ceil|round|min|max)\([^)]*\.currentStep/,
  },
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function isExcluded(relativePath) {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function collectFiles(entryPath, repoRoot, files = []) {
  if (!fs.existsSync(entryPath)) return files;
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    const rel = toPosixRelative(entryPath, repoRoot);
    if (!isExcluded(rel) && rel.endsWith('.js')) files.push(entryPath);
    return files;
  }
  if (!stat.isDirectory()) return files;
  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    collectFiles(path.join(entryPath, entry.name), repoRoot, files);
  }
  return files;
}

function findStepContractViolationsInText(relativePath, text) {
  const findings = [];
  const tableAllowed = TABLE_ALLOWLIST.includes(relativePath);
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (!tableAllowed) {
      if (NAME_TO_NUMBER_ROW.test(line)) {
        findings.push({ file: relativePath, line: i + 1, kind: 'step-name-number-table' });
      }
      if (NUMBER_TO_NAME_ROW.test(line)) {
        findings.push({ file: relativePath, line: i + 1, kind: 'number-step-name-table' });
      }
    }
    if (relativePath !== CANONICAL) {
      // compareSteps() RETURNS an ordering number; comparing that result
      // relationally is the sanctioned helper form.
      if (/compareSteps\s*\(/.test(line)) continue;
      for (const rule of COMPARISON_PATTERNS) {
        if (rule.pattern.test(line)) {
          findings.push({ file: relativePath, line: i + 1, kind: rule.kind });
        }
      }
    }
  }
  return findings;
}

function scanTutorialStepContract({ repoRoot = process.cwd() } = {}) {
  const violations = [];
  for (const scanRoot of SCAN_ROOTS) {
    const absoluteRoot = path.join(repoRoot, scanRoot);
    for (const file of collectFiles(absoluteRoot, repoRoot)) {
      const relativePath = toPosixRelative(file, repoRoot);
      violations.push(
        ...findStepContractViolationsInText(relativePath, fs.readFileSync(file, 'utf8')),
      );
    }
  }
  return { summary: { totalViolations: violations.length }, violations };
}

function renderText(report) {
  const lines = [
    '[tutorial-step-contract] blocking gate',
    `canonical: ${CANONICAL}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  for (const violation of report.violations) {
    lines.push(`  ${violation.file}:${violation.line} ${violation.kind}`);
  }
  if (report.summary.totalViolations > 0) {
    lines.push(
      'Tutorial steps are NAMES: declare tables only in shared/tutorialFlowConfig.js and',
      'compare via its helpers (stepAtLeast/stepAtMost/stepBefore/stepEquals/compareSteps).',
    );
  }
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

function parseFormat(argv) {
  const rest = argv.filter((arg) => arg !== '--json');
  if (rest.length > 0) throw new Error(`unknown arguments: ${rest.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

if (require.main === module) {
  const format = parseFormat(process.argv.slice(2));
  const report = scanTutorialStepContract();
  console.log(format === 'json' ? JSON.stringify(report, null, 2) : renderText(report));
  process.exit(report.summary.totalViolations === 0 ? 0 : 1);
}

module.exports = {
  CANONICAL,
  TABLE_ALLOWLIST,
  COMPARISON_PATTERNS,
  findStepContractViolationsInText,
  scanTutorialStepContract,
  renderText,
  parseFormat,
};

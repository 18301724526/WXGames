const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['frontend/js']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /\.contract\.test\.js$/,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
]);

const ADAPTER_PATH_PATTERNS = Object.freeze([
  /^frontend\/js\/platform\/CanvasRuntimeContract\.js$/,
  /^frontend\/js\/platform\/H5[A-Za-z0-9_$]*\.js$/,
  /^frontend\/js\/platform\/MiniGame[A-Za-z0-9_$]*\.js$/,
  /^frontend\/js\/platform\/PlatformRuntime\.js$/,
  /^frontend\/js\/ui\/H5[A-Za-z0-9_$]*\.js$/,
  /^frontend\/js\/debug\/H5LoadTrace\.js$/,
]);

const PLATFORM_PATTERNS = Object.freeze([
  {
    symbol: 'browser-storage',
    pattern:
      /\b(?:global|globalThis|window|runtime|this\.runtime)\s*\.\s*(?:localStorage|sessionStorage)\b|\b(?:localStorage|sessionStorage)\b/,
    note: 'storage must flow through the canvas runtime contract, not browser globals',
  },
  {
    symbol: 'browser-document',
    pattern: /\b(?:global|globalThis|window)\s*\.\s*document\b|\bdocument\s*\./,
    note: 'DOM access belongs only in H5 adapters/bootstrap code',
  },
  {
    symbol: 'browser-location',
    pattern:
      /\b(?:global|globalThis|window|runtime|this\.runtime)\s*\.\s*location\b|\blocation\s*\./,
    note: 'location/reload behavior belongs in the platform update adapter',
  },
  {
    symbol: 'browser-network-global',
    pattern: /\b(?:global|globalThis|window)\s*\.\s*(?:fetch|AbortController)\b|\bfetch\s*\(/,
    note: 'network requests must use runtime.request or an injected transport',
  },
  {
    symbol: 'browser-scheduler-global',
    pattern:
      /\b(?:global|globalThis|window)\s*\.\s*requestAnimationFrame\b|(^|[^.\w$])requestAnimationFrame\s*\(/,
    note: 'animation scheduling must use runtime.requestAnimationFrame',
  },
  {
    symbol: 'browser-diagnostics',
    pattern: /\bH5LoadTrace\b/,
    note: 'diagnostics must not name the H5 implementation from shared gameplay/runtime code',
  },
  {
    symbol: 'mini-game-global',
    pattern: /\b(?:wx|tt)\s*\./,
    note: 'mini-game globals belong only in platform adapters',
  },
]);

const BASELINE_DEBT = Object.freeze({});

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

function isExcluded(relativePath = '') {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function isAdapterPath(relativePath = '') {
  return ADAPTER_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function isProductionSource(relativePath = '') {
  const normalized = normalizePath(relativePath);
  if (!normalized.endsWith('.js')) return false;
  if (!SOURCE_ROOTS.some((root) => normalized.startsWith(`${root}/`))) return false;
  return !isExcluded(normalized);
}

function stripLineComment(line = '') {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let index = 0; index < line.length - 1; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    const escaped = index > 0 && line[index - 1] === '\\';
    if (!escaped && char === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    else if (!escaped && char === '"' && !inSingle && !inTemplate) inDouble = !inDouble;
    else if (!escaped && char === '`' && !inSingle && !inDouble) inTemplate = !inTemplate;
    if (!inSingle && !inDouble && !inTemplate && char === '/' && next === '/')
      return line.slice(0, index);
  }
  return line;
}

function stripStringLiterals(line = '') {
  return String(line || '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
}

function findPlatformBoundaryFindingsInText(filePath, text = '') {
  if (isAdapterPath(normalizePath(filePath))) return [];
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    if (/^\s*(?:\/\/|\*)/.test(rawLine)) return;
    const strippedLine = stripStringLiterals(stripLineComment(rawLine));
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!evidence) return;
    for (const { symbol, pattern, note } of PLATFORM_PATTERNS) {
      if (!pattern.test(strippedLine)) continue;
      findings.push({
        file: normalizePath(filePath),
        line: index + 1,
        symbol,
        evidence,
        note,
      });
      break;
    }
  });
  return findings;
}

function countByDebtKey(findings = []) {
  return findings.reduce((counts, finding) => {
    const key = `${finding.file}#${finding.symbol}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function summarizeResidualDebt(findings = [], baseline = BASELINE_DEBT) {
  const counts = countByDebtKey(findings);
  const residual = Object.entries(counts)
    .filter(([key]) => baseline[key])
    .map(([key, count]) => ({
      key,
      count,
      baseline: baseline[key],
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return residual;
}

function findNewViolations(findings = [], baseline = BASELINE_DEBT) {
  const counts = countByDebtKey(findings);
  const overflowByKey = new Map();
  Object.entries(counts).forEach(([key, count]) => {
    const allowed = baseline[key] || 0;
    if (count > allowed) overflowByKey.set(key, count - allowed);
  });
  const used = new Map();
  return findings.filter((finding) => {
    const key = `${finding.file}#${finding.symbol}`;
    const overflow = overflowByKey.get(key) || 0;
    if (overflow <= 0) return false;
    const nextUsed = (used.get(key) || 0) + 1;
    used.set(key, nextUsed);
    const allowed = baseline[key] || 0;
    return nextUsed > allowed;
  });
}

function scanPlatformBoundary(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const baseline = options.baseline || BASELINE_DEBT;
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isProductionSource)
    .sort();
  const findings = files.flatMap((file) =>
    findPlatformBoundaryFindingsInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  );
  const newViolations = findNewViolations(findings, baseline);
  return {
    report: 'frontend-platform-boundary',
    mode: 'blocking-growth',
    filesScanned: files.length,
    adapterPathPatterns: ADAPTER_PATH_PATTERNS.map((pattern) => pattern.source),
    residualDebt: summarizeResidualDebt(findings, baseline),
    violations: newViolations,
    summary: {
      totalFindings: findings.length,
      residualDebtKeys: summarizeResidualDebt(findings, baseline).length,
      totalViolations: newViolations.length,
    },
  };
}

function renderText(report) {
  const lines = [
    '[frontend-platform-boundary] blocking-growth gate',
    `files scanned: ${report.filesScanned}`,
    `residual debt keys: ${report.summary.residualDebtKeys}`,
    `total findings: ${report.summary.totalFindings}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  if (report.residualDebt.length) {
    lines.push('', 'Existing platform-boundary debt still allowed by baseline:');
    report.residualDebt.forEach((entry) => {
      lines.push(`- ${entry.key}: ${entry.count}/${entry.baseline}`);
    });
  }
  if (report.violations.length) {
    lines.push('', 'New platform-boundary violations:');
    report.violations.forEach((violation) => {
      lines.push(
        `- ${violation.file}:${violation.line} ${violation.symbol}: ${violation.evidence}`,
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
  if (unknown.length) throw new Error(`unknown arguments: ${unknown.join(', ')}`);
  return argv.includes('--json') ? 'json' : 'text';
}

function main() {
  try {
    const report = scanPlatformBoundary();
    if (parseFormat() === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(renderText(report));
    if (report.summary.totalViolations > 0) process.exit(1);
  } catch (error) {
    console.error(`[frontend-platform-boundary] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ADAPTER_PATH_PATTERNS,
  BASELINE_DEBT,
  PLATFORM_PATTERNS,
  findNewViolations,
  findPlatformBoundaryFindingsInText,
  isAdapterPath,
  parseFormat,
  renderText,
  scanPlatformBoundary,
  stripStringLiterals,
};

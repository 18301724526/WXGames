'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = Object.freeze(['backend', 'frontend/js', 'frontend/minigame', 'shared']);
const EXCLUDED_PATH_PATTERNS = Object.freeze([
  /\.test\.js$/,
  /\.contract\.test\.js$/,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)public\//,
  /(^|\/)dist\//,
]);

const ALLOWED_DOMAIN_OWNER_PATTERNS = Object.freeze([
  /^backend\/actions\//,
  /^backend\/application\/commands\//,
  /^backend\/application\/projections\//,
  /^backend\/calculators\//,
  /^backend\/config\//,
  /^backend\/modules\//,
  /^backend\/repositories\//,
  /^backend\/services\//,
  /^shared\/worldMarch(?:Core|Passability)\.js$/,
  /^shared\/tutorialFlowConfig\.js$/,
]);

const REVIEW_LAYER_PATTERNS = Object.freeze([
  {
    layer: 'frontend-renderer',
    pattern: /^frontend\/js\/platform\/renderers\//,
    note: 'renderer should consume snapshots and emit intents, not own gameplay rules',
  },
  {
    layer: 'frontend-platform',
    pattern: /^frontend\/js\/platform\//,
    note: 'platform shell should route state/rendering, not calculate gameplay outcomes',
  },
  {
    layer: 'frontend-ui',
    pattern: /^frontend\/js\/ui\//,
    note: 'UI adapters should translate input/output, not mutate canonical gameplay state',
  },
  {
    layer: 'frontend-minigame',
    pattern: /^frontend\/minigame\//,
    note: 'bootstrap bundle should not become a gameplay rule owner',
  },
  {
    layer: 'backend-route',
    pattern: /^backend\/routes\//,
    note: 'routes should delegate commands to services/actions instead of calculating rules inline',
  },
  {
    layer: 'backend-middleware',
    pattern: /^backend\/middleware\//,
    note: 'middleware should enforce transport/security concerns, not gameplay rules',
  },
  {
    layer: 'backend-bootstrap',
    pattern: /^backend\/(?:server|world-worker)\.js$/,
    note: 'bootstrap should wire runtime dependencies, not own gameplay rules',
  },
]);

const GAMEPLAY_NOUNS = Object.freeze([
  'army',
  'battle',
  'building',
  'casualt',
  'city',
  'cooldown',
  'cost',
  'damage',
  'defender',
  'era',
  'explor',
  'famous',
  'food',
  'gold',
  'hp',
  'level',
  'march',
  'mission',
  'morale',
  'person',
  'population',
  'power',
  'progress',
  'recruit',
  'research',
  'reward',
  'skill',
  'soldier',
  'talent',
  'tech',
  'territor',
  'tutorial',
  'unlock',
  'worker',
  'wood',
  'world',
]);

const RULE_VERBS = Object.freeze([
  'accept',
  'advance',
  'attack',
  'award',
  'build',
  'calculate',
  'claim',
  'complete',
  'consume',
  'damage',
  'defeat',
  'deduct',
  'finish',
  'gain',
  'grant',
  'heal',
  'levelUp',
  'pay',
  'produce',
  'recruit',
  'refund',
  'research',
  'resolve',
  'reward',
  'spend',
  'unlock',
  'upgrade',
]);

const AUTHORITY_OBJECTS = Object.freeze([
  'account',
  'army',
  'battle',
  'building',
  'city',
  'game',
  'gameState',
  'person',
  'player',
  'resources',
  'state',
  'territory',
  'tutorial',
  'unit',
]);

const MUTATING_MEMBER_PATTERN = new RegExp(
  `\\b(?:${AUTHORITY_OBJECTS.join('|')})\\s*(?:\\.[A-Za-z_$][\\w$]*){1,4}\\s*(?:=(?!=|>)|\\+=|-=|\\*=|\\/=|%=|\\+\\+|--|\\.push\\s*\\(|\\.splice\\s*\\(|\\.set\\s*\\()`,
  'i',
);

const STATE_WRITE_PATTERN =
  /\b(?:host|lastGame|owner|app|game|shell|canvasShell|controller)\.state\s*=\s*[^=]/i;
const RESOURCE_DELTA_PATTERN =
  /\b(?:resources?|food|wood|gold|population|soldiers?|power|morale|hp)\b[^;\n]*(?:\+=|-=|=(?!=|>)|Math\.(?:max|min|floor|ceil|round)|\+|-|\*)/i;
const BRANCH_PATTERN = /\b(?:if|else\s+if|switch|case)\b/i;
const RULE_TERM_PATTERNS = Object.freeze([
  /\bcost\b|[A-Z]Cost\b/i,
  /\breward\b|[A-Z]Reward\b/i,
  /\bunlock\b|[A-Z]Unlock(?:ed)?\b/i,
  /\bcooldown\b|[A-Z]Cooldown\b/i,
  /\blevel\b|[A-Z]Level\b/i,
  /\bera\b|currentEra|advanceEra|eraProgress/i,
  /\bresearch\b|[A-Z]Research(?:ed)?\b/i,
  /\bresources?\b|[A-Z]Resources?\b/i,
  /\bpopulation\b|[A-Z]Population\b/i,
  /\bsoldiers?\b|[A-Z]Soldiers?\b/i,
  /\bmorale\b|[A-Z]Morale\b/i,
  /\bdamage\b|[A-Z]Damage\b/i,
  /\bhp\b|[A-Z]Hp\b|\bHP\b/,
  /\bpower\b|[A-Z]Power\b/i,
]);
const RULE_VERB_PATTERN = new RegExp(`\\b(?:${RULE_VERBS.join('|')})[A-Za-z0-9_$]*\\s*\\(`, 'i');
const GAMEPLAY_HARDCODED_NUMBER_PATTERN =
  /\b(?:cost|reward|damage|cooldown|duration|level|era|hp|morale|population|soldiers?|food|wood|gold|power)\b[^;\n]*\b\d{2,}\b|\b\d{2,}\b[^;\n]*(?:cost|reward|damage|cooldown|duration|level|era|hp|morale|population|soldiers?|food|wood|gold|power)\b/i;
const BACKEND_DELEGATION_PATTERN =
  /\b(?:[A-Za-z_$][\w$]*(?:Service|Registry|Repository|Pipeline|Assembler)|service|registry|repository|pipeline|assembler)\.[A-Za-z_$][\w$]*\s*\(/;
const ROUTING_ONLY_PATTERNS = Object.freeze([
  /^\s*case\s+/,
  /\breturn\s+this\.handle_[A-Za-z0-9_$]+\b/,
  /\bthis\.handle_[A-Za-z0-9_$]+\b/,
  /\btypeof\s+[A-Za-z_$][\w$?.]*\s*===\s*''/,
  /\btypeof\s+[A-Za-z_$][\w$?.]*\s*!==\s*''/,
  /\b(?:api|this\.api|game|target)(?:\?\.|\.)[A-Za-z_$][\w$]*\s*\(/,
  /\bthis\.request\s*\(/,
]);
const SEVERITY_RANK = Object.freeze({ high: 0, medium: 1, low: 2 });

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function collectFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(entryPath, files);
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
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
    if (!inSingle && !inDouble && !inTemplate && char === '/' && next === '/') {
      return line.slice(0, index);
    }
  }
  return line;
}

function stripStringLiterals(line = '') {
  return String(line || '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''");
}

function stripCodeLine(line = '') {
  return stripStringLiterals(stripLineComment(line));
}

function isExcluded(relativePath = '') {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function isSourceFile(relativePath = '') {
  const normalized = normalizePath(relativePath);
  if (!normalized.endsWith('.js')) return false;
  if (!SOURCE_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
    return false;
  }
  return !isExcluded(normalized);
}

function isAllowedDomainOwner(relativePath = '') {
  const normalized = normalizePath(relativePath);
  return ALLOWED_DOMAIN_OWNER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function classifyLayer(relativePath = '') {
  const normalized = normalizePath(relativePath);
  const reviewLayer = REVIEW_LAYER_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  if (reviewLayer) return { layer: reviewLayer.layer, reviewRequired: true, note: reviewLayer.note };
  if (isAllowedDomainOwner(normalized)) {
    return {
      layer: 'allowed-domain-owner',
      reviewRequired: false,
      note: 'known service/config/action/shared authority layer',
    };
  }
  if (normalized.startsWith('frontend/js/state/')) {
    return {
      layer: 'frontend-state',
      reviewRequired: true,
      note: 'frontend state stores may own client state, but should not calculate server-authoritative gameplay',
    };
  }
  if (normalized.startsWith('frontend/js/ecs/')) {
    return {
      layer: 'frontend-ecs',
      reviewRequired: true,
      note: 'ECS projection/input/foundation code should stay deterministic and scoped to client runtime',
    };
  }
  if (normalized.startsWith('shared/')) {
    return {
      layer: 'shared',
      reviewRequired: true,
      note: 'shared modules need explicit pure-core ownership when they contain gameplay rules',
    };
  }
  return {
    layer: 'unclassified',
    reviewRequired: true,
    note: 'unclassified source surface with gameplay-rule signals',
  };
}

function hasGameplayNoun(line = '') {
  const lower = String(line || '').toLowerCase();
  return GAMEPLAY_NOUNS.some((noun) => lower.includes(noun));
}

function hasRuleTerm(line = '') {
  return RULE_TERM_PATTERNS.some((pattern) => pattern.test(line));
}

function collectSignals(line = '') {
  const signals = [];
  if (STATE_WRITE_PATTERN.test(line)) signals.push('host-state-write');
  if (MUTATING_MEMBER_PATTERN.test(line) && hasGameplayNoun(line)) {
    signals.push('authority-state-mutation');
  }
  if (RESOURCE_DELTA_PATTERN.test(line)) signals.push('resource-or-stat-delta');
  if (BRANCH_PATTERN.test(line) && hasRuleTerm(line)) signals.push('gameplay-rule-branch');
  if (RULE_VERB_PATTERN.test(line) && hasGameplayNoun(line)) signals.push('gameplay-result-verb');
  if (GAMEPLAY_HARDCODED_NUMBER_PATTERN.test(line) && hasGameplayNoun(line)) {
    signals.push('hardcoded-gameplay-number');
  }
  return signals;
}

function isDelegationOnly(line = '') {
  const signals = collectSignals(line);
  return signals.length === 1 && signals[0] === 'gameplay-result-verb' && BACKEND_DELEGATION_PATTERN.test(line);
}

function isRoutingOnly(line = '', signals = collectSignals(line)) {
  if (signals.some((signal) => ['authority-state-mutation', 'resource-or-stat-delta'].includes(signal))) {
    return false;
  }
  return ROUTING_ONLY_PATTERNS.some((pattern) => pattern.test(line));
}

function classifySeverity(layer, signals) {
  if (signals.includes('host-state-write')) return 'high';
  if (
    (layer === 'frontend-renderer' || layer === 'frontend-platform' || layer === 'frontend-ui') &&
    signals.some((signal) =>
      ['authority-state-mutation', 'gameplay-rule-branch'].includes(signal),
    )
  ) {
    return 'high';
  }
  if (layer === 'backend-route' && signals.some((signal) => signal !== 'gameplay-result-verb')) {
    return 'medium';
  }
  if (signals.length >= 2) return 'medium';
  return 'low';
}

function sortFindings(findings = []) {
  return findings.slice().sort((a, b) => (
    (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    || a.layer.localeCompare(b.layer)
    || a.file.localeCompare(b.file)
    || a.line - b.line
  ));
}

function findDomainBusinessCandidatesInText(relativePath, text = '') {
  const normalized = normalizePath(relativePath);
  const layerInfo = classifyLayer(normalized);
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    if (/^\s*(?:\/\/|\*)/.test(rawLine)) return;
    const line = stripCodeLine(rawLine);
    const evidence = rawLine.trim().replace(/\s+/g, ' ');
    if (!line.trim() || !evidence) return;
    if (!hasGameplayNoun(line)) return;

    const signals = collectSignals(line);
    if (signals.length === 0) return;
    if (!layerInfo.reviewRequired) return;
    if (isDelegationOnly(line)) return;
    if (isRoutingOnly(line, signals)) return;

    findings.push({
      file: normalized,
      line: index + 1,
      layer: layerInfo.layer,
      severity: classifySeverity(layerInfo.layer, signals),
      signals,
      evidence,
      note: layerInfo.note,
    });
  });

  return findings;
}

function buildSummary(findings = []) {
  const byLayer = new Map();
  const bySeverity = new Map();
  const bySignal = new Map();
  findings.forEach((finding) => {
    byLayer.set(finding.layer, (byLayer.get(finding.layer) || 0) + 1);
    bySeverity.set(finding.severity, (bySeverity.get(finding.severity) || 0) + 1);
    finding.signals.forEach((signal) => {
      bySignal.set(signal, (bySignal.get(signal) || 0) + 1);
    });
  });
  return {
    totalFindings: findings.length,
    byLayer: Object.fromEntries(Array.from(byLayer.entries()).sort()),
    bySeverity: Object.fromEntries(Array.from(bySeverity.entries()).sort()),
    bySignal: Object.fromEntries(Array.from(bySignal.entries()).sort()),
  };
}

function scanDomainBusinessCandidates(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const files = SOURCE_ROOTS.flatMap((root) => collectFiles(path.join(repoRoot, root)))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .filter(isSourceFile)
    .sort();
  const findings = sortFindings(files.flatMap((file) =>
    findDomainBusinessCandidatesInText(file, fs.readFileSync(path.join(repoRoot, file), 'utf8')),
  ));
  return {
    report: 'domain-business-candidates',
    mode: 'report-only',
    definition:
      'Finds gameplay-rule signals outside declared authority owners: canonical state mutation, resource/stat deltas, rule branches, result verbs, and hardcoded gameplay numbers.',
    filesScanned: files.length,
    allowedDomainOwnerPatterns: ALLOWED_DOMAIN_OWNER_PATTERNS.map((pattern) => pattern.source),
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
    '[domain-business-candidates] report-only structural scan',
    report.definition,
    `files scanned: ${report.filesScanned}`,
    `findings: ${report.summary.totalFindings}`,
    'by severity:',
  ];
  Object.entries(report.summary.bySeverity).forEach(([severity, count]) => {
    lines.push(`- ${severity}: ${count}`);
  });
  lines.push('by layer:');
  Object.entries(report.summary.byLayer).forEach(([layer, count]) => {
    lines.push(`- ${layer}: ${count}`);
  });
  lines.push('by signal:');
  Object.entries(report.summary.bySignal).forEach(([signal, count]) => {
    lines.push(`- ${signal}: ${count}`);
  });
  if (report.findings.length > 0) {
    lines.push('', 'Top candidates:');
    report.findings.slice(0, 40).forEach((finding) => {
      lines.push(
        `- [${finding.severity}] ${finding.file}:${finding.line} ${finding.layer} ${finding.signals.join(', ')}: ${finding.evidence}`,
      );
    });
  }
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(report) {
  const lines = [
    '# Domain Business Candidate Report',
    '',
    'Mode: report-only. Findings are structural candidates for review, not automatic violations.',
    '',
    report.definition,
    '',
    '## Summary',
    '',
    '| Dimension | Key | Findings |',
    '| --- | --- | ---: |',
  ];
  Object.entries(report.summary.bySeverity).forEach(([severity, count]) => {
    lines.push(`| Severity | ${escapeMarkdownCell(severity)} | ${count} |`);
  });
  Object.entries(report.summary.byLayer).forEach(([layer, count]) => {
    lines.push(`| Layer | ${escapeMarkdownCell(layer)} | ${count} |`);
  });
  Object.entries(report.summary.bySignal).forEach(([signal, count]) => {
    lines.push(`| Signal | ${escapeMarkdownCell(signal)} | ${count} |`);
  });
  lines.push(
    '',
    '## Findings',
    '',
    '| Severity | File | Line | Layer | Signals | Evidence | Note |',
    '| --- | --- | ---: | --- | --- | --- | --- |',
  );
  report.findings.forEach((finding) => {
    lines.push(
      `| ${escapeMarkdownCell(finding.severity)} | ${escapeMarkdownCell(finding.file)} | ${finding.line} | ${escapeMarkdownCell(finding.layer)} | ${escapeMarkdownCell(finding.signals.join(', '))} | \`${escapeMarkdownCell(finding.evidence)}\` | ${escapeMarkdownCell(finding.note)} |`,
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
    const report = scanDomainBusinessCandidates();
    if (format === 'json') process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else if (format === 'markdown') process.stdout.write(renderMarkdown(report));
    else process.stdout.write(renderSummary(report));
  } catch (error) {
    console.error(`[domain-business-candidates] failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  ALLOWED_DOMAIN_OWNER_PATTERNS,
  GAMEPLAY_NOUNS,
  REVIEW_LAYER_PATTERNS,
  SOURCE_ROOTS,
  buildSummary,
  classifyLayer,
  collectSignals,
  findDomainBusinessCandidatesInText,
  isAllowedDomainOwner,
  isSourceFile,
  parseFormat,
  renderMarkdown,
  renderSummary,
  scanDomainBusinessCandidates,
  stripCodeLine,
};

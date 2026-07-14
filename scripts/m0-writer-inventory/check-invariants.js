'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  COMMAND_OWNER_RULES,
  listDeclaredCommandTypes,
} = require('../../backend/application/commands/CommandOwnerResolver');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_DOCUMENT = path.join(REPO_ROOT, 'docs', 'architecture', 'm0', 'command-invariants.md');
const COMMAND_TABLE_START = '<!-- COMMAND_INVARIANTS_START -->';
const COMMAND_TABLE_END = '<!-- COMMAND_INVARIANTS_END -->';
const ABSENT_TABLE_START = '<!-- ABSENT_CRITICAL_PATHS_START -->';
const ABSENT_TABLE_END = '<!-- ABSENT_CRITICAL_PATHS_END -->';
const REQUIRED_FIELDS = Object.freeze([
  'ownerSet',
  'domainTables',
  'businessUniqueKey',
  'expectedVersionSource',
  'externalSideEffects',
  'finalProjection',
]);
const REQUIRED_CRITICAL_PATHS = Object.freeze([
  '付费',
  '奖励',
  '占领',
  '入盟',
  '行军',
  '建筑完成',
]);

function splitTableRow(line) {
  const text = String(line || '').trim();
  if (!text.startsWith('|') || !text.endsWith('|')) return [];
  return text.slice(1, -1).split('|').map((cell) => cell.trim());
}

function parseMarkedTable(markdown, startMarker, endMarker) {
  const start = markdown.indexOf(startMarker);
  const end = markdown.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`missing marked table: ${startMarker}`);
  }
  const lines = markdown.slice(start + startMarker.length, end)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  if (lines.length < 2) throw new Error(`empty marked table: ${startMarker}`);
  const headers = splitTableRow(lines[0]);
  const rows = [];
  lines.slice(2).forEach((line, index) => {
    const cells = splitTableRow(line);
    if (cells.length !== headers.length) {
      throw new Error(`invalid table row ${index + 1}: expected ${headers.length} cells, got ${cells.length}`);
    }
    rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])));
  });
  return rows;
}

function expectedOwnerSet(rule = {}) {
  if (rule.kind === 'player') return 'player:{playerId}';
  if (rule.kind === 'player-identity') return 'player:{payload.username}';
  if (rule.kind === 'player-territory-owner') {
    return 'player:{playerId}; territory-owner:{playerId}';
  }
  if (rule.kind === 'player-encounter-handoff') {
    return 'player:{playerId}; encounter:{payload.encounterId or payload.combatEncounterId when present}';
  }
  if (rule.kind === 'player-with-encounters') {
    return 'player:{playerId}; encounter:{each payload.encounterIds}';
  }
  if (rule.kind === 'world-social-batch') {
    return 'world-social:global; player:{each payload.playerIds}; person:{each payload.personIds}';
  }
  if (rule.kind === 'diagnostic-player') return 'diagnostic:{playerId}';
  if (rule.kind === 'constant') return rule.ownerKey;
  if (rule.kind === 'split-required') {
    return 'BLOCKED: explicit per-mutation owner commands required';
  }
  if (rule.kind === 'shared' && rule.prefix === 'territory') {
    return 'player:{playerId}; territory:{payload.territoryId}; territory-owner:{playerId}; territory-owner:{currentOwnerPlayerId}';
  }
  if (rule.kind === 'shared' && rule.prefix === 'encounter') {
    return 'player:{playerId}; encounter:{payload.encounterId or payload.combatEncounterId}';
  }
  if (rule.kind === 'shared' && rule.prefix === 'diplomacy') {
    return 'diplomacy:{payload.pairId}';
  }
  return '';
}

function parseTags(value) {
  const text = String(value || '').trim();
  if (!text || text === '无') return [];
  return text.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function inspectDocument(markdown, options = {}) {
  const rules = options.rules || COMMAND_OWNER_RULES;
  const commandTypes = options.commandTypes || Object.keys(rules).sort();
  const findings = [];
  let rows = [];
  let absentRows = [];
  try {
    rows = parseMarkedTable(markdown, COMMAND_TABLE_START, COMMAND_TABLE_END);
    absentRows = parseMarkedTable(markdown, ABSENT_TABLE_START, ABSENT_TABLE_END);
  } catch (error) {
    return { findings: [error.message], rows, absentRows };
  }

  const rowsByType = new Map();
  rows.forEach((row) => {
    if (!row.commandType) findings.push('documented commandType is empty');
    else if (rowsByType.has(row.commandType)) findings.push(`duplicate commandType: ${row.commandType}`);
    else rowsByType.set(row.commandType, row);
  });
  commandTypes.forEach((commandType) => {
    if (!rowsByType.has(commandType)) findings.push(`registry command missing from document: ${commandType}`);
  });
  rowsByType.forEach((_row, commandType) => {
    if (!Object.hasOwn(rules, commandType)) findings.push(`document command missing from registry: ${commandType}`);
  });

  const taggedPaths = new Map(REQUIRED_CRITICAL_PATHS.map((pathTag) => [pathTag, []]));
  rowsByType.forEach((row, commandType) => {
    REQUIRED_FIELDS.forEach((field) => {
      if (!String(row[field] || '').trim()) findings.push(`${commandType} field is empty: ${field}`);
    });
    if (!String(row.invariant || '').trim()) findings.push(`${commandType} invariant is empty`);
    const expected = expectedOwnerSet(rules[commandType]);
    if (expected && row.ownerSet !== expected) {
      findings.push(`${commandType} ownerSet mismatch: expected ${expected}`);
    }
    parseTags(row.pathTags).forEach((tag) => {
      if (!taggedPaths.has(tag)) findings.push(`${commandType} has unknown critical path tag: ${tag}`);
      else taggedPaths.get(tag).push(commandType);
    });
  });

  const absentByPath = new Map();
  absentRows.forEach((row) => {
    const pathTag = String(row.pathTag || '').trim();
    if (!REQUIRED_CRITICAL_PATHS.includes(pathTag)) {
      findings.push(`unknown absent critical path: ${pathTag || '<empty>'}`);
      return;
    }
    if (absentByPath.has(pathTag)) findings.push(`duplicate absent critical path: ${pathTag}`);
    absentByPath.set(pathTag, row);
    if (row.commandSurface !== 'NONE_DECLARED') {
      findings.push(`${pathTag} absent path must use NONE_DECLARED`);
    }
    if (!String(row.invariant || '').trim()) findings.push(`${pathTag} absent path invariant is empty`);
  });

  REQUIRED_CRITICAL_PATHS.forEach((pathTag) => {
    const commands = taggedPaths.get(pathTag) || [];
    const absent = absentByPath.has(pathTag);
    if (!commands.length && !absent) findings.push(`critical path lacks tagged command or absent declaration: ${pathTag}`);
    if (commands.length && absent) findings.push(`critical path is both tagged and declared absent: ${pathTag}`);
  });

  return {
    findings,
    rows,
    absentRows,
    summary: {
      registryCommandCount: commandTypes.length,
      documentedCommandCount: rowsByType.size,
      criticalPathCount: REQUIRED_CRITICAL_PATHS.length,
    },
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { documentPath: DEFAULT_DOCUMENT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--document') options.documentPath = path.resolve(argv[++index] || '');
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs();
  const markdown = fs.readFileSync(options.documentPath, 'utf8');
  const result = inspectDocument(markdown, {
    rules: COMMAND_OWNER_RULES,
    commandTypes: listDeclaredCommandTypes(),
  });
  process.stdout.write(
    `[m0-command-invariants] registry=${result.summary?.registryCommandCount || 0} `
      + `documented=${result.summary?.documentedCommandCount || 0} `
      + `criticalPaths=${result.summary?.criticalPathCount || 0} findings=${result.findings.length}\n`,
  );
  result.findings.forEach((finding) => process.stderr.write(`[m0-command-invariants] ${finding}\n`));
  if (result.findings.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[m0-command-invariants] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ABSENT_TABLE_END,
  ABSENT_TABLE_START,
  COMMAND_TABLE_END,
  COMMAND_TABLE_START,
  REQUIRED_CRITICAL_PATHS,
  REQUIRED_FIELDS,
  expectedOwnerSet,
  inspectDocument,
  parseMarkedTable,
  splitTableRow,
};

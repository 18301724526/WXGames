'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { buildReport: buildStaticReport } = require('./index');
const {
  CATEGORIES,
  WRITER_DECLARATIONS,
} = require('./declarations');
const { TRACE_SCHEMA } = require('../../backend/services/WriterTraceProbe');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs', 'architecture', 'm0');
const HIT_SET_OUTPUT = path.join(OUTPUT_DIR, 'writer-runtime-hits.json');
const MARKDOWN_OUTPUT = path.join(OUTPUT_DIR, 'writer-tri-diff.md');
const HIT_SET_SCHEMA = 'm0-writer-runtime-hits-v1';

const ROUTE_COMMAND_TYPES = Object.freeze({
  'route:POST /api/buildings/build': 'build',
  'route:POST /api/client-events': 'clientEventIngest',
  'route:POST /api/client-operation-logs': 'clientOperationLogIngest',
  'route:POST /api/game/heartbeat': 'heartbeat',
  'route:POST /api/game/tasks/claim': 'claimTaskReward',
  'route:POST /api/player/login': 'playerLogin',
  'route:POST /api/player/reset': 'playerReset',
  'admin:route:POST /api/admin/config-releases/publish': 'configReleasePublish',
  'admin:route:POST /api/admin/config-releases/rollback': 'configReleaseRollback',
  'admin:route:POST /api/admin/ops/login': 'opsLoginAudit',
  'admin:route:POST /api/admin/ops/maintenance': 'opsMaintenanceSet',
  'admin:route:POST /api/admin/ops/restart': 'opsRestartAccepted',
});

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function flattenStaticEntries(staticReport) {
  return staticReport.categories.flatMap((category) => category.entries || []);
}

function flattenDeclaredIds(declarations = WRITER_DECLARATIONS) {
  return uniqueSorted(CATEGORIES.flatMap((category) => (
    (declarations[category] || []).map((entry) => entry.id)
  )));
}

function readTraceFile(traceFile) {
  const content = fs.readFileSync(traceFile, 'utf8');
  return content.split(/\r?\n/).filter(Boolean).map((line, index) => {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid writer trace JSON at line ${index + 1}: ${error.message}`);
    }
    if (record.schema !== TRACE_SCHEMA) {
      throw new Error(`invalid writer trace schema at line ${index + 1}: ${record.schema || '<empty>'}`);
    }
    return record;
  });
}

function commandWriterId(commandType, staticIds) {
  const candidates = [
    `command:${commandType}`,
    `worker:command:${commandType}`,
    `admin:command:${commandType}`,
  ];
  return candidates.find((id) => staticIds.has(id)) || '';
}

function selectNearestEntry(entries, frame) {
  const candidates = entries.filter((entry) => entry.file === frame.file);
  if (candidates.length === 0) return null;
  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(Number(frame.line) - Number(left.line));
    const rightDistance = Math.abs(Number(frame.line) - Number(right.line));
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return Number(right.line) - Number(left.line);
  })[0];
}

function mapTraceRecord(record, staticEntries) {
  const staticIds = new Set(staticEntries.map((entry) => entry.id));
  const writerIds = new Set();
  const commandType = String(record.commandType || '');
  if (commandType) {
    const commandId = commandWriterId(commandType, staticIds);
    if (commandId) writerIds.add(commandId);
  }

  const stackEntries = staticEntries.filter((entry) => !['command', 'client_state_writer'].includes(entry.category));
  const seenFiles = new Set();
  (record.stack || []).forEach((frame) => {
    if (!frame?.file || seenFiles.has(frame.file)) return;
    seenFiles.add(frame.file);
    const match = selectNearestEntry(stackEntries, frame);
    if (match) writerIds.add(match.id);
  });

  Array.from(writerIds).forEach((writerId) => {
    const routedCommandType = ROUTE_COMMAND_TYPES[writerId];
    if (!routedCommandType) return;
    const commandId = commandWriterId(routedCommandType, staticIds);
    if (commandId) writerIds.add(commandId);
  });

  return Object.freeze({
    writerIds: Object.freeze(uniqueSorted(Array.from(writerIds))),
    category: String(record.category || 'unknown'),
    commandType,
    table: String(record.table || ''),
    operation: String(record.operation || ''),
    database: path.basename(String(record.databasePath || '')),
    source: Object.freeze((record.stack || []).slice(0, 3).map((frame) => Object.freeze({
      file: String(frame.file || ''),
      line: Number(frame.line) || 0,
      function: String(frame.function || ''),
    }))),
  });
}

function runtimeWriterRows(mappedRecords, staticEntries) {
  const entryById = new Map(staticEntries.map((entry) => [entry.id, entry]));
  return uniqueSorted(mappedRecords.flatMap((record) => record.writerIds)).map((writerId) => {
    const records = mappedRecords.filter((record) => record.writerIds.includes(writerId));
    const entry = entryById.get(writerId);
    return Object.freeze({
      id: writerId,
      category: entry?.category || 'unknown',
      commandTypes: Object.freeze(uniqueSorted(records.map((record) => record.commandType))),
      tables: Object.freeze(uniqueSorted(records.map((record) => record.table))),
      operations: Object.freeze(uniqueSorted(records.map((record) => record.operation))),
      evidence: Object.freeze(uniqueSorted(records.flatMap((record) => (
        record.source.map((source) => `${source.file}:${source.line}`)
      )))),
    });
  });
}

function unknownRows(mappedRecords) {
  const rowsByKey = new Map();
  mappedRecords.filter((record) => record.writerIds.length === 0).forEach((record) => {
    const firstSource = record.source[0] || {};
    const key = [
      record.category,
      record.commandType,
      record.database,
      record.table,
      record.operation,
      firstSource.file,
      firstSource.line,
    ].join('|');
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, Object.freeze({
        category: record.category,
        commandType: record.commandType,
        database: record.database,
        table: record.table,
        operation: record.operation,
        evidence: firstSource.file ? `${firstSource.file}:${firstSource.line}` : '',
        ownerTask: '',
      }));
    }
  });
  return Array.from(rowsByKey.values()).sort((left, right) => (
    `${left.database}:${left.table}:${left.operation}:${left.evidence}`
      .localeCompare(`${right.database}:${right.table}:${right.operation}:${right.evidence}`)
  ));
}

function buildRuntimeHitSet(records, options = {}) {
  const staticReport = options.staticReport || buildStaticReport();
  const staticEntries = flattenStaticEntries(staticReport);
  const mappedRecords = records.map((record) => mapTraceRecord(record, staticEntries));
  const runtimeWriters = runtimeWriterRows(mappedRecords, staticEntries);
  const unknown = unknownRows(mappedRecords);
  return {
    schema: HIT_SET_SCHEMA,
    source: {
      environment: options.environment || 'WSL Ubuntu-24.04',
      harness: options.harness || 'scripts/playtest-game-smoke.js',
    },
    summary: {
      rawEventCount: records.length,
      mappedEventCount: mappedRecords.filter((record) => record.writerIds.length > 0).length,
      runtimeWriterCount: runtimeWriters.length,
      unknownWriterCount: unknown.length,
    },
    runtimeWriters,
    unknown,
  };
}

function directionalDifference(left, right) {
  const rightSet = new Set(right);
  return uniqueSorted(left.filter((item) => !rightSet.has(item)));
}

function buildTriDiff(hitSet, options = {}) {
  const staticReport = options.staticReport || buildStaticReport();
  const staticIds = uniqueSorted(flattenStaticEntries(staticReport).map((entry) => entry.id));
  const declaredIds = flattenDeclaredIds(options.declarations || WRITER_DECLARATIONS);
  const runtimeIds = uniqueSorted((hitSet.runtimeWriters || []).map((entry) => entry.id));
  return {
    staticIds,
    declaredIds,
    runtimeIds,
    differences: {
      staticMinusDeclared: directionalDifference(staticIds, declaredIds),
      declaredMinusStatic: directionalDifference(declaredIds, staticIds),
      staticMinusRuntime: directionalDifference(staticIds, runtimeIds),
      runtimeMinusStatic: directionalDifference(runtimeIds, staticIds),
      declaredMinusRuntime: directionalDifference(declaredIds, runtimeIds),
      runtimeMinusDeclared: directionalDifference(runtimeIds, declaredIds),
    },
  };
}

function renderList(lines, values) {
  if (!values.length) lines.push('无。');
  else values.forEach((value) => lines.push(`- ${value}`));
}

function renderMarkdown(hitSet, triDiff = buildTriDiff(hitSet)) {
  const lines = [
    '# M0 Writer 三集合差异',
    '',
    `- 运行环境：${hitSet.source?.environment || ''}`,
    `- 运行入口：${hitSet.source?.harness || ''}`,
    `- 原始写入事件：${hitSet.summary?.rawEventCount || 0}`,
    `- 已映射事件：${hitSet.summary?.mappedEventCount || 0}`,
    `- 运行时 writer：${triDiff.runtimeIds.length}`,
    `- 未知 writer：${(hitSet.unknown || []).length}`,
    '',
    '## 集合规模',
    '',
    '| 集合 | 数量 |',
    '| --- | ---: |',
    `| 静态发现 | ${triDiff.staticIds.length} |`,
    `| 清单声明 | ${triDiff.declaredIds.length} |`,
    `| 运行时命中 | ${triDiff.runtimeIds.length} |`,
    '',
    '## 两两双向差集',
  ];
  const sections = [
    ['静态发现 - 清单声明', triDiff.differences.staticMinusDeclared],
    ['清单声明 - 静态发现', triDiff.differences.declaredMinusStatic],
    ['静态发现 - 运行时命中', triDiff.differences.staticMinusRuntime],
    ['运行时命中 - 静态发现', triDiff.differences.runtimeMinusStatic],
    ['清单声明 - 运行时命中', triDiff.differences.declaredMinusRuntime],
    ['运行时命中 - 清单声明', triDiff.differences.runtimeMinusDeclared],
  ];
  sections.forEach(([title, values]) => {
    lines.push('', `### ${title}`, '');
    renderList(lines, values);
  });

  lines.push('', '## 运行时命中明细', '');
  if (!(hitSet.runtimeWriters || []).length) lines.push('无。');
  else {
    lines.push('| Writer | 类别 | 命令类型 | 表 | 操作 | 证据 |', '| --- | --- | --- | --- | --- | --- |');
    hitSet.runtimeWriters.forEach((entry) => {
      lines.push(`| ${entry.id} | ${entry.category} | ${entry.commandTypes.join(', ')} | ${entry.tables.join(', ')} | ${entry.operations.join(', ')} | ${entry.evidence.join(', ')} |`);
    });
  }

  lines.push('', '## 未知运行时 writer', '');
  if (!(hitSet.unknown || []).length) lines.push('无。');
  else {
    lines.push('| 类别 | 命令类型 | 数据库 | 表 | 操作 | 证据 | 后续任务 |', '| --- | --- | --- | --- | --- | --- | --- |');
    hitSet.unknown.forEach((entry) => {
      lines.push(`| ${entry.category} | ${entry.commandType} | ${entry.database} | ${entry.table} | ${entry.operation} | ${entry.evidence} | ${entry.ownerTask} |`);
    });
  }

  lines.push(
    '',
    '## 解释边界',
    '',
    '- 运行时集合只表示本次 playtest smoke 实际命中的 writer，不把未执行项伪装成命中。',
    '- SQL 原文不落盘；探针只记录操作类型、表、命令类型与仓库内调用栈，避免把凭据或 token 写入证据。',
    '- 静态发现与清单声明应完全相等；运行时命中必须能映射回这两个集合，或明确列出后续归属。',
  );
  return `${lines.join('\n')}\n`;
}

function renderHitSetJson(hitSet) {
  return `${JSON.stringify(hitSet, null, 2)}\n`;
}

function validateHitSet(hitSet, triDiff = buildTriDiff(hitSet)) {
  const findings = [];
  if (hitSet.schema !== HIT_SET_SCHEMA) findings.push(`invalid hit set schema: ${hitSet.schema || '<empty>'}`);
  if (triDiff.differences.staticMinusDeclared.length || triDiff.differences.declaredMinusStatic.length) {
    findings.push('static discovery and declarations are not equal');
  }
  if (triDiff.differences.runtimeMinusStatic.length) {
    findings.push(`runtime ids missing from static discovery: ${triDiff.differences.runtimeMinusStatic.join(', ')}`);
  }
  if (triDiff.differences.runtimeMinusDeclared.length) {
    findings.push(`runtime ids missing from declarations: ${triDiff.differences.runtimeMinusDeclared.join(', ')}`);
  }
  (hitSet.unknown || []).forEach((entry) => {
    if (!String(entry.ownerTask || '').trim()) {
      findings.push(`unknown writer lacks owner task: ${entry.database}:${entry.table}:${entry.operation}:${entry.evidence}`);
    }
  });
  return findings;
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { check: false, traceFile: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check') options.check = true;
    else if (arg === '--trace') options.traceFile = argv[++index] || '';
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.check && !options.traceFile) throw new Error('--trace is required unless --check is used');
  return options;
}

function checkOutputs(hitSet, markdown) {
  const findings = [];
  if (!fs.existsSync(MARKDOWN_OUTPUT)) findings.push('OUTPUT_MISSING docs/architecture/m0/writer-tri-diff.md');
  else if (fs.readFileSync(MARKDOWN_OUTPUT, 'utf8') !== markdown) {
    findings.push('OUTPUT_STALE docs/architecture/m0/writer-tri-diff.md');
  }
  if (fs.readFileSync(HIT_SET_OUTPUT, 'utf8') !== renderHitSetJson(hitSet)) {
    findings.push('OUTPUT_STALE docs/architecture/m0/writer-runtime-hits.json');
  }
  return findings;
}

function main() {
  const args = parseArgs();
  let hitSet;
  if (args.check) {
    if (!fs.existsSync(HIT_SET_OUTPUT)) throw new Error('runtime hit set output is missing');
    hitSet = JSON.parse(fs.readFileSync(HIT_SET_OUTPUT, 'utf8'));
  } else {
    const traceFile = path.resolve(args.traceFile);
    hitSet = buildRuntimeHitSet(readTraceFile(traceFile));
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(HIT_SET_OUTPUT, renderHitSetJson(hitSet), 'utf8');
  }
  const triDiff = buildTriDiff(hitSet);
  const markdown = renderMarkdown(hitSet, triDiff);
  if (!args.check) fs.writeFileSync(MARKDOWN_OUTPUT, markdown, 'utf8');
  const findings = [
    ...validateHitSet(hitSet, triDiff),
    ...(args.check ? checkOutputs(hitSet, markdown) : []),
  ];
  process.stdout.write(
    `[m0-writer-runtime] events=${hitSet.summary?.rawEventCount || 0} `
      + `runtime=${triDiff.runtimeIds.length} unknown=${(hitSet.unknown || []).length} `
      + `findings=${findings.length}\n`,
  );
  findings.forEach((finding) => process.stderr.write(`[m0-writer-runtime] ${finding}\n`));
  if (findings.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[m0-writer-runtime] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  HIT_SET_OUTPUT,
  HIT_SET_SCHEMA,
  MARKDOWN_OUTPUT,
  buildRuntimeHitSet,
  buildTriDiff,
  commandWriterId,
  directionalDifference,
  mapTraceRecord,
  parseArgs,
  readTraceFile,
  renderHitSetJson,
  renderMarkdown,
  selectNearestEntry,
  validateHitSet,
};

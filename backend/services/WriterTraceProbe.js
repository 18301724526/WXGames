'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getOwnerContext } = require('../application/commands/CommandOwnerContext');

const DEFAULT_TRACE_FILE = path.join('.local-logs', 'm0-writer-trace.ndjson');
const TRACE_SCHEMA = 'm0-writer-trace-v1';
const ADMIN_COMMAND_PATTERN = /^(?:configRelease|ops)/;
const WORKER_COMMAND_PATTERN = /^worldWorker/;
const WRITE_PATTERNS = Object.freeze([
  Object.freeze({ operation: 'insert', pattern: /\bINSERT(?:\s+OR\s+\w+)?\s+INTO\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
  Object.freeze({ operation: 'replace', pattern: /\bREPLACE\s+INTO\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
  Object.freeze({ operation: 'update', pattern: /\bUPDATE(?:\s+OR\s+\w+)?\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
  Object.freeze({ operation: 'delete', pattern: /\bDELETE\s+FROM\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
  Object.freeze({ operation: 'create', pattern: /\bCREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
  Object.freeze({ operation: 'alter', pattern: /\bALTER\s+TABLE\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
  Object.freeze({ operation: 'drop', pattern: /\bDROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+([`"\[]?[A-Za-z_][\w$.-]*[`"\]]?)/i }),
]);

function normalizeIdentifier(value) {
  return String(value || '').replace(/^[`"\[]|[`"\]]$/g, '').split('.').pop() || '';
}

function parseWriteStatement(sql) {
  const text = String(sql || '');
  for (const entry of WRITE_PATTERNS) {
    const match = entry.pattern.exec(text);
    if (match) {
      return Object.freeze({
        operation: entry.operation,
        table: normalizeIdentifier(match[1]),
      });
    }
  }
  return null;
}

function parseStackFrame(line, repoRoot) {
  const text = String(line || '').trim();
  const location = /(.+):(\d+):(\d+)\)?$/.exec(text);
  if (!location) return null;
  let filePath = location[1].replace(/^at\s+/, '');
  const openParen = filePath.lastIndexOf('(');
  const functionText = openParen >= 0 ? filePath.slice(0, openParen).trim() : '';
  if (openParen >= 0) filePath = filePath.slice(openParen + 1);
  if (filePath.startsWith('file://')) filePath = filePath.slice('file://'.length);
  const absolutePath = path.resolve(filePath);
  const relativePath = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) return null;
  if (relativePath.includes('/node_modules/') || relativePath.endsWith('/WriterTraceProbe.js')) return null;
  return Object.freeze({
    file: relativePath,
    line: Number(location[2]),
    column: Number(location[3]),
    function: functionText.replace(/^at\s+/, ''),
  });
}

function captureApplicationStack(repoRoot) {
  return Object.freeze(String(new Error().stack || '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => parseStackFrame(line, repoRoot))
    .filter(Boolean)
    .slice(0, 16));
}

function classifyCommand(commandType) {
  if (WORKER_COMMAND_PATTERN.test(commandType)) return 'worker';
  if (ADMIN_COMMAND_PATTERN.test(commandType)) return 'admin';
  return 'command';
}

function classifyStack(frames) {
  const files = frames.map((frame) => frame.file);
  if (files.some((file) => /^backend\/routes\/(?:admin|ops)Routes\.js$/.test(file))) return 'admin';
  if (files.some((file) => file.startsWith('backend/routes/'))) return 'route';
  if (files.some((file) => file.startsWith('backend/migrations/'))) return 'migration';
  if (files.some((file) => file === 'backend/world-worker.js' || /WorldWorker/.test(file))) return 'worker';
  if (files.some((file) => /(?:^|\/)(?:repair|cleanup|restore|backfill)[^/]*\.(?:js|sh)$/i.test(file))) {
    return 'repair_script';
  }
  if (files.some((file) => /(?:^|\/)consumers?(?:\/|$)|Consumer\.js$/i.test(file))) return 'consumer';
  return 'unknown';
}

function createWriterTraceProbe(options = {}) {
  const env = options.env || process.env;
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..'));
  const traceFile = path.resolve(
    options.traceFile || env.M0_WRITER_TRACE_FILE || path.join(repoRoot, DEFAULT_TRACE_FILE),
  );
  const databasePath = String(options.dbPath || '');
  fs.mkdirSync(path.dirname(traceFile), { recursive: true });

  return function writerTraceVerbose(sql) {
    const statement = parseWriteStatement(sql);
    if (!statement) return;
    const ownerContext = getOwnerContext();
    const commandType = String(ownerContext?.commandType || '');
    const stack = captureApplicationStack(repoRoot);
    const record = {
      schema: TRACE_SCHEMA,
      at: new Date().toISOString(),
      pid: process.pid,
      category: commandType ? classifyCommand(commandType) : classifyStack(stack),
      table: statement.table,
      commandType,
      operation: statement.operation,
      databasePath,
      stack,
    };
    fs.appendFileSync(traceFile, `${JSON.stringify(record)}\n`, 'utf8');
  };
}

module.exports = {
  TRACE_SCHEMA,
  classifyCommand,
  classifyStack,
  createWriterTraceProbe,
  parseStackFrame,
  parseWriteStatement,
};

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { listDeclaredCommandTypes } = require('../../backend/application/commands/CommandOwnerResolver');
const { scanRepository } = require('../command-owner-step1/scanner');
const { ADMIN_COMMAND_TYPES, WORKER_COMMAND_TYPES } = require('./declarations');

const ADMIN_COMMAND_SET = new Set(ADMIN_COMMAND_TYPES);
const WORKER_COMMAND_SET = new Set(WORKER_COMMAND_TYPES);
const REPAIR_NAME_PATTERN = /(?:repair|cleanup|restore|backfill)/i;
const REPAIR_WRITE_PATTERNS = Object.freeze([
  /\bresetPlayerState\s*\(/,
  /\brepairLegacySpawnAccount\s*\(/,
  /\bupdate\.run\s*\(/,
  /^\s*(?:cp|mv)\s+.*(?:DB_PATH|civilization\.db)/m,
]);
const CONSUMER_WRITE_PATTERN = /\b(?:save|upsert\w*|insert\w*|update\w*|delete\w*|resetPlayerState)\s*\(/;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toRelative(repoRoot, filePath) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function firstMatch(text, patterns) {
  let selected = null;
  patterns.forEach((pattern) => {
    const match = pattern.exec(text);
    pattern.lastIndex = 0;
    if (!match) return;
    if (!selected || match.index < selected.index) selected = match;
  });
  return selected;
}

function writer(category, id, file, line, summary) {
  return {
    category,
    id,
    file,
    line,
    evidence: [`${file}:${line}`],
    summary,
  };
}

function collectFiles(rootDir, predicate, output = []) {
  if (!fs.existsSync(rootDir)) return output;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  entries.forEach((entry) => {
    const filePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) collectFiles(filePath, predicate, output);
    else if (entry.isFile() && predicate(filePath)) output.push(filePath);
  });
  return output;
}

function findCommandTypeLine(text, commandType) {
  const escaped = escapeRegExp(commandType);
  const directKey = new RegExp(`^\\s*${escaped}\\s*:`, 'm').exec(text);
  const quotedValue = new RegExp(`['"]${escaped}['"]`).exec(text);
  const match = directKey || quotedValue;
  return match ? lineNumberAt(text, match.index) : 1;
}

function scanCommandWriters(repoRoot) {
  const relativeFile = 'backend/application/commands/CommandOwnerResolver.js';
  const filePath = path.join(repoRoot, relativeFile);
  const text = fs.readFileSync(filePath, 'utf8');
  return listDeclaredCommandTypes().map((commandType) => {
    const line = findCommandTypeLine(text, commandType);
    if (WORKER_COMMAND_SET.has(commandType)) {
      return writer(
        'worker',
        `worker:command:${commandType}`,
        relativeFile,
        line,
        `后台命令 ${commandType}`,
      );
    }
    if (ADMIN_COMMAND_SET.has(commandType)) {
      return writer(
        'admin',
        `admin:command:${commandType}`,
        relativeFile,
        line,
        `管理命令 ${commandType}`,
      );
    }
    return writer(
      'command',
      `command:${commandType}`,
      relativeFile,
      line,
      `业务命令 ${commandType}`,
    );
  });
}

function scanRouteWriters(repoRoot) {
  return scanRepository(repoRoot).serverWriteRoutes.map((route) => {
    if (route.method === 'BACKGROUND') {
      return writer(
        'worker',
        'worker:entry:backend/world-worker.js',
        route.file,
        route.line,
        '后台 world worker 入口',
      );
    }
    if (route.route.startsWith('/api/admin/')) {
      return writer(
        'admin',
        `admin:route:${route.key}`,
        route.file,
        route.line,
        `管理写路由 ${route.key}`,
      );
    }
    return writer('route', `route:${route.key}`, route.file, route.line, `写路由 ${route.key}`);
  });
}

function scanMigrationWriters(repoRoot) {
  const migrationRoot = path.join(repoRoot, 'backend', 'migrations');
  const files = collectFiles(migrationRoot, (filePath) => filePath.endsWith('.js'));
  const results = [];
  files.forEach((filePath) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const relativeFile = toRelative(repoRoot, filePath);
    const pattern = /\bid\s*:\s*(['"])([^'"]+)\1/g;
    let match;
    while ((match = pattern.exec(text))) {
      results.push(writer(
        'migration',
        `migration:${match[2]}`,
        relativeFile,
        lineNumberAt(text, match.index),
        `SchemaMigrationService 迁移 ${match[2]}`,
      ));
    }
  });
  return results;
}

function scanRepairScriptWriters(repoRoot) {
  const roots = [path.join(repoRoot, 'scripts'), path.join(repoRoot, 'backend', 'scripts')];
  const candidates = roots.flatMap((root) => collectFiles(root, (filePath) => {
    const relative = toRelative(repoRoot, filePath);
    return !relative.includes('/m0-writer-inventory/')
      && !relative.endsWith('.test.js')
      && REPAIR_NAME_PATTERN.test(path.basename(filePath))
      && /\.(?:js|sh)$/.test(filePath);
  }));
  return candidates.flatMap((filePath) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = firstMatch(text, REPAIR_WRITE_PATTERNS);
    if (!match) return [];
    const relativeFile = toRelative(repoRoot, filePath);
    return [writer(
      'repair_script',
      `repair-script:${relativeFile}`,
      relativeFile,
      lineNumberAt(text, match.index),
      `修复或恢复脚本 ${relativeFile}`,
    )];
  });
}

function scanConsumerWriters(repoRoot) {
  const backendRoot = path.join(repoRoot, 'backend');
  const candidates = collectFiles(backendRoot, (filePath) => {
    const relative = toRelative(repoRoot, filePath);
    return relative.endsWith('.js')
      && !relative.endsWith('.test.js')
      && (/(?:^|\/)consumers?(?:\/|$)/i.test(relative) || /Consumer\.js$/i.test(relative));
  });
  return candidates.flatMap((filePath) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = CONSUMER_WRITE_PATTERN.exec(text);
    CONSUMER_WRITE_PATTERN.lastIndex = 0;
    if (!match) return [];
    const relativeFile = toRelative(repoRoot, filePath);
    return [writer(
      'consumer',
      `consumer:${relativeFile}`,
      relativeFile,
      lineNumberAt(text, match.index),
      `消息 consumer 写入口 ${relativeFile}`,
    )];
  });
}

function scanClientStateWriters(repoRoot) {
  const stateRoot = path.join(repoRoot, 'frontend', 'js', 'state');
  const candidates = collectFiles(stateRoot, (filePath) => (
    /StateWriter\.js$/.test(filePath) && !filePath.endsWith('.test.js')
  ));
  return candidates.flatMap((filePath) => {
    const text = fs.readFileSync(filePath, 'utf8');
    const match = /\bowner\.state\s*=/.exec(text);
    if (!match) return [];
    const relativeFile = toRelative(repoRoot, filePath);
    return [writer(
      'client_state_writer',
      `client-state-writer:${relativeFile}#commit`,
      relativeFile,
      lineNumberAt(text, match.index),
      '客户端实时状态唯一写点 StateWriter.commit',
    )];
  });
}

function scanStaticWriters(repoRoot = process.cwd()) {
  const root = path.resolve(repoRoot);
  return [
    ...scanRouteWriters(root),
    ...scanCommandWriters(root),
    ...scanMigrationWriters(root),
    ...scanRepairScriptWriters(root),
    ...scanConsumerWriters(root),
    ...scanClientStateWriters(root),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

module.exports = {
  scanClientStateWriters,
  scanCommandWriters,
  scanConsumerWriters,
  scanMigrationWriters,
  scanRepairScriptWriters,
  scanRouteWriters,
  scanStaticWriters,
};

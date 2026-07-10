'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  collectJsFiles,
  readText,
  resolveRepoPath,
  splitLines,
} = require('./source-utils');

const REQUIRE_PATTERN = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const IMPORT_PATTERN = /\bfrom\s+['"]([^'"]+)['"]/g;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function sourceExists(repoRoot, file, sources = {}) {
  if (Object.prototype.hasOwnProperty.call(sources, file)) return true;
  const resolved = resolveRepoPath(repoRoot, file);
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
}

function readSource(repoRoot, file, sources = {}) {
  if (Object.prototype.hasOwnProperty.call(sources, file)) return sources[file];
  return readText(repoRoot, file);
}

function extractLocalImports(source = '') {
  const imports = [];
  for (const pattern of [REQUIRE_PATTERN, IMPORT_PATTERN]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      const specifier = match[1] || '';
      if (specifier.startsWith('.')) imports.push(specifier);
      match = pattern.exec(source);
    }
  }
  return imports;
}

function resolveLocalImport(fromFile, specifier, repoRoot = process.cwd(), sources = {}) {
  const base = normalizePath(path.posix.normalize(path.posix.join(
    path.posix.dirname(normalizePath(fromFile)),
    specifier,
  )));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.json`,
    `${base}/index.js`,
  ];
  return candidates.find((candidate) => sourceExists(repoRoot, candidate, sources)) || '';
}

function buildImportClosure(entryFiles = [], options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sources = options.sources || {};
  const shouldTraverse = options.shouldTraverse || (() => true);
  const seen = new Set();
  const stack = [...entryFiles.map(normalizePath)];

  while (stack.length) {
    const file = stack.pop();
    if (!file || seen.has(file) || !sourceExists(repoRoot, file, sources)) continue;
    seen.add(file);
    if (!shouldTraverse(file)) continue;
    const source = readSource(repoRoot, file, sources);
    extractLocalImports(source).forEach((specifier) => {
      const resolved = resolveLocalImport(file, specifier, repoRoot, sources);
      if (resolved && !seen.has(resolved)) stack.push(resolved);
    });
  }
  return [...seen].sort();
}

function collectEntryFiles(roots, repoRoot = process.cwd(), options = {}) {
  if (Array.isArray(options.files)) return options.files.map(normalizePath).sort();
  return collectJsFiles(roots, repoRoot, options).map(normalizePath);
}

function isCommentOnly(line = '') {
  return /^\s*(?:\/\/|\*)/.test(line);
}

function scanForbiddenPatterns(files = [], rules = [], options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const sources = options.sources || {};
  const allowFile = options.allowFile || (() => false);
  const findings = [];
  for (const file of files) {
    if (allowFile(file)) continue;
    const lines = splitLines(readSource(repoRoot, file, sources));
    lines.forEach((line, index) => {
      if (isCommentOnly(line)) return;
      rules.forEach((rule) => {
        rule.pattern.lastIndex = 0;
        if (!rule.pattern.test(line)) return;
        findings.push({
          file,
          line: index + 1,
          kind: rule.kind,
          evidence: line.trim(),
          message: rule.message || `${rule.kind} is not allowed here`,
        });
      });
    });
  }
  return findings;
}

module.exports = {
  buildImportClosure,
  collectEntryFiles,
  extractLocalImports,
  normalizePath,
  readSource,
  resolveLocalImport,
  scanForbiddenPatterns,
  sourceExists,
};

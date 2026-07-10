'use strict';

const fs = require('node:fs');
const path = require('node:path');

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(filePath, repoRoot = process.cwd()) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function resolveRepoPath(repoRoot, relativePath) {
  return path.join(repoRoot, ...String(relativePath || '').split('/'));
}

function readText(repoRoot, relativePath) {
  return fs.readFileSync(resolveRepoPath(repoRoot, relativePath), 'utf8');
}

function splitLines(text = '') {
  return String(text).split(/\r?\n/);
}

function lineRangeText(text, startLine, endLine) {
  const lines = splitLines(text);
  return lines.slice(Math.max(0, startLine - 1), Math.max(0, endLine)).join('\n');
}

function lineRangeValid(text, startLine, endLine) {
  const lines = splitLines(text);
  return Number.isInteger(startLine)
    && Number.isInteger(endLine)
    && startLine >= 1
    && endLine >= startLine
    && endLine <= lines.length;
}

function collectFiles(entryPath, repoRoot, predicate = () => true, files = []) {
  if (!fs.existsSync(entryPath)) return files;
  const stat = fs.statSync(entryPath);
  if (stat.isFile()) {
    const relative = toPosixRelative(entryPath, repoRoot);
    if (predicate(relative, entryPath)) files.push(entryPath);
    return files;
  }
  if (!stat.isDirectory()) return files;
  for (const entry of fs.readdirSync(entryPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    collectFiles(path.join(entryPath, entry.name), repoRoot, predicate, files);
  }
  return files;
}

function collectJsFiles(roots, repoRoot = process.cwd(), options = {}) {
  const excluded = options.excluded || [];
  return roots
    .flatMap((root) => collectFiles(resolveRepoPath(repoRoot, root), repoRoot, (relative) => (
      relative.endsWith('.js')
      && !relative.endsWith('.test.js')
      && !excluded.some((pattern) => pattern.test(relative))
    )))
    .map((filePath) => toPosixRelative(filePath, repoRoot))
    .sort();
}

function findLine(text, pattern) {
  const lines = splitLines(text);
  const matcher = pattern instanceof RegExp
    ? (line) => pattern.test(line)
    : (line) => line.includes(String(pattern || ''));
  const index = lines.findIndex((line) => matcher(line));
  return index >= 0 ? index + 1 : 0;
}

function sourceRef(file, startLine, endLine, symbolOrPattern, inventoryId) {
  return {
    file,
    startLine,
    endLine,
    symbolOrPattern,
    inventoryId,
  };
}

module.exports = {
  collectFiles,
  collectJsFiles,
  findLine,
  lineRangeText,
  lineRangeValid,
  normalizePath,
  readText,
  resolveRepoPath,
  sourceRef,
  splitLines,
  toPosixRelative,
};

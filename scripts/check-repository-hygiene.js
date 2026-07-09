const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const FORBIDDEN_PATTERNS = [
  /\.bak(\.|$)/i,
  /\.backup(\.|$)/i,
  /(^|\/)\.env(\.|$)/i,
  /\.(sqlite|sqlite3|db)(-|\.|$)/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)[^/]*(password|credential|secret)[^/]*\.txt$/i,
  /(^|\/)[^/]*(密码|密钥|凭据|连接密码)[^/]*\.txt$/i,
];

const EXCLUDED_SCAN_DIRS = new Set(['.git', '.codegraph', 'node_modules', 'vendor']);

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/');
}

function hasGitWorkTree(cwd = process.cwd()) {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function runGitLsFiles(cwd = process.cwd()) {
  const result = spawnSync('git', ['ls-files'], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'git ls-files failed');
  }
  return result.stdout.split(/\r?\n/).filter(Boolean).map(normalizePath);
}

function collectFilesystemFiles(root = process.cwd()) {
  const files = [];

  function visit(directory, relativePrefix = '') {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_SCAN_DIRS.has(entry.name)) continue;
      const relativePath = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      if (entry.isFile()) files.push(normalizePath(relativePath));
    }
  }

  visit(root);
  return files.sort();
}

function collectInspectableFiles(cwd = process.cwd(), options = {}) {
  const isGitWorkTree = typeof options.hasGitWorkTree === 'function'
    ? options.hasGitWorkTree(cwd)
    : hasGitWorkTree(cwd);
  if (isGitWorkTree) {
    return { mode: 'git', files: runGitLsFiles(cwd) };
  }
  return { mode: 'filesystem', files: collectFilesystemFiles(cwd) };
}

function isForbidden(file) {
  const normalized = normalizePath(file);
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalized));
}

function main() {
  let inventory;
  try {
    inventory = collectInspectableFiles();
  } catch (error) {
    process.stderr.write(`${error.message || error}\n`);
    process.exit(1);
  }
  const offenders = inventory.files.filter(isForbidden).sort();

  if (offenders.length > 0) {
    console.error(`[repository-hygiene] forbidden ${inventory.mode === 'git' ? 'tracked' : 'published'} files:`);
    offenders.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }

  console.log(`[repository-hygiene] passed (${inventory.mode})`);
}

if (require.main === module) {
  main();
}

module.exports = {
  EXCLUDED_SCAN_DIRS,
  FORBIDDEN_PATTERNS,
  collectFilesystemFiles,
  collectInspectableFiles,
  hasGitWorkTree,
  isForbidden,
  normalizePath,
  runGitLsFiles,
};

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_ROOTS = Object.freeze(['backend', 'frontend', 'shared']);
const DEFAULT_REVIEW_FILES = Object.freeze([
  '.gitattributes',
  '.prettierignore',
  '.prettierrc',
  '.github/workflows/ci.yml',
  'eslint-suppressions.json',
  'eslint.config.js',
  'package.json',
  'package-lock.json',
  'scripts/check-eslint-suppressions-budget.js',
  'scripts/package-game-code.js',
  'scripts/package-game-code.test.js',
]);
const DOC_ROOTS = Object.freeze(['docs']);

const BLOCKED_DIRECTORY_SEGMENTS = Object.freeze([
  '.git',
  '.github',
  '.local-logs',
  'assets',
  'data',
  'logs',
  'node_modules',
  'ops-agent',
  'tmp',
  'tools',
  'vendor',
]);

const ALLOWED_EXTENSIONS = Object.freeze([
  '',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sample',
  '.sh',
  '.ts',
  '.yaml',
  '.yml',
]);

const BLOCKED_FILE_PATTERNS = Object.freeze([
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)[^/]*(password|credential|secret|token)[^/]*\.(txt|md|json|env)$/i,
  /\.(7z|atlas|avif|bak|backup|bmp|db|db-shm|db-wal|gif|gz|ico|jpeg|jpg|log|m4a|mov|mp3|mp4|ogg|png|rar|skel|sqlite|sqlite3|tar|tgz|wav|webm|webp|zip)$/i,
  /\.(pem|key|p12|pfx)$/i,
]);

function toPosix(relativePath) {
  return String(relativePath).replace(/\\/g, '/');
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    includeDocs: false,
    out: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run' || arg === '--list') {
      options.dryRun = true;
    } else if (arg === '--include-docs') {
      options.includeDocs = true;
    } else if (arg === '--out') {
      options.out = argv[index + 1] || null;
      index += 1;
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function getTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function getDefaultOutputPath(root = projectRoot) {
  return path.join(root, 'tmp', 'code-bundles', `wxgames-code-${getTimestamp()}.zip`);
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isAllowedExtension(relativePath) {
  const basename = path.basename(relativePath);
  if (basename === '.gitignore') return true;
  return ALLOWED_EXTENSIONS.includes(path.extname(relativePath).toLowerCase());
}

function hasBlockedDirectory(relativePath) {
  const segments = toPosix(relativePath).split('/');
  return segments.slice(0, -1).some((segment) => BLOCKED_DIRECTORY_SEGMENTS.includes(segment));
}

function hasBlockedFilePattern(relativePath) {
  const normalized = toPosix(relativePath);
  return BLOCKED_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isDefaultReviewFile(relativePath) {
  return DEFAULT_REVIEW_FILES.includes(toPosix(relativePath));
}

function isUnderRoot(relativePath, root) {
  const normalized = toPosix(relativePath);
  return normalized === root || normalized.startsWith(`${root}/`);
}

function shouldIncludeFile(relativePath, options = {}) {
  const normalized = toPosix(relativePath);
  const roots = [...DEFAULT_ROOTS, ...(options.includeDocs ? DOC_ROOTS : [])];
  const isExplicitReviewFile = isDefaultReviewFile(normalized);

  if (!isExplicitReviewFile && !roots.some((root) => isUnderRoot(normalized, root))) {
    return false;
  }

  if (!isExplicitReviewFile && hasBlockedDirectory(normalized)) return false;
  if (hasBlockedFilePattern(normalized)) return false;
  if (!isAllowedExtension(normalized)) return false;

  return true;
}

function walkDirectory(directory, root, files = []) {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = toPosix(path.relative(root, absolutePath));

    if (entry.isDirectory()) {
      if (!hasBlockedDirectory(path.join(relativePath, 'placeholder'))) {
        walkDirectory(absolutePath, root, files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function collectCandidateFiles(root = projectRoot, options = {}) {
  const candidates = [];

  for (const reviewFile of DEFAULT_REVIEW_FILES) {
    const absolutePath = path.join(root, reviewFile);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      candidates.push(reviewFile);
    }
  }

  const roots = [...DEFAULT_ROOTS, ...(options.includeDocs ? DOC_ROOTS : [])];
  for (const relativeRoot of roots) {
    walkDirectory(path.join(root, relativeRoot), root, candidates);
  }

  return Array.from(new Set(candidates)).sort((a, b) => a.localeCompare(b));
}

function collectPackageFiles(root = projectRoot, options = {}) {
  return collectCandidateFiles(root, options).filter((file) => shouldIncludeFile(file, options));
}

function ensureCleanDirectory(directory) {
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  fs.mkdirSync(directory, { recursive: true });
}

function copyFiles(files, sourceRoot, stagingRoot) {
  for (const relativePath of files) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(stagingRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function getFilesTotalBytes(files, root) {
  return files.reduce((sum, relativePath) => sum + fs.statSync(path.join(root, relativePath)).size, 0);
}

function writeBundleReadme(stagingRoot, manifest) {
  const lines = [
    '# WXGames code review bundle',
    '',
    'This archive is generated by `npm run package:code`.',
    '',
    'Included by default:',
    '- backend game/server source, tests, and package manifests',
    '- frontend game source, tests, HTML/CSS entry files, and mini-game shell files',
    '- shared game configuration',
    '- root Node package manifests',
    '- CI, lint, format, and suppression baseline configuration',
    '- the code bundle script and its focused test',
    '',
    'Excluded by default:',
    '- art assets, animation files, audio/video, and other binary media',
    '- local databases, logs, temporary files, generated archives, and build/runtime output',
    '- node_modules, frontend vendor code, frontend tools, backend ops agent, and local secrets',
    '',
    `Files: ${manifest.fileCount}`,
    `Bytes: ${manifest.totalBytes}`,
    '',
  ];
  fs.writeFileSync(path.join(stagingRoot, 'README_CODE_BUNDLE.md'), `${lines.join('\n')}\n`, 'utf8');
}

function writeManifest(stagingRoot, manifest) {
  fs.writeFileSync(
    path.join(stagingRoot, 'CODE_BUNDLE_MANIFEST.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

function quotePowerShellPath(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runZip(stagingRoot, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, { force: true });
  }

  if (process.platform === 'win32') {
    const command = [
      '$ErrorActionPreference = "Stop"',
      `Compress-Archive -Path ${quotePowerShellPath(path.join(stagingRoot, '*'))} -DestinationPath ${quotePowerShellPath(outputPath)} -Force`,
    ].join('; ');
    const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      cwd: stagingRoot,
      encoding: 'utf8',
      shell: false,
    });
    if (result.status === 0) return;
    throw new Error(result.stderr || result.stdout || 'Compress-Archive failed');
  }

  const result = spawnSync('zip', ['-qr', outputPath, '.'], {
    cwd: stagingRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'zip failed');
  }
}

function createBundle(options = {}) {
  const sourceRoot = path.resolve(options.root || projectRoot);
  const outputPath = path.resolve(sourceRoot, options.out || getDefaultOutputPath(sourceRoot));
  const stagingRoot = path.join(sourceRoot, 'tmp', 'code-bundles', `.staging-${getTimestamp()}`);

  if (!isPathInside(sourceRoot, stagingRoot)) {
    throw new Error(`Refusing to stage outside project root: ${stagingRoot}`);
  }

  const files = collectPackageFiles(sourceRoot, options);
  const totalBytes = getFilesTotalBytes(files, sourceRoot);
  const manifest = {
    createdAt: new Date().toISOString(),
    profile: 'game-code-review',
    includeDocs: Boolean(options.includeDocs),
    sourceRoot,
    fileCount: files.length,
    totalBytes,
    files: files.map((relativePath) => ({
      path: relativePath,
      bytes: fs.statSync(path.join(sourceRoot, relativePath)).size,
    })),
    rules: {
      roots: [...DEFAULT_ROOTS, ...(options.includeDocs ? DOC_ROOTS : [])],
      reviewFiles: DEFAULT_REVIEW_FILES,
      blockedDirectorySegments: BLOCKED_DIRECTORY_SEGMENTS,
      allowedExtensions: ALLOWED_EXTENSIONS,
      blockedFilePatterns: BLOCKED_FILE_PATTERNS.map((pattern) => pattern.source),
    },
  };

  if (options.dryRun) {
    return { files, manifest, outputPath, stagingRoot: null };
  }

  ensureCleanDirectory(stagingRoot);
  try {
    copyFiles(files, sourceRoot, stagingRoot);
    writeBundleReadme(stagingRoot, manifest);
    writeManifest(stagingRoot, manifest);
    runZip(stagingRoot, outputPath);
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }

  return { files, manifest, outputPath, stagingRoot: null };
}

function printHelp() {
  console.log(`Usage: node scripts/package-game-code.js [options]

Options:
  --out <path>       Write the zip to this path. Defaults to tmp/code-bundles/wxgames-code-<timestamp>.zip.
  --dry-run, --list  Print the files that would be included without writing an archive.
  --include-docs     Include docs/ markdown and JSON files in the bundle.
  -h, --help         Show this help.
`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const result = createBundle(options);
  if (options.dryRun) {
    result.files.forEach((file) => console.log(file));
    console.error(`[package-code] ${result.files.length} files, ${result.manifest.totalBytes} bytes`);
    return;
  }

  console.log(`[package-code] wrote ${path.relative(projectRoot, result.outputPath)}`);
  console.log(`[package-code] ${result.files.length} files, ${result.manifest.totalBytes} bytes`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[package-code] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  BLOCKED_DIRECTORY_SEGMENTS,
  BLOCKED_FILE_PATTERNS,
  ALLOWED_EXTENSIONS,
  DEFAULT_ROOTS,
  DEFAULT_REVIEW_FILES,
  collectPackageFiles,
  createBundle,
  shouldIncludeFile,
};

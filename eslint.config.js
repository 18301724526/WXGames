const fs = require('node:fs');
const path = require('node:path');

const rootDir = __dirname;
const frontendJsDir = path.join(rootDir, 'frontend', 'js');

const READONLY = 'readonly';
const WRITABLE = 'writable';
const GLOBAL_ASSIGNMENT_RE = /\b(?:global|window)\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g;

function walkJsFiles(directory, files = []) {
  if (!fs.existsSync(directory)) return files;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'vendor') continue;

    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function discoverFrontendGlobals() {
  const names = new Set();

  for (const file of walkJsFiles(frontendJsDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(GLOBAL_ASSIGNMENT_RE)) {
      names.add(match[1]);
    }
  }

  return Object.fromEntries(
    Array.from(names)
      .sort()
      .map((name) => [name, READONLY]),
  );
}

const browserGlobals = {
  AbortController: READONLY,
  Blob: READONLY,
  CanvasRenderingContext2D: READONLY,
  clearInterval: READONLY,
  clearTimeout: READONLY,
  console: READONLY,
  CustomEvent: READONLY,
  document: READONLY,
  fetch: READONLY,
  FileReader: READONLY,
  FormData: READONLY,
  global: WRITABLE,
  Image: READONLY,
  localStorage: READONLY,
  location: READONLY,
  navigator: READONLY,
  Navigator: READONLY,
  OffscreenCanvas: READONLY,
  performance: READONLY,
  PerformanceObserver: READONLY,
  requestAnimationFrame: READONLY,
  setInterval: READONLY,
  setTimeout: READONLY,
  TextDecoder: READONLY,
  TextEncoder: READONLY,
  URL: READONLY,
  URLSearchParams: READONLY,
  window: WRITABLE,
};

const nodeGlobals = {
  AbortController: READONLY,
  __dirname: READONLY,
  __filename: READONLY,
  Blob: READONLY,
  Buffer: READONLY,
  clearInterval: READONLY,
  clearTimeout: READONLY,
  console: READONLY,
  exports: WRITABLE,
  fetch: READONLY,
  FormData: READONLY,
  Headers: READONLY,
  global: WRITABLE,
  module: WRITABLE,
  process: READONLY,
  require: READONLY,
  Request: READONLY,
  Response: READONLY,
  setInterval: READONLY,
  setTimeout: READONLY,
  TextDecoder: READONLY,
  TextEncoder: READONLY,
  URL: READONLY,
  URLSearchParams: READONLY,
};

const commonRules = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-dupe-keys': 'error',
  'no-empty': ['error', { allowEmptyCatch: false }],
  'no-fallthrough': 'error',
  'no-redeclare': 'error',
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-unused-vars': [
    'error',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      caughtErrors: 'all',
      caughtErrorsIgnorePattern: '^_',
      ignoreRestSiblings: true,
      vars: 'all',
    },
  ],
};

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/vendor/**',
      'frontend/js/vendor/**',
      'frontend/assets/**',
      'frontend/minigame/**',
      'backend/data/**',
      'backend/logs/**',
      '.local-logs/**',
      'tmp/**',
      'spine*/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'eslint-suppressions.json',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
    rules: commonRules,
  },
  {
    files: ['frontend/**/*.js'],
    languageOptions: {
      globals: {
        ...browserGlobals,
        ...discoverFrontendGlobals(),
      },
    },
  },
  {
    files: ['frontend/js/domain/**/*.js'],
    ignores: ['frontend/js/domain/**/*.test.js'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          message:
            'Domain layer is pure logic; pass platform data as explicit parameters instead of reading window properties.',
        },
        {
          object: 'document',
          message:
            'Domain layer is pure logic; pass platform data as explicit parameters instead of reading document properties.',
        },
        {
          object: 'localStorage',
          message:
            'Domain layer is pure logic; pass platform data as explicit parameters instead of reading localStorage properties.',
        },
        {
          object: 'wx',
          message:
            'Domain layer is pure logic; pass platform data as explicit parameters instead of reading wx properties.',
        },
        {
          object: 'tt',
          message:
            'Domain layer is pure logic; pass platform data as explicit parameters instead of reading tt properties.',
        },
      ],
    },
  },
  {
    files: ['backend/**/*.js', 'scripts/**/*.js', '*.js'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: [
      'backend/frontend-api-example.js',
      'scripts/p2-task-uploader-browser-verify.js',
      'scripts/playtest-*.js',
      'scripts/profile-h5-performance.js',
    ],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        ...browserGlobals,
      },
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        assert: READONLY,
        test: READONLY,
      },
    },
  },
];

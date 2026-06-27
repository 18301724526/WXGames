const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  MOJIBAKE_DENYLIST,
  findEncodingIssuesInBuffer,
  scanSourceEncoding,
  parseFormat,
} = require('./check-source-encoding');

function writeFile(root, filePath, buffer) {
  const fullPath = path.join(root, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
}

function withTempRepo(callback) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'source-encoding-'));
  try {
    fs.mkdirSync(path.join(repoRoot, 'backend'), { recursive: true });
    return callback(repoRoot);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

test('flags a UTF-8 BOM at the start of a source file', () => {
  const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('const x = 1;\n')]);
  const issues = findEncodingIssuesInBuffer('backend/Foo.js', buffer);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'bom');
});

test('flags a known garbled mojibake string', () => {
  const buffer = Buffer.from(`const m = '${MOJIBAKE_DENYLIST[0]}';\n`, 'utf8');
  const issues = findEncodingIssuesInBuffer('backend/Foo.js', buffer);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'mojibake');
});

test('passes clean UTF-8 with legitimate Chinese', () => {
  const buffer = Buffer.from("const ok = '只有主城可以推动文明进阶';\n", 'utf8');
  assert.deepEqual(findEncodingIssuesInBuffer('backend/Foo.js', buffer), []);
});

test('scans backend/frontend/shared and skips tests', () =>
  withTempRepo((repoRoot) => {
    writeFile(
      repoRoot,
      'backend/Bad.js',
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('const a = 1;\n')]),
    );
    writeFile(repoRoot, 'backend/Good.js', Buffer.from('const b = 2;\n', 'utf8'));
    writeFile(
      repoRoot,
      'backend/Bad.test.js',
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('test();\n')]),
    );

    const report = scanSourceEncoding({ repoRoot });

    assert.equal(report.summary.totalViolations, 1);
    assert.equal(report.violations[0].file, 'backend/Bad.js');
    assert.equal(report.violations[0].kind, 'bom');
  }));

test('rejects unknown CLI flags', () => {
  assert.equal(parseFormat([]), 'text');
  assert.equal(parseFormat(['--json']), 'json');
  assert.throws(() => parseFormat(['--bogus']), /unknown arguments/);
});

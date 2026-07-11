const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_FILE = path.resolve(__dirname, '..', 'frontend/js/platform/TutorialActionMatches.js');
const IMPORT_PATTERN = /\b(?:require\s*\(|import\s*(?:\(|[\s{*]))/;

function inspectSource(source = '') {
  const matches = String(source).match(IMPORT_PATTERN) || [];
  return {
    ok: matches.length === 0,
    matches,
  };
}

function checkFile(file = DEFAULT_FILE) {
  return inspectSource(fs.readFileSync(file, 'utf8'));
}

function main() {
  const result = checkFile(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FILE);
  if (!result.ok) {
    console.error('TutorialActionMatches purity check failed: imports are forbidden.');
    process.exitCode = 1;
    return;
  }
  console.log('TutorialActionMatches purity check passed: zero imports.');
}

if (require.main === module) main();

module.exports = { inspectSource, checkFile };

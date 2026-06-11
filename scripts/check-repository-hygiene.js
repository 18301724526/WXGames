const { spawnSync } = require('node:child_process');

const FORBIDDEN_PATTERNS = [
  /\.bak(\.|$)/i,
  /\.backup(\.|$)/i,
  /(^|\/)\.env(\.|$)/i,
  /\.(sqlite|sqlite3|db)(-|\.|$)/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)[^/]*(password|credential|secret)[^/]*\.txt$/i,
  /(^|\/)[^/]*(密码|密钥|凭据|连接密码)[^/]*\.txt$/i,
];

function runGitLsFiles() {
  const result = spawnSync('git', ['ls-files'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'git ls-files failed\n');
    process.exit(result.status || 1);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function isForbidden(file) {
  const normalized = file.replace(/\\/g, '/');
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalized));
}

function main() {
  const offenders = runGitLsFiles().filter(isForbidden).sort();

  if (offenders.length > 0) {
    console.error('[repository-hygiene] forbidden tracked files:');
    offenders.forEach((file) => console.error(`- ${file}`));
    process.exit(1);
  }

  console.log('[repository-hygiene] passed');
}

if (require.main === module) {
  main();
}

module.exports = {
  FORBIDDEN_PATTERNS,
  isForbidden,
};

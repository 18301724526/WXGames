#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'backend');
const ALLOWED_RESIDUALS = Object.freeze({
  xlsx: {
    severity: 'high',
    reason: 'SheetJS npm package has no npm-audit fix; backend import surface is constrained by TaskDefinitionImportParser safety checks.',
  },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function severityRank(severity) {
  return {
    info: 0,
    low: 1,
    moderate: 2,
    high: 3,
    critical: 4,
  }[String(severity || '').toLowerCase()] ?? -1;
}

function parseAuditJson(stdout) {
  assert(stdout, 'npm audit did not return JSON output');
  return JSON.parse(String(stdout));
}

function validateAuditReport(report) {
  const vulnerabilities = report?.vulnerabilities || {};
  const unexpected = [];
  const allowed = [];

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    const policy = ALLOWED_RESIDUALS[name];
    if (!policy) {
      unexpected.push(`${name}: unexpected ${vulnerability.severity || 'unknown'} vulnerability`);
      continue;
    }
    if (vulnerability.fixAvailable) {
      unexpected.push(`${name}: allowed residual now has a fix and must be upgraded or removed`);
      continue;
    }
    assert(
      severityRank(vulnerability.severity) <= severityRank(policy.severity),
      `${name}: severity exceeded allowed residual policy`,
    );
    allowed.push({
      name,
      severity: vulnerability.severity,
      reason: policy.reason,
    });
  }

  assert(
    unexpected.length === 0,
    `Unexpected backend npm audit vulnerabilities:\n${unexpected.join('\n')}`,
  );

  return {
    success: true,
    allowedResiduals: allowed,
    total: Object.keys(vulnerabilities).length,
  };
}

function runBackendAudit() {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd audit --json']
    : ['audit', '--json'];
  const result = spawnSync(command, args, {
    cwd: backendRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  const report = parseAuditJson(result.stdout);
  return validateAuditReport(report);
}

function main() {
  const result = runBackendAudit();
  const allowed = result.allowedResiduals.map((item) => `${item.name}:${item.severity}`).join(', ') || 'none';
  console.log(`[backend-security-audit] passed; allowed residuals: ${allowed}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  ALLOWED_RESIDUALS,
  parseAuditJson,
  validateAuditReport,
};

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALLOWED_RESIDUALS,
  validateAuditReport,
} = require('./check-backend-security-audit');

test('backend security audit allows documented xlsx residual only when no fix exists', () => {
  const result = validateAuditReport({
    vulnerabilities: {
      xlsx: {
        severity: 'high',
        fixAvailable: false,
      },
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.allowedResiduals[0].name, 'xlsx');
  assert.match(ALLOWED_RESIDUALS.xlsx.reason, /TaskDefinitionImportParser/);
});

test('backend security audit blocks unexpected or newly fixable vulnerabilities', () => {
  assert.throws(
    () => validateAuditReport({
      vulnerabilities: {
        qs: {
          severity: 'moderate',
          fixAvailable: true,
        },
      },
    }),
    /Unexpected backend npm audit vulnerabilities/,
  );

  assert.throws(
    () => validateAuditReport({
      vulnerabilities: {
        xlsx: {
          severity: 'high',
          fixAvailable: true,
        },
      },
    }),
    /allowed residual now has a fix/,
  );
});

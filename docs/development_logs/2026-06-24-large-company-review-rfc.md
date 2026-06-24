# 2026-06-24 Large Company Review RFC

## Scope

This RFC turns the June 24 architecture review into implementable engineering controls. It covers ESLint baseline burn-down, SQLite schema migration governance, dependency audit verification, and single-session player login.

## ESLint Baseline

Goal: keep lint debt measurable while removing high-risk suppressions first.

Design:

- CI must keep blocking suppression increases through `scripts/check-eslint-suppressions-budget.js`.
- `no-undef` and `no-dupe-keys` are zero-tolerance rules. They must not remain in `eslint-suppressions.json`.
- `no-empty` is the next burn-down bucket because empty catches hide operational failures.
- `no-unused-vars` is handled per touched module to avoid noisy mechanical rewrites.

Acceptance:

- `npm run lint` passes.
- `eslint-suppressions.json` has no `no-undef` or `no-dupe-keys` entries.
- Future feature work does not increase the suppression total.

Rollback:

- Revert only the focused lint cleanup if a test proves behavior changed. Do not regenerate the entire baseline as a rollback.

## SQLite Schema Migration Governance

Goal: make DB schema changes auditable, repeatable, and safe for API plus worker process startup.

Design:

- `SchemaMigrationService` owns a `schema_migrations` ledger with migration id, checksum, status, timestamp, and duration.
- `schema_migration_locks` prevents concurrent API and worker processes from applying migrations at the same time.
- `dryRun` returns a plan without changing schema.
- Checksum drift blocks startup so production does not silently run a different schema definition under an existing id.
- Existing `game_states` compatibility columns move behind the migration ledger while new database bootstrap tables remain created with `CREATE TABLE IF NOT EXISTS`.

Acceptance:

- Repository init records `001-game-states-compat-columns` once and remains idempotent.
- Checksum mismatch and active migration lock both fail loudly.
- `npm run test:architecture` includes the migration service and tests.

Rollback:

- Forward-fix preferred. For schema rollout failure, restore the pre-deploy SQLite backup and revert the migration commit before restart.

## Dependency Audit Verification

Goal: make audit verification reliable on local Windows, CI, and production-like hosts.

Design:

- `scripts/check-backend-security-audit.js` still runs backend `npm audit --json`.
- `NPM_AUDIT_PROXY`, `HTTPS_PROXY`, or `HTTP_PROXY` can provide an explicit proxy.
- On Windows, the script may fall back to the current user system proxy when npm has no proxy configured.
- The only allowed residual remains `xlsx` high severity with no fix available, compensated by constrained XLSX import parsing.

Acceptance:

- Root production audit reports 0 vulnerabilities.
- Backend production audit reports only the documented `xlsx` residual.
- `npm run security:audit` passes and fails any unexpected or newly fixable vulnerability.

Rollback:

- If proxy fallback causes host-specific audit failures, disable it by setting explicit CI proxy variables or running in a direct-egress CI environment. Do not weaken vulnerability policy.

## Single-Session Player Login

Goal: one player account has only one valid player session across H5 and mini-game clients.

Design:

- Login issues a JWT with a server-generated `sessionId`.
- `players.token` stores only a SHA-256 token hash for new logins.
- Auth middleware verifies JWT signature and then requires the presented token to match the current stored hash.
- Replaced sessions return `401 SESSION_REPLACED` with a relogin message.
- Existing plaintext tokens are accepted only as backward compatibility until the next login overwrites the field with a hash.

Acceptance:

- Two consecutive logins for the same account produce different tokens.
- The first token is rejected after the second login.
- The second token remains accepted.
- Stored player token value starts with `sha256:` and does not equal the JWT.

Rollback:

- Revert auth service and tests. Previously issued hash-backed sessions would need users to log in again if code is rolled back to plaintext token comparison.

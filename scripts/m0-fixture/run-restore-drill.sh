#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_ROOT="$REPO_ROOT/tmp/m0-fixture"
DOC_ROOT="$REPO_ROOT/docs/architecture/m0"
FIXTURE_PATH="$TMP_ROOT/production-shape.fixture.json"
METADATA_PATH="$DOC_ROOT/production-shape-fixture-metadata.json"
REPORT_PATH="$DOC_ROOT/production-shape-restore-report.json"
EVIDENCE_PATH="$DOC_ROOT/production-shape-restore-evidence.md"
WORK_ROOT="$TMP_ROOT/restore-drill"
EXPORT_SCRIPT="$SCRIPT_DIR/export-production-shape.js"

SOURCE_DB="${M0_FIXTURE_SOURCE_DB:-/root/wxgame-test/backend/civilization.db}"
RUNTIME_BACKEND_DIR="${M0_FIXTURE_BACKEND_DIR:-/root/wxgame-test/backend}"
SERVER_ENTRY="${M0_FIXTURE_SERVER_ENTRY:-$RUNTIME_BACKEND_DIR/server.js}"

CURRENT_CHILD_PID=""

cleanup() {
    if [ -n "$CURRENT_CHILD_PID" ] && kill -0 "$CURRENT_CHILD_PID" >/dev/null 2>&1; then
        kill "$CURRENT_CHILD_PID" >/dev/null 2>&1 || true
        wait "$CURRENT_CHILD_PID" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "[m0-fixture] Missing command: $1" >&2
        exit 1
    fi
}

require_file() {
    if [ ! -f "$1" ]; then
        echo "[m0-fixture] Missing file: $1" >&2
        exit 1
    fi
}

json_field() {
    local json="$1"
    local field="$2"
    printf '%s' "$json" | node -e '
const field = process.argv[1];
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const value = field.split(".").reduce((current, key) => current?.[key], JSON.parse(input));
  if (value === undefined || value === null) process.exit(2);
  process.stdout.write(String(value));
});
' "$field"
}

find_free_port() {
    node - <<'NODE'
const net = require('node:net');
const server = net.createServer();
server.unref();
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  server.close((error) => {
    if (error || !port) process.exit(1);
    process.stdout.write(String(port));
  });
});
NODE
}

start_and_probe() {
    local db_path="$1"
    local logs_db_path="$2"
    local deploy_state_dir="$3"
    local port="$4"
    local server_log="$5"
    local health_output="$6"
    local ready=0

    mkdir -p "$deploy_state_dir" "$(dirname "$logs_db_path")"
    (
        cd "$RUNTIME_BACKEND_DIR"
        env \
            NODE_ENV=test \
            JWT_SECRET=m0-fixture-local-only-secret \
            CORS_ORIGINS=http://127.0.0.1 \
            PORT="$port" \
            DB_PATH="$db_path" \
            LOGS_DB_PATH="$logs_db_path" \
            WXGAME_DEPLOY_STATE_DIR="$deploy_state_dir" \
            node "$SERVER_ENTRY"
    ) >"$server_log" 2>&1 &
    CURRENT_CHILD_PID=$!

    for _ in $(seq 1 300); do
        if ! kill -0 "$CURRENT_CHILD_PID" >/dev/null 2>&1; then
            break
        fi
        if curl -fsS --max-time 1 "http://127.0.0.1:$port/api/health" -o "$health_output" 2>/dev/null; then
            if node -e '
const fs = require("node:fs");
const health = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(health.status === "ok" ? 0 : 1);
' "$health_output"; then
                ready=1
                break
            fi
        fi
        sleep 0.1
    done

    if [ "$ready" != "1" ]; then
        echo "[m0-fixture] Isolated server failed health check on port $port" >&2
        tail -80 "$server_log" >&2 || true
        exit 1
    fi

    kill "$CURRENT_CHILD_PID" >/dev/null 2>&1 || true
    wait "$CURRENT_CHILD_PID" >/dev/null 2>&1 || true
    CURRENT_CHILD_PID=""
}

prepare_runtime_script() {
    local source_path="$1"
    local target_path="$2"
    tr -d '\r' <"$source_path" >"$target_path"
    chmod +x "$target_path"
}

for command in node bash tar find curl sha256sum seq tail tr chmod awk; do
    require_command "$command"
done
require_file "$SOURCE_DB"
require_file "$SERVER_ENTRY"
require_file "$EXPORT_SCRIPT"
require_file "$REPO_ROOT/scripts/backup-runtime-state.sh"
require_file "$REPO_ROOT/scripts/restore-runtime-state.sh"
require_file "$REPO_ROOT/scripts/verify-runtime-backup.sh"

case "$WORK_ROOT" in
    "$REPO_ROOT"/tmp/m0-fixture/*) ;;
    *)
        echo "[m0-fixture] Refusing unsafe work root: $WORK_ROOT" >&2
        exit 1
        ;;
esac

rm -rf "$WORK_ROOT"
mkdir -p "$WORK_ROOT" "$DOC_ROOT"

source_backend="$WORK_ROOT/source/backend"
source_db="$source_backend/civilization.db"
source_logs="$source_backend/observability.db"
source_shared="$WORK_ROOT/source/shared"
source_state="$WORK_ROOT/source/deploy-state"
restore_backend="$WORK_ROOT/restored/backend"
restore_db="$restore_backend/civilization.db"
restore_logs="$restore_backend/observability.db"
restore_shared="$WORK_ROOT/restored/shared"
restore_state="$WORK_ROOT/restored/deploy-state"
backup_root="$WORK_ROOT/backups"
restore_work="$WORK_ROOT/restore-work"

mkdir -p \
    "$source_backend" \
    "$source_shared" \
    "$source_state" \
    "$restore_backend" \
    "$restore_shared" \
    "$restore_state" \
    "$backup_root"

runtime_scripts="$WORK_ROOT/runtime-scripts"
mkdir -p "$runtime_scripts"
prepare_runtime_script \
    "$REPO_ROOT/scripts/backup-runtime-state.sh" \
    "$runtime_scripts/backup-runtime-state.sh"
prepare_runtime_script \
    "$REPO_ROOT/scripts/restore-runtime-state.sh" \
    "$runtime_scripts/restore-runtime-state.sh"
prepare_runtime_script \
    "$REPO_ROOT/scripts/verify-runtime-backup.sh" \
    "$runtime_scripts/verify-runtime-backup.sh"

export_json="$(node "$EXPORT_SCRIPT" export \
    --source-db "$SOURCE_DB" \
    --backend-dir "$RUNTIME_BACKEND_DIR" \
    --source-label wsl:wxgame-test \
    --output "$FIXTURE_PATH" \
    --metadata-output "$METADATA_PATH")"
sanitization_json="$(node "$EXPORT_SCRIPT" assert-fixture --fixture "$FIXTURE_PATH")"
fixture_checksum_one_json="$(node "$EXPORT_SCRIPT" checksum-fixture --fixture "$FIXTURE_PATH")"
fixture_checksum_two_json="$(node "$EXPORT_SCRIPT" checksum-fixture --fixture "$FIXTURE_PATH")"

fixture_checksum_one="$(json_field "$fixture_checksum_one_json" checksum)"
fixture_checksum_two="$(json_field "$fixture_checksum_two_json" checksum)"
if [ "$fixture_checksum_one" != "$fixture_checksum_two" ]; then
    echo "[m0-fixture] Fixture checksum is not repeatable" >&2
    exit 1
fi

node "$EXPORT_SCRIPT" materialize \
    --fixture "$FIXTURE_PATH" \
    --output-db "$source_db" \
    --backend-dir "$RUNTIME_BACKEND_DIR" >/dev/null

source_port="$(find_free_port)"
restore_port="$(find_free_port)"
while [ "$restore_port" = "$source_port" ]; do
    restore_port="$(find_free_port)"
done

start_and_probe \
    "$source_db" \
    "$source_logs" \
    "$source_state" \
    "$source_port" \
    "$WORK_ROOT/source-server.log" \
    "$WORK_ROOT/source-health.json"

before_checksum_json="$(node "$EXPORT_SCRIPT" checksum-db \
    --db "$source_db" \
    --backend-dir "$RUNTIME_BACKEND_DIR")"
before_checksum="$(json_field "$before_checksum_json" checksum)"

BACKEND_DIR="$RUNTIME_BACKEND_DIR" \
SHARED_DIR="$source_shared" \
DEPLOY_STATE_DIR="$source_state" \
BACKUP_ROOT="$backup_root" \
DB_PATH="$source_db" \
RETENTION_DAYS=0 \
BACKUP_LABEL=m0-t5 \
    bash "$runtime_scripts/backup-runtime-state.sh" >"$WORK_ROOT/backup.log"

BACKUP_ROOT="$backup_root" \
MAX_BACKUP_AGE_HOURS=1 \
REQUIRE_BACKUP_DB=1 \
    bash "$runtime_scripts/verify-runtime-backup.sh" >"$WORK_ROOT/verify-backup.log"

shopt -s nullglob
archives=("$backup_root"/wxgame-runtime-*.tar.gz)
shopt -u nullglob
if [ "${#archives[@]}" != "1" ]; then
    echo "[m0-fixture] Expected one drill backup, found ${#archives[@]}" >&2
    exit 1
fi
archive_path="${archives[0]}"
archive_checksum="$(sha256sum "$archive_path" | awk '{print $1}')"

WXGAME_RESTORE_CONFIRM=restore-runtime-state \
ALLOW_RESTORE_WITHOUT_PM2_STOP=1 \
SKIP_PRE_RESTORE_BACKUP=1 \
RESTORE_DEPLOY_STATE=1 \
BACKEND_DIR="$restore_backend" \
SHARED_DIR="$restore_shared" \
DEPLOY_STATE_DIR="$restore_state" \
BACKUP_ROOT="$backup_root" \
DB_PATH="$restore_db" \
RESTORE_WORK_DIR="$restore_work" \
TAR_OPTIONS=--warning=no-timestamp \
    bash "$runtime_scripts/restore-runtime-state.sh" "$archive_path" >"$WORK_ROOT/restore.log"

start_and_probe \
    "$restore_db" \
    "$restore_logs" \
    "$restore_state" \
    "$restore_port" \
    "$WORK_ROOT/restore-server.log" \
    "$WORK_ROOT/restore-health.json"

after_checksum_json="$(node "$EXPORT_SCRIPT" checksum-db \
    --db "$restore_db" \
    --backend-dir "$RUNTIME_BACKEND_DIR")"
after_checksum="$(json_field "$after_checksum_json" checksum)"
if [ "$before_checksum" != "$after_checksum" ]; then
    echo "[m0-fixture] Restore checksum mismatch: before=$before_checksum after=$after_checksum" >&2
    exit 1
fi

node - \
    "$REPO_ROOT" \
    "$METADATA_PATH" \
    "$REPORT_PATH" \
    "$EVIDENCE_PATH" \
    "$FIXTURE_PATH" \
    "$archive_path" \
    "$archive_checksum" \
    "$source_port" \
    "$restore_port" \
    "$fixture_checksum_one_json" \
    "$fixture_checksum_two_json" \
    "$before_checksum_json" \
    "$after_checksum_json" \
    "$sanitization_json" \
    "$export_json" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [
  repoRoot,
  metadataPath,
  reportPath,
  evidencePath,
  fixturePath,
  archivePath,
  archiveChecksum,
  sourcePort,
  restorePort,
  fixtureChecksumOneJson,
  fixtureChecksumTwoJson,
  beforeChecksumJson,
  afterChecksumJson,
  sanitizationJson,
  exportJson,
] = process.argv.slice(2);
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const fixtureChecksumOne = JSON.parse(fixtureChecksumOneJson);
const fixtureChecksumTwo = JSON.parse(fixtureChecksumTwoJson);
const beforeChecksum = JSON.parse(beforeChecksumJson);
const afterChecksum = JSON.parse(afterChecksumJson);
const sanitization = JSON.parse(sanitizationJson);
const exported = JSON.parse(exportJson);
const relative = (filePath) => path.relative(repoRoot, filePath).replaceAll('\\', '/');
const report = {
  schema: 'wxgame-production-shape-restore-drill-v1',
  executedAt: new Date().toISOString(),
  environment: 'WSL Ubuntu-24.04 本地隔离环境',
  source: {
    label: metadata.source.label,
    access: metadata.source.access,
  },
  artifacts: {
    fixture: relative(fixturePath),
    metadata: relative(metadataPath),
    backupArchive: relative(archivePath),
    backupArchiveSha256: archiveChecksum,
  },
  shape: {
    tableCount: metadata.checksum.tableCount,
    rowCount: metadata.checksum.rowCount,
    excludedInstrumentationTables: metadata.excludedInstrumentationTables,
  },
  fixtureChecksumRuns: [fixtureChecksumOne, fixtureChecksumTwo],
  backupRestore: {
    before: beforeChecksum,
    after: afterChecksum,
    sourceDb: 'tmp/m0-fixture/restore-drill/source/backend/civilization.db',
    restoredDb: 'tmp/m0-fixture/restore-drill/restored/backend/civilization.db',
    sourcePort: Number(sourcePort),
    restorePort: Number(restorePort),
    sourceHealthStatus: 'ok',
    restoreHealthStatus: 'ok',
  },
  sanitization,
  assertions: {
    exportExitedZero: exported.checksum === fixtureChecksumOne.checksum,
    sanitizationPassed: Object.entries(sanitization)
      .filter(([key]) => key.endsWith('Leaks'))
      .every(([, value]) => value === 0),
    fixtureChecksumRepeatable: fixtureChecksumOne.checksum === fixtureChecksumTwo.checksum,
    isolatedDatabasePaths: true,
    isolatedPorts: Number(sourcePort) !== Number(restorePort),
    restoreChecksumMatches: beforeChecksum.checksum === afterChecksum.checksum,
  },
};
if (!Object.values(report.assertions).every(Boolean)) {
  throw new Error(`drill assertions failed: ${JSON.stringify(report.assertions)}`);
}
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const markdown = `# T5 production-shape restore 演练证据

- 环境：${report.environment}
- 表数 / 行数：${report.shape.tableCount} / ${report.shape.rowCount}
- fixture 双跑 checksum：\`${fixtureChecksumOne.checksum}\`（一致）
- backup 前 checksum：\`${beforeChecksum.checksum}\`
- restore 后 checksum：\`${afterChecksum.checksum}\`（一致）
- 隔离端口：source \`${sourcePort}\`，restore \`${restorePort}\`
- 健康检查：source \`status ok\`，restore \`status ok\`
- 脱敏断言：真实敏感值、邮箱、JWT、Bearer、查询凭据泄漏数均为 \`0\`
- 原始产物：\`tmp/m0-fixture/restore-drill/\`
- 机器报告：\`${relative(reportPath)}\`
`;
fs.writeFileSync(evidencePath, markdown);
NODE

echo "[m0-fixture] fixture checksum: $fixture_checksum_one"
echo "[m0-fixture] restore checksum: $after_checksum"
echo "[m0-fixture] report: $REPORT_PATH"
echo "[m0-fixture] passed"

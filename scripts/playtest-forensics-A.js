// A-seat dynamic forensics runner: boot an isolated loopback backend + preview, then
// drive scripts/playtest-online-tutorial.js with PLAYTEST_HANG_FORENSICS=1 exactly once.
// Test scaffolding only — does NOT modify product code (frontend/ backend/ shared/).
// No remote/public network: every socket is 127.0.0.1 loopback.
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ConfigPipeline = require('../backend/services/config/ConfigPipeline');
const ConfigReleaseService = require('../backend/services/config/ConfigReleaseService');

const REPO_ROOT = path.resolve(__dirname, '..');
const G0 = process.argv.includes('--g0') || process.env.PLAYTEST_G0_FORENSICS === '1';
const OUTPUT_DIR = G0 ? path.join(REPO_ROOT, 'tmp', 'forensics-A-g0') : path.join(REPO_ROOT, 'tmp', 'forensics-A');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function publishLocalConfigRuntime(tempRoot) {
  const historyPath = path.join(tempRoot, 'configReleases.json');
  const activePath = path.join(tempRoot, 'configActiveRelease.json');
  const now = new Date();
  const snapshot = ConfigPipeline.buildCurrentSnapshot({ generatedAt: now.toISOString() });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'playtest-forensics-A' },
    { historyPath, activePath, operator: 'playtest-forensics-A', now },
  );
  if (!publish.success) {
    throw new Error(`local isolated config publish failed: ${(publish.errors || []).join('; ')}`);
  }
  return { historyPath, activePath, releaseId: publish.release?.id || '' };
}

function spawnLogged(command, args, options, outputPath) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const output = fs.createWriteStream(outputPath, { flags: 'a' });
  child.stdout.pipe(output);
  child.stderr.pipe(output);
  return child;
}

async function waitForHealth(url, child, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`local backend exited before health check: ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`local backend health timeout: ${lastError || 'unknown error'}`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve(); };
    child.once('exit', finish);
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); finish(); }, 3000).unref();
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once('error', (error) => resolve({ code: -1, signal: '', error: error.message }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wxgames-forensics-A-'));
  const dbPath = path.join(tempRoot, 'civilization.db');
  const logsDbPath = path.join(tempRoot, 'observability.db');
  const configRuntime = publishLocalConfigRuntime(tempRoot);
  const backendPort = await findFreePort();
  const previewPort = await findFreePort();
  const backendLogPath = path.join(OUTPUT_DIR, 'backend.log');
  const previewLogPath = path.join(OUTPUT_DIR, 'preview.log');
  const playtestLogPath = path.join(OUTPUT_DIR, 'playtest.log');
  fs.writeFileSync(backendLogPath, '', 'utf8');
  fs.writeFileSync(previewLogPath, '', 'utf8');
  fs.writeFileSync(playtestLogPath, '', 'utf8');
  const backendEnv = {
    ...process.env,
    PORT: String(backendPort),
    DB_PATH: dbPath,
    LOGS_DB_PATH: logsDbPath,
    JWT_SECRET: 'playtest-forensics-A-local-only',
    CONFIG_RELEASE_GATE: 'required',
    CONFIG_RELEASE_HISTORY_PATH: configRuntime.historyPath,
    CONFIG_ACTIVE_RELEASE_PATH: configRuntime.activePath,
  };
  console.log(JSON.stringify({
    phase: 'boot', backendPort, previewPort, tempRoot, outputDir: OUTPUT_DIR,
  }));
  let backend = null;
  let preview = null;
  let playtest = null;
  try {
    backend = spawnLogged(process.execPath, ['backend/server.js'], {
      cwd: REPO_ROOT, env: backendEnv,
    }, backendLogPath);
    await waitForHealth(`http://127.0.0.1:${backendPort}/api/health`, backend, 60000);
    preview = spawnLogged(process.execPath, ['scripts/local-preview-server.js'], {
      cwd: REPO_ROOT,
      env: {
        ...backendEnv,
        LOCAL_PREVIEW_PORT: String(previewPort),
        LOCAL_PREVIEW_API_BASE: `http://127.0.0.1:${backendPort}`,
      },
    }, previewLogPath);
    // Give the preview server a moment to bind.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const childEnv = {
      ...process.env,
      PLAYTEST_HANG_FORENSICS: '1',
      ...(G0 ? { PLAYTEST_G0_FORENSICS: '1' } : {}),
      PLAYTEST_BUILDFARM_FORENSICS: process.env.PLAYTEST_BUILDFARM_FORENSICS === '1' ? '1' : '0',
      PLAYTEST_LOCAL_ISOLATED: '0',
      PLAYTEST_TARGET: 'local',
      PLAYTEST_GAME_URL: `http://127.0.0.1:${previewPort}/`,
      PLAYTEST_API_BASE: `http://127.0.0.1:${backendPort}/api`,
      PLAYTEST_USERNAME: 'test1',
      PLAYTEST_RESET_ACCOUNT: '1',
      PLAYTEST_HEADLESS: '1',
      PLAYTEST_DISABLE_GPU: '1',
      PLAYTEST_EXACT_OUTPUT_DIR: OUTPUT_DIR,
    };
    playtest = spawnLogged(process.execPath, ['scripts/playtest-online-tutorial.js'], {
      cwd: REPO_ROOT, env: childEnv,
    }, playtestLogPath);
    const result = await waitForExit(playtest);
    const manifest = {
      outputDir: OUTPUT_DIR,
      gameOver: result,
      artifacts: fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [],
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, 'runner-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    await stopChild(playtest);
    await stopChild(preview);
    await stopChild(backend);
  }
}

main().catch((error) => {
  fs.writeFileSync(path.join(OUTPUT_DIR, 'runner-fatal.txt'), (error && (error.stack || error.message)) || String(error), 'utf8');
  console.error((error && (error.stack || error.message)) || String(error));
  process.exit(1);
});
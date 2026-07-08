const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { URL } = require('url');
const XLSX = require('../backend/node_modules/xlsx');

const ConfigPipeline = require('../backend/services/config/ConfigPipeline');
const ConfigReleaseService = require('../backend/services/config/ConfigReleaseService');

const REPO_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend');
const OUT_DIR = path.join(REPO_ROOT, 'tmp');
const USERNAME = process.env.VERIFY_USER || 'codexqa';
const PASSWORD = process.env.VERIFY_PASSWORD || '123456';
const REMOTE_BASE_URL = process.env.REMOTE_BASE_URL || '';
const VERIFY_TITLE = `策划预览验证-${Date.now()}`;
const VERIFY_DESC = '浏览器真实上传 Excel 后，只应通过预览校验看到这段新描述。';

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForHttp(url, timeoutMs = 20000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function publishLocalActiveRelease(activePath, historyPath) {
  const now = new Date('2026-07-08T00:00:00.000Z');
  const snapshot = ConfigPipeline.buildCurrentSnapshot({ generatedAt: now.toISOString() });
  const publish = ConfigReleaseService.publishRelease(
    { snapshot, source: 'verify:current-config' },
    { activePath, historyPath, operator: USERNAME, now },
  );
  if (!publish.success) {
    throw new Error(`Failed to publish local active release: ${(publish.errors || []).join('; ')}`);
  }
  return publish.release;
}

function startBackend(port, dbPath, activePath, historyPath) {
  const child = spawn(process.execPath, ['backend/server.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      JWT_SECRET: 'codex-temp-p2-task-uploader',
      CONFIG_RELEASE_GATE: 'required',
      CONFIG_ACTIVE_RELEASE_PATH: activePath,
      CONFIG_RELEASE_HISTORY_PATH: historyPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));
  child.logs = logs;
  return child;
}

function createPreviewServer(port, apiBase) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  function send(res, status, body, type = 'text/plain; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
      req.on('error', reject);
    });
  }

  async function proxyApi(req, res, reqUrl) {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
    const skip = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive']);
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([key]) => !skip.has(key.toLowerCase())));
    const upstream = await fetch(`${apiBase}${reqUrl.pathname}${reqUrl.search}`, {
      method: req.method,
      headers,
      body,
      duplex: body ? 'half' : undefined,
    });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
    if (upstream.body) {
      for await (const chunk of upstream.body) res.write(chunk);
    }
    res.end();
  }

  function serveStatic(reqUrl, res) {
    let filePath = path.join(FRONTEND_ROOT, decodeURIComponent(reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname));
    if (!filePath.startsWith(FRONTEND_ROOT)) return send(res, 403, 'Forbidden');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) return send(res, 404, 'Not Found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    fs.createReadStream(filePath).pipe(res);
    return null;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
      if (reqUrl.pathname.startsWith('/api/')) return await proxyApi(req, res, reqUrl);
      return serveStatic(reqUrl, res);
    } catch (error) {
      return send(res, 500, error.stack || String(error));
    }
  });
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function createTaskWorkbook(filePath) {
  const workbook = XLSX.utils.book_new();
  const rows = [
    {
      id: 'main_build_house',
      category: 'main',
      title: VERIFY_TITLE,
      description: VERIFY_DESC,
      target: 'buildings',
      'condition.type': 'buildingLevel',
      'condition.target': 'house',
      'condition.count': 1,
      'reward.food': 7,
      'reward.wood': 3,
      sortOrder: 10,
      enabled: 1,
    },
    {
      id: 'main_first_supplies',
      category: 'main',
      title: '安居的火种',
      description: '完成第一处民居并迈入农耕时代后，领取建造农田与下一次文明进阶所需的基础物资。',
      target: 'tasks',
      condition: JSON.stringify({
        type: 'all',
        conditions: [
          { type: 'buildingLevel', buildingId: 'house', count: 1 },
          { type: 'eraAtLeast', era: 1 },
        ],
      }),
      'reward.formulas': 'buildCost:farm;advanceCost:1',
      sortOrder: 20,
      enabled: 1,
    },
    {
      id: 'main_lumbermill_supplies',
      category: 'main',
      title: '让木材流入仓廪',
      description: '建成伐木场后领取下一阶段文明进阶物资。',
      target: 'tasks',
      'condition.type': 'buildingLevel',
      'condition.target': 'lumbermill',
      'condition.count': 1,
      'reward.formulas': 'advanceCost:2',
      sortOrder: 30,
      enabled: 1,
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  XLSX.writeFile(workbook, filePath);
}

async function login(page, baseUrl) {
  await page.goto(`${baseUrl}/tools/task-table-uploader.html`, { waitUntil: 'load' });
  await page.evaluate(async ({ username, password }) => {
    localStorage.clear();
    const login = await fetch('/api/player/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await login.json();
    if (!login.ok) throw new Error(data.message || data.error || 'login failed');
    localStorage.setItem('cf_token', data.token);
    localStorage.setItem('cf_username', username);
  }, { username: USERNAME, password: PASSWORD });
}

async function getCurrentDefinitions(page) {
  return page.evaluate(async () => {
    const token = localStorage.getItem('cf_token');
    const response = await fetch('/api/admin/task-definitions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'current definitions failed');
    return data.definitions;
  });
}

async function getTaskCenter(page) {
  return page.evaluate(async () => {
    const token = localStorage.getItem('cf_token');
    const response = await fetch('/api/game/tasks?tab=main', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'tasks failed');
    return data.taskCenter;
  });
}

async function main() {
  let backend = null;
  let previewServer = null;
  let browser = null;
  const pageLogs = [];
  const isRemote = Boolean(REMOTE_BASE_URL);
  let baseUrl = REMOTE_BASE_URL;

  const apiPort = await getFreePort();
  const webPort = await getFreePort();
  const stamp = Date.now();
  const dbPath = path.join(OUT_DIR, `p2-task-uploader-${stamp}.db`);
  const activePath = path.join(OUT_DIR, `p2-config-active-${stamp}.json`);
  const historyPath = path.join(OUT_DIR, `p2-config-releases-${stamp}.json`);
  const workbookPath = path.join(OUT_DIR, `p2-task-uploader-${stamp}.xlsx`);

  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    createTaskWorkbook(workbookPath);
    if (!isRemote) {
      publishLocalActiveRelease(activePath, historyPath);
      backend = startBackend(apiPort, dbPath, activePath, historyPath);
      await waitForHttp(`http://127.0.0.1:${apiPort}/api/health`);
      previewServer = await createPreviewServer(webPort, `http://127.0.0.1:${apiPort}`);
      baseUrl = `http://127.0.0.1:${webPort}`;
    }

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    page.on('console', (msg) => pageLogs.push(`${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => pageLogs.push(`PAGEERROR: ${err.message}`));

    await login(page, baseUrl);
    const original = await getCurrentDefinitions(page);
    const originalTask = original.tasks.find((task) => task.id === 'main_build_house');
    assert(originalTask?.title !== VERIFY_TITLE, 'active release should start from committed task title', originalTask);

    await page.goto(`${baseUrl}/tools/task-table-uploader.html`, { waitUntil: 'load' });
    await page.waitForSelector('#fileInput', { timeout: 10000 });
    assert(await page.locator('#importButton').count() === 0, 'preview tool must not expose a confirm import button');
    await page.setInputFiles('#fileInput', workbookPath);
    await page.click('#previewButton');
    await page.waitForFunction((title) => document.body.innerText.includes(title), VERIFY_TITLE, { timeout: 15000 });
    const previewText = await page.locator('#preview').innerText();
    assert(previewText.includes('修改'), 'preview should show changed diff', previewText);
    assert(previewText.includes(VERIFY_DESC), 'preview should show uploaded description', previewText);
    await page.waitForFunction(() => document.body.innerText.includes('配置发布链路'), null, { timeout: 15000 });

    const afterPreview = await getCurrentDefinitions(page);
    const unchangedTask = afterPreview.tasks.find((task) => task.id === 'main_build_house');
    assert(unchangedTask?.title === originalTask.title, 'preview must not mutate active task definitions', unchangedTask);
    assert(unchangedTask?.description === originalTask.description, 'preview must not mutate active task description', unchangedTask);

    const taskCenter = await getTaskCenter(page);
    const liveTask = taskCenter.categories.main.tasks.find((task) => task.id === 'main_build_house');
    assert(liveTask?.title !== VERIFY_TITLE, 'task center must still read the active release, not uploaded preview rows', liveTask);
    assert(liveTask?.description !== VERIFY_DESC, 'task center must not read uploaded preview description', liveTask);

    await page.screenshot({ path: path.join(OUT_DIR, 'p2-task-uploader-browser-verify.png'), fullPage: true });
    const badLogs = pageLogs.filter((line) => /PAGEERROR|TypeError|ReferenceError|Unhandled/i.test(line));
    assert(badLogs.length === 0, 'browser should not report runtime errors', badLogs);

    console.log(JSON.stringify({
      ok: true,
      mode: isRemote ? 'remote' : 'local',
      baseUrl,
      previewOnly: true,
      activeTitle: liveTask.title,
      uploadedPreviewTitle: VERIFY_TITLE,
      screenshot: path.join(OUT_DIR, 'p2-task-uploader-browser-verify.png'),
    }, null, 2));
  } catch (error) {
    console.error(error.stack || String(error));
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    if (backend?.logs?.length) console.error(backend.logs.join('').slice(-4000));
    if (pageLogs.length) console.error(pageLogs.slice(-40).join('\n'));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (previewServer) await new Promise((resolve) => previewServer.close(resolve));
    if (backend) {
      backend.kill();
      await sleep(250);
    }
  }
}

main();

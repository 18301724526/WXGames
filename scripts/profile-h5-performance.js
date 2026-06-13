const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.join(REPO_ROOT, 'frontend');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, '.local-logs', 'h5-performance');
const CLI_OPTIONS = parseCliOptions(process.argv.slice(2));

const MIME_TYPES = Object.freeze({
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
  '.atlas': 'text/plain; charset=utf-8',
  '.skel': 'application/octet-stream',
});

const VIEWPORT_PRESETS = Object.freeze({
  mobile: {
    name: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    name: 'desktop',
    width: 1365,
    height: 768,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  'phone-2026': {
    name: 'phone-2026',
    width: 390,
    height: 844,
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
  },
});

const DEVICE_PROFILE_PRESETS = Object.freeze({
  host: {
    name: 'host',
    label: 'Host Chromium baseline',
    cpuThrottlingRate: 1,
    hardwareConcurrency: null,
    deviceMemoryGb: null,
    jsHeapMb: null,
    gpuMode: 'host',
    launchArgs: [],
    notes: [
      'Uses the local desktop browser runtime without synthetic phone hardware limits.',
    ],
  },
  'phone-2026-low': {
    name: 'phone-2026-low',
    label: '2026 low-end Android phone simulation',
    cpuThrottlingRate: 6,
    hardwareConcurrency: 4,
    deviceMemoryGb: 4,
    jsHeapMb: 512,
    gpuMode: 'swiftshader-low-end',
    launchArgs: [
      '--use-angle=swiftshader',
      '--use-gl=swiftshader',
      '--disable-gpu-rasterization',
      '--enable-low-end-device-mode',
      '--js-flags=--max-old-space-size=512',
    ],
    notes: [
      'CPU is throttled through Chromium DevTools Protocol.',
      'GPU is approximated with SwiftShader/software rendering flags.',
      'Memory is approximated through navigator.deviceMemory and V8 old-space cap, not an OS-level RAM cap.',
    ],
  },
  'phone-2026-mid': {
    name: 'phone-2026-mid',
    label: '2026 mid-range Android phone simulation',
    cpuThrottlingRate: 4,
    hardwareConcurrency: 6,
    deviceMemoryGb: 6,
    jsHeapMb: 768,
    gpuMode: 'swiftshader',
    launchArgs: [
      '--use-angle=swiftshader',
      '--use-gl=swiftshader',
      '--disable-gpu-rasterization',
      '--js-flags=--max-old-space-size=768',
    ],
    notes: [
      'CPU is throttled through Chromium DevTools Protocol.',
      'GPU is approximated with SwiftShader/software rendering flags.',
      'Memory is approximated through navigator.deviceMemory and V8 old-space cap, not an OS-level RAM cap.',
    ],
  },
  'phone-2026-flagship': {
    name: 'phone-2026-flagship',
    label: '2026 flagship Android phone simulation',
    cpuThrottlingRate: 2,
    hardwareConcurrency: 8,
    deviceMemoryGb: 8,
    jsHeapMb: 1024,
    gpuMode: 'swiftshader-controlled',
    launchArgs: [
      '--use-angle=swiftshader',
      '--use-gl=swiftshader',
      '--js-flags=--max-old-space-size=1024',
    ],
    notes: [
      'CPU is throttled through Chromium DevTools Protocol.',
      'GPU is kept on the same SwiftShader-controlled path for comparable local evidence; this may understate a real flagship GPU.',
      'Memory is approximated through navigator.deviceMemory and V8 old-space cap, not an OS-level RAM cap.',
    ],
  },
});

function parseCliOptions(args = []) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg || !arg.startsWith('--')) continue;
    const withoutPrefix = arg.slice(2);
    const equalsIndex = withoutPrefix.indexOf('=');
    if (equalsIndex >= 0) {
      options[withoutPrefix.slice(0, equalsIndex)] = withoutPrefix.slice(equalsIndex + 1);
      continue;
    }
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      options[withoutPrefix] = next;
      index += 1;
    } else {
      options[withoutPrefix] = true;
    }
  }
  return options;
}

function getConfigValue(cliName, envName, fallback = undefined) {
  if (Object.prototype.hasOwnProperty.call(CLI_OPTIONS, cliName)) return CLI_OPTIONS[cliName];
  if (Object.prototype.hasOwnProperty.call(process.env, envName)) return process.env[envName];
  return fallback;
}

function getConfigNumber(cliName, envName, fallback) {
  const value = Number(getConfigValue(cliName, envName, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function getConfigBoolean(cliName, envName, fallback) {
  const value = getConfigValue(cliName, envName, undefined);
  if (value === undefined) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(String(value).toLowerCase())) return false;
  return fallback;
}

function createRunId(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function parseViewportToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;
  if (VIEWPORT_PRESETS[value]) return { ...VIEWPORT_PRESETS[value] };
  const match = /^([a-z0-9_-]+:)?(\d+)x(\d+)(@(\d+(?:\.\d+)?))?$/i.exec(value);
  if (!match) return null;
  const width = Number(match[2]);
  const height = Number(match[3]);
  const deviceScaleFactor = Number(match[5] || 1);
  return {
    name: match[1] ? match[1].slice(0, -1) : `${width}x${height}`,
    width,
    height,
    deviceScaleFactor,
    isMobile: width <= 520,
    hasTouch: width <= 520,
  };
}

function isPhoneSimulationEnabled() {
  return getConfigBoolean('phone-sim', 'PROFILE_PHONE_SIM', false);
}

function getDefaultViewportList() {
  return isPhoneSimulationEnabled() ? 'phone-2026' : 'mobile,desktop';
}

function parseViewports(value = getConfigValue('viewports', 'PROFILE_VIEWPORTS', getDefaultViewportList())) {
  const parsed = String(value)
    .split(',')
    .map(parseViewportToken)
    .filter(Boolean);
  return parsed.length ? parsed : [{ ...VIEWPORT_PRESETS.mobile }, { ...VIEWPORT_PRESETS.desktop }];
}

function parseDeviceProfileToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;
  if (DEVICE_PROFILE_PRESETS[value]) return {
    ...DEVICE_PROFILE_PRESETS[value],
    launchArgs: [...DEVICE_PROFILE_PRESETS[value].launchArgs],
    notes: [...DEVICE_PROFILE_PRESETS[value].notes],
  };
  return null;
}

function getDefaultDeviceProfileList() {
  return isPhoneSimulationEnabled()
    ? 'phone-2026-low,phone-2026-mid,phone-2026-flagship'
    : 'host';
}

function parseDeviceProfiles(value = getConfigValue('device-profiles', 'PROFILE_DEVICE_PROFILES', getDefaultDeviceProfileList())) {
  const parsed = String(value)
    .split(',')
    .map(parseDeviceProfileToken)
    .filter(Boolean);
  return parsed.length ? parsed : [parseDeviceProfileToken('host')];
}

const CONFIG = Object.freeze({
  runId: getConfigValue('run-id', 'PROFILE_RUN_ID', createRunId()),
  outputRoot: path.resolve(getConfigValue('output-dir', 'PROFILE_OUTPUT_DIR', DEFAULT_OUTPUT_ROOT)),
  headless: getConfigBoolean('headless', 'PROFILE_HEADLESS', true),
  phoneSimulation: isPhoneSimulationEnabled(),
  sampleMs: getConfigNumber('sample-ms', 'PROFILE_SAMPLE_MS', isPhoneSimulationEnabled() ? 3500 : 2500),
  waitForReadyMs: getConfigNumber('wait-for-ready-ms', 'PROFILE_WAIT_FOR_READY_MS', isPhoneSimulationEnabled() ? 30000 : 15000),
  tileRadius: getConfigNumber('tile-radius', 'PROFILE_TILE_RADIUS', 8),
  viewports: parseViewports(),
  deviceProfiles: parseDeviceProfiles(),
  budgets: Object.freeze({
    maxNavigationLoadMs: getConfigNumber('max-navigation-load-ms', 'PROFILE_MAX_NAVIGATION_LOAD_MS', isPhoneSimulationEnabled() ? 30000 : 15000),
    maxReadyMs: getConfigNumber('max-ready-ms', 'PROFILE_MAX_READY_MS', isPhoneSimulationEnabled() ? 30000 : 15000),
    maxApiFailures: getConfigNumber('max-api-failures', 'PROFILE_MAX_API_FAILURES', 0),
    maxScriptFailures: getConfigNumber('max-script-failures', 'PROFILE_MAX_SCRIPT_FAILURES', 0),
    maxStyleFailures: getConfigNumber('max-style-failures', 'PROFILE_MAX_STYLE_FAILURES', 0),
    maxAssetFailures: getConfigNumber('max-asset-failures', 'PROFILE_MAX_ASSET_FAILURES', 0),
    maxRequestFailures: getConfigNumber('max-request-failures', 'PROFILE_MAX_REQUEST_FAILURES', 0),
    maxPageErrors: getConfigNumber('max-page-errors', 'PROFILE_MAX_PAGE_ERRORS', 0),
    maxConsoleErrors: getConfigNumber('max-console-errors', 'PROFILE_MAX_CONSOLE_ERRORS', 0),
    minCanvasCount: getConfigNumber('min-canvas-count', 'PROFILE_MIN_CANVAS_COUNT', 1),
    minScreenshotUniqueColors: getConfigNumber('min-screenshot-unique-colors', 'PROFILE_MIN_SCREENSHOT_UNIQUE_COLORS', 16),
    minScreenshotLumaStdDev: getConfigNumber('min-screenshot-luma-stddev', 'PROFILE_MIN_SCREENSHOT_LUMA_STDDEV', 4),
    maxLongTaskWarningCount: getConfigNumber('max-long-task-warning-count', 'PROFILE_MAX_LONG_TASK_WARNING_COUNT', isPhoneSimulationEnabled() ? 40 : 12),
    maxRafP95WarningMs: getConfigNumber('max-raf-p95-warning-ms', 'PROFILE_MAX_RAF_P95_WARNING_MS', isPhoneSimulationEnabled() ? 180 : 80),
    maxSimulatedPhoneReadyWarningMs: getConfigNumber('max-simulated-phone-ready-warning-ms', 'PROFILE_MAX_SIMULATED_PHONE_READY_WARNING_MS', 45000),
  }),
});

function sanitize(value, depth = 0) {
  if (depth > 5) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return typeof value === 'function' ? '[function]' : value;
  if (Array.isArray(value)) return value.slice(0, 120).map((entry) => sanitize(entry, depth + 1));
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'function') continue;
    result[key] = sanitize(entry, depth + 1);
  }
  return result;
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getTileId(q, r) {
  return `tile_${toInteger(q)}_${toInteger(r)}`;
}

function createWorldTiles(radius = CONFIG.tileRadius) {
  const terrains = ['plains', 'forest', 'hills', 'plains', 'desert', 'river', 'mountain'];
  const tiles = [];
  const siteByCoord = new Map([
    ['0,0', 'capital'],
    ['2,-1', 'site-river-town'],
    ['-3,1', 'site-forest-camp'],
    ['4,-2', 'site-hill-outpost'],
    ['-2,4', 'site-ruins'],
    ['1,3', 'site-town'],
  ]);
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      const edge = distance >= radius - 1;
      const terrain = edge && (q + r) % 3 === 0
        ? 'ocean'
        : terrains[Math.abs((q * 13 + r * 7) % terrains.length)];
      const id = getTileId(q, r);
      const siteId = siteByCoord.get(`${q},${r}`) || null;
      tiles.push({
        id,
        q,
        r,
        terrain,
        discovered: true,
        visible: true,
        visibility: siteId === 'capital' ? 'controlled' : 'scouted',
        siteId,
        riverPorts: terrain === 'river' ? ['nw', 'se'] : [],
        oceanTemplates: terrain === 'ocean' ? ['full'] : [],
        transitionKey: terrain === 'desert' && distance > 2 ? 'nw-se' : '',
        intel: {
          level: 2,
          knownTerrain: true,
          knownSite: Boolean(siteId),
          knownOwner: true,
          knownGarrison: Boolean(siteId && siteId !== 'capital'),
          knownLeader: false,
          knownSkill: false,
        },
      });
    }
  }
  return tiles;
}

function createTerritories() {
  return [
    {
      id: 'capital',
      x: 0,
      y: 0,
      type: 'capital',
      owner: 'player',
      status: 'occupied',
      naturalName: 'Capital',
      cityName: 'Capital',
      population: 3,
      garrison: 12,
    },
    {
      id: 'site-river-town',
      x: 2,
      y: -1,
      type: 'town',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'River Town',
      garrison: 8,
      mapTerrain: 'river',
    },
    {
      id: 'site-forest-camp',
      x: -3,
      y: 1,
      type: 'camp',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'Forest Camp',
      garrison: 5,
      mapTerrain: 'forest',
    },
    {
      id: 'site-hill-outpost',
      x: 4,
      y: -2,
      type: 'outpost',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'Hill Outpost',
      garrison: 10,
      mapTerrain: 'hills',
    },
    {
      id: 'site-ruins',
      x: -2,
      y: 4,
      type: 'ruins',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'Old Ruins',
      garrison: 0,
      mapTerrain: 'desert',
    },
    {
      id: 'site-town',
      x: 1,
      y: 3,
      type: 'city',
      owner: 'neutral',
      status: 'discovered',
      naturalName: 'South City',
      garrison: 14,
      mapTerrain: 'plains',
    },
  ];
}

function createWorldExplorerState(now = new Date()) {
  const startedAt = now.toISOString();
  const nextStepAt = new Date(now.getTime() + 30000).toISOString();
  const completesAt = new Date(now.getTime() + 90000).toISOString();
  const route = [
    { q: 0, r: 0, step: 0, tileId: getTileId(0, 0), revealed: true },
    { q: 1, r: 0, step: 1, tileId: getTileId(1, 0), revealed: true },
    { q: 2, r: -1, step: 2, tileId: getTileId(2, -1), revealed: true },
  ];
  const mission = {
    id: 'profile-explore-1',
    mode: 'east',
    status: 'active',
    origin: { q: 0, r: 0, tileId: getTileId(0, 0) },
    target: { q: 2, r: -1, tileId: getTileId(2, -1) },
    position: { q: 1, r: 0, tileId: getTileId(1, 0) },
    route,
    plannedTiles: route,
    plannedSites: [
      {
        tileId: getTileId(2, -1),
        q: 2,
        r: -1,
        siteId: 'site-river-town',
        materialized: true,
        revealedAt: startedAt,
        site: createTerritories().find((site) => site.id === 'site-river-town'),
      },
    ],
    revealedTileIds: route.map((step) => step.tileId),
    stepDurationSeconds: 30,
    startedAt,
    nextStepAt,
    completesAt,
  };
  return {
    missions: [mission],
    activeMission: mission,
    idleMissions: [],
    maxActiveMissions: 1,
  };
}

function createGameStatePayload(options = {}) {
  const now = options.now || new Date();
  const territories = createTerritories();
  const worldTiles = createWorldTiles(options.tileRadius || CONFIG.tileRadius);
  const gameState = {
    playerId: 'profile-player',
    resources: {
      food: 120,
      wood: 90,
      stone: 48,
      iron: 24,
      knowledge: 35,
    },
    buildings: {
      house: { level: 1 },
      farm: { level: 1 },
      lumbermill: { level: 1 },
    },
    buildingCosts: {},
    buildingDefinitions: {
      house: { id: 'house', name: 'House', category: 'housing' },
      farm: { id: 'farm', name: 'Farm', category: 'resource' },
      lumbermill: { id: 'lumbermill', name: 'Lumbermill', category: 'resource' },
    },
    buildingCategories: {},
    buildingEffects: {},
    unlockedBuildings: ['house', 'farm', 'lumbermill', 'barracks'],
    currentEra: 1,
    currentEraName: 'Profile Era',
    currentEraDescription: 'Local profiling fixture',
    population: {
      total: 8,
      max: 12,
      maxPop: 12,
      farmers: 4,
      scholars: 1,
      craftsmen: 1,
      soldiers: 2,
      unassigned: 0,
    },
    happiness: 96,
    gameDay: 12,
    totalBuildings: 3,
    eraProgress: {
      percentage: 35,
      canAdvance: false,
      conditions: [],
    },
    currentTab: 'military',
    militaryView: 'world',
    techs: {},
    techEffects: {},
    eventQueue: [],
    eventHistory: [],
    regularEventState: null,
    threatEventState: null,
    activeBuffs: [],
    military: {
      soldiers: 24,
      availableSoldiers: 18,
      soldiersOnMission: 6,
      soldierCap: 40,
      trainingProgress: 0,
      trainingIntervalSeconds: 60,
      trainingBatchSize: 2,
      defensePerSoldier: 0.01,
      defense: 0.24,
    },
    territoryState: {
      version: 1,
      polity: {
        name: 'Profile Polity',
        capitalCityName: 'Capital',
        namePrompted: true,
      },
      worldMap: {
        version: 1,
        seed: 'profile-seed',
        tiles: worldTiles,
      },
      territories,
      scoutMissions: [],
      warMissions: [],
      scoutReports: [],
      scoutAreas: [],
      directions: [
        { id: 'north', label: 'North', available: true },
        { id: 'east', label: 'East', available: true },
        { id: 'south', label: 'South', available: true },
        { id: 'west', label: 'West', available: true },
      ],
      availableSoldiers: 18,
      soldiersOnMission: 6,
      occupiedCount: 1,
      discoveredCount: territories.length,
      missionDurationSeconds: 90,
      maxActiveScouts: 1,
      namingPrompt: null,
      famousPersons: {
        people: [],
      },
    },
    worldExplorerState: createWorldExplorerState(now),
    cityState: {
      activeCityId: 'capital',
      capitalCityId: 'capital',
      cities: [
        {
          id: 'capital',
          name: 'Capital',
          territoryId: 'capital',
          population: 8,
          buildings: {
            house: 1,
            farm: 1,
            lumbermill: 1,
          },
        },
      ],
    },
    activeCityId: 'capital',
    isCapitalCity: true,
    famousPersons: {
      people: [],
      candidates: [],
    },
    softGuide: null,
    guideTasks: { visible: false, tasks: [] },
    taskCenter: null,
  };

  return {
    gameState,
    tutorial: {
      completed: false,
      currentStep: 0,
      phaseCompleted: { newbie: false, era2: false },
    },
    softGuide: null,
    guideTasks: { visible: false, tasks: [] },
    taskCenter: null,
    eraProgress: gameState.eraProgress,
    syncTime: now.toISOString(),
  };
}

function readRequestBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`request body exceeds ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)));
    req.on('error', reject);
  });
}

function writeJson(res, status, payload, headers = {}) {
  const body = status === 304 ? '' : JSON.stringify(payload || {});
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
  return Buffer.byteLength(body);
}

function sendText(res, status, message) {
  const body = String(message || '');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
  return Buffer.byteLength(body);
}

function resolveStaticFile(reqPath) {
  const pathname = reqPath === '/' ? '/index.html' : reqPath;
  let decoded = '/';
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  let filePath = path.normalize(path.join(FRONTEND_ROOT, decoded));
  const rootWithSep = `${FRONTEND_ROOT}${path.sep}`;
  if (filePath !== FRONTEND_ROOT && !filePath.startsWith(rootWithSep)) return null;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  return filePath;
}

function serveStatic(req, res, reqUrl) {
  const filePath = resolveStaticFile(reqUrl.pathname);
  if (!filePath) return sendText(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath)) return sendText(res, 404, 'Not Found');
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Length': stat.size,
  });
  fs.createReadStream(filePath).pipe(res);
  return stat.size;
}

function parseJsonBody(buffer) {
  if (!buffer || !buffer.length) return {};
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return { rawBody: buffer.toString('utf8').slice(0, 1000) };
  }
}

async function createProfileServer(options = {}) {
  const apiEvents = [];
  const clientEvents = [];
  let heartbeatSeq = 0;
  const statePayload = createGameStatePayload({ tileRadius: options.tileRadius || CONFIG.tileRadius });
  const server = http.createServer(async (req, res) => {
    const startedAt = Date.now();
    let requestBytes = 0;
    let responseBytes = 0;
    let status = 500;
    let body = Buffer.alloc(0);
    try {
      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'OPTIONS') {
        status = 204;
        res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
        res.end();
        return;
      }
      if (!reqUrl.pathname.startsWith('/api/')) {
        responseBytes = serveStatic(req, res, reqUrl) || 0;
        status = res.statusCode;
        return;
      }

      body = ['GET', 'HEAD'].includes(req.method || '') ? Buffer.alloc(0) : await readRequestBody(req);
      requestBytes = body.length;
      const jsonBody = parseJsonBody(body);
      const etag = '"profile-local-version"';

      if (reqUrl.pathname === '/api/game/state') {
        status = 200;
        responseBytes = writeJson(res, status, statePayload);
      } else if (reqUrl.pathname === '/api/game/heartbeat') {
        status = 200;
        responseBytes = writeJson(res, status, {
          type: 'heartbeat',
          ok: true,
          serverTime: new Date().toISOString(),
          heartbeatSeq: ++heartbeatSeq,
        });
      } else if (reqUrl.pathname === '/api/version') {
        if (req.headers['if-none-match'] === etag) {
          status = 304;
          responseBytes = writeJson(res, status, {}, { ETag: etag });
        } else {
          status = 200;
          responseBytes = writeJson(res, status, {
            deploymentId: `profile-${CONFIG.runId}`,
            version: 'local-profile',
            buildTime: new Date().toISOString(),
            source: 'scripts/profile-h5-performance.js',
          }, { ETag: etag });
        }
      } else if (reqUrl.pathname === '/api/client-events') {
        clientEvents.push({
          at: new Date().toISOString(),
          body: sanitize(jsonBody),
        });
        status = 200;
        responseBytes = writeJson(res, status, { success: true });
      } else if (reqUrl.pathname === '/api/player/login') {
        status = 200;
        responseBytes = writeJson(res, status, {
          success: true,
          token: 'profile-token',
          playerId: 'profile-player',
          ...statePayload,
        });
      } else if (reqUrl.pathname === '/api/game/tasks') {
        status = 200;
        responseBytes = writeJson(res, status, {
          taskCenter: null,
          guideTasks: { visible: false, tasks: [] },
        });
      } else if (reqUrl.pathname === '/api/game/action' || reqUrl.pathname === '/api/game/tasks/claim') {
        status = 200;
        responseBytes = writeJson(res, status, {
          success: true,
          ...statePayload,
        });
      } else {
        status = 404;
        responseBytes = writeJson(res, status, {
          success: false,
          message: `profile stub has no endpoint for ${req.method} ${reqUrl.pathname}`,
        });
      }
    } catch (error) {
      status = 500;
      if (!res.headersSent) {
        responseBytes = writeJson(res, status, {
          success: false,
          message: error?.message || String(error),
        });
      } else {
        res.end();
      }
    } finally {
      if ((req.url || '').startsWith('/api/')) {
        apiEvents.push({
          at: new Date().toISOString(),
          method: req.method,
          path: (() => {
            try { return new URL(req.url || '/', 'http://127.0.0.1').pathname; } catch { return req.url || ''; }
          })(),
          status,
          durationMs: Date.now() - startedAt,
          requestBytes,
          responseBytes,
        });
      }
    }
  });

  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

  return {
    port,
    apiEvents,
    clientEvents,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function analyzePng(buffer) {
  const png = PNG.sync.read(buffer);
  const pixels = png.data;
  const sampleStep = Math.max(1, Math.floor(Math.sqrt((png.width * png.height) / 24000)));
  const colors = new Set();
  let count = 0;
  let lumaSum = 0;
  let lumaSqSum = 0;
  let darkCount = 0;
  let transparentCount = 0;
  for (let y = 0; y < png.height; y += sampleStep) {
    for (let x = 0; x < png.width; x += sampleStep) {
      const idx = (png.width * y + x) << 2;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      colors.add(`${r >> 3},${g >> 3},${b >> 3},${a >> 5}`);
      lumaSum += luma;
      lumaSqSum += luma * luma;
      if (luma < 24) darkCount += 1;
      if (a < 8) transparentCount += 1;
      count += 1;
    }
  }
  const lumaMean = count ? lumaSum / count : 0;
  const variance = count ? Math.max(0, lumaSqSum / count - lumaMean * lumaMean) : 0;
  const lumaStdDev = Math.sqrt(variance);
  return {
    width: png.width,
    height: png.height,
    samples: count,
    uniqueColors: colors.size,
    lumaMean: Number(lumaMean.toFixed(2)),
    lumaStdDev: Number(lumaStdDev.toFixed(2)),
    darkRatio: Number((count ? darkCount / count : 0).toFixed(3)),
    transparentRatio: Number((count ? transparentCount / count : 0).toFixed(3)),
    suspiciousBlank: colors.size < CONFIG.budgets.minScreenshotUniqueColors
      || lumaStdDev < CONFIG.budgets.minScreenshotLumaStdDev,
  };
}

function percentile(values, p) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  const index = Math.min(numbers.length - 1, Math.max(0, Math.ceil((p / 100) * numbers.length) - 1));
  return numbers[index];
}

function summarizeRaf(deltas = []) {
  const values = deltas.filter((value) => Number.isFinite(value) && value >= 0);
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    count: values.length,
    averageMs: Number((values.length ? sum / values.length : 0).toFixed(2)),
    p95Ms: Number(percentile(values, 95).toFixed(2)),
    maxMs: Number((values.length ? Math.max(...values) : 0).toFixed(2)),
    over50Ms: values.filter((value) => value > 50).length,
    over100Ms: values.filter((value) => value > 100).length,
  };
}

function categorizeResponse(entry = {}) {
  let pathname = '';
  try {
    pathname = new URL(entry.url).pathname;
  } catch {
    pathname = entry.url || '';
  }
  const ext = path.extname(pathname).toLowerCase();
  if (pathname.startsWith('/api/')) return 'api';
  if (ext === '.js') return 'script';
  if (ext === '.css') return 'style';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.atlas', '.skel'].includes(ext)) return 'asset';
  return 'other';
}

function getRequestPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return String(url || '');
  }
}

function isBenignRequestFailure(entry = {}, profile = {}) {
  const pathName = getRequestPath(entry.url);
  const failure = String(entry.failure || '');
  return Boolean(profile.pageMetrics?.hasServerState)
    && pathName === '/api/version'
    && failure.includes('ERR_ABORTED');
}

function summarizeFailures(responses = [], requestFailures = [], profile = {}) {
  const badResponses = responses.filter((entry) => Number(entry.status) >= 400);
  const ignoredRequestFailures = requestFailures.filter((entry) => isBenignRequestFailure(entry, profile));
  const actionableRequestFailures = requestFailures.filter((entry) => !isBenignRequestFailure(entry, profile));
  const byCategory = { api: 0, script: 0, style: 0, asset: 0, other: 0 };
  badResponses.forEach((entry) => {
    byCategory[categorizeResponse(entry)] += 1;
  });
  return {
    badResponses,
    requestFailures: actionableRequestFailures,
    ignoredRequestFailures,
    byCategory,
  };
}

function summarizeDeviceProfile(profile = {}) {
  return {
    name: profile.name || 'host',
    label: profile.label || profile.name || 'host',
    cpuThrottlingRate: Number(profile.cpuThrottlingRate || 1),
    hardwareConcurrency: profile.hardwareConcurrency,
    deviceMemoryGb: profile.deviceMemoryGb,
    jsHeapMb: profile.jsHeapMb,
    gpuMode: profile.gpuMode || 'host',
    launchArgs: Array.isArray(profile.launchArgs) ? [...profile.launchArgs] : [],
    notes: Array.isArray(profile.notes) ? [...profile.notes] : [],
    limitations: [
      'Chromium CPU throttling is a deterministic local approximation, not a physical phone SoC.',
      'GPU constraints are approximated with browser launch flags; desktop GPU scheduling, thermals, and drivers are not true-device equivalent.',
      'Memory constraints expose browser-visible deviceMemory and V8 old-space caps, but do not enforce total OS RAM pressure.',
    ],
  };
}

function collectBudgetFindings(profile = {}, budgets = CONFIG.budgets) {
  const failures = summarizeFailures(profile.responses, profile.requestFailures, profile);
  const errors = [];
  const warnings = [];
  const navLoadMs = Number(profile.pageMetrics?.navigation?.loadEventEnd || profile.pageMetrics?.navigation?.duration || 0);
  const readyMs = Number(profile.pageMetrics?.h5LoadTrace?.readyMs || 0);
  const canvasCount = Number(profile.pageMetrics?.canvasCount || 0);
  const screenshot = profile.screenshotAnalysis || {};
  const raf = profile.pageMetrics?.rafSummary || {};
  const longTaskCount = Number(profile.pageMetrics?.longTasks?.length || 0);
  const consoleErrorCount = profile.consoleMessages.filter((entry) => entry.type === 'error').length;

  const isSimulatedPhone = String(profile.deviceProfile?.name || '').startsWith('phone-2026');

  if (!profile.pageMetrics?.hasServerState) errors.push('H5 did not apply server state before timeout');
  if (navLoadMs > budgets.maxNavigationLoadMs) errors.push(`navigation load ${Math.round(navLoadMs)}ms exceeds ${budgets.maxNavigationLoadMs}ms`);
  if (readyMs > budgets.maxReadyMs) {
    if (isSimulatedPhone && readyMs <= budgets.maxSimulatedPhoneReadyWarningMs) {
      warnings.push(`simulated phone H5 ready ${Math.round(readyMs)}ms exceeds target ${budgets.maxReadyMs}ms`);
    } else {
      errors.push(`H5 ready ${Math.round(readyMs)}ms exceeds ${budgets.maxReadyMs}ms`);
    }
  }
  if (failures.byCategory.api > budgets.maxApiFailures) errors.push(`API failures ${failures.byCategory.api} exceeds ${budgets.maxApiFailures}`);
  if (failures.byCategory.script > budgets.maxScriptFailures) errors.push(`script failures ${failures.byCategory.script} exceeds ${budgets.maxScriptFailures}`);
  if (failures.byCategory.style > budgets.maxStyleFailures) errors.push(`style failures ${failures.byCategory.style} exceeds ${budgets.maxStyleFailures}`);
  if (failures.byCategory.asset > budgets.maxAssetFailures) errors.push(`asset failures ${failures.byCategory.asset} exceeds ${budgets.maxAssetFailures}`);
  if (failures.requestFailures.length > budgets.maxRequestFailures) errors.push(`request failures ${failures.requestFailures.length} exceeds ${budgets.maxRequestFailures}`);
  if (profile.pageErrors.length > budgets.maxPageErrors) errors.push(`page errors ${profile.pageErrors.length} exceeds ${budgets.maxPageErrors}`);
  if (consoleErrorCount > budgets.maxConsoleErrors) errors.push(`console errors ${consoleErrorCount} exceeds ${budgets.maxConsoleErrors}`);
  if (canvasCount < budgets.minCanvasCount) errors.push(`canvas count ${canvasCount} below ${budgets.minCanvasCount}`);
  if (screenshot.suspiciousBlank) {
    errors.push(`screenshot appears blank/low-variance: uniqueColors=${screenshot.uniqueColors}, lumaStdDev=${screenshot.lumaStdDev}`);
  }
  if (failures.ignoredRequestFailures.length) warnings.push(`ignored ${failures.ignoredRequestFailures.length} benign request abort(s) after successful H5 state application`);
  if (longTaskCount > budgets.maxLongTaskWarningCount) warnings.push(`long task count ${longTaskCount} exceeds warning budget ${budgets.maxLongTaskWarningCount}`);
  if (raf.p95Ms > budgets.maxRafP95WarningMs) warnings.push(`RAF p95 ${raf.p95Ms}ms exceeds warning budget ${budgets.maxRafP95WarningMs}ms`);

  return {
    verdict: errors.length ? 'fail' : (warnings.length ? 'pass-with-warnings' : 'pass'),
    errors,
    warnings,
    failureSummary: failures,
  };
}

async function installDeviceProfileHooks(page, deviceProfile = DEVICE_PROFILE_PRESETS.host) {
  const device = summarizeDeviceProfile(deviceProfile);
  await page.addInitScript((profile) => {
    const defineGetter = (target, key, value) => {
      if (value === null || value === undefined) return false;
      try {
        Object.defineProperty(target, key, {
          configurable: true,
          get: () => value,
        });
        return true;
      } catch (_) {
        return false;
      }
    };
    defineGetter(Navigator.prototype, 'hardwareConcurrency', profile.hardwareConcurrency);
    defineGetter(Navigator.prototype, 'deviceMemory', profile.deviceMemoryGb);
    try {
      window.__wxDeviceProfile = profile;
    } catch (_) {}
  }, device);
}

async function applyCpuThrottling(page, deviceProfile = DEVICE_PROFILE_PRESETS.host) {
  const rate = Number(deviceProfile.cpuThrottlingRate || 1);
  if (!Number.isFinite(rate) || rate <= 1) {
    return { applied: false, rate: 1, reason: 'not requested' };
  }
  try {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate });
    return { applied: true, rate };
  } catch (error) {
    return {
      applied: false,
      rate,
      reason: error?.message || String(error || ''),
    };
  }
}

async function installBrowserProfilingHooks(page) {
  await page.addInitScript(() => {
    window.__wxProfile = {
      longTasks: [],
      rafDeltas: [],
      fetchCalls: [],
      runtimeErrors: [],
      startedAt: performance.now(),
      deviceProfile: window.__wxDeviceProfile || null,
    };

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__wxProfile.longTasks.push({
            name: entry.name,
            startTime: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (_) {}

    try {
      let lastFrame = 0;
      const sample = (ts) => {
        if (lastFrame) window.__wxProfile.rafDeltas.push(Number((ts - lastFrame).toFixed(2)));
        lastFrame = ts;
        if (window.__wxProfile.rafDeltas.length < 240) window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    } catch (_) {}

    try {
      window.addEventListener('error', (event) => {
        window.__wxProfile.runtimeErrors.push({
          type: 'error',
          message: event.message || '',
          source: event.filename || '',
          line: event.lineno || 0,
          column: event.colno || 0,
        });
      });
      window.addEventListener('unhandledrejection', (event) => {
        window.__wxProfile.runtimeErrors.push({
          type: 'unhandledrejection',
          message: event.reason?.message || String(event.reason || ''),
        });
      });
    } catch (_) {}

    try {
      const originalFetch = window.fetch?.bind(window);
      if (originalFetch && !window.fetch.__wxProfileWrapped) {
        const wrappedFetch = async (...args) => {
          const startedAt = performance.now();
          const request = args[0];
          const init = args[1] || {};
          const url = typeof request === 'string' ? request : String(request?.url || '');
          const method = String(init.method || request?.method || 'GET').toUpperCase();
          const entry = {
            index: window.__wxProfile.fetchCalls.length,
            url,
            method,
            startedAt: Math.round(startedAt),
            completed: false,
          };
          window.__wxProfile.fetchCalls.push(entry);
          try {
            const response = await originalFetch(...args);
            entry.completed = true;
            entry.ok = response.ok;
            entry.status = response.status;
            entry.durationMs = Math.round(performance.now() - startedAt);
            return response;
          } catch (error) {
            entry.completed = true;
            entry.ok = false;
            entry.error = error?.message || String(error || '');
            entry.durationMs = Math.round(performance.now() - startedAt);
            throw error;
          }
        };
        wrappedFetch.__wxProfileWrapped = true;
        window.fetch = wrappedFetch;
      }
    } catch (_) {}
  });
}

async function collectPageMetrics(page) {
  return page.evaluate(() => {
    function compactResource(entry) {
      return {
        name: entry.name,
        initiatorType: entry.initiatorType || '',
        duration: Math.round(entry.duration || 0),
        transferSize: Number(entry.transferSize || 0),
        encodedBodySize: Number(entry.encodedBodySize || 0),
        decodedBodySize: Number(entry.decodedBodySize || 0),
      };
    }

    function summarizeResources(resources) {
      const byInitiator = {};
      let transferSize = 0;
      for (const entry of resources) {
        byInitiator[entry.initiatorType || 'other'] = (byInitiator[entry.initiatorType || 'other'] || 0) + 1;
        transferSize += Number(entry.transferSize || 0);
      }
      return {
        count: resources.length,
        byInitiator,
        transferSize,
        slowest: resources
          .map(compactResource)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 12),
      };
    }

    function analyzeCanvas(canvas) {
      const rect = canvas.getBoundingClientRect?.();
      const summary = {
        id: canvas.id || '',
        layer: canvas.getAttribute?.('data-canvas-layer') || '',
        width: canvas.width || 0,
        height: canvas.height || 0,
        rect: rect ? {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } : null,
        sampled: false,
      };
      try {
        const context = canvas.getContext?.('2d');
        if (!context || !canvas.width || !canvas.height) return summary;
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const step = Math.max(1, Math.floor(Math.sqrt((canvas.width * canvas.height) / 12000)));
        const colors = new Set();
        let count = 0;
        let lumaSum = 0;
        let lumaSqSum = 0;
        for (let y = 0; y < canvas.height; y += step) {
          for (let x = 0; x < canvas.width; x += step) {
            const idx = (canvas.width * y + x) << 2;
            const r = image.data[idx];
            const g = image.data[idx + 1];
            const b = image.data[idx + 2];
            const a = image.data[idx + 3];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            colors.add(`${r >> 3},${g >> 3},${b >> 3},${a >> 5}`);
            lumaSum += luma;
            lumaSqSum += luma * luma;
            count += 1;
          }
        }
        const mean = count ? lumaSum / count : 0;
        const variance = count ? Math.max(0, lumaSqSum / count - mean * mean) : 0;
        return {
          ...summary,
          sampled: true,
          samples: count,
          uniqueColors: colors.size,
          lumaMean: Number(mean.toFixed(2)),
          lumaStdDev: Number(Math.sqrt(variance).toFixed(2)),
        };
      } catch (error) {
        return {
          ...summary,
          sampleError: error?.message || String(error || ''),
        };
      }
    }

    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const profile = window.__wxProfile || {};
    const loadTrace = window.H5LoadTrace || {};
    const game = window.Game || null;
    const shell = game?.canvasShell || null;
    const renderer = shell?.renderer || game?.renderer || null;
    const runtime = shell?.runtime || game?.runtime || null;
    const territoryState = game?.state?.territoryState || {};
    const worldMap = territoryState.worldMap || {};
    const worldExplorerState = game?.state?.worldExplorerState || {};
    const canvases = Array.from(document.querySelectorAll('canvas')).map(analyzeCanvas);
    return {
      title: document.title,
      url: location.href,
      hasServerState: Boolean(game?.hasServerState),
      tokenPresent: Boolean(localStorage.getItem('cf_token')),
      currentTab: game?.state?.currentTab || game?.activeTab || '',
      militaryView: game?.state?.militaryView || game?.militaryView || '',
      worldMapTiles: Array.isArray(worldMap.tiles) ? worldMap.tiles.length : 0,
      territories: Array.isArray(territoryState.territories) ? territoryState.territories.length : 0,
      explorerMissions: Array.isArray(worldExplorerState.missions) ? worldExplorerState.missions.length : 0,
      hitTargets: Array.isArray(renderer?.hitTargets) ? renderer.hitTargets.length : 0,
      canvasCount: canvases.length,
      canvases,
      runtimeSize: runtime ? {
        width: runtime.width || 0,
        height: runtime.height || 0,
        pixelRatio: runtime.pixelRatio || window.devicePixelRatio || 1,
      } : null,
      navigation: navigation ? navigation.toJSON() : null,
      resources: summarizeResources(resources),
      longTasks: Array.isArray(profile.longTasks) ? profile.longTasks.slice(0, 120) : [],
      rafSummary: {
        count: Array.isArray(profile.rafDeltas) ? profile.rafDeltas.length : 0,
        deltas: Array.isArray(profile.rafDeltas) ? profile.rafDeltas.slice(0, 240) : [],
      },
      fetchCalls: Array.isArray(profile.fetchCalls) ? profile.fetchCalls.slice(0, 120) : [],
      runtimeErrors: Array.isArray(profile.runtimeErrors) ? profile.runtimeErrors.slice(0, 50) : [],
      deviceProfile: {
        requested: window.__wxDeviceProfile || null,
        observed: {
          hardwareConcurrency: navigator.hardwareConcurrency || null,
          deviceMemoryGb: navigator.deviceMemory || null,
          userAgent: navigator.userAgent || '',
          platform: navigator.platform || '',
          maxTouchPoints: navigator.maxTouchPoints || 0,
          devicePixelRatio: window.devicePixelRatio || 1,
        },
      },
      h5LoadTrace: {
        enabled: loadTrace.enabled !== false,
        startedAt: Number(loadTrace.startedAt || 0),
        readyAt: Number(loadTrace.readyAt || 0),
        readyMs: loadTrace.readyAt ? Math.round(Number(loadTrace.readyAt) - Number(loadTrace.startedAt || 0)) : 0,
      },
    };
  });
}

async function profileViewport(browser, baseUrl, viewport, outDir, deviceProfile = DEVICE_PROFILE_PRESETS.host) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  });
  const page = await context.newPage();
  const cpuThrottle = await applyCpuThrottling(page, deviceProfile);
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const responses = [];
  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text().slice(0, 1200),
      location: msg.location(),
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push({ message: error.message, stack: error.stack });
  });
  page.on('requestfailed', (req) => {
    requestFailures.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      failure: req.failure()?.errorText || '',
    });
  });
  page.on('response', (resp) => {
    const status = resp.status();
    const req = resp.request();
    const url = resp.url();
    const include = status >= 400 || url.includes('/api/') || ['script', 'stylesheet', 'image'].includes(req.resourceType());
    if (!include) return;
    responses.push({
      url,
      status,
      method: req.method(),
      resourceType: req.resourceType(),
      contentType: resp.headers()['content-type'] || '',
    });
  });
  await installDeviceProfileHooks(page, deviceProfile);
  await installBrowserProfilingHooks(page);

  const device = summarizeDeviceProfile(deviceProfile);
  const runLabel = `${device.name}-${viewport.name}`;
  const url = `${baseUrl}/?codexIabToken=profile-token&codexIabUser=profile-user&loadTrace=1&profileRun=${encodeURIComponent(CONFIG.runId)}&profileViewport=${encodeURIComponent(viewport.name)}&profileDevice=${encodeURIComponent(device.name)}`;
  const startedAt = Date.now();
  let ready = false;
  let timeoutError = null;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.waitForReadyMs });
    await page.waitForLoadState('load', { timeout: CONFIG.waitForReadyMs }).catch(() => {});
    await page.waitForFunction(() => Boolean(window.Game && window.Game.canvasShell), null, { timeout: CONFIG.waitForReadyMs });
    await page.waitForFunction(() => Boolean(window.Game && window.Game.hasServerState), null, { timeout: CONFIG.waitForReadyMs });
    ready = true;
  } catch (error) {
    timeoutError = error?.message || String(error || '');
  }
  await page.waitForTimeout(CONFIG.sampleMs);

  const pageMetrics = await collectPageMetrics(page);
  pageMetrics.rafSummary = summarizeRaf(pageMetrics.rafSummary?.deltas || []);
  pageMetrics.profileWallMs = Date.now() - startedAt;
  pageMetrics.ready = ready;
  if (timeoutError) pageMetrics.timeoutError = timeoutError;

  const screenshotFile = path.join(outDir, `${runLabel}-screenshot.png`);
  const screenshotBuffer = await page.screenshot({ path: screenshotFile, fullPage: false });
  const screenshotAnalysis = analyzePng(screenshotBuffer);

  await context.close();

  const profile = {
    runLabel,
    deviceProfile: device,
    cpuThrottle,
    viewport,
    screenshotFile,
    pageMetrics,
    screenshotAnalysis,
    consoleMessages,
    pageErrors,
    requestFailures,
    responses,
  };
  profile.budget = collectBudgetFindings(profile);
  return profile;
}

function createBrowserLaunchOptions(deviceProfile = DEVICE_PROFILE_PRESETS.host) {
  const device = summarizeDeviceProfile(deviceProfile);
  return {
    headless: CONFIG.headless,
    args: Array.from(new Set(device.launchArgs || [])),
  };
}

async function profileDevice(baseUrl, deviceProfile, outDir) {
  const browser = await chromium.launch(createBrowserLaunchOptions(deviceProfile));
  const profiles = [];
  try {
    for (const viewport of CONFIG.viewports) {
      const device = summarizeDeviceProfile(deviceProfile);
      console.log(`[h5-profile] profiling ${device.name}/${viewport.name} ${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor} cpu=${device.cpuThrottlingRate}x gpu=${device.gpuMode}`);
      profiles.push(await profileViewport(browser, baseUrl, viewport, outDir, deviceProfile));
    }
    return profiles;
  } finally {
    await browser.close().catch(() => {});
  }
}

function getProfileScore(profile = {}) {
  return {
    readyMs: Number(profile.pageMetrics?.h5LoadTrace?.readyMs || 0),
    navigationLoadMs: Math.round(Number(profile.pageMetrics?.navigation?.loadEventEnd || profile.pageMetrics?.navigation?.duration || 0)),
    rafP95Ms: Number(profile.pageMetrics?.rafSummary?.p95Ms || 0),
    longTasks: Number(profile.pageMetrics?.longTasks?.length || 0),
  };
}

function getWorstProfile(profiles = []) {
  if (!profiles.length) return null;
  const sorted = [...profiles].sort((a, b) => {
    const aScore = getProfileScore(a);
    const bScore = getProfileScore(b);
    return (bScore.readyMs - aScore.readyMs)
      || (bScore.rafP95Ms - aScore.rafP95Ms)
      || (bScore.longTasks - aScore.longTasks)
      || (bScore.navigationLoadMs - aScore.navigationLoadMs);
  });
  const worst = sorted[0];
  return {
    runLabel: worst.runLabel,
    deviceProfile: worst.deviceProfile?.name || '',
    viewport: worst.viewport?.name || '',
    verdict: worst.budget?.verdict || '',
    warnings: worst.budget?.warnings || [],
    errors: worst.budget?.errors || [],
    ...getProfileScore(worst),
  };
}

async function main() {
  const outDir = path.join(CONFIG.outputRoot, CONFIG.runId);
  fs.mkdirSync(outDir, { recursive: true });
  const server = await createProfileServer({ tileRadius: CONFIG.tileRadius });
  const baseUrl = `http://127.0.0.1:${server.port}`;
  const profiles = [];
  try {
    for (const deviceProfile of CONFIG.deviceProfiles) {
      profiles.push(...await profileDevice(baseUrl, deviceProfile, outDir));
    }
  } finally {
    await server.close().catch(() => {});
  }

  const summary = {
    runId: CONFIG.runId,
    outputDir: outDir,
    baseUrl,
    generatedAt: new Date().toISOString(),
    headless: CONFIG.headless,
    phoneSimulation: CONFIG.phoneSimulation,
    tileRadius: CONFIG.tileRadius,
    budgets: CONFIG.budgets,
    deviceProfiles: CONFIG.deviceProfiles.map(summarizeDeviceProfile),
    viewportsConfigured: CONFIG.viewports,
    verdict: profiles.some((profile) => profile.budget.verdict === 'fail')
      ? 'fail'
      : (profiles.some((profile) => profile.budget.verdict === 'pass-with-warnings') ? 'pass-with-warnings' : 'pass'),
    worstProfile: getWorstProfile(profiles),
    viewports: profiles.map((profile) => ({
      runLabel: profile.runLabel,
      deviceProfile: profile.deviceProfile.name,
      deviceLabel: profile.deviceProfile.label,
      cpuThrottle: profile.cpuThrottle,
      name: profile.viewport.name,
      size: `${profile.viewport.width}x${profile.viewport.height}@${profile.viewport.deviceScaleFactor}`,
      verdict: profile.budget.verdict,
      errors: profile.budget.errors,
      warnings: profile.budget.warnings,
      readyMs: profile.pageMetrics.h5LoadTrace.readyMs,
      navigationLoadMs: Math.round(Number(profile.pageMetrics.navigation?.loadEventEnd || profile.pageMetrics.navigation?.duration || 0)),
      canvasCount: profile.pageMetrics.canvasCount,
      worldMapTiles: profile.pageMetrics.worldMapTiles,
      hitTargets: profile.pageMetrics.hitTargets,
      rafP95Ms: profile.pageMetrics.rafSummary.p95Ms,
      longTasks: profile.pageMetrics.longTasks.length,
      screenshot: {
        file: profile.screenshotFile,
        uniqueColors: profile.screenshotAnalysis.uniqueColors,
        lumaStdDev: profile.screenshotAnalysis.lumaStdDev,
      },
      failures: profile.budget.failureSummary.byCategory,
    })),
    apiEvents: server.apiEvents,
    clientEvents: server.clientEvents,
  };

  const report = {
    summary,
    profiles,
  };
  const reportFile = path.join(outDir, 'profile.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (summary.verdict === 'fail') process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    const outDir = path.join(CONFIG.outputRoot, CONFIG.runId);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'fatal-error.txt'), error.stack || error.message || String(error));
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  CONFIG,
  VIEWPORT_PRESETS,
  analyzePng,
  collectBudgetFindings,
  createGameStatePayload,
  createProfileServer,
  DEVICE_PROFILE_PRESETS,
  getWorstProfile,
  parseDeviceProfiles,
  parseViewports,
  summarizeRaf,
  summarizeDeviceProfile,
};

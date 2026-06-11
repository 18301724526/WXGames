const http = require('node:http');

const OpsAgentService = require('./OpsAgentService');
const OpsAuthService = require('../services/OpsAuthService');

const DEFAULT_BIND_HOST = '127.0.0.1';
const DEFAULT_PORT = 3101;
const MAX_BODY_BYTES = 1024 * 1024;

function parsePort(value, fallback = DEFAULT_PORT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return Math.floor(parsed);
}

function resolveBindHost(env = process.env) {
  return String(env.OPS_AGENT_BIND_HOST || DEFAULT_BIND_HOST).trim() || DEFAULT_BIND_HOST;
}

function resolveCorsOrigins(env = process.env) {
  return String(env.OPS_AGENT_CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function applyCors(req, res, corsOrigins = []) {
  const origin = req.headers.origin || '';
  if (!origin || corsOrigins.length === 0) return {};
  if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
    const allowOrigin = corsOrigins.includes('*') ? '*' : origin;
    return {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    };
  }
  return {};
}

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      text += chunk;
      if (Buffer.byteLength(text, 'utf8') > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('error', reject);
    req.on('end', () => {
      if (!text.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (_) {
        reject(new Error('Invalid JSON body'));
      }
    });
  });
}

function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
}

function verifyOpsAuth(req, opsAuthService) {
  const authReq = { headers: req.headers };
  const authRes = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let reached = false;
  opsAuthService.authMiddleware(authReq, authRes, () => { reached = true; });
  if (!reached) {
    return {
      ok: false,
      statusCode: authRes.statusCode || 401,
      payload: authRes.payload || { error: 'OpsUnauthorized', message: 'Ops token is invalid' },
    };
  }
  return {
    ok: true,
    operator: authReq.opsAdminUser || authReq.adminUser || 'ops-admin',
  };
}

function createOpsAgentRequestHandler(options = {}) {
  const opsAgentService = options.opsAgentService || new OpsAgentService(options);
  const opsAuthService = options.opsAuthService || new OpsAuthService(options);
  const corsOrigins = options.corsOrigins || resolveCorsOrigins(opsAgentService.env || process.env);

  return async function handleOpsAgentRequest(req, res) {
    const corsHeaders = applyCors(req, res, corsOrigins);
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {}, corsHeaders);
      return;
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const route = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (req.method === 'GET' && route === '/health') {
        sendJson(res, 200, {
          ...opsAgentService.getHealth(),
          auth: opsAuthService.getConfigStatus(),
        }, corsHeaders);
        return;
      }

      if (req.method === 'POST' && route === '/login') {
        const body = await readJsonBody(req);
        const result = opsAuthService.login({
          ...body,
          clientIp: getClientIp(req),
        });
        if (typeof opsAgentService.appendAudit === 'function') {
          opsAgentService.appendAudit({
            action: result.success ? 'ops-agent:login' : (result.error === 'OpsLoginRateLimited' ? 'ops-agent:login:rate-limited' : 'ops-agent:login:failed'),
            operator: result.operator?.username || body.username || 'unknown',
          });
        }
        if (result.retryAfterSeconds) {
          corsHeaders['Retry-After'] = String(result.retryAfterSeconds);
        }
        sendJson(res, result.statusCode || (result.success ? 200 : 401), result, corsHeaders);
        return;
      }

      const auth = verifyOpsAuth(req, opsAuthService);
      if (!auth.ok) {
        sendJson(res, auth.statusCode, auth.payload, corsHeaders);
        return;
      }

      if (req.method === 'GET' && route === '/status') {
        sendJson(res, 200, opsAgentService.getStatus(), corsHeaders);
        return;
      }

      const actionMap = {
        '/pm2/start': () => opsAgentService.startService({ operator: auth.operator }),
        '/pm2/stop': () => opsAgentService.stopService({ operator: auth.operator }),
        '/pm2/restart': () => opsAgentService.restartService({ operator: auth.operator }),
      };
      if (req.method === 'POST' && actionMap[route]) {
        const result = actionMap[route]();
        sendJson(res, result.success ? 200 : 409, result, corsHeaders);
        return;
      }

      sendJson(res, 404, {
        success: false,
        error: 'OpsAgentRouteNotFound',
        message: `Unknown ops-agent route: ${req.method} ${route}`,
      }, corsHeaders);
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: 'OpsAgentRequestFailed',
        message: error.message,
      }, corsHeaders);
    }
  };
}

function createOpsAgentHttpServer(options = {}) {
  return http.createServer(createOpsAgentRequestHandler(options));
}

module.exports = {
  DEFAULT_BIND_HOST,
  DEFAULT_PORT,
  createOpsAgentHttpServer,
  createOpsAgentRequestHandler,
  parsePort,
  resolveBindHost,
  resolveCorsOrigins,
};

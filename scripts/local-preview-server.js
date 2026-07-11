const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const repoRoot = path.resolve(__dirname, '..');
const root = path.join(repoRoot, 'frontend');
const port = Number(process.env.LOCAL_PREVIEW_PORT || process.env.PORT) || 8080;
const apiBase = process.env.LOCAL_PREVIEW_API_BASE || 'http://127.0.0.1:3000';
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

function sendError(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function sendDeployStatus(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(JSON.stringify({ status: 'ready', stage: 'local-preview' }));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

async function proxyApi(req, res, reqUrl) {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readRequestBody(req);
  const hopByHopHeaders = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'upgrade',
    'expect',
  ]);
  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([key]) => !hopByHopHeaders.has(key.toLowerCase()))
  );

  const upstream = await fetch(`${apiBase}${reqUrl.pathname}${reqUrl.search}`, {
    method: req.method,
    headers,
    body,
    duplex: body ? 'half' : undefined,
  });

  res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
  if (upstream.body) {
    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
  }
  res.end();
}

function serveStatic(res, reqUrl) {
  const pathname = decodeURIComponent(reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname);
  const staticRoot = pathname.startsWith('/shared/') ? repoRoot : root;
  let filePath = path.resolve(staticRoot, `.${pathname}`);
  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
    sendError(res, 403, 'Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    sendError(res, 404, 'Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);
    if (reqUrl.pathname === '/.wxgame-deploy-status.json') {
      sendDeployStatus(res);
      return;
    }
    if (reqUrl.pathname.startsWith('/api/')) {
      await proxyApi(req, res, reqUrl);
      return;
    }
    serveStatic(res, reqUrl);
  } catch (error) {
    const reason = [
      error && error.stack ? error.stack : String(error),
      error && error.cause ? `CAUSE: ${error.cause.stack || error.cause}` : '',
    ].filter(Boolean).join('\n');
    console.error(reason);
    sendError(res, 500, reason);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
});

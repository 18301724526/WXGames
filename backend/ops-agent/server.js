#!/usr/bin/env node

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const OpsAgentService = require('./OpsAgentService');
const OpsAuthService = require('../services/OpsAuthService');
const {
  createOpsAgentHttpServer,
  parsePort,
  resolveBindHost,
} = require('./OpsAgentHttpServer');

function startOpsAgent(env = process.env) {
  const host = resolveBindHost(env);
  const port = parsePort(env.OPS_AGENT_PORT);
  const opsAgentService = new OpsAgentService({ env });
  const opsAuthService = new OpsAuthService({ env });
  const server = createOpsAgentHttpServer({ opsAgentService, opsAuthService });

  server.listen(port, host, () => {
    const auth = opsAuthService.getConfigStatus();
    console.log(`[ops-agent] listening on http://${host}:${port}`);
    console.log(`[ops-agent] target PM2 app: ${opsAgentService.pm2AppName}`);
    if (!auth.configured) {
      console.warn(`[ops-agent] ops auth is not configured: ${auth.missing.join(', ')}`);
    }
  });

  return { server, opsAgentService, opsAuthService };
}

if (require.main === module) {
  startOpsAgent();
}

module.exports = { startOpsAgent };

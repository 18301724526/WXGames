#!/usr/bin/env node

const { performance } = require('node:perf_hooks');

function parseArgs(argv) {
  const stringKeys = new Set(['baseUrl', 'password']);
  const args = {
    baseUrl: process.env.LOADTEST_BASE_URL || 'http://47.116.32.216',
    botCount: Number(process.env.LOADTEST_BOT_COUNT || 100),
    concurrency: Number(process.env.LOADTEST_CONCURRENCY || 25),
    rounds: Number(process.env.LOADTEST_ROUNDS || 3),
    password: process.env.BOT_ACCOUNT_PASSWORD || process.env.LOADTEST_BOT_PASSWORD || '',
    timeoutMs: Number(process.env.LOADTEST_TIMEOUT_MS || 10000),
    targetUtilization: Number(process.env.LOADTEST_TARGET_UTILIZATION || 0.8),
    maxP95Ms: Number(process.env.LOADTEST_MAX_P95_MS || 1500),
    maxErrorRate: Number(process.env.LOADTEST_MAX_ERROR_RATE || 0.02),
  };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith('--')) continue;
    index += 1;
    const name = key.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(args, name)) {
      args[name] = stringKeys.has(name) ? value : Number(value);
    }
  }
  args.baseUrl = String(args.baseUrl || '').replace(/\/+$/, '');
  args.botCount = Math.max(1, Math.floor(Number(args.botCount) || 1));
  args.concurrency = Math.max(1, Math.floor(Number(args.concurrency) || 1));
  args.rounds = Math.max(1, Math.floor(Number(args.rounds) || 1));
  args.timeoutMs = Math.max(1000, Math.floor(Number(args.timeoutMs) || 10000));
  args.targetUtilization = Math.max(0.1, Math.min(1, Number(args.targetUtilization) || 0.8));
  args.maxP95Ms = Math.max(1, Math.floor(Number(args.maxP95Ms) || 1500));
  args.maxErrorRate = Math.max(0, Math.min(1, Number(args.maxErrorRate) || 0.02));
  return args;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function botName(index) {
  return `bot${String(index).padStart(5, '0')}`;
}

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (_) {
      json = { raw: text.slice(0, 500) };
    }
    return {
      ok: response.ok,
      status: response.status,
      data: json,
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error?.name || 'RequestFailed', message: error?.message || String(error || '') },
      durationMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function loginBot(args, username) {
  const response = await fetchJson(`${args.baseUrl}/api/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: args.password }),
  }, args.timeoutMs);
  return {
    username,
    ok: response.ok && Boolean(response.data?.token),
    token: response.data?.token || '',
    status: response.status,
    durationMs: response.durationMs,
    error: response.data?.error || response.data?.message || '',
  };
}

async function heartbeat(args, bot, round) {
  const response = await fetchJson(`${args.baseUrl}/api/game/heartbeat`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bot.token}`,
      'X-Client-Request-ID': `bot-${bot.username}-round-${round}`,
    },
  }, args.timeoutMs);
  return {
    username: bot.username,
    round,
    ok: response.ok,
    status: response.status,
    durationMs: response.durationMs,
    error: response.data?.error || response.data?.message || '',
  };
}

function summarize(label, results) {
  const durations = results.map((item) => item.durationMs).filter((value) => Number.isFinite(value));
  const failures = results.filter((item) => !item.ok);
  return {
    label,
    count: results.length,
    success: results.length - failures.length,
    failures: failures.length,
    errorRate: results.length ? Math.round((failures.length / results.length) * 10000) / 10000 : 0,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: durations.length ? Math.max(...durations) : 0,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.password) {
    console.error('[bot-loadtest] BOT password is required via --password or BOT_ACCOUNT_PASSWORD');
    process.exit(2);
  }
  const bots = Array.from({ length: args.botCount }, (_, index) => botName(index + 1));
  console.log('[bot-loadtest] config', {
    baseUrl: args.baseUrl,
    botCount: args.botCount,
    concurrency: args.concurrency,
    rounds: args.rounds,
    targetUtilization: args.targetUtilization,
    maxP95Ms: args.maxP95Ms,
    maxErrorRate: args.maxErrorRate,
  });

  const logins = await runPool(bots, args.concurrency, (username) => loginBot(args, username));
  const loginSummary = summarize('login', logins);
  console.log('[bot-loadtest] login summary', loginSummary);
  const readyBots = logins.filter((item) => item.ok);
  if (!readyBots.length) {
    console.error('[bot-loadtest] no bots logged in');
    process.exit(1);
  }

  const heartbeatResults = [];
  for (let round = 1; round <= args.rounds; round += 1) {
    const roundResults = await runPool(readyBots, args.concurrency, (bot) => heartbeat(args, bot, round));
    heartbeatResults.push(...roundResults);
    console.log('[bot-loadtest] heartbeat round', round, summarize(`heartbeat-${round}`, roundResults));
  }
  const heartbeatSummary = summarize('heartbeat', heartbeatResults);
  const reachedUtilization = readyBots.length >= Math.floor(args.botCount * args.targetUtilization);
  const passed = reachedUtilization
    && heartbeatSummary.errorRate <= args.maxErrorRate
    && heartbeatSummary.p95Ms <= args.maxP95Ms;
  const finalSummary = {
    schema: 'bot-heartbeat-loadtest-summary-v1',
    passed,
    reachedUtilization,
    targetBotCount: args.botCount,
    readyBotCount: readyBots.length,
    login: loginSummary,
    heartbeat: heartbeatSummary,
    thresholds: {
      targetUtilization: args.targetUtilization,
      maxP95Ms: args.maxP95Ms,
      maxErrorRate: args.maxErrorRate,
    },
  };
  console.log('[bot-loadtest] final summary', JSON.stringify(finalSummary, null, 2));
  if (!passed) process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[bot-loadtest] fatal', error);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  summarize,
};

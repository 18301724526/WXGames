'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const gameApiPath = path.join(repoRoot, 'frontend', 'js', 'api', 'GameAPI.js');
const senderPath = path.join(repoRoot, 'frontend', 'js', 'api', 'ClientCommandSender.js');
const indexPath = path.join(repoRoot, 'frontend', 'index.html');
const { FRONTEND_WRITE_HELPERS } = require('./command-owner-step1/inventories');

function extractClassMethods(source = '') {
  const lines = String(source).split(/\r?\n/);
  const methods = new Map();
  const starts = lines
    .map((line, index) => ({
      index,
      match: line.match(/^\s{4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/),
    }))
    .filter(({ match }) => match);
  starts.forEach(({ index, match }, position) => {
    const end = starts[position + 1]?.index ?? lines.length;
    methods.set(match[1], {
      name: match[1],
      line: index + 1,
      body: lines.slice(index, end).join('\n'),
    });
  });
  return methods;
}

function inspectCoverage(options = {}) {
  const gameApiSource = String(options.gameApiSource || '');
  const senderSource = String(options.senderSource || '');
  const indexSource = String(options.indexSource || '');
  const helpers = options.helpers || [];
  const methods = extractClassMethods(gameApiSource);
  const violations = [];

  helpers.forEach(({ helper }) => {
    const method = methods.get(helper);
    if (!method) {
      violations.push(`GameAPI.${helper} is missing`);
      return;
    }
    const usesSender = /\bthis\.(?:submitCommand|submitDiagnosticCommand)\(\s*['"]/.test(method.body);
    if (!usesSender) violations.push(`GameAPI.${helper} does not enter ClientCommandSender`);
    if (/\bthis\.request\(\s*['"]POST['"]|\bmethod:\s*['"]POST['"]/.test(method.body)) {
      violations.push(`GameAPI.${helper} performs a direct POST`);
    }
  });

  methods.forEach((method) => {
    if (!/\bthis\.request\(\s*['"]POST['"]|\bmethod:\s*['"]POST['"]/.test(method.body)) return;
    if (method.name !== 'sendCommandEnvelope') {
      violations.push(`GameAPI.${method.name} owns a POST outside the sender transport bridge`);
    }
  });

  const bridge = methods.get('sendCommandEnvelope')?.body || '';
  const request = methods.get('request')?.body || '';
  if (!/senderToken:\s*COMMAND_SENDER_REQUEST/.test(bridge)) {
    violations.push('GameAPI sender transport bridge does not carry its private token');
  }
  if (!/options\.senderToken\s*!==\s*COMMAND_SENDER_REQUEST/.test(request)) {
    violations.push('GameAPI.request does not reject write bypasses');
  }
  if (!/class\s+ClientCommandSender\b/.test(senderSource)
      || !/\bsubmit\(type,\s*payload\s*=\s*\{\},\s*options\s*=\s*\{\}\)/.test(senderSource)) {
    violations.push('ClientCommandSender.submit(type, payload, options) is missing');
  }
  if (!/inFlightByKey/.test(senderSource) || !/finally\(\(\)\s*=>/.test(senderSource)) {
    violations.push('ClientCommandSender does not expose structural in-flight release evidence');
  }

  const senderScript = 'js/api/ClientCommandSender.js';
  const gameApiScript = 'js/api/GameAPI.js';
  const senderIndex = indexSource.indexOf(senderScript);
  const gameApiIndex = indexSource.indexOf(gameApiScript);
  if (senderIndex < 0 || gameApiIndex < 0 || senderIndex > gameApiIndex) {
    violations.push('ClientCommandSender must load before GameAPI in frontend/index.html');
  }

  return { methods, violations };
}

function runCheck(options = {}) {
  return inspectCoverage({
    gameApiSource: options.gameApiSource ?? fs.readFileSync(gameApiPath, 'utf8'),
    senderSource: options.senderSource ?? fs.readFileSync(senderPath, 'utf8'),
    indexSource: options.indexSource ?? fs.readFileSync(indexPath, 'utf8'),
    helpers: options.helpers || FRONTEND_WRITE_HELPERS,
  });
}

function main() {
  const result = runCheck();
  console.log('[client-command-sender-coverage] blocking gate');
  console.log(`write helpers: ${FRONTEND_WRITE_HELPERS.length}`);
  console.log(`violations: ${result.violations.length}`);
  result.violations.forEach((violation) => console.error(`- ${violation}`));
  if (result.violations.length > 0) process.exit(1);
  console.log('passed');
}

if (require.main === module) main();

module.exports = {
  extractClassMethods,
  inspectCoverage,
  runCheck,
};

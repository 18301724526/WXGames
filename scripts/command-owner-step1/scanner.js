'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WRITE_HELPER_NAMES = Object.freeze([
  'build',
  'upgrade',
  'assignJob',
  'applyTalentPolicy',
  'saveTalentPolicy',
  'deleteTalentPolicy',
  'research',
  'seekFamousPerson',
  'acceptFamousPerson',
  'dismissFamousPersonCandidate',
  'assignFamousAttributePoint',
  'setArmyFormation',
  'veteranCampWithdraw',
  'veteranCampUpgrade',
  'advanceEra',
  'claimTaskReward',
  'claimEvent',
  'resolveCapture',
  'startWorldMarch',
  'returnWorldMarch',
  'stopWorldMarch',
  'startWorldCombat',
  'resolveWorldCombat',
  'startConquest',
  'claimConquest',
  'renameCity',
  'renamePolity',
  'switchCity',
  'advanceTutorial',
  'heartbeat',
  'reportClientEvent',
  'uploadClientOperationLog',
]);

const WRITE_SIGNAL_PATTERN = /\b(?:repository\.(?:save|resetPlayerState)|withPlayerStateLock|authService\.(?:loginPlayer|resetPlayer)|opsControlService\.(?:setMaintenanceState|appendAudit|restartService)|configReleaseService\.(?:publishRelease|rollbackRelease)|observabilityService\.recordClientEvent|logService\.logClientOperationSnapshot|buildBuildingCommandHandler\.execute|TaskCenterService\.claimTask|executeGameActionRequest|recordWorldMarchClientReport|WorldCombatSessionService\.(?:openSession|resolveSession)|fs\.(?:writeFileSync|appendFileSync)|(?:writeFileSync|appendFileSync)\s*\()/;

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const DIRECT_SUBMIT_IGNORE = /(?:^|\/)(?:api\/GameAPI\.js|.*\.test\.js)$/;
const SOURCE_IGNORE_DIRS = new Set(['.git', '.codegraph', 'node_modules', 'tmp']);
const API_RECEIVER_ACCESSOR_PATTERN = /\b(?:api|getApi|getGameApi)\b/;

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function toPosixRelative(repoRoot, filePath) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function lineAt(text, lineNumber) {
  return String(text || '').split(/\r?\n/)[Math.max(0, lineNumber - 1)] || '';
}

function collectJsFiles(rootDir) {
  const result = [];
  if (!fs.existsSync(rootDir)) return result;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (SOURCE_IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) result.push(fullPath);
    }
  }
  return result.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)));
}

function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractCallText(text, openParenIndex) {
  const end = findMatching(text, openParenIndex, '(', ')');
  if (end < 0) return text.slice(openParenIndex);
  let stop = end + 1;
  while (text[stop] === ';' || /\s/.test(text[stop] || '')) {
    if (text[stop] === '\n') break;
    stop += 1;
  }
  return text.slice(openParenIndex, stop);
}

function extractNamedFunctionBody(text, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`function\\s+${escapedName}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`, 'g'),
    new RegExp(`(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s*)?[^=;]+=>\\s*\\{`, 'g'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const openBrace = text.indexOf('{', match.index);
    const closeBrace = findMatching(text, openBrace, '{', '}');
    if (closeBrace > openBrace) return text.slice(openBrace, closeBrace + 1);
  }
  return '';
}

function routeWrites(callText, fileText) {
  if (WRITE_SIGNAL_PATTERN.test(callText)) return true;
  const handlerNames = Array.from(callText.matchAll(/\b([A-Za-z_$][\w$]*)\b/g))
    .map((match) => match[1])
    .filter((name) => !ROUTE_METHODS.has(name) && !['app', 'authMiddleware', 'adminMiddleware', 'handlers', 'req', 'res'].includes(name));
  for (const handlerName of handlerNames) {
    const body = extractNamedFunctionBody(fileText, handlerName);
    if (body && WRITE_SIGNAL_PATTERN.test(body)) return true;
  }
  return false;
}

function classifyServerRoute(route, file, callText) {
  if (route === '/api/game/action') return 'game-action-write-route';
  if (route === '/api/game/tasks/claim') return 'game-task-write-route';
  if (route === '/api/game/heartbeat') return 'heartbeat-write-route';
  if (route.includes('/admin/ops/')) return 'ops-write-route';
  if (route.includes('/config-releases/publish')) return 'config-publish-write-route';
  if (route.includes('/config-releases/rollback')) return 'config-rollback-write-route';
  if (route === '/api/player/login') return 'auth-player-write-route';
  if (route === '/api/player/reset') return 'player-reset-write-route';
  if (route === '/api/client-events') return 'diagnostic-write-route';
  if (route === '/api/client-operation-logs') return 'diagnostic-write-route';
  if (route === '/api/buildings/build') return 'legacy-build-write-route';
  return WRITE_SIGNAL_PATTERN.test(callText) ? 'write-route' : 'route';
}

function scanServerWriteRoutes(repoRoot) {
  const routesDir = path.join(repoRoot, 'backend', 'routes');
  const findings = [];
  for (const filePath of collectJsFiles(routesDir)) {
    const fileText = readText(filePath);
    const relativeFile = toPosixRelative(repoRoot, filePath);
    const routePattern = /\bapp\.(get|post|put|patch|delete)\s*\(/g;
    let match;
    while ((match = routePattern.exec(fileText))) {
      const method = match[1].toUpperCase();
      const openParen = fileText.indexOf('(', match.index);
      const callText = extractCallText(fileText, openParen);
      const routeMatch = callText.match(/['"`]([^'"`]+)['"`]/);
      if (!routeMatch) continue;
      const route = routeMatch[1];
      if (!routeWrites(callText, fileText)) continue;
      const line = lineNumberAt(fileText, match.index);
      findings.push({
        key: `${method} ${route}`,
        route,
        method,
        file: relativeFile,
        line,
        evidence: [`${relativeFile}:${line}`],
        classification: classifyServerRoute(route, relativeFile, callText),
        summary: `${method} ${route}`,
      });
    }
  }

  const workerPath = path.join(repoRoot, 'backend', 'world-worker.js');
  if (fileExists(workerPath)) {
    const workerText = readText(workerPath);
    const workerServicePath = path.join(repoRoot, 'backend', 'services', 'realtime', 'WorldWorkerService.js');
    const workerServiceText = fileExists(workerServicePath) ? readText(workerServicePath) : '';
    if (/\bWorldWorkerService\b/.test(workerText)
      && /(?:repository\.save|upsert[A-Za-z]*\s*\(|advance|tick)/.test(workerServiceText)) {
      findings.push({
        key: 'BACKGROUND backend/world-worker.js',
        route: 'backend/world-worker.js',
        method: 'BACKGROUND',
        file: 'backend/world-worker.js',
        line: 1,
        evidence: ['backend/world-worker.js:1'],
        classification: 'background-worker-write',
        summary: 'BACKGROUND backend/world-worker.js',
      });
    }
  }
  return findings.sort((a, b) => a.key.localeCompare(b.key));
}

function extractStringArray(text, constantName) {
  const pattern = new RegExp(`const\\s+${constantName}\\s*=\\s*new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`);
  const match = pattern.exec(text);
  if (!match) return [];
  return Array.from(match[1].matchAll(/['"]([^'"]+)['"]/g)).map((item) => item[1]);
}

function scanGameActions(repoRoot) {
  const actions = [];
  const registryPath = path.join(repoRoot, 'backend', 'actions', 'GameActionRegistry.js');
  if (fileExists(registryPath)) {
    const text = readText(registryPath);
    const relativeFile = toPosixRelative(repoRoot, registryPath);
    const territoryActions = extractStringArray(text, 'TERRITORY_ACTIONS');
    const registerPattern = /\bregister\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = registerPattern.exec(text))) {
      const action = match[1];
      actions.push({
        action,
        routeEntry: 'server:game-action-registry',
        sourceKind: 'registry-action',
        file: relativeFile,
        line: lineNumberAt(text, match.index),
        evidence: [`${relativeFile}:${lineNumberAt(text, match.index)}`],
      });
    }
    const forLoopIndex = text.indexOf('for (const action of TERRITORY_ACTIONS)');
    for (const action of territoryActions) {
      actions.push({
        action,
        routeEntry: 'server:game-action-registry',
        sourceKind: 'registry-territory-action',
        file: relativeFile,
        line: forLoopIndex >= 0 ? lineNumberAt(text, forLoopIndex) : 1,
        evidence: [`${relativeFile}:${forLoopIndex >= 0 ? lineNumberAt(text, forLoopIndex) : 1}`],
      });
    }
  }

  const routesPath = path.join(repoRoot, 'backend', 'routes', 'gameRoutes.js');
  if (fileExists(routesPath)) {
    const text = readText(routesPath);
    const relativeFile = toPosixRelative(repoRoot, routesPath);
    const worldCombatActions = extractStringArray(text, 'WORLD_COMBAT_ACTIONS');
    const worldCombatIndex = text.indexOf('WORLD_COMBAT_ACTIONS');
    for (const action of worldCombatActions) {
      actions.push({
        action,
        routeEntry: 'server:game-action-world-combat-bypass',
        sourceKind: 'route-bypass-action',
        file: relativeFile,
        line: worldCombatIndex >= 0 ? lineNumberAt(text, worldCombatIndex) : 1,
        evidence: [`${relativeFile}:${worldCombatIndex >= 0 ? lineNumberAt(text, worldCombatIndex) : 1}`],
      });
    }
    const claimIndex = text.indexOf("app.post('/api/game/tasks/claim'");
    if (claimIndex >= 0) {
      actions.push({
        action: 'claimTaskReward',
        routeEntry: 'server:game-tasks-claim',
        sourceKind: 'route-only-action',
        file: relativeFile,
        line: lineNumberAt(text, claimIndex),
        evidence: [`${relativeFile}:${lineNumberAt(text, claimIndex)}`],
      });
    }
  }

  const byKey = new Map();
  for (const action of actions) byKey.set(`${action.routeEntry}:${action.action}`, action);
  return Array.from(byKey.values()).sort((a, b) => `${a.action}:${a.routeEntry}`.localeCompare(`${b.action}:${b.routeEntry}`));
}

function scanGameApiWriteHelpers(repoRoot) {
  const filePath = path.join(repoRoot, 'frontend', 'js', 'api', 'GameAPI.js');
  if (!fileExists(filePath)) return [];
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  const relativeFile = toPosixRelative(repoRoot, filePath);
  const methods = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^\s{4}(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    if (!match) continue;
    let depth = 0;
    let end = index;
    for (; end < lines.length; end += 1) {
      const current = lines[end];
      depth += (current.match(/\{/g) || []).length;
      depth -= (current.match(/\}/g) || []).length;
      if (end > index && depth <= 0) break;
      if (end === index && depth <= 0) break;
    }
    const body = lines.slice(index, end + 1).join('\n');
    if (!/\b(?:this\.request\(\s*['"]POST['"]|method:\s*['"]POST['"])/.test(body)) continue;
    const requestMatch = body.match(/this\.request\(\s*['"]POST['"]\s*,\s*['"]([^'"]+)['"]/);
    const pathMatch = requestMatch || body.match(/\bpath:\s*['"]([^'"]+)['"]/);
    const endpoint = requestMatch ? requestMatch[1] : normalizeGameApiEndpoint(pathMatch?.[1] || '');
    const actionMatch = body.match(/\baction:\s*['"]([^'"]+)['"]/);
    methods.push({
      helper: match[1],
      endpoint,
      commandType: actionMatch ? actionMatch[1] : inferGameApiCommandType(match[1], endpoint),
      file: relativeFile,
      line: index + 1,
      evidence: [`${relativeFile}:${index + 1}`],
      classification: endpoint.startsWith('/client-') ? 'diagnostic-write-helper' : 'gameapi-write-helper',
      summary: `GameAPI.${match[1]} -> ${endpoint || 'unknown endpoint'}`,
    });
    index = end;
  }
  return methods.sort((a, b) => a.helper.localeCompare(b.helper));
}

function normalizeGameApiEndpoint(endpoint) {
  if (!endpoint) return '';
  return endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint;
}

function inferGameApiCommandType(helper, endpoint) {
  if (endpoint === '/game/tasks/claim') return 'claimTaskReward';
  if (endpoint === '/game/heartbeat') return 'heartbeatMarchSettlement|worldMarchClientReportIngest';
  if (endpoint === '/client-events') return 'clientEventIngest';
  if (endpoint === '/client-operation-logs') return 'clientOperationLogIngest';
  return helper;
}

function discoverApiAliases(text) {
  const aliases = new Set(['api']);
  const declarationPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  let match;
  while ((match = declarationPattern.exec(text))) {
    if (API_RECEIVER_ACCESSOR_PATTERN.test(match[2])) aliases.add(match[1]);
  }
  return aliases;
}

function buildDirectSubmitCallSiteKey(call) {
  return `${normalizePath(call.file)}:${call.line}:${call.helper}`;
}

function scanFrontendDirectSubmits(repoRoot, options = {}) {
  const frontendRoot = path.join(repoRoot, 'frontend', 'js');
  const helperNames = Array.from(new Set([
    ...DEFAULT_WRITE_HELPER_NAMES,
    ...(options.helperNames || []),
  ])).sort((a, b) => b.length - a.length);
  const helperPattern = helperNames.map((helper) => helper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  if (!helperPattern) return [];
  const results = [];
  for (const filePath of collectJsFiles(frontendRoot)) {
    const relativeFile = toPosixRelative(repoRoot, filePath);
    if (DIRECT_SUBMIT_IGNORE.test(relativeFile)) continue;
    const text = readText(filePath);
    const aliases = Array.from(discoverApiAliases(text))
      .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const receiverPattern = [
      'this\\.host\\.api',
      'this\\.core\\.host\\.api',
      'this\\.api',
      'host\\.api',
      'game\\.api',
      'this\\.getApi\\(\\)',
      'getApi\\(\\)',
      'this\\.getGameApi\\(\\)',
      'getGameApi\\(\\)',
      ...aliases,
    ].join('|');
    const callPattern = new RegExp(`(?:${receiverPattern})\\s*(?:\\?\\.|\\.)\\s*(${helperPattern})\\s*\\(`, 'g');
    let match;
    while ((match = callPattern.exec(text))) {
      const helper = match[1];
      const line = lineNumberAt(text, match.index);
      const call = {
        helper,
        commandType: helper,
        file: relativeFile,
        line,
        callSiteKey: `${relativeFile}:${line}:${helper}`,
        evidence: [`${relativeFile}:${line}`],
        sourceLine: lineAt(text, line).trim(),
        classification: 'direct-submit-call-site',
        submissionClassification: inferDirectSubmitSubmissionClassification(relativeFile),
        migrationTarget: inferDirectSubmitMigrationTarget(relativeFile),
      };
      if (helper === 'assignJob') call.commandType = 'assign';
      if (helper === 'advanceTutorial') call.commandType = 'tutorialAdvance';
      results.push(call);
    }
  }
  return results.sort((a, b) => buildDirectSubmitCallSiteKey(a).localeCompare(buildDirectSubmitCallSiteKey(b)));
}

function inferDirectSubmitSubmissionClassification(file) {
  if (file.includes('/platform/CanvasGameApp.js')) return 'compatibility-direct-submit';
  if (file.includes('/platform/GameCommandService.js')) return 'compatibility-direct-submit';
  if (file.includes('/services/')) return 'compatibility-direct-submit';
  return 'controller-direct-submit';
}

function inferDirectSubmitMigrationTarget(file) {
  if (file.includes('/controllers/')) return 'ClientCommandSender via controller action adapter';
  if (file.includes('/platform/WorldMarchActionHandler.js')) return 'ClientCommandSender world-march adapter';
  if (file.includes('/platform/GameCommandService.js')) return 'ClientCommandSender game-command service adapter';
  if (file.includes('/platform/CanvasGameApp.js')) return 'ClientCommandSender CanvasGameApp facade';
  if (file.includes('/services/')) return 'ClientCommandSender service bridge';
  if (file.includes('/tutorial/')) return 'ClientCommandSender tutorial adapter';
  return 'ClientCommandSender frontend command adapter';
}

function scanDisabledProducers(repoRoot) {
  const roots = [
    path.join(repoRoot, 'frontend', 'js', 'platform', 'renderers'),
    path.join(repoRoot, 'frontend', 'js', 'state'),
  ];
  const producers = [];
  for (const root of roots) {
    for (const filePath of collectJsFiles(root)) {
      const relativeFile = toPosixRelative(repoRoot, filePath);
      if (/\.test\.js$/.test(relativeFile)) continue;
      const text = readText(filePath);
      const lines = text.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (!/\bdisabled\s*:/.test(lines[index])) continue;
        const windowText = lines.slice(Math.max(0, index - 8), Math.min(lines.length, index + 9)).join('\n');
        if (!/\baddHitTarget\s*\(/.test(windowText) && !/\baction\s*:/.test(windowText) && !/\btype\s*:/.test(windowText)) continue;
        const typeMatch = windowText.match(/\btype:\s*['"]([^'"]+)['"]/);
        producers.push({
          file: relativeFile,
          line: index + 1,
          actionType: typeMatch ? typeMatch[1] : 'unknown',
          signal: 'disabled',
          evidence: [`${relativeFile}:${index + 1}`],
          sourceLine: lines[index].trim(),
        });
      }
    }
  }
  const byKey = new Map();
  for (const producer of producers) byKey.set(`${producer.file}:${producer.line}:${producer.actionType}`, producer);
  return Array.from(byKey.values()).sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`));
}

function scanDisabledConsumers(repoRoot) {
  const files = [
    'frontend/js/platform/CanvasActionDispatcher.js',
    'frontend/js/platform/CanvasActionController.js',
    'frontend/js/platform/CanvasPanelActionRunner.js',
    'frontend/js/platform/WorldMarchActionHandler.js',
  ];
  const consumers = [];
  for (const relativeFile of files) {
    const filePath = path.join(repoRoot, relativeFile);
    if (!fileExists(filePath)) continue;
    const text = readText(filePath);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!/\baction(?:\?\.)?\.disabled\b/.test(line)) return;
      consumers.push({
        file: normalizePath(relativeFile),
        line: index + 1,
        signal: 'action.disabled',
        evidence: [`${normalizePath(relativeFile)}:${index + 1}`],
        sourceLine: line.trim(),
      });
    });
  }
  return consumers;
}

function chooseDisabledConsumer(producer, consumers) {
  const marchTypes = new Set([
    'startWorldMarch',
    'returnWorldMarch',
    'stopWorldMarch',
    'launchExpedition',
    'chooseWorldTarget',
    'selectWorldActor',
  ]);
  const worldMarchConsumer = consumers.find((item) => item.file.endsWith('/WorldMarchActionHandler.js'));
  const controllerConsumer = consumers.find((item) => item.file.endsWith('/CanvasActionController.js'));
  const dispatcherConsumer = consumers.find((item) => item.file.endsWith('/CanvasActionDispatcher.js'));
  const panelConsumer = consumers.find((item) => item.file.endsWith('/CanvasPanelActionRunner.js'));
  if (marchTypes.has(producer.actionType) && worldMarchConsumer) return worldMarchConsumer;
  if (producer.file.includes('/renderers/') && dispatcherConsumer) return dispatcherConsumer;
  if (producer.file.includes('/presenters/') && controllerConsumer) return controllerConsumer;
  return controllerConsumer || dispatcherConsumer || panelConsumer || consumers[0] || null;
}

function scanDisabledCommandFlows(repoRoot) {
  const producers = scanDisabledProducers(repoRoot);
  const consumers = scanDisabledConsumers(repoRoot);
  return producers.map((producer) => {
    const consumer = chooseDisabledConsumer(producer, consumers);
    return {
      producer,
      consumer,
      classification: 'domain-blocker-flow-observed',
      evidence: [
        ...(producer.evidence || []),
        ...(consumer?.evidence || []),
      ],
      summary: consumer
        ? `${producer.file}:${producer.line} ${producer.actionType} disabled -> ${consumer.file}:${consumer.line} ${consumer.signal}`
        : `${producer.file}:${producer.line} ${producer.actionType} disabled -> missing consumer`,
    };
  });
}

function scanRepository(repoRoot = process.cwd(), options = {}) {
  const root = path.resolve(repoRoot);
  const gameApiWriteHelpers = scanGameApiWriteHelpers(root);
  return {
    repoRoot: root,
    serverWriteRoutes: scanServerWriteRoutes(root),
    gameActions: scanGameActions(root),
    gameApiWriteHelpers,
    frontendDirectSubmits: scanFrontendDirectSubmits(root, {
      helperNames: gameApiWriteHelpers.map((helper) => helper.helper),
      ...options,
    }),
    disabledCommandFlows: scanDisabledCommandFlows(root),
  };
}

module.exports = {
  DEFAULT_WRITE_HELPER_NAMES,
  buildDirectSubmitCallSiteKey,
  scanDisabledCommandFlows,
  scanFrontendDirectSubmits,
  scanGameActions,
  scanGameApiWriteHelpers,
  scanRepository,
  scanServerWriteRoutes,
};

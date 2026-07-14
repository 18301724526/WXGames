#!/usr/bin/env node
'use strict';

const { readText, splitLines } = require('./step4-debt-catalog/source-utils');

const FILES = Object.freeze({
  semantics: 'frontend/js/platform/ClientCommandSemantics.js',
  dispatcher: 'frontend/js/platform/CanvasActionDispatcher.js',
  controller: 'frontend/js/platform/CanvasActionController.js',
  shell: 'frontend/js/platform/CanvasGameShell.js',
  app: 'frontend/js/platform/CanvasGameApp.js',
  commandService: 'frontend/js/platform/GameCommandService.js',
  gameApi: 'frontend/js/api/GameAPI.js',
});

const REQUIRED_COMMAND_ACTION_TYPES = Object.freeze([
  'acceptFamousPerson',
  'advanceEra',
  'assignFamousAttributePoint',
  'assignJob',
  'autoReplenishArmyFormation',
  'buildBuilding',
  'claimConquest',
  'claimEvent',
  'claimTaskReward',
  'conquer',
  'dismissFamousPersonCandidate',
  'entityBattleAuto',
  'entityBattleMaster',
  'entityBattleOrder',
  'entityBattleSkill',
  'launchExpedition',
  'research',
  'resolveCapture',
  'saveArmyFormation',
  'seekFamousPerson',
  'startWorldMarch',
  'stopWorldMarch',
  'submitNaming',
  'upgradeBuilding',
  'veteranCampUpgrade',
  'veteranCampWithdraw',
]);

const COMMAND_CLICK_TARGET_METHODS = Object.freeze([
  { file: FILES.controller, method: 'handle_research', label: 'tech research command target' },
  { file: FILES.commandService, method: 'handleBuildingAction', label: 'building command target' },
  { file: FILES.controller, method: 'handle_acceptFamousPerson', label: 'famous accept command target' },
  { file: FILES.controller, method: 'handle_dismissFamousPersonCandidate', label: 'famous dismiss command target' },
  { file: FILES.controller, method: 'handle_claimConquest', label: 'territory claim command target' },
  { file: FILES.controller, method: 'handle_startWorldMarch', label: 'world march command target' },
  { file: FILES.shell, method: 'startWorldMarch', label: 'world march shell forwarder' },
]);

const GAME_API_COMMAND_HELPERS = Object.freeze([
  'build',
  'upgrade',
  'research',
  'advanceEra',
  'acceptFamousPerson',
  'dismissFamousPersonCandidate',
  'startWorldMarch',
  'claimConquest',
]);

const DOMAIN_BLOCK_PATTERN = /\b(canResearch|disabled|visualDisabled|cost|unlocked|maxLevel|candidate(?:Available|Availability)?|claimable|ready|passab(?:le|ility)|busy|cooldown|eligible|locked|resources?)\b/i;
const EARLY_BLOCK_PATTERN = /\breturn\b|throw\s+new|disabled\s*=|commandDisabled\s*:|type\s*:\s*['"]open|type\s*:\s*['"]close/;

function parseArgs(argv) {
  const options = { json: false };
  for (const arg of argv) {
    if (arg === '--json') options.json = true;
    else if (arg === '--blocking') options.blocking = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readSource(repoRoot, sources, file) {
  return Object.prototype.hasOwnProperty.call(sources, file)
    ? sources[file]
    : readText(repoRoot, file);
}

function lineOf(source, index) {
  return source.slice(0, Math.max(0, index)).split(/\r?\n/).length;
}

function extractMethodSource(source, methodName) {
  const pattern = new RegExp(`\\b${methodName}\\s*\\([^)]*\\)\\s*\\{`);
  const match = pattern.exec(source);
  if (!match) return null;
  const start = match.index;
  let index = match.index + match[0].length - 1;
  let depth = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return {
          source: source.slice(start, index + 1),
          startLine: lineOf(source, start),
        };
      }
    }
    index += 1;
  }
  return null;
}

function parseCommandActionTypes(source) {
  const match = /COMMAND_ACTION_TYPES\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\)/.exec(source);
  if (!match) return new Set();
  const values = new Set();
  const literalPattern = /['"]([^'"]+)['"]/g;
  let literal = literalPattern.exec(match[1]);
  while (literal) {
    values.add(literal[1]);
    literal = literalPattern.exec(match[1]);
  }
  return values;
}

function pushViolation(violations, file, line, kind, message, evidence = '') {
  violations.push({ file, line, kind, message, evidence });
}

function inspectNormalizeBeforeDisabled(violations, file, methodSource, methodName) {
  if (!methodSource) {
    pushViolation(violations, file, 1, 'missing-method', `${methodName} method is missing`);
    return;
  }
  const normalizeIndex = methodSource.source.indexOf('normalizeAction');
  const disabledIndex = methodSource.source.search(/\b(?:action|normalizedAction)\.disabled\b/);
  if (normalizeIndex < 0) {
    pushViolation(violations, file, methodSource.startLine, 'missing-normalize-action', `${methodName} does not call ClientCommandSemantics.normalizeAction`);
  }
  if (disabledIndex >= 0 && (normalizeIndex < 0 || disabledIndex < normalizeIndex)) {
    pushViolation(
      violations,
      file,
      methodSource.startLine + lineOf(methodSource.source, disabledIndex) - 1,
      'disabled-before-normalize',
      `${methodName} checks disabled before normalizeAction`,
    );
  }
  const lines = splitLines(methodSource.source);
  lines.forEach((line, index) => {
    if (/^\s*\/\//.test(line)) return;
    if (/\bif\s*\([^)]*\baction\.disabled\b[^)]*\)/.test(line)) {
      pushViolation(
        violations,
        file,
        methodSource.startLine + index,
        'command-disabled-early-return',
        `${methodName} reintroduced action.disabled command-submit guard`,
        line.trim(),
      );
    }
    if (/\bif\s*\([^)]*\bvisualDisabled\b[^)]*\)/.test(line)) {
      pushViolation(
        violations,
        file,
        methodSource.startLine + index,
        'visual-disabled-command-guard',
        `${methodName} consumes visualDisabled as command-submit guard`,
        line.trim(),
      );
    }
  });
}

function inspectCommandActionTypes(violations, source) {
  const actual = parseCommandActionTypes(source);
  if (actual.size === 0) {
    pushViolation(violations, FILES.semantics, 1, 'missing-command-action-types', 'COMMAND_ACTION_TYPES cannot be parsed');
    return;
  }
  REQUIRED_COMMAND_ACTION_TYPES.forEach((type) => {
    if (!actual.has(type)) {
      pushViolation(
        violations,
        FILES.semantics,
        1,
        'missing-command-action-type',
        `COMMAND_ACTION_TYPES is missing command action ${type}`,
        type,
      );
    }
  });
}

function inspectAdvanceEra(violations, source) {
  const method = extractMethodSource(source, 'advanceEra');
  if (!method) {
    pushViolation(violations, FILES.app, 1, 'missing-advance-era', 'CanvasGameApp.advanceEra is missing');
    return;
  }
  const apiCallIndex = method.source.indexOf('getGameApi().advanceEra');
  if (apiCallIndex < 0) {
    pushViolation(violations, FILES.app, method.startLine, 'missing-advance-era-api-call', 'advanceEra does not call GameAPI.advanceEra');
  }
  const guardIndex = method.source.search(/canAdvanceEraNow\s*\(/);
  if (guardIndex >= 0 && (apiCallIndex < 0 || guardIndex < apiCallIndex)) {
    pushViolation(
      violations,
      FILES.app,
      method.startLine + lineOf(method.source, guardIndex) - 1,
      'advance-era-local-guard',
      'advanceEra consumes canAdvanceEraNow before GameAPI.advanceEra',
    );
  }
}

function inspectDomainBlocksInMethod(violations, source, file, methodName, label) {
  const method = extractMethodSource(source, methodName);
  if (!method) {
    pushViolation(violations, file, 1, 'missing-command-target-method', `${methodName} is missing`);
    return;
  }
  splitLines(method.source).forEach((line, index) => {
    if (/^\s*\/\//.test(line)) return;
    if (!DOMAIN_BLOCK_PATTERN.test(line) || !EARLY_BLOCK_PATTERN.test(line)) return;
    pushViolation(
      violations,
      file,
      method.startLine + index,
      'domain-command-target-block',
      `${label} contains a domain-state command-submit blocker`,
      line.trim(),
    );
  });
}

function inspectGameApiHelpers(violations, source) {
  GAME_API_COMMAND_HELPERS.forEach((methodName) => {
    const method = extractMethodSource(source, methodName);
    if (!method) {
      pushViolation(violations, FILES.gameApi, 1, 'missing-gameapi-helper', `GameAPI.${methodName} is missing`);
      return;
    }
    if (!method.source.includes('submitCommand')) {
      pushViolation(violations, FILES.gameApi, method.startLine, 'gameapi-helper-not-command', `GameAPI.${methodName} does not call submitCommand`);
    }
    inspectDomainBlocksInMethod(violations, source, FILES.gameApi, methodName, `GameAPI.${methodName}`);
  });
}

function inspectFrontendCommandSemantics({
  repoRoot = process.cwd(),
  sources = {},
} = {}) {
  const violations = [];
  const semantics = readSource(repoRoot, sources, FILES.semantics);
  const dispatcher = readSource(repoRoot, sources, FILES.dispatcher);
  const controller = readSource(repoRoot, sources, FILES.controller);
  const shell = readSource(repoRoot, sources, FILES.shell);
  const app = readSource(repoRoot, sources, FILES.app);
  const commandService = readSource(repoRoot, sources, FILES.commandService);
  const gameApi = readSource(repoRoot, sources, FILES.gameApi);

  inspectCommandActionTypes(violations, semantics);
  inspectNormalizeBeforeDisabled(violations, FILES.dispatcher, extractMethodSource(dispatcher, 'handle'), 'CanvasActionDispatcher.handle');
  inspectNormalizeBeforeDisabled(violations, FILES.controller, extractMethodSource(controller, 'handle'), 'CanvasActionController.handle');
  inspectAdvanceEra(violations, app);
  COMMAND_CLICK_TARGET_METHODS.forEach((target) => {
    const source = target.file === FILES.shell
      ? shell
      : target.file === FILES.commandService
        ? commandService
        : controller;
    inspectDomainBlocksInMethod(violations, source, target.file, target.method, target.label);
  });
  inspectGameApiHelpers(violations, gameApi);

  return {
    summary: {
      requiredCommandActions: REQUIRED_COMMAND_ACTION_TYPES.length,
      checkedCommandTargets: COMMAND_CLICK_TARGET_METHODS.length,
      checkedGameApiHelpers: GAME_API_COMMAND_HELPERS.length,
      totalViolations: violations.length,
    },
    violations,
  };
}

function renderText(report) {
  const lines = [
    '[frontend-command-semantics] command submit/display separation gate',
    `required command actions: ${report.summary.requiredCommandActions}`,
    `checked command targets: ${report.summary.checkedCommandTargets}`,
    `checked GameAPI helpers: ${report.summary.checkedGameApiHelpers}`,
    `violations: ${report.summary.totalViolations}`,
  ];
  report.violations.forEach((finding) => {
    lines.push(`  ${finding.file}:${finding.line} ${finding.kind} ${finding.message}${finding.evidence ? `: ${finding.evidence}` : ''}`);
  });
  lines.push(report.summary.totalViolations === 0 ? 'passed' : 'FAILED');
  return lines.join('\n');
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = inspectFrontendCommandSemantics();
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(`${renderText(report)}\n`);
    process.exit(report.summary.totalViolations === 0 ? 0 : 1);
  } catch (error) {
    process.stderr.write(`[frontend-command-semantics] failed: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  COMMAND_CLICK_TARGET_METHODS,
  FILES,
  GAME_API_COMMAND_HELPERS,
  REQUIRED_COMMAND_ACTION_TYPES,
  extractMethodSource,
  inspectFrontendCommandSemantics,
  parseArgs,
  parseCommandActionTypes,
  renderText,
};

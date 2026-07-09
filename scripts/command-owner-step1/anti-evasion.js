'use strict';

const REQUIRED_ALLOWLIST_FIELDS = Object.freeze([
  'inventoryId',
  'owner',
  'reason',
  'retirementCondition',
  'growthPreventionTest',
]);

const FIXTURES = Object.freeze([
  {
    id: 'scanner-rename-command-submit',
    contracts: ['COP-ALLOWLIST-001', 'COP-CLIENT-002'],
    fakePassPrevented: 'renaming api/request helpers to avoid submit scanner vocabulary',
    sample: 'const sendViaRenamedFacade = () => getGameApi().claimConquest(territoryId);',
    expect: ['direct-submit'],
  },
  {
    id: 'allowlist-growth-missing-metadata',
    contracts: ['COP-ALLOWLIST-001'],
    fakePassPrevented: 'allowlist entries without owner/reason/retirement/growth test',
    sample: { inventoryId: 'frontend:fake' },
    expect: ['allowlist-metadata-missing'],
  },
  {
    id: 'fallback-id-fake-compliance',
    contracts: ['COP-IDEMP-001', 'COP-ENVELOPE-001'],
    fakePassPrevented: 'server requestId/timestamp/random fallback being counted as real idempotency',
    sample: 'const commandId = body.commandId || `cmd-${requestId}`; const idempotencyKey = commandId;',
    expect: ['server-fallback-id'],
  },
  {
    id: 'frontend-direct-submit-bypass',
    contracts: ['COP-CLIENT-002', 'COP-ENTRY-001'],
    fakePassPrevented: 'controller/panel/game-body direct write submit bypassing future sender inventory',
    sample: 'return this.host.api.claimConquest(action.territoryId);',
    expect: ['direct-submit'],
  },
  {
    id: 'frontend-direct-submit-aliased-receiver',
    contracts: ['COP-CLIENT-002', 'COP-ENTRY-001'],
    fakePassPrevented: 'renaming the GameAPI receiver before direct submit detection',
    sample: 'const svc = this.host.api; return svc.claimConquest(action.territoryId);',
    expect: ['direct-submit'],
  },
  {
    id: 'frontend-direct-submit-accessor-receiver',
    contracts: ['COP-CLIENT-002', 'COP-ENTRY-001'],
    fakePassPrevented: 'using a getApi accessor receiver to bypass direct submit detection',
    sample: 'return this.getApi().research(techId);',
    expect: ['direct-submit'],
  },
  {
    id: 'payload-shape-reclassification',
    contracts: ['COP-CLIENT-001', 'COP-AUTHORITY-001'],
    fakePassPrevented: 'domain blocker relabeled as PAYLOAD_SHAPE or UI_NOT_READY',
    sample: "if (!canResearch) return { blocked: true, reason: 'PAYLOAD_SHAPE' };",
    expect: ['domain-as-payload-shape'],
  },
  {
    id: 'helper-wrapper-fake-pipeline',
    contracts: ['COP-ROUTE-001', 'COP-ALLOWLIST-001'],
    fakePassPrevented: 'route orchestration hidden in helper named pipeline/service/adapter/runner',
    sample: 'return legacyCommandPipeline(() => { const state = repository.findByPlayerId(id); repository.save(state); });',
    expect: ['helper-wrapped-orchestration'],
  },
  {
    id: 'missing-shared-target-player-fallback',
    contracts: ['COP-OWNER-002', 'COP-SHARED-001'],
    fakePassPrevented: 'missing territory/encounter/loot/boss ids falling back to player owner',
    sample: "const ownerKey = payload.territoryId ? `territory:${payload.territoryId}` : `player:${playerId}`;",
    expect: ['shared-owner-player-fallback'],
  },
  {
    id: 'owner-lookup-after-domain',
    contracts: ['COP-OWNER-001', 'COP-OWNER-002'],
    fakePassPrevented: 'domain handler execution required before shared owner is known',
    sample: 'const result = TerritoryAction.execute(action, state, body); const ownerKey = result.territoryId;',
    expect: ['owner-after-domain'],
  },
  {
    id: 'handler-helper-lock-save',
    contracts: ['COP-HANDLER-001', 'COP-LOCK-001'],
    fakePassPrevented: 'handler moves lock/save into a helper and claims the handler is clean',
    sample: 'function persistInsideHandler() { return repository.withPlayerStateLock(playerId, () => repository.save(state)); }',
    expect: ['handler-lock-save'],
  },
]);

function classifyFixtureSample(sample) {
  if (sample && typeof sample === 'object') {
    const missingFields = REQUIRED_ALLOWLIST_FIELDS.filter((field) => !sample[field]);
    return missingFields.length ? ['allowlist-metadata-missing'] : [];
  }

  const text = String(sample || '');
  const hits = [];
  const apiAliases = new Set(['api']);
  const aliasPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  let aliasMatch;
  while ((aliasMatch = aliasPattern.exec(text))) {
    if (/\b(?:api|getApi|getGameApi)\b/.test(aliasMatch[2])) apiAliases.add(aliasMatch[1]);
  }
  const aliasReceivers = Array.from(apiAliases)
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const directSubmitPattern = new RegExp(`\\b(?:getApi\\(\\)|this\\.getApi\\(\\)|getGameApi\\(\\)|this\\.getGameApi\\(\\)|host\\.api|this\\.host\\.api|${aliasReceivers})\\s*(?:\\?\\.|\\.)\\s*[A-Za-z_$][\\w$]*\\s*\\(`);
  if (directSubmitPattern.test(text)) {
    hits.push('direct-submit');
  }
  if (/\bcmd-\$\{requestId\}|Date\.now\(|Math\.random\(|fallback|idempotencyKey\s*=\s*commandId/.test(text)) {
    hits.push('server-fallback-id');
  }
  if (/\b(?:canResearch|canAdvance|cooldown|candidate|territory|resources?)\b[\s\S]*\b(?:PAYLOAD_SHAPE|UI_NOT_READY)\b/i.test(text)) {
    hits.push('domain-as-payload-shape');
  }
  if (/\b[A-Za-z_$][\w$]*(?:Pipeline|Service|Adapter|Runner)\b[\s\S]*(?:findByPlayerId|repository\.save|getClientGameState|buildGameView)/i.test(text)
    || /\b(?:pipeline|service|adapter|runner)\b[\s\S]*(?:findByPlayerId|repository\.save|getClientGameState|buildGameView)/i.test(text)) {
    hits.push('helper-wrapped-orchestration');
  }
  if (/\b(?:territory|encounter|loot|boss)Id\b[\s\S]*`player:\$\{playerId\}`/.test(text)) {
    hits.push('shared-owner-player-fallback');
  }
  if (/\b(?:TerritoryAction|WorldCombatSessionService|handler)\.[A-Za-z_$][\w$]*\s*\([\s\S]*\bownerKey\s*=/.test(text)) {
    hits.push('owner-after-domain');
  }
  if (/\bwithPlayerStateLock\b[\s\S]*\brepository\.save\b|\brepository\.save\b[\s\S]*\bwithPlayerStateLock\b/.test(text)) {
    hits.push('handler-lock-save');
  }
  return Array.from(new Set(hits));
}

function runAntiEvasionFixtures(fixtures = FIXTURES) {
  return fixtures.map((fixture) => {
    const actual = classifyFixtureSample(fixture.sample);
    const missing = fixture.expect.filter((expected) => !actual.includes(expected));
    return {
      ...fixture,
      actual,
      passed: missing.length === 0,
      missing,
    };
  });
}

function assertAntiEvasionFixtures(fixtures = FIXTURES) {
  const results = runAntiEvasionFixtures(fixtures);
  const failed = results.filter((result) => !result.passed);
  if (failed.length > 0) {
    const labels = failed.map((result) => `${result.id}: missing ${result.missing.join(', ')}`);
    throw new Error(`anti-evasion fixture failure: ${labels.join('; ')}`);
  }
  return results;
}

module.exports = {
  FIXTURES,
  REQUIRED_ALLOWLIST_FIELDS,
  assertAntiEvasionFixtures,
  classifyFixtureSample,
  runAntiEvasionFixtures,
};

const { toNumber } = require('../../../shared/numberUtils');
const {
  createInternalCommandEnvelope,
  summarizeCommand,
} = require('../../application/commands/CommandEnvelope');
const { inspectCommandOwners } = require('../../application/commands/CommandOwnerResolver');
const { requireOwnerContext } = require('../../application/commands/CommandOwnerContext');

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_ACTIVE_LIMIT = 25;
const DEFAULT_SLOW_TICK_MS = 1500;
const DEFAULT_SOCIAL_MEET_PAIRS = 3;

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Math.floor(toNumber(value, fallback));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(number, max);
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value)))).sort();
}

function diplomacyPairId(fromFactionId, toFactionId) {
  return uniqueSorted([fromFactionId, toFactionId]).join('--');
}

function stageByIdentity(list, mutation, identityOf) {
  const identity = identityOf(mutation);
  const index = list.findIndex((item) => identityOf(item) === identity);
  if (index >= 0) list[index] = mutation;
  else list.push(mutation);
}

class WorldWorkerService {
  constructor(options = {}) {
    this.repository = options.repository;
    this.gameStateService = options.gameStateService || {};
    this.cityService = options.cityService || {};
    this.territoryService = options.territoryService || {};
    this.eventService = options.eventService || {};
    this.worldPeopleRepo = options.worldPeopleRepo || null;
    this.worldPeopleRegistryService = options.worldPeopleRegistryService || {};
    this.worldSocialTickService = options.worldSocialTickService || {};
    this.factionRegistryService = options.factionRegistryService || {};
    this.worldDiplomacyTickService = options.worldDiplomacyTickService || {};
    this.factionDiplomacyService = options.factionDiplomacyService || {};
    this.commandExecutionPipeline = options.commandExecutionPipeline || null;
    this.getSocialTickOptions = typeof options.getSocialTickOptions === 'function'
      ? options.getSocialTickOptions
      : () => ({});
    this.now = options.now || (() => new Date());
    this.monotonicNow = options.monotonicNow || (() => Date.now());
    this.intervalMs = positiveInteger(options.intervalMs, DEFAULT_INTERVAL_MS);
    this.activeWindowMs = positiveInteger(options.activeWindowMs, DEFAULT_ACTIVE_WINDOW_MS);
    this.activeLimit = positiveInteger(options.activeLimit, DEFAULT_ACTIVE_LIMIT, 1000);
    this.slowTickMs = positiveInteger(options.slowTickMs, DEFAULT_SLOW_TICK_MS);
    this.commandEntryReporter = typeof options.commandEntryReporter === 'function'
      ? options.commandEntryReporter
      : null;
    this.running = false;
    this.timer = null;
    this.lastSummary = null;
  }

  collectSocialTickPeople(gameStates, sharedPeople = null) {
    const peopleById = new Map();
    const ownerById = new Map();
    const states = Array.isArray(gameStates) ? gameStates : [];
    for (const state of states) {
      const playerId = state?.playerId || '';
      const roster = typeof this.worldPeopleRegistryService.materializePlayerRoster === 'function'
        ? this.worldPeopleRegistryService.materializePlayerRoster(state)
        : (Array.isArray(state?.famousPeople) ? state.famousPeople : []);
      for (const person of roster) {
        if (!person?.id || peopleById.has(person.id)) continue;
        peopleById.set(person.id, person);
        ownerById.set(person.id, { type: 'player', playerId });
      }
    }
    const shared = Array.isArray(sharedPeople)
      ? sharedPeople
      : (this.worldPeopleRepo && typeof this.worldPeopleRepo.getAllPeople === 'function'
        ? this.worldPeopleRepo.getAllPeople()
        : []);
    for (const person of shared) {
      if (!person?.id || peopleById.has(person.id)) continue;
      peopleById.set(person.id, person);
      ownerById.set(person.id, { type: 'shared' });
    }
    return { people: [...peopleById.values()], ownerById };
  }

  applySocialUpdates(gameStates, socialResult, ownership) {
    const updatedById = new Map((socialResult?.people || []).filter((p) => p?.id).map((p) => [p.id, p]));
    const rosterPatchesByPlayer = new Map();
    const sharedPeople = [];
    for (const [personId, owner] of ownership.ownerById.entries()) {
      const updated = updatedById.get(personId);
      if (!updated) continue;
      if (owner.type === 'shared') {
        sharedPeople.push(updated);
      } else if (owner.type === 'player') {
        if (!rosterPatchesByPlayer.has(owner.playerId)) rosterPatchesByPlayer.set(owner.playerId, new Map());
        rosterPatchesByPlayer.get(owner.playerId).set(personId, updated);
      }
    }
    for (const state of (Array.isArray(gameStates) ? gameStates : [])) {
      this.applyRosterPatch(state, rosterPatchesByPlayer.get(state?.playerId || ''));
    }
    return { rosterPatchesByPlayer, sharedPeople };
  }

  applyRosterPatch(gameState, patch) {
    if (!gameState || !patch || patch.size === 0 || !Array.isArray(gameState.famousPeople)) return gameState;
    gameState.famousPeople = gameState.famousPeople.map((person) => {
      const updated = patch.get(person?.id);
      return updated ? { ...person, ...updated } : person;
    });
    return gameState;
  }

  collectAliveFactionIds(gameStates) {
    const ids = new Set();
    const states = Array.isArray(gameStates) ? gameStates : [];
    for (const state of states) {
      if (typeof this.factionRegistryService.getAliveFactions !== 'function') continue;
      for (const faction of this.factionRegistryService.getAliveFactions(state)) {
        if (faction?.id) ids.add(faction.id);
      }
    }
    return [...ids];
  }

  advanceSharedWorldState(gameStates, now) {
    const summary = {
      socialPeople: 0,
      socialMeets: 0,
      socialCrossings: 0,
      diplomacyPairs: 0,
      peopleById: new Map(),
    };
    const states = Array.isArray(gameStates) ? gameStates : [];
    if (!states.length) return summary;
    const ownership = this.collectSocialTickPeople(states);
    summary.peopleById = new Map(ownership.people.filter((p) => p?.id).map((p) => [p.id, p]));
    if (ownership.people.length > 1 && typeof this.worldSocialTickService.advanceRelationships === 'function') {
      const playerIds = uniqueSorted(states.map((state) => state?.playerId));
      const personIds = uniqueSorted(
        [...ownership.ownerById.entries()]
          .filter(([, owner]) => owner?.type === 'shared')
          .map(([personId]) => personId),
      );
      const socialResult = this.executeSocialTick(playerIds, personIds, now);
      const counts = socialResult.counts || {};
      summary.socialPeople = Number(counts.people ?? socialResult.people?.length ?? 0);
      summary.socialMeets = Number(counts.meets ?? socialResult.meets?.length ?? 0);
      summary.socialCrossings = Number(counts.crossings ?? socialResult.crossings?.length ?? 0);
      summary.peopleById = new Map(
        (Array.isArray(socialResult.people) ? socialResult.people : [])
          .filter((person) => person?.id)
          .map((person) => [person.id, person]),
      );
    }

    if (typeof this.worldDiplomacyTickService.driftContext === 'function') {
      const factionIds = this.collectAliveFactionIds(states);
      if (factionIds.length > 1) {
        const rulerOf = (factionId) => {
          for (const state of states) {
            const faction = this.factionRegistryService.getFaction?.(factionId, state);
            const rulerId = faction?.rulerPersonId;
            if (rulerId && summary.peopleById.has(rulerId)) return summary.peopleById.get(rulerId);
          }
          return null;
        };
        for (let i = 0; i < factionIds.length; i += 1) {
          for (let j = i + 1; j < factionIds.length; j += 1) {
            const fromFactionId = factionIds[i];
            const toFactionId = factionIds[j];
            const context = this.worldDiplomacyTickService.driftContext(
              fromFactionId,
              toFactionId,
              {
                factionIds,
                rulerOf,
                bordering: () => false,
              },
            );
            this.executeDiplomacyTick(fromFactionId, toFactionId, context, now);
            summary.diplomacyPairs += 1;
          }
        }
      }
    }
    return summary;
  }

  getNow() {
    const now = this.now();
    return now instanceof Date ? now : new Date(now);
  }

  getRecentlyActive(now) {
    if (!this.repository || typeof this.repository.findRecentlyActive !== 'function') return [];
    const activeSince = new Date(now.getTime() - this.activeWindowMs).toISOString();
    return this.repository.findRecentlyActive(activeSince, this.activeLimit);
  }

  reportCommandEntry(envelope) {
    const ownerResolution = inspectCommandOwners(envelope);
    const report = {
      schema: 'command-entry-report-v1',
      mode: 'blocking',
      inventoryId: 'worker:world-worker-runtime-writes',
      envelope,
      command: summarizeCommand(envelope),
      idempotencyClassification: envelope.compatibility.idempotencyClassification,
      ownerResolution,
      recordedAt: new Date().toISOString(),
    };
    this.commandEntryReporter?.(report);
    return report;
  }

  executeInternalCommand(type, playerId, payload, suffix, definition, now, options = {}) {
    if (!this.commandExecutionPipeline?.execute) {
      const error = new Error('WorldWorkerService requires CommandExecutionPipeline');
      error.code = 'WORLD_WORKER_COMMAND_PIPELINE_REQUIRED';
      throw error;
    }
    const tickId = now.getTime();
    const commandId = `cmd-world-worker-${type}-${suffix}-${tickId}`;
    const envelope = createInternalCommandEnvelope({
      type,
      playerId,
      commandId,
      idempotencyKey: commandId,
      requestId: commandId,
      inventoryId: 'worker:world-worker-runtime-writes',
      payload,
    });
    this.reportCommandEntry(envelope);
    return this.commandExecutionPipeline.execute(envelope, definition, {
      scope: `world-worker:${type}`,
      lockOptions: {
        waitMs: 0,
        ttlMs: Math.max(this.intervalMs * 4, 30 * 1000),
      },
      maxRevisionRetries: options.maxRevisionRetries ?? 1,
    });
  }

  requireCommandSuccess(response = {}) {
    if (response.statusCode >= 200
        && response.statusCode < 300
        && response.payload?.success !== false) {
      return response;
    }
    const error = new Error(response.payload?.message || 'World worker command failed');
    error.code = response.payload?.error || 'WORLD_WORKER_COMMAND_FAILED';
    error.status = response.statusCode || 500;
    error.retryable = Boolean(response.payload?.retryable);
    throw error;
  }

  collectPlayerEncounterIds(gameState = {}) {
    const ids = [];
    for (const mission of (Array.isArray(gameState.exploreMissions) ? gameState.exploreMissions : [])) {
      if (mission?.combat?.encounterId) ids.push(mission.combat.encounterId);
    }
    if (gameState.worldCombat?.session?.encounterId) {
      ids.push(gameState.worldCombat.session.encounterId);
    }
    return uniqueSorted(ids);
  }

  stageEncounter(context, encounter, now) {
    if (!encounter?.id) return;
    const ownerKey = `encounter:${encounter.id}`;
    if (!context.ownerResolution?.ownerKeys?.includes(ownerKey)) {
      const error = new Error(`World worker did not lock ${ownerKey}`);
      error.code = 'WORLD_WORKER_ENCOUNTER_OWNER_NOT_LOCKED';
      throw error;
    }
    context.sharedMutations.encounters = Array.isArray(context.sharedMutations.encounters)
      ? context.sharedMutations.encounters
      : [];
    stageByIdentity(
      context.sharedMutations.encounters,
      { encounter, now: toIso(now) },
      (mutation) => (mutation?.encounter || mutation)?.id || '',
    );
  }

  advanceState(rawState, now, options = {}) {
    const projection = options.projection || {};
    const advanced = typeof this.gameStateService.advanceRuntimeState === 'function'
      ? this.gameStateService.advanceRuntimeState(rawState, now, {
        advanceWorldAi: false,
        marchVerification: { enabled: true },
        planningContext: projection,
        worldEncounterRepo: this.repository?.worldEncounterRepo,
        sharedWorldEncounters: projection.sharedWorldEncounters,
        stageEncounter: options.stageEncounter,
      })
      : rawState;
    if (typeof this.cityService.advanceAllCities === 'function') {
      this.cityService.advanceAllCities(advanced, Math.floor(this.intervalMs / 1000));
    }
    this.territoryService.updateMissionReadiness?.(advanced);
    this.eventService.cleanupRuntimeState?.(advanced);
    this.eventService.maybeGenerateRegularEvent?.(advanced);
    this.eventService.maybeGenerateThreatEvent?.(advanced);
    advanced.updatedAt = now.toISOString();
    return advanced;
  }

  createPlayerTickDefinition(now, initialState = null) {
    return {
      load: (context) => {
        const projection = this.repository?.getClientProjectionForPlayer?.(
          context.envelope.playerId,
        ) || {};
        context.application = { projection };
        if (typeof this.repository?.findByPlayerId === 'function') {
          return this.repository.findByPlayerId(context.envelope.playerId) || null;
        }
        return initialState;
      },
      validate: (context) => {
        requireOwnerContext(context.ownerResolution);
        return { success: true };
      },
      execute: (context) => {
        requireOwnerContext(context.ownerResolution);
        context.state = this.advanceState(context.state, now, {
          projection: context.application.projection,
          stageEncounter: (encounter, mutationNow) => this.stageEncounter(
            context,
            encounter,
            mutationNow || now,
          ),
        });
        return { success: true, changed: true, playerId: context.envelope.playerId };
      },
      persistence: { strategy: 'save' },
      project: (context) => context.execution,
      respond: (context) => ({ statusCode: 200, payload: context.projection }),
    };
  }

  createSocialTickDefinition() {
    return {
      allowMissingState: true,
      load: (context) => {
        const payload = context.envelope.payload || {};
        const playerIds = uniqueSorted(payload.playerIds);
        const personIds = uniqueSorted(payload.personIds);
        const playerStates = playerIds
          .map((playerId) => this.repository?.findByPlayerId?.(playerId) || null)
          .filter(Boolean);
        const peopleRepo = this.worldPeopleRepo || this.repository?.worldPeopleRepo || null;
        let sharedPeople = [];
        if (peopleRepo && typeof peopleRepo.getPerson === 'function') {
          sharedPeople = personIds.map((personId) => peopleRepo.getPerson(personId)).filter(Boolean);
        } else if (peopleRepo && typeof peopleRepo.getAllPeople === 'function') {
          const requested = new Set(personIds);
          sharedPeople = peopleRepo.getAllPeople().filter((person) => requested.has(String(person?.id || '')));
        }
        context.application = { playerIds, personIds, playerStates, sharedPeople };
        return null;
      },
      validate: (context) => {
        requireOwnerContext(context.ownerResolution);
        const payload = context.envelope.payload || {};
        const playerIds = uniqueSorted(payload.playerIds);
        const personIds = uniqueSorted(payload.personIds);
        const expectedOwnerKeys = uniqueSorted([
          'world-social:global',
          ...playerIds.map((playerId) => `player:${playerId}`),
          ...personIds.map((personId) => `person:${personId}`),
        ]);
        const actualOwnerKeys = uniqueSorted(context.ownerResolution.ownerKeys);
        const validNow = Number.isFinite(Date.parse(payload.now));
        if ((!playerIds.length && !personIds.length)
            || !validNow
            || context.ownerResolution.ownerKey !== 'world-social:global'
            || JSON.stringify(actualOwnerKeys) !== JSON.stringify(expectedOwnerKeys)) {
          return {
            success: false,
            statusCode: 400,
            error: 'WORLD_WORKER_SOCIAL_OWNER_MISMATCH',
            message: 'World social batch does not match its owner keys',
          };
        }
        if (typeof this.worldSocialTickService.advanceRelationships !== 'function') {
          return {
            success: false,
            statusCode: 500,
            error: 'WORLD_WORKER_SOCIAL_TICK_REQUIRED',
            message: 'World social tick service is unavailable',
          };
        }
        return { success: true };
      },
      execute: (context) => {
        requireOwnerContext(context.ownerResolution);
        const payload = context.envelope.payload;
        const now = new Date(payload.now);
        const ownership = this.collectSocialTickPeople(
          context.application.playerStates,
          context.application.sharedPeople,
        );
        if (ownership.people.length <= 1) {
          return {
            success: true,
            changed: false,
            people: ownership.people,
            counts: { people: ownership.people.length, meets: 0, crossings: 0 },
            meets: [],
            crossings: [],
          };
        }
        const socialOptions = this.getSocialTickOptions(now) || {};
        const socialResult = this.worldSocialTickService.advanceRelationships(ownership.people, {
          meetPairs: socialOptions.meetPairs ?? DEFAULT_SOCIAL_MEET_PAIRS,
          nowMs: now.getTime(),
          prng: socialOptions.prng,
          natures: socialOptions.natures,
          personalityTuning: socialOptions.personalityTuning,
          relTuning: socialOptions.relTuning,
          decay: socialOptions.decay,
        });
        const socialUpdates = this.applySocialUpdates(
          context.application.playerStates,
          socialResult,
          ownership,
        );
        context.sharedMutations.playerStates = context.application.playerStates
          .filter((state) => socialUpdates.rosterPatchesByPlayer.has(String(state?.playerId || '')))
          .map((state) => ({ state, expectedRevision: state.revision }));
        context.sharedMutations.people = socialUpdates.sharedPeople.map((person) => ({
          person,
          now: payload.now,
        }));
        const people = Array.isArray(socialResult.people) ? socialResult.people : [];
        const meets = Array.isArray(socialResult.meets) ? socialResult.meets : [];
        const crossings = Array.isArray(socialResult.crossings) ? socialResult.crossings : [];
        return {
          success: true,
          changed: context.sharedMutations.playerStates.length > 0
            || context.sharedMutations.people.length > 0,
          people,
          counts: { people: people.length, meets: meets.length, crossings: crossings.length },
          meets,
          crossings,
        };
      },
      persistence: { strategy: 'shared-only' },
      project: (context) => context.execution,
      respond: (context) => ({ statusCode: 200, payload: context.projection }),
    };
  }

  createDiplomacyTickDefinition() {
    return {
      allowMissingState: true,
      load: () => null,
      validate: (context) => {
        requireOwnerContext(context.ownerResolution);
        const payload = context.envelope.payload || {};
        const pairId = diplomacyPairId(payload.fromFactionId, payload.toFactionId);
        if (!payload.fromFactionId || !payload.toFactionId || payload.pairId !== pairId
            || context.ownerResolution.ownerKey !== `diplomacy:${pairId}`) {
          return {
            success: false,
            statusCode: 400,
            error: 'WORLD_WORKER_DIPLOMACY_OWNER_MISMATCH',
            message: 'Diplomacy pair does not match its owner key',
          };
        }
        if (typeof this.factionDiplomacyService.planAdvanceEdge !== 'function') {
          return {
            success: false,
            statusCode: 500,
            error: 'WORLD_WORKER_DIPLOMACY_PLANNER_REQUIRED',
            message: 'Diplomacy planner is unavailable',
          };
        }
        return { success: true };
      },
      execute: (context) => {
        requireOwnerContext(context.ownerResolution);
        const payload = context.envelope.payload;
        const plan = this.factionDiplomacyService.planAdvanceEdge(
          payload.fromFactionId,
          payload.toFactionId,
          payload.context,
          payload.context,
          payload.now,
        );
        context.sharedMutations.diplomacyEdges = [plan.forward, plan.reverse];
        return { success: true, changed: true, pairId: payload.pairId };
      },
      persistence: { strategy: 'shared-only' },
      project: (context) => context.execution,
      respond: (context) => ({ statusCode: 200, payload: context.projection }),
    };
  }

  executeSocialTick(playerIds, personIds, now) {
    const response = this.executeInternalCommand(
      'worldWorkerPersonUpdate',
      'system:world-worker',
      {
        playerIds: uniqueSorted(playerIds),
        personIds: uniqueSorted(personIds),
        now: now.toISOString(),
      },
      'global',
      this.createSocialTickDefinition(),
      now,
    );
    return this.requireCommandSuccess(response).payload;
  }

  executeDiplomacyTick(fromFactionId, toFactionId, context, now) {
    const pairId = diplomacyPairId(fromFactionId, toFactionId);
    const response = this.executeInternalCommand(
      'worldWorkerDiplomacyTick',
      'system:world-worker',
      { pairId, fromFactionId, toFactionId, context, now: now.toISOString() },
      pairId,
      this.createDiplomacyTickDefinition(),
      now,
    );
    return this.requireCommandSuccess(response);
  }

  // ACTIVE players (the ones watching their march move) are exactly the ones whose API
  // writes race this worker. The old flow advanced a snapshot taken before the loop and
  // dropped the player on a revision conflict — under steady client traffic every tick
  // conflicted and marches starved forever. Re-read the LATEST revision per player and
  // retry the advance on conflict; a player hot enough to win every retry just waits for
  // the next tick (5s), which only delays a march, never starves it.
  advancePlayerWithRetry(playerId, now, attempts = 3, initialState = null) {
    const candidate = initialState || (
      playerId && typeof this.repository?.findByPlayerId === 'function'
        ? this.repository.findByPlayerId(playerId)
        : null
    );
    if (!candidate) return { advanced: false, reason: 'missing-state' };
    const response = this.executeInternalCommand(
      'worldWorkerPlayerTick',
      playerId,
      {
        encounterIds: this.collectPlayerEncounterIds(candidate),
        now: now.toISOString(),
      },
      playerId,
      this.createPlayerTickDefinition(now, candidate),
      now,
      { maxRevisionRetries: Math.max(0, attempts - 1) },
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return { advanced: true, attempts: (response.trace?.retryAttempt || 0) + 1 };
    }
    if (response.payload?.error === 'PLAYER_STATE_BUSY'
        || response.payload?.error === 'OWNER_BUSY') {
      return { advanced: false, reason: 'player-state-locked' };
    }
    if (response.payload?.error === 'GAME_STATE_NOT_FOUND') {
      return { advanced: false, reason: 'missing-state' };
    }
    return this.requireCommandSuccess(response);
  }

  tickOnce() {
    if (this.running) {
      return {
        schema: 'world-worker-tick-summary-v1',
        skipped: true,
        reason: 'already-running',
        processedCount: 0,
        generatedAt: toIso(this.getNow()),
      };
    }
    this.running = true;
    const startedAtMs = this.monotonicNow();
    const now = this.getNow();
    const commandEntry = {
      schema: 'world-worker-command-batch-v1',
      mode: 'blocking',
      inventoryId: 'worker:world-worker-runtime-writes',
      idempotencyClassification: 'internal-idempotent',
      commandTypes: [
        'worldWorkerPlayerTick',
        'worldWorkerPersonUpdate',
        'worldWorkerDiplomacyTick',
      ],
      ownerResolution: { status: 'split' },
    };
    const errors = [];
    let processedCount = 0;
    let shared = {
      socialPeople: 0,
      socialMeets: 0,
      socialCrossings: 0,
      diplomacyPairs: 0,
    };
    try {
      const gameStates = this.getRecentlyActive(now);
      try {
        shared = this.advanceSharedWorldState(gameStates, now);
      } catch (error) {
        errors.push({
          playerId: '',
          message: error?.message || String(error || ''),
        });
      }
      for (const rawState of gameStates) {
        try {
          const playerId = rawState?.playerId || '';
          const result = this.advancePlayerWithRetry(playerId, now, 3, rawState);
          if (result.advanced) processedCount += 1;
        } catch (error) {
          errors.push({
            playerId: rawState?.playerId || '',
            message: error?.message || String(error || ''),
          });
        }
      }
    } finally {
      this.running = false;
    }
    const durationMs = Math.max(0, this.monotonicNow() - startedAtMs);
    const summary = {
      schema: 'world-worker-tick-summary-v1',
      generatedAt: now.toISOString(),
      intervalMs: this.intervalMs,
      activeWindowMs: this.activeWindowMs,
      activeLimit: this.activeLimit,
      commandEntry,
      processedCount,
      errorCount: errors.length,
      errors,
      shared: {
        socialPeople: shared.socialPeople,
        socialMeets: shared.socialMeets,
        socialCrossings: shared.socialCrossings,
        diplomacyPairs: shared.diplomacyPairs,
      },
      durationMs,
      slow: durationMs >= this.slowTickMs,
    };
    this.lastSummary = summary;
    return summary;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      const summary = this.tickOnce();
      if (summary.skipped) return;
      if (summary.errorCount || summary.slow) {
        const method = summary.errorCount ? 'error' : 'warn';
        console[method]('[world-worker] tick summary', summary);
      }
    }, this.intervalMs);
    return this.timer;
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  getStatus() {
    return {
      schema: 'world-worker-status-v1',
      running: this.running,
      intervalMs: this.intervalMs,
      activeWindowMs: this.activeWindowMs,
      activeLimit: this.activeLimit,
      lastSummary: this.lastSummary,
    };
  }
}

module.exports = WorldWorkerService;

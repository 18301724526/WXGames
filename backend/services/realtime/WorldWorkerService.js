const { toNumber } = require('../../../shared/numberUtils');
const { prepareCommandEntry } = require('../../application/commands/CommandEntryContext');

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

  collectSocialTickPeople(gameStates) {
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
    const shared = this.worldPeopleRepo && typeof this.worldPeopleRepo.getAllPeople === 'function'
      ? this.worldPeopleRepo.getAllPeople()
      : [];
    for (const person of shared) {
      if (!person?.id || peopleById.has(person.id)) continue;
      peopleById.set(person.id, person);
      ownerById.set(person.id, { type: 'shared' });
    }
    return { people: [...peopleById.values()], ownerById };
  }

  applySocialUpdates(gameStates, socialResult, ownership, now) {
    const updatedById = new Map((socialResult?.people || []).filter((p) => p?.id).map((p) => [p.id, p]));
    const rosterPatchesByPlayer = new Map();
    for (const [personId, owner] of ownership.ownerById.entries()) {
      const updated = updatedById.get(personId);
      if (!updated) continue;
      if (owner.type === 'shared') {
        if (this.worldPeopleRepo && typeof this.worldPeopleRepo.upsertPerson === 'function') {
          this.worldPeopleRepo.upsertPerson(updated, now.toISOString());
        }
      } else if (owner.type === 'player') {
        if (!rosterPatchesByPlayer.has(owner.playerId)) rosterPatchesByPlayer.set(owner.playerId, new Map());
        rosterPatchesByPlayer.get(owner.playerId).set(personId, updated);
      }
    }
    for (const state of (Array.isArray(gameStates) ? gameStates : [])) {
      this.applyRosterPatch(state, rosterPatchesByPlayer.get(state?.playerId || ''));
    }
    return rosterPatchesByPlayer;
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
      rosterPatchesByPlayer: new Map(),
      peopleById: new Map(),
    };
    const states = Array.isArray(gameStates) ? gameStates : [];
    if (!states.length) return summary;
    const ownership = this.collectSocialTickPeople(states);
    summary.peopleById = new Map(ownership.people.filter((p) => p?.id).map((p) => [p.id, p]));
    if (ownership.people.length > 1 && typeof this.worldSocialTickService.advanceRelationships === 'function') {
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
      summary.socialPeople = socialResult.people.length;
      summary.socialMeets = socialResult.meets.length;
      summary.socialCrossings = socialResult.crossings.length;
      summary.rosterPatchesByPlayer = this.applySocialUpdates(states, socialResult, ownership, now);
      summary.peopleById = new Map((socialResult.people || []).filter((p) => p?.id).map((p) => [p.id, p]));
    }

    if (typeof this.worldDiplomacyTickService.advanceAll === 'function') {
      const factionIds = this.collectAliveFactionIds(states);
      if (factionIds.length > 1) {
        summary.diplomacyPairs = this.worldDiplomacyTickService.advanceAll({
          factionIds,
          now: now.toISOString(),
          rulerOf: (factionId) => {
            for (const state of states) {
              const faction = this.factionRegistryService.getFaction?.(factionId, state);
              const rulerId = faction?.rulerPersonId;
              if (rulerId && summary.peopleById.has(rulerId)) return summary.peopleById.get(rulerId);
            }
            return null;
          },
          bordering: () => false,
        });
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

  prepareRuntimeCommandEntry() {
    const entry = prepareCommandEntry({
      body: {},
      method: 'BACKGROUND',
      path: 'backend/world-worker.js',
      headers: {},
    }, {
      type: 'worldWorkerRuntimeTick',
      inventoryId: 'worker:world-worker-runtime-writes',
      route: 'backend/world-worker.js',
      method: 'BACKGROUND',
      reporter: this.commandEntryReporter,
    });
    return {
      mode: entry.report.mode,
      inventoryId: entry.report.inventoryId,
      idempotencyClassification: entry.report.idempotencyClassification,
      ownerResolution: entry.report.ownerResolution,
    };
  }

  advanceState(rawState, now) {
    const projection = this.repository?.getClientProjectionForPlayer?.(rawState?.playerId) || {};
    const advanced = typeof this.gameStateService.advanceRuntimeState === 'function'
      ? this.gameStateService.advanceRuntimeState(rawState, now, {
        advanceWorldAi: false,
        marchVerification: { enabled: true },
        planningContext: projection,
        worldEncounterRepo: this.repository?.worldEncounterRepo,
        sharedWorldEncounters: projection.sharedWorldEncounters,
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
    if (typeof this.repository?.save === 'function') this.repository.save(advanced);
    return advanced;
  }

  // ACTIVE players (the ones watching their march move) are exactly the ones whose API
  // writes race this worker. The old flow advanced a snapshot taken before the loop and
  // dropped the player on a revision conflict — under steady client traffic every tick
  // conflicted and marches starved forever. Re-read the LATEST revision per player and
  // retry the advance on conflict; a player hot enough to win every retry just waits for
  // the next tick (5s), which only delays a march, never starves it.
  advancePlayerWithRetry(playerId, now, attempts = 3, initialState = null, rosterPatch = null) {
    const runAdvance = () => {
      let candidate = initialState;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const fresh = playerId && typeof this.repository?.findByPlayerId === 'function'
          ? this.repository.findByPlayerId(playerId)
          : null;
        if (fresh) candidate = fresh;
        if (!candidate) return { advanced: false, reason: 'missing-state' };
        this.applyRosterPatch(candidate, rosterPatch);
        try {
          this.advanceState(candidate, now);
          return { advanced: true, attempts: attempt };
        } catch (error) {
          if (error?.code !== 'GAME_STATE_REVISION_CONFLICT' || attempt === attempts) {
            throw error;
          }
          candidate = null;
        }
      }
      return { advanced: false, reason: 'conflict-exhausted' };
    };
    if (playerId && typeof this.repository?.withPlayerStateLock === 'function') {
      return this.repository.withPlayerStateLock(playerId, runAdvance, {
        scope: 'world-worker',
        waitMs: 0,
        ttlMs: Math.max(this.intervalMs * 4, 30 * 1000),
        timeoutResult: { advanced: false, reason: 'player-state-locked' },
      });
    }
    return runAdvance();
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
    const commandEntry = this.prepareRuntimeCommandEntry();
    const errors = [];
    let processedCount = 0;
    let shared = {
      socialPeople: 0,
      socialMeets: 0,
      socialCrossings: 0,
      diplomacyPairs: 0,
      rosterPatchesByPlayer: new Map(),
    };
    try {
      const gameStates = this.getRecentlyActive(now);
      shared = this.advanceSharedWorldState(gameStates, now);
      for (const rawState of gameStates) {
        try {
          const playerId = rawState?.playerId || '';
          const result = this.advancePlayerWithRetry(playerId, now, 3, rawState, shared.rosterPatchesByPlayer.get(playerId));
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

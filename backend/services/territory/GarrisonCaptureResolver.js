// GarrisonCaptureResolver — ②b: on a garrison-battle VICTORY, maybe capture the defeated defender general
// and stage a 斩杀/招降/放生 decision (docs garrison + design/03/08). Thin orchestration over the already-
// built FactionCaptureService + captureCore, so the hook in TerritoryConquestMissions stays ~2 lines.
//
// ADDITIVE / non-invasive: capture is a SIDE-TRACK. The existing occupy path is untouched — the city still
// occupies and clears its defenderLeader exactly as before; we only read the defender before it's cleared
// and, on a successful capture roll, push a pending decision onto gameState.captureDecisions. If the
// garrison band has captureChance 0 (safe band / undefended) nothing happens, so old saves + the tutorial
// occupy flow behave identically.
//
// Determinism: the capture roll AND the later recruit roll come from ONE seeded RNG (mission+territory+now),
// so the outcome is fixed at victory time (no reload-to-reroll) and the same whether resolved online or by
// the offline worker. The recruit roll is re-derived from the stored seed on resolve, never sent to the
// client, so 招降 success can't be peeked.

const { createFactionCaptureService } = require('../faction/FactionCaptureService');
const { createSeedRandom } = require('../famousPerson/FamousPersonShared');

const factionCaptureService = createFactionCaptureService();

// Lazy require to avoid a require cycle (FamousPersonService pulls in territory services).
function getFamousPersonService() {
  return require('../FamousPersonService');
}

function normalizeCaptureDecisions(gameState) {
  if (!gameState || typeof gameState !== 'object') return [];
  if (!Array.isArray(gameState.captureDecisions)) gameState.captureDecisions = [];
  return gameState.captureDecisions;
}

// The recruiting faction's ruler person (for 魅力 + 相性). Ruler-sourced person if tagged, else the first
// roster member, else null (recruitChance degrades to band base rate).
function findRuler(gameState) {
  const roster = Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [];
  return roster.find((p) => p && p.source && p.source.type === 'ruler') || roster[0] || null;
}

// inFactionKind(toPersonId) → the captive's relationship kind toward that person IF they serve the player,
// else null. Built from the captive's own edges + the player roster (relationships are empty until the
// relationship tick is wired, so this returns null for now — graceful, no bonus/penalty).
function inFactionKindResolver(gameState, captive) {
  const roster = new Set((gameState.famousPeople || []).map((p) => p && p.id).filter(Boolean));
  const edgeKind = new Map(
    (captive && Array.isArray(captive.relationships) ? captive.relationships : [])
      .filter((e) => e && e.toPersonId)
      .map((e) => [e.toPersonId, e.kind]),
  );
  return (toPersonId) => (roster.has(toPersonId) ? (edgeKind.get(toPersonId) || null) : null);
}

// Called at garrison-battle victory, BEFORE territory.defenderLeader/garrison are cleared. Returns the
// staged capture decision (also pushed onto gameState.captureDecisions) or null when nothing is captured.
function maybeCaptureOnVictory(gameState, territory, mission, now = new Date()) {
  const garrison = territory && territory.garrison;
  const captive = garrison && garrison.leader;
  if (!captive) return null;
  const band = { captureChance: garrison.captureChance, recruitBaseRate: garrison.recruitBaseRate };
  if (!(Number(band.captureChance) > 0)) return null;

  const seed = `${mission && mission.id}:${territory.id}:capture:${now.getTime()}`;
  const rng = createSeedRandom(seed);
  const captureRoll = rng();
  if (!factionCaptureService.rollCapture(band, captureRoll)) return null;

  const ruler = findRuler(gameState);
  const recruitChance = factionCaptureService.recruitChance(captive, ruler, inFactionKindResolver(gameState, captive), band);
  const decision = {
    id: `cap_${now.getTime()}_${territory.id}`,
    territoryId: territory.id,
    territoryName: territory.cityName || territory.naturalName || '',
    captive: JSON.parse(JSON.stringify(captive)), // snapshot enough to display + add to roster
    recruitChance,
    seed,
    status: 'pending',
    createdAt: now.toISOString(),
  };
  const list = normalizeCaptureDecisions(gameState);
  gameState.captureDecisions = [decision, ...list.filter((d) => d && d.id !== decision.id)];
  return decision;
}

// Add a recruited captive to the player's roster (deduped + normalized through the single roster source).
function addCaptiveToRoster(gameState, captive, territoryId, now) {
  const FamousPersonService = getFamousPersonService();
  const person = {
    ...captive,
    source: { type: 'capture', territoryId, capturedAt: now.toISOString() },
    joinedAt: now.toISOString(),
  };
  gameState.famousPeople = FamousPersonService.normalizeFamousPeople([person, ...(gameState.famousPeople || [])]);
  return gameState.famousPeople.find((p) => p.id === captive.id) || null;
}

// Resolve a pending capture decision by the player's choice (execute/recruit/release). Re-derives the
// recruit roll from the stored seed (deterministic, unpeekable). Returns { success, outcome, recruited }.
function resolveCaptureDecision(gameState, decisionId, choice, now = new Date()) {
  const list = normalizeCaptureDecisions(gameState);
  const decision = list.find((d) => d && d.id === decisionId && d.status === 'pending');
  if (!decision) return { success: false, error: 'CAPTURE_DECISION_NOT_FOUND', message: '没有待处置的俘将' };

  const rng = createSeedRandom(decision.seed);
  rng(); // consume the capture roll so the recruit roll matches the victory-time sequence
  const recruitRoll = rng();
  const outcome = factionCaptureService.resolveDisposition(choice, decision.recruitChance, recruitRoll);

  let recruited = null;
  if (outcome.joinsFaction) recruited = addCaptiveToRoster(gameState, decision.captive, decision.territoryId, now);

  decision.status = 'resolved';
  decision.choice = choice;
  decision.outcome = outcome.kind;
  decision.resolvedAt = now.toISOString();
  return { success: true, outcome, recruited, decision };
}

module.exports = {
  normalizeCaptureDecisions,
  maybeCaptureOnVictory,
  resolveCaptureDecision,
};

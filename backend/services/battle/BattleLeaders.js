const {
  clone,
  normalizeAttributes,
  toInteger,
} = require('./BattleShared');

function createBattleLeaders() {
  function getFamousPerson(gameState, leaderId) {
    const id = typeof leaderId === 'string' ? leaderId.trim() : '';
    if (!id || id === 'unavailable') return null;
    return (Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
      .find((person) => person?.id === id) || null;
  }

  function normalizeLeaderSnapshot(raw = {}, fallback = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      id: source.id || fallback.id || 'unavailable',
      name: source.name || fallback.name || 'Field Commander',
      title: source.title || source.archetypeLabel || fallback.title || '',
      archetype: source.archetype || '',
      abilityArchetype: source.abilityArchetype || source.abilityKit?.archetype || source.archetype || '',
      quality: source.quality || fallback.quality || 'common',
      qualityLabel: source.qualityLabel || '',
      level: toInteger(source.level, fallback.level || 1),
      attributes: normalizeAttributes(source.attributes || fallback.attributes || {}),
      appearance: source.appearance && typeof source.appearance === 'object' ? clone(source.appearance) : {},
      abilityKit: source.abilityKit && typeof source.abilityKit === 'object' ? clone(source.abilityKit) : null,
      skills: Array.isArray(source.skills) ? clone(source.skills).slice(0, 2) : [],
    };
  }

  function getLeaderSnapshot(gameState, leaderId) {
    const person = getFamousPerson(gameState, leaderId);
    return person ? normalizeLeaderSnapshot(person) : null;
  }

  function getLeaderSnapshotFromMission(mission = {}) {
    const raw = mission.expedition?.leaderSnapshot;
    if (!raw || typeof raw !== 'object') return null;
    return normalizeLeaderSnapshot(raw, {
      id: mission.expedition?.leader || 'unavailable',
      name: 'Field Commander',
    });
  }

  function getDefenderLeaderSnapshot(territory = {}) {
    const raw = territory.battleTarget?.defender?.leader || territory.garrison?.leader || territory.defenderLeader;
    if (!raw || typeof raw !== 'object') return null;
    return normalizeLeaderSnapshot(raw, {
      id: `df_${territory.id || 'site'}`,
      name: territory.naturalName || 'Defender',
      title: 'Defender',
    });
  }

  return {
    getDefenderLeaderSnapshot,
    getLeaderSnapshot,
    getLeaderSnapshotFromMission,
    normalizeLeaderSnapshot,
  };
}

module.exports = {
  createBattleLeaders,
};

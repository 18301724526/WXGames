const {
  clone,
  normalizeAttributes,
  toInteger,
} = require('./BattleShared');

function createBattleReports({
  BattleConfig,
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MORALE_EFFECT_ENABLED,
  DAMAGE_TYPE_LABELS,
  getBattleSkill,
  getDefenderLeaderSnapshot,
  getBattleSpeed,
  getBattleVisualGroups,
} = {}) {
  function getBattleMapForTerritory(territory = {}) {
    return BattleConfig.getBattleMapForType(territory.type);
  }

  function getBattleStageForTerritory(territory = {}) {
    return BattleConfig.getBattleStageForType(territory.type);
  }

  function getDefenderProfile(territory) {
    const profile = BattleConfig.getDefenderProfileForOwner(territory.owner, territory.naturalName);
    const soldiers = Math.max(
      MIN_BATTLE_SOLDIERS,
      toInteger(territory.battleTarget?.defender?.soldiers, toInteger(territory.garrison?.soldiers, toInteger(territory.defense, MIN_BATTLE_SOLDIERS))),
    );
    return {
      id: territory.id,
      name: profile.name,
      leader: null,
      soldiers,
      maxSoldiers: soldiers,
      morale: profile.morale,
      attributes: normalizeAttributes(profile),
      skill: getBattleSkill({}, 'defender'),
    };
  }

  function getDefenderBattleProfile(territory) {
    const fallback = getDefenderProfile(territory);
    const leader = getDefenderLeaderSnapshot(territory);
    if (!leader) return fallback;
    return {
      ...fallback,
      id: leader.id,
      name: leader.name,
      leader,
      attributes: leader.attributes,
      skill: getBattleSkill({ leader }, 'defender'),
    };
  }

  function createLegacyBattleReport(mission, territory, result, now = new Date()) {
    return {
      id: `battle_${territory.id}_${now.getTime()}`,
      mode: 'legacy',
      result: result.success ? 'victory' : 'defeat',
      summary: result.success
        ? `部队凭借兵力优势控制了${territory.naturalName}。`
        : `${territory.naturalName}守备坚决，部队未能建立优势。`,
      rounds: [],
      attacker: {
        leaderId: mission.expedition?.leader || 'unavailable',
        leaderName: '无名领队',
        soldiersStart: mission.soldiersCommitted,
        soldiersEnd: Math.max(0, mission.soldiersCommitted - result.casualties),
      },
      defender: {
        name: territory.naturalName || '守军',
        soldiersStart: territory.defense || 0,
        soldiersEnd: result.success ? 0 : Math.max(0, (territory.defense || 0) - Math.floor(mission.soldiersCommitted / 2)),
      },
      visual: {
        groupSize: DEFAULT_SOLDIER_SCALE,
        map: getBattleMapForTerritory(territory),
      },
    };
  }

  function makeUnit(side, base) {
    return {
      ...base,
      side,
      morale: toInteger(base.morale, 100),
      moraleEffectEnabled: MORALE_EFFECT_ENABLED,
      attributes: normalizeAttributes(base.attributes || {}),
      skillCooldownRemaining: 0,
      ownActionCount: 0,
      statuses: Array.isArray(base.statuses) ? clone(base.statuses) : [],
    };
  }

  function formatDamageLine(targetName, damageType, dealt, remaining) {
    const label = DAMAGE_TYPE_LABELS[damageType] || '伤害';
    return `[${targetName}] 受到${label} ${dealt}（${remaining}）`;
  }

  function createPreparationEvents(attacker, defender) {
    return [
      {
        phase: 'preparation',
        type: 'status',
        lines: [
          `[${attacker.name}] 士气 ${attacker.morale}`,
          `[${defender.name}] 士气 ${defender.morale}`,
          `士气影响：${MORALE_EFFECT_ENABLED ? '生效' : '未启用'}`,
        ],
      },
    ];
  }

  function createExperienceSummary(attacker, defender, success) {
    const enemyLoss = Math.max(0, defender.maxSoldiers - defender.soldiers);
    const ownLoss = Math.max(0, attacker.maxSoldiers - attacker.soldiers);
    const victoryBonus = success ? Math.max(20, Math.round(defender.maxSoldiers * 0.05)) : 0;
    const total = Math.max(0, Math.round(enemyLoss * 1 + ownLoss * 0.25 + victoryBonus));
    return {
      total,
      enemyLoss,
      ownLoss,
      victoryBonus,
      formula: 'enemyLoss * 1 + ownLoss * 0.25 + victoryBonus',
    };
  }

  function buildReportUnitSnapshot(unit, options = {}) {
    return {
      leaderId: options.leaderId || unit.leader?.id || '',
      name: options.name || unit.name,
      leaderName: options.leaderName || unit.name,
      leaderTitle: options.leaderTitle || unit.leader?.title || '',
      quality: options.quality ?? unit.leader?.quality ?? '',
      qualityLabel: options.qualityLabel ?? unit.leader?.qualityLabel ?? '',
      level: options.level ?? unit.leader?.level ?? 1,
      speed: getBattleSpeed(unit),
      morale: unit.morale,
      moraleEffectEnabled: MORALE_EFFECT_ENABLED,
      attributes: clone(unit.attributes || {}),
      soldiersStart: unit.maxSoldiers,
      soldiersEnd: unit.soldiers,
      groupsStart: getBattleVisualGroups(unit.maxSoldiers),
      groupsEnd: getBattleVisualGroups(unit.soldiers),
      appearance: clone(options.appearance || unit.leader?.appearance || {}),
      ...(options.abilityKit ? { abilityKit: clone(options.abilityKit) } : {}),
      skill: clone(unit.skill || {}),
    };
  }

  return {
    buildReportUnitSnapshot,
    createExperienceSummary,
    createLegacyBattleReport,
    createPreparationEvents,
    formatDamageLine,
    getBattleMapForTerritory,
    getBattleStageForTerritory,
    getDefenderBattleProfile,
    getDefenderProfile,
    makeUnit,
  };
}

module.exports = {
  createBattleReports,
};

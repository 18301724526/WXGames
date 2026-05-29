const DEFAULT_SOLDIER_SCALE = 100;
const MIN_BATTLE_SOLDIERS = 100;
const MAX_BATTLE_ROUNDS = 20;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function getFamousPerson(gameState, leaderId) {
  const id = typeof leaderId === 'string' ? leaderId.trim() : '';
  if (!id || id === 'unavailable') return null;
  return (Array.isArray(gameState.famousPeople) ? gameState.famousPeople : [])
    .find((person) => person?.id === id) || null;
}

function getLeaderSnapshot(gameState, leaderId) {
  const person = getFamousPerson(gameState, leaderId);
  if (!person) return null;
  const attributes = person.attributes || {};
  return {
    id: person.id,
    name: person.name || '无名之士',
    title: person.title || person.archetypeLabel || '名人',
    archetype: person.archetype || '',
    attributes: {
      command: toInteger(attributes.command, 50),
      force: toInteger(attributes.force, 50),
      strategy: toInteger(attributes.strategy, 50),
      charisma: toInteger(attributes.charisma, 50),
    },
    appearance: clone(person.appearance || {}),
    skills: Array.isArray(person.skills) ? clone(person.skills).slice(0, 2) : [],
  };
}

function getLeaderSnapshotFromMission(mission) {
  const raw = mission?.expedition?.leaderSnapshot;
  if (!raw || typeof raw !== 'object') return null;
  const attributes = raw.attributes || {};
  return {
    id: raw.id || mission.expedition?.leader || 'unavailable',
    name: raw.name || '无名之士',
    title: raw.title || raw.archetypeLabel || '名人',
    archetype: raw.archetype || '',
    attributes: {
      command: toInteger(attributes.command, 50),
      force: toInteger(attributes.force, 50),
      strategy: toInteger(attributes.strategy, 50),
      charisma: toInteger(attributes.charisma, 50),
    },
    appearance: clone(raw.appearance || {}),
    skills: Array.isArray(raw.skills) ? clone(raw.skills).slice(0, 2) : [],
  };
}

function getBattleSpeed(unit) {
  const attributes = unit.attributes || {};
  const force = toInteger(attributes.force, 45);
  const strategy = toInteger(attributes.strategy, 45);
  const command = toInteger(attributes.command, 45);
  const charisma = toInteger(attributes.charisma, 45);
  return Math.max(10, Math.round(force * 0.34 + command * 0.34 + strategy * 0.18 + charisma * 0.14));
}

function getAttackPower(unit) {
  const soldiers = Math.max(0, toInteger(unit.soldiers, 0));
  const attributes = unit.attributes || {};
  const force = toInteger(attributes.force, 45);
  const strategy = toInteger(attributes.strategy, 45);
  const command = toInteger(attributes.command, 45);
  const soldierScale = Math.max(1, soldiers / DEFAULT_SOLDIER_SCALE);
  const attrScore = force * 0.6 + strategy * 0.25 + command * 0.15;
  const moraleFactor = Math.max(0.75, Math.min(1.25, (unit.morale || 100) / 100));
  return Math.max(8, Math.round((soldierScale * 14 + attrScore * 0.32) * moraleFactor));
}

function getBattleSkill(unit, role = 'attacker') {
  if (Array.isArray(unit.leader?.skills) && unit.leader.skills.length) {
    return clone(unit.leader.skills[0]);
  }
  return {
    id: role === 'attacker' ? 'fallback_assault' : 'fallback_guard_thrust',
    name: role === 'attacker' ? '奋击' : '守势突刺',
    type: 'battle',
    cooldown: 3,
    effects: role === 'attacker'
      ? [{ key: 'morale', value: 0.08 }]
      : [{ key: 'shield', value: 0.08 }],
  };
}

function getSkillCooldown(skill = {}) {
  return Math.max(2, toInteger(skill.cooldown, 3));
}

function getSkillPower(unit, skill = {}) {
  const base = getAttackPower(unit);
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  const hasDamageAmplifier = effects.some((effect) => ['combo', 'armorBreak', 'ambush', 'burn', 'poison'].includes(effect.key));
  const hasSupportEffect = effects.some((effect) => ['shield', 'heal', 'morale'].includes(effect.key));
  const multiplier = hasDamageAmplifier ? 1.55 : (hasSupportEffect ? 1.32 : 1.4);
  return Math.max(10, Math.round(base * multiplier));
}

function applyDamage(target, damage) {
  const actual = Math.max(0, Math.min(target.soldiers, Math.floor(Number(damage) || 0)));
  target.soldiers = Math.max(0, target.soldiers - actual);
  return actual;
}

function healSoldiers(unit, amount) {
  const recovered = Math.max(0, Math.min(unit.maxSoldiers - unit.soldiers, Math.floor(Number(amount) || 0)));
  unit.soldiers += recovered;
  return recovered;
}

function applySkillSideEffects(unit, target, skill = {}, dealt = 0) {
  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  const notes = [];
  effects.forEach((effect) => {
    if (!effect || typeof effect !== 'object') return;
    if (effect.key === 'lifesteal') {
      const recovered = healSoldiers(unit, Math.round(dealt * (Number(effect.value) || 0)));
      if (recovered > 0) notes.push(`恢复 ${recovered} 士兵`);
    } else if (effect.key === 'heal') {
      const recovered = healSoldiers(unit, Math.round(unit.maxSoldiers * (Number(effect.value) || 0)));
      if (recovered > 0) notes.push(`整队恢复 ${recovered} 士兵`);
    } else if (effect.key === 'shield') {
      const shield = Math.round(getAttackPower(target) * (Number(effect.value) || 0));
      if (shield > 0) notes.push(`护势抵消约 ${shield} 伤害`);
    } else if (effect.key === 'morale') {
      unit.morale = Math.min(130, Math.round((unit.morale || 100) * (1 + (Number(effect.value) || 0))));
      notes.push('士气上扬');
    }
  });
  return notes;
}

function getBattleMapForTerritory(territory = {}) {
  const mapByType = {
    camp: { id: 'forest-camp', name: '林地营地', palette: ['#283f2e', '#526a3b', '#8b6f3a'] },
    city: { id: 'stone-gate', name: '城邦外墙', palette: ['#343d46', '#6b7478', '#9c8055'] },
    ruins: { id: 'old-ruins', name: '古代遗迹', palette: ['#30353a', '#65615b', '#8c805f'] },
    town: { id: 'river-town', name: '河湾村镇', palette: ['#324b47', '#5f7659', '#9b7d45'] },
    outpost: { id: 'frontier-outpost', name: '边境据点', palette: ['#34412e', '#687448', '#a4834c'] },
  };
  return mapByType[territory.type] || { id: 'frontier-field', name: '边境战场', palette: ['#2f3d30', '#667245', '#9a7848'] };
}

function getBattleStageForTerritory(territory = {}) {
  return {
    ...getBattleMapForTerritory(territory),
    background: 'assets/art/battle/battlefield-forest-camp.png',
    soldierSprites: {
      attacker: 'assets/art/battle/soldier-player-sheet.png',
      defender: 'assets/art/battle/soldier-enemy-sheet.png',
    },
  };
}

function getBattleVisualGroups(soldiers, groupSize = DEFAULT_SOLDIER_SCALE) {
  const total = Math.max(0, toInteger(soldiers, 0));
  if (total <= 0) return [];
  const count = Math.ceil(total / groupSize);
  return Array.from({ length: count }, (_, index) => {
    const remaining = total - index * groupSize;
    return {
      index: index + 1,
      soldiers: Math.max(0, Math.min(groupSize, remaining)),
      capacity: groupSize,
    };
  });
}

function getDefenderProfile(territory) {
  const ownerProfiles = {
    tribe: { name: territory.naturalName || '部落营地', force: 54, strategy: 38, command: 48, morale: 92 },
    city_state: { name: territory.naturalName || '城邦守军', force: 58, strategy: 52, command: 62, morale: 100 },
    ruin_guardians: { name: territory.naturalName || '遗迹守军', force: 64, strategy: 62, command: 55, morale: 96 },
  };
  const profile = ownerProfiles[territory.owner] || { name: territory.naturalName || '守军', force: 48, strategy: 42, command: 45, morale: 88 };
  const soldiers = Math.max(MIN_BATTLE_SOLDIERS, toInteger(territory.defense, MIN_BATTLE_SOLDIERS));
  return {
    id: territory.id,
    name: profile.name,
    soldiers,
    maxSoldiers: soldiers,
    morale: profile.morale,
    attributes: {
      force: profile.force,
      strategy: profile.strategy,
      command: profile.command,
      charisma: 42,
    },
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

function simulateConquestBattle(gameState, mission, territory, now = new Date()) {
  const leader = getLeaderSnapshot(gameState, mission.expedition?.leader)
    || getLeaderSnapshotFromMission(mission);
  const fallbackLeader = leader || {
    id: 'unavailable',
    name: '无名领队',
    title: '临时领队',
    attributes: { command: 45, force: 45, strategy: 40, charisma: 42 },
    appearance: {},
    skills: [],
  };
  const attacker = {
    leader: fallbackLeader,
    name: fallbackLeader.name,
    soldiers: Math.max(MIN_BATTLE_SOLDIERS, toInteger(mission.soldiersCommitted, MIN_BATTLE_SOLDIERS)),
    maxSoldiers: Math.max(MIN_BATTLE_SOLDIERS, toInteger(mission.soldiersCommitted, MIN_BATTLE_SOLDIERS)),
    morale: 100 + Math.floor((fallbackLeader.attributes.charisma - 50) / 5),
    attributes: fallbackLeader.attributes,
    skill: getBattleSkill({ leader: fallbackLeader }, 'attacker'),
    skillCooldownRemaining: 0,
  };
  const defender = {
    ...getDefenderProfile(territory),
    skill: getBattleSkill({}, 'defender'),
    skillCooldownRemaining: 0,
  };
  const turns = [];
  const rounds = [];
  const attackerFirst = getBattleSpeed(attacker) >= getBattleSpeed(defender);
  const order = attackerFirst
    ? [{ key: 'attacker', unit: attacker, target: defender }, { key: 'defender', unit: defender, target: attacker }]
    : [{ key: 'defender', unit: defender, target: attacker }, { key: 'attacker', unit: attacker, target: defender }];

  const recordAction = (actor, round) => {
    const beforeAttacker = attacker.soldiers;
    const beforeDefender = defender.soldiers;
    const actorName = actor.key === 'attacker' ? fallbackLeader.name : defender.name;
    const targetName = actor.key === 'attacker' ? defender.name : fallbackLeader.name;
    const useSkill = actor.unit.skillCooldownRemaining <= 0;
    const action = useSkill ? 'skill' : 'basicAttack';
    const skill = useSkill ? actor.unit.skill : null;
    const damage = useSkill ? getSkillPower(actor.unit, skill) : getAttackPower(actor.unit);
    const dealt = applyDamage(actor.target, damage);
    const notes = useSkill ? applySkillSideEffects(actor.unit, actor.target, skill, dealt) : [];
    const cooldownBefore = actor.unit.skillCooldownRemaining;
    if (useSkill) actor.unit.skillCooldownRemaining = getSkillCooldown(skill);
    else actor.unit.skillCooldownRemaining = Math.max(0, actor.unit.skillCooldownRemaining - 1);
    const cooldownAfter = actor.unit.skillCooldownRemaining;
    const text = useSkill
      ? `${actorName}队释放${skill?.name || '技能'}，${targetName}损失 ${dealt} 士兵${notes.length ? `，${notes.join('，')}` : ''}`
      : `${actorName}队普攻接战，${targetName}损失 ${dealt} 士兵`;
    turns.push({
      index: turns.length + 1,
      round,
      actor: actor.key,
      target: actor.key === 'attacker' ? 'defender' : 'attacker',
      action,
      actorName,
      targetName,
      damage: dealt,
      skillId: skill?.id || '',
      skillName: skill?.name || '',
      skillCooldown: useSkill ? getSkillCooldown(skill) : getSkillCooldown(actor.unit.skill),
      cooldownBefore,
      cooldownAfter,
      text,
      attackerSoldiersBefore: beforeAttacker,
      defenderSoldiersBefore: beforeDefender,
      attackerSoldiersAfter: attacker.soldiers,
      defenderSoldiersAfter: defender.soldiers,
      attackerGroupsAfter: getBattleVisualGroups(attacker.soldiers),
      defenderGroupsAfter: getBattleVisualGroups(defender.soldiers),
    });
    return text;
  };

  for (let round = 1; round <= MAX_BATTLE_ROUNDS; round += 1) {
    const events = [];
    for (const actor of order) {
      if (attacker.soldiers <= 0 || defender.soldiers <= 0) break;
      events.push(recordAction(actor, round));
    }
    rounds.push({ round, attackerSoldiers: attacker.soldiers, defenderSoldiers: defender.soldiers, events });
    if (attacker.soldiers <= 0 || defender.soldiers <= 0) break;
  }

  const success = defender.soldiers <= 0 || (attacker.soldiers > 0 && attacker.soldiers >= defender.soldiers);
  const casualties = Math.max(0, attacker.maxSoldiers - attacker.soldiers);
  const report = {
    id: `battle_${territory.id}_${now.getTime()}`,
    mode: 'auto-round',
    maxRounds: MAX_BATTLE_ROUNDS,
    result: success ? 'victory' : 'defeat',
    summary: success
      ? `${fallbackLeader.name}队压制了${territory.naturalName}。`
      : `${fallbackLeader.name}队未能突破${territory.naturalName}的防线。`,
    system: 'speed-skill-cooldown-v1',
    groupSize: DEFAULT_SOLDIER_SCALE,
    firstActor: attackerFirst ? 'attacker' : 'defender',
    skillRules: {
      openingSkill: true,
      cooldownTicksOnOwnTurnOnly: true,
      fallbackAction: 'basicAttack',
    },
    turns,
    rounds,
    attacker: {
      leaderId: fallbackLeader.id,
      leaderName: fallbackLeader.name,
      leaderTitle: fallbackLeader.title,
      speed: getBattleSpeed(attacker),
      soldiersStart: attacker.maxSoldiers,
      soldiersEnd: attacker.soldiers,
      groupsStart: getBattleVisualGroups(attacker.maxSoldiers),
      groupsEnd: getBattleVisualGroups(attacker.soldiers),
      appearance: clone(fallbackLeader.appearance || {}),
      skill: clone(attacker.skill || {}),
    },
    defender: {
      name: defender.name,
      speed: getBattleSpeed(defender),
      soldiersStart: defender.maxSoldiers,
      soldiersEnd: defender.soldiers,
      groupsStart: getBattleVisualGroups(defender.maxSoldiers),
      groupsEnd: getBattleVisualGroups(defender.soldiers),
      skill: clone(defender.skill || {}),
    },
    visual: {
      groupSize: DEFAULT_SOLDIER_SCALE,
      map: getBattleStageForTerritory(territory),
    },
  };
  return { success, casualties, report };
}

module.exports = {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  getLeaderSnapshot,
  getBattleVisualGroups,
  getBattleMapForTerritory,
  getBattleStageForTerritory,
  createLegacyBattleReport,
  simulateConquestBattle,
};

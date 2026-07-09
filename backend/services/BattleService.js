const BattleConfig = require('../config/BattleConfig');
const {
  clamp,
  clone,
  getBattleVisualGroups: getRawBattleVisualGroups,
  toInteger,
} = require('./battle/BattleShared');
const {
  createBattleLeaders,
} = require('./battle/BattleLeaders');
const {
  createBattleStatuses,
  getStatusTotalValue,
  sanitizeStatuses,
} = require('./battle/BattleStatuses');
const {
  createBattleSkillRuntime,
  getSkillCooldown,
} = require('./battle/BattleSkillRuntime');
const {
  createBattleReports,
} = require('./battle/BattleReports');

const {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  BATTLE_SYSTEM,
  MORALE_EFFECT_ENABLED,
} = BattleConfig;
const DAMAGE_TYPE_LABELS = {
  blade: '兵刃伤害',
  strategy: '谋略伤害',
  support: '支援效果',
  guard: '守御效果',
};

const BATTLE_RULE_VERSION = 'battle-rules-v3';
const battleLeaders = createBattleLeaders({ BattleConfig });
const {
  getBattleSkill,
  getDefenderLeaderSnapshot,
  getLeaderSnapshot,
  getLeaderSnapshotFromMission,
  getPassiveTraitsFromAbilityKit,
} = battleLeaders;

function getEffectiveAttribute(value) {
  const attribute = Math.max(1, Number(value) || 1);
  if (attribute <= 100) return attribute;
  return 100 + 2 * Math.pow(attribute - 100, 0.75);
}

function getBattleSpeed(unit) {
  return Math.max(1, Math.round(getEffectiveAttribute(unit.attributes?.speed ?? 45)));
}

function calculateDamage(attacker, defender, options = {}) {
  const damageType = options.damageType || 'blade';
  const multiplier = Number.isFinite(Number(options.multiplier)) ? Number(options.multiplier) : 1;
  const attackAttributeKey = damageType === 'strategy' ? 'intelligence' : 'force';
  const defenseAttributeKey = damageType === 'strategy' ? 'intelligence' : 'command';
  const effectiveAttack = getEffectiveAttribute(attacker.attributes?.[attackAttributeKey] ?? 45);
  const effectiveDefense = getEffectiveAttribute(defender.attributes?.[defenseAttributeKey] ?? 45);
  const soldierFactor = Math.pow(Math.max(1, attacker.soldiers) / DEFAULT_SOLDIER_SCALE, 0.65);
  const attackFactor = 0.75 + effectiveAttack / 120;
  const damageReduction = clamp(effectiveDefense / (effectiveDefense + 180), 0.05, 0.6);
  const moraleFactor = MORALE_EFFECT_ENABLED ? clamp((attacker.morale || 100) / 100, 0.75, 1.25) : 1;
  const armorBreakFactor = damageType === 'blade' ? 1 + getStatusTotalValue(defender, 'armorBreak') : 1;
  const rawDamage = 35 * soldierFactor * attackFactor * (1 - damageReduction) * moraleFactor * multiplier * armorBreakFactor;
  return Math.max(1, Math.min(defender.soldiers, Math.round(rawDamage)));
}

const battleStatuses = createBattleStatuses({
  defaultSoldierScale: DEFAULT_SOLDIER_SCALE,
  calculateDamage,
});
const {
  applyDamageWithStatuses,
  applyStatusToUnit,
  clearDefeatedStatuses,
  healSoldiers,
  tickStatusesAtActionStart,
} = battleStatuses;

const battleSkillRuntime = createBattleSkillRuntime({
  getPassiveTraitsFromAbilityKit,
  healSoldiers,
  applyStatusToUnit,
});
const {
  applyPreBattlePassives,
  applySkillSideEffects,
  canCastSkill,
  describeActionDecision,
  getSkillEffectMultiplier,
} = battleSkillRuntime;

const getBattleVisualGroups = (soldiers, groupSize = DEFAULT_SOLDIER_SCALE) => getRawBattleVisualGroups(soldiers, groupSize);

const battleReports = createBattleReports({
  BattleConfig,
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MORALE_EFFECT_ENABLED,
  DAMAGE_TYPE_LABELS,
  getBattleSkill,
  getDefenderLeaderSnapshot,
  getBattleSpeed,
  getBattleVisualGroups,
});
const {
  buildReportUnitSnapshot,
  createExperienceSummary,
  createLegacyBattleReport,
  createPreparationEvents,
  formatDamageLine,
  getBattleMapForTerritory,
  getBattleStageForTerritory,
  getDefenderBattleProfile,
  makeUnit,
} = battleReports;

function simulateConquestBattle(gameState, mission, territory, now = new Date()) {
  const targetTerritory = mission?.battleTarget ? { ...territory, battleTarget: mission.battleTarget } : territory;
  const leader = getLeaderSnapshot(gameState, mission.expedition?.leader) || getLeaderSnapshotFromMission(mission);
  const fallbackLeader = leader || BattleConfig.getFallbackLeader();
  const attackerSoldiers = Math.max(MIN_BATTLE_SOLDIERS, toInteger(mission.soldiersCommitted, MIN_BATTLE_SOLDIERS));
  const attacker = makeUnit('attacker', {
    leader: fallbackLeader,
    name: fallbackLeader.name,
    soldiers: attackerSoldiers,
    maxSoldiers: attackerSoldiers,
    morale: 100,
    attributes: fallbackLeader.attributes,
    skill: getBattleSkill({ leader: fallbackLeader }, 'attacker'),
  });
  const defender = makeUnit('defender', { ...getDefenderBattleProfile(targetTerritory) });

  const turns = [];
  const rounds = [];
  const detailEvents = [];
  const preparation = [
    ...createPreparationEvents(attacker, defender),
    ...applyPreBattlePassives(attacker),
    ...applyPreBattlePassives(defender),
  ];
  const attackerFirst = getBattleSpeed(attacker) >= getBattleSpeed(defender);
  const order = attackerFirst
    ? [{ key: 'attacker', unit: attacker, target: defender }, { key: 'defender', unit: defender, target: attacker }]
    : [{ key: 'defender', unit: defender, target: attacker }, { key: 'attacker', unit: attacker, target: defender }];

  const recordAction = (actor, round) => {
    const beforeAttacker = attacker.soldiers;
    const beforeDefender = defender.soldiers;
    const statusesBefore = { attacker: sanitizeStatuses(attacker.statuses), defender: sanitizeStatuses(defender.statuses) };
    const actorName = actor.unit.name;
    const targetName = actor.target.name;
    const statusEventsBefore = tickStatusesAtActionStart(actor.unit);
    const defeatedByStatus = actor.unit.soldiers <= 0;
    const statusClearEventsBefore = clearDefeatedStatuses(attacker, defender);
    if (defeatedByStatus) {
      const statusLines = [...statusEventsBefore, ...statusClearEventsBefore].map((event) => event.text).filter(Boolean);
      const turn = {
        index: turns.length + 1,
        round,
        actor: actor.key,
        target: actor.key,
        action: 'statusTick',
        actionType: 'statusTick',
        actorName,
        targetName: actorName,
        damage: Math.max(0, (actor.key === 'attacker' ? beforeAttacker : beforeDefender) - actor.unit.soldiers),
        damageType: 'strategy',
        damageLabel: '状态伤害',
        skillId: '',
        skillName: '',
        skillCooldown: actor.unit.skill ? getSkillCooldown(actor.unit.skill) : 0,
        cooldownBefore: actor.unit.skillCooldownRemaining,
        cooldownAfter: actor.unit.skillCooldownRemaining,
        cooldownTicked: false,
        ownActionCountBefore: toInteger(actor.unit.ownActionCount, 0),
        ownActionCountAfter: toInteger(actor.unit.ownActionCount, 0),
        castPolicy: '',
        castConditions: actor.unit.skill?.castConditions || [],
        actionDecision: {
          skillId: actor.unit.skill?.id || '',
          skillName: actor.unit.skill?.name || '',
          canCast: false,
          reason: 'defeatedByStatus',
          conditionResults: [],
          cooldownRemaining: Math.max(0, toInteger(actor.unit.skillCooldownRemaining, 0)),
          ownActionCountBefore: toInteger(actor.unit.ownActionCount, 0),
        },
        extraHits: [],
        statusEvents: [...statusEventsBefore, ...statusClearEventsBefore],
        floatingTexts: [...statusEventsBefore, ...statusClearEventsBefore].map((event) => event.floatingText).filter(Boolean),
        actorPortrait: null,
        presentation: { cutIn: false, showSkillName: false, emphasis: 'status' },
        morale: {
          actor: actor.unit.morale,
          target: actor.target.morale,
          effectEnabled: MORALE_EFFECT_ENABLED,
        },
        statusesBefore,
        soldiersBefore: { attacker: beforeAttacker, defender: beforeDefender },
        soldiersAfter: { attacker: attacker.soldiers, defender: defender.soldiers },
        statusesAfter: { attacker: sanitizeStatuses(attacker.statuses), defender: sanitizeStatuses(defender.statuses) },
        actionLineIndex: -1,
        lines: [
          `[${actorName}] 开始行动`,
          ...statusLines,
          `[${actorName}] 因状态败退，无法继续行动`,
        ],
        text: `${actorName}队因状态伤害败退`,
        attackerSoldiersBefore: beforeAttacker,
        defenderSoldiersBefore: beforeDefender,
        attackerSoldiersAfter: attacker.soldiers,
        defenderSoldiersAfter: defender.soldiers,
        attackerGroupsAfter: getBattleVisualGroups(attacker.soldiers),
        defenderGroupsAfter: getBattleVisualGroups(defender.soldiers),
      };
      turns.push(turn);
      detailEvents.push({
        round,
        actor: turn.actor,
        actorName,
        target: turn.target,
        targetName: actorName,
        actionType: turn.action,
        skillName: '',
        damageType: 'strategy',
        damage: turn.damage,
        actorPortrait: null,
        presentation: turn.presentation,
        extraHits: [],
        statusEvents: turn.statusEvents,
        actionDecision: turn.actionDecision,
        soldiersBefore: turn.soldiersBefore,
        soldiersAfter: turn.soldiersAfter,
        statusesBefore: turn.statusesBefore,
        statusesAfter: turn.statusesAfter,
        actionLineIndex: turn.actionLineIndex,
        lines: turn.lines,
      });
      return turn.text;
    }
    const actionDecision = describeActionDecision(actor.unit, actor.target, actor.unit.skill);
    const useSkill = canCastSkill(actor.unit, actor.target, actor.unit.skill);
    const action = useSkill ? 'skill' : 'basicAttack';
    const skill = useSkill ? actor.unit.skill : null;
    const damageType = useSkill ? skill.damageType : 'blade';
    const multiplier = useSkill ? skill.multiplier : 1;
    const damage = calculateDamage(actor.unit, actor.target, { damageType, multiplier });
    const damageResult = applyDamageWithStatuses(actor.target, damage);
    const dealt = damageResult.dealt;
    const secondHitMultiplier = useSkill ? getSkillEffectMultiplier(skill, 'secondHit', 0) : 0;
    const firstStrikeMultiplier = useSkill && toInteger(actor.unit.ownActionCount, 0) === 0
      ? getSkillEffectMultiplier(skill, 'firstStrike', 0)
      : 0;
    const extraHits = [];
    const hitStatusEvents = [...damageResult.shieldEvents];
    if (secondHitMultiplier > 0 && actor.target.soldiers > 0) {
      const extraDamage = calculateDamage(actor.unit, actor.target, { damageType, multiplier: secondHitMultiplier });
      const extraResult = applyDamageWithStatuses(actor.target, extraDamage);
      const extraDealt = extraResult.dealt;
      hitStatusEvents.push(...extraResult.shieldEvents);
      if (extraDealt > 0) extraHits.push({ key: 'secondHit', label: '二段伤害', damage: extraDealt, remaining: actor.target.soldiers });
    }
    if (firstStrikeMultiplier > 0 && actor.target.soldiers > 0) {
      const extraDamage = calculateDamage(actor.unit, actor.target, { damageType, multiplier: firstStrikeMultiplier });
      const extraResult = applyDamageWithStatuses(actor.target, extraDamage);
      const extraDealt = extraResult.dealt;
      hitStatusEvents.push(...extraResult.shieldEvents);
      if (extraDealt > 0) extraHits.push({ key: 'firstStrike', label: '先机伤害', damage: extraDealt, remaining: actor.target.soldiers });
    }
    const totalDealt = dealt + extraHits.reduce((sum, hit) => sum + hit.damage, 0);
    const sideEffects = useSkill ? applySkillSideEffects(actor.unit, actor.target, skill, totalDealt) : { notes: [], structured: [] };
    const statusClearEventsAfter = clearDefeatedStatuses(attacker, defender);
    const statusEvents = [
      ...statusEventsBefore,
      ...hitStatusEvents,
      ...sideEffects.structured.filter((effect) => (
        ['statusApplied', 'shieldAbsorb', 'statusExpired', 'statusCleared'].includes(effect.type)
      )),
      ...statusClearEventsAfter,
    ];
    const floatingTexts = [
      ...statusEvents,
      ...sideEffects.structured.filter((effect) => (
        effect.floatingText
        && !['statusApplied', 'shieldAbsorb', 'statusExpired', 'statusCleared'].includes(effect.type)
      )),
    ].map((event) => event.floatingText).filter(Boolean);
    const cooldownBefore = actor.unit.skillCooldownRemaining;
    const ownActionCountBefore = toInteger(actor.unit.ownActionCount, 0);
    if (useSkill) actor.unit.skillCooldownRemaining = getSkillCooldown(skill);
    else actor.unit.skillCooldownRemaining = Math.max(0, actor.unit.skillCooldownRemaining - 1);
    const cooldownAfter = actor.unit.skillCooldownRemaining;
    actor.unit.ownActionCount = toInteger(actor.unit.ownActionCount, 0) + 1;
    const ownActionCountAfter = actor.unit.ownActionCount;
    const cooldownTicked = !useSkill && cooldownBefore !== cooldownAfter;
    const actionLine = useSkill
      ? `[${actorName}] 发动战法 [${skill?.name || '技能'}]`
      : `[${actorName}] 对 [${targetName}] 发动普通攻击`;
    const damageLine = formatDamageLine(targetName, damageType, dealt, actor.target.soldiers);
    const extraLines = extraHits.map((hit) => `[${targetName}] 受到${hit.label} ${hit.damage}（${hit.remaining}）`);
    const preActionLines = [`[${actorName}] 开始行动`, ...statusEventsBefore.map((event) => event.text).filter(Boolean)];
    const actionLineIndex = preActionLines.length;
    const lines = [
      ...preActionLines,
      actionLine,
      ...hitStatusEvents.map((event) => event.text).filter(Boolean),
      damageLine,
      ...extraLines,
      ...sideEffects.structured.map((effect) => effect.text),
      ...statusClearEventsAfter.map((event) => event.text).filter(Boolean),
    ];
    const text = useSkill
      ? `${actorName}队发动${skill?.name || '技能'}，${targetName}损失 ${totalDealt} 士兵${sideEffects.notes.length ? `，${sideEffects.notes.join('，')}` : ''}`
      : `${actorName}队普攻接战，${targetName}损失 ${totalDealt} 士兵`;
    const actorPortrait = useSkill
      ? clone(actor.unit.leader?.appearance || {})
      : null;
    const presentation = useSkill
      ? { cutIn: true, showSkillName: true, emphasis: 'skill' }
      : { cutIn: false, showSkillName: false, emphasis: 'basicAttack' };
    const turn = {
      index: turns.length + 1,
      round,
      actor: actor.key,
      target: actor.key === 'attacker' ? 'defender' : 'attacker',
      action,
      actionType: action,
      actorName,
      targetName,
      damage: totalDealt,
      damageType,
      damageLabel: DAMAGE_TYPE_LABELS[damageType] || '伤害',
      skillId: skill?.id || '',
      skillName: skill?.name || '',
      skillCooldown: actor.unit.skill ? getSkillCooldown(actor.unit.skill) : 0,
      cooldownBefore,
      cooldownAfter,
      cooldownTicked,
      ownActionCountBefore,
      ownActionCountAfter,
      castPolicy: skill?.castPolicy || '',
      castConditions: actor.unit.skill?.castConditions || [],
      actionDecision,
      extraHits,
      statusEvents,
      floatingTexts,
      actorPortrait,
      presentation,
      morale: {
        actor: actor.unit.morale,
        target: actor.target.morale,
        effectEnabled: MORALE_EFFECT_ENABLED,
      },
      statusesBefore,
      soldiersBefore: { attacker: beforeAttacker, defender: beforeDefender },
      soldiersAfter: { attacker: attacker.soldiers, defender: defender.soldiers },
      statusesAfter: { attacker: sanitizeStatuses(attacker.statuses), defender: sanitizeStatuses(defender.statuses) },
      actionLineIndex,
      lines,
      text,
      attackerSoldiersBefore: beforeAttacker,
      defenderSoldiersBefore: beforeDefender,
      attackerSoldiersAfter: attacker.soldiers,
      defenderSoldiersAfter: defender.soldiers,
      attackerGroupsAfter: getBattleVisualGroups(attacker.soldiers),
      defenderGroupsAfter: getBattleVisualGroups(defender.soldiers),
    };
    turns.push(turn);
    detailEvents.push({
      round,
      actor: turn.actor,
      actorName,
      target: turn.target,
      targetName,
      actionType: action,
      skillName: turn.skillName,
      damageType,
      damage: totalDealt,
      actorPortrait,
      presentation,
      extraHits,
      statusEvents,
      floatingTexts,
      actionDecision,
      soldiersBefore: turn.soldiersBefore,
      soldiersAfter: turn.soldiersAfter,
      statusesBefore: turn.statusesBefore,
      statusesAfter: turn.statusesAfter,
      actionLineIndex,
      lines,
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
  const experience = createExperienceSummary(attacker, defender, success);
  const report = {
    id: `battle_${territory.id}_${now.getTime()}`,
    mode: 'auto-round',
    maxRounds: MAX_BATTLE_ROUNDS,
    result: success ? 'victory' : 'defeat',
    summary: success
      ? `${fallbackLeader.name}队压制了${territory.naturalName}。`
      : `${fallbackLeader.name}队未能突破${defender.name}的防线。`,
    system: BATTLE_SYSTEM,
    ruleVersion: BATTLE_RULE_VERSION,
    battleTarget: mission.battleTarget ? clone(mission.battleTarget) : null,
    groupSize: DEFAULT_SOLDIER_SCALE,
    firstActor: attackerFirst ? 'attacker' : 'defender',
    actionOrder: order.map((actor) => actor.key),
    moraleEffectEnabled: MORALE_EFFECT_ENABLED,
    skillRules: BattleConfig.getBattleRules().skillRules,
    preparation,
    detailEvents,
    turns,
    rounds,
    experience,
    attacker: {
      leaderId: fallbackLeader.id,
      leaderName: fallbackLeader.name,
      leaderTitle: fallbackLeader.title,
      speed: getBattleSpeed(attacker),
      morale: attacker.morale,
      moraleEffectEnabled: MORALE_EFFECT_ENABLED,
      attributes: clone(attacker.attributes || {}),
      soldiersStart: attacker.maxSoldiers,
      soldiersEnd: attacker.soldiers,
      groupsStart: getBattleVisualGroups(attacker.maxSoldiers),
      groupsEnd: getBattleVisualGroups(attacker.soldiers),
      appearance: clone(fallbackLeader.appearance || {}),
      skill: clone(attacker.skill || {}),
    },
    defender: {
      leaderId: defender.leader?.id || '',
      name: defender.name,
      leaderName: defender.name,
      leaderTitle: defender.leader?.title || '守军',
      quality: defender.leader?.quality || '',
      qualityLabel: defender.leader?.qualityLabel || '',
      level: defender.leader?.level || 1,
      speed: getBattleSpeed(defender),
      morale: defender.morale,
      moraleEffectEnabled: MORALE_EFFECT_ENABLED,
      attributes: clone(defender.attributes || {}),
      soldiersStart: defender.maxSoldiers,
      soldiersEnd: defender.soldiers,
      groupsStart: getBattleVisualGroups(defender.maxSoldiers),
      groupsEnd: getBattleVisualGroups(defender.soldiers),
      appearance: clone(defender.leader?.appearance || {}),
      abilityKit: defender.leader?.abilityKit ? clone(defender.leader.abilityKit) : null,
      skill: clone(defender.skill || {}),
    },
    visual: {
      groupSize: DEFAULT_SOLDIER_SCALE,
      map: getBattleStageForTerritory(territory),
    },
  };
  return { success, casualties, experience, report };
}

module.exports = {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  getLeaderSnapshot,
  getDefenderLeaderSnapshot,
  getEffectiveAttribute,
  calculateDamage,
  getBattleVisualGroups,
  getBattleMapForTerritory,
  getBattleStageForTerritory,
  createLegacyBattleReport,
  simulateConquestBattle,
  _test: {
    applyDamageWithStatuses,
    applyStatusToUnit,
    tickStatusesAtActionStart,
    makeUnit,
  },
};

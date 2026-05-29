const DEFAULT_SOLDIER_SCALE = 100;
const MIN_BATTLE_SOLDIERS = 100;
const MAX_BATTLE_ROUNDS = 20;

const BATTLE_SYSTEM = 'speed-skill-cooldown-v1';

const SKILL_RULES = {
  openingSkill: true,
  cooldownTicksOnOwnTurnOnly: true,
  fallbackAction: 'basicAttack',
};

const FALLBACK_LEADER = {
  id: 'unavailable',
  name: '无名领队',
  title: '临时领队',
  attributes: { command: 45, force: 45, strategy: 40, charisma: 42 },
  appearance: {},
  skills: [],
};

const FALLBACK_SKILLS = {
  attacker: {
    id: 'fallback_assault',
    name: '奋击',
    type: 'battle',
    cooldown: 3,
    effects: [{ key: 'morale', value: 0.08 }],
  },
  defender: {
    id: 'fallback_guard_thrust',
    name: '守势突刺',
    type: 'battle',
    cooldown: 3,
    effects: [{ key: 'shield', value: 0.08 }],
  },
};

const BATTLE_MAPS_BY_TERRITORY_TYPE = {
  camp: { id: 'forest-camp', name: '林地营地', palette: ['#283f2e', '#526a3b', '#8b6f3a'] },
  city: { id: 'stone-gate', name: '城邦外墙', palette: ['#343d46', '#6b7478', '#9c8055'] },
  ruins: { id: 'old-ruins', name: '古代遗迹', palette: ['#30353a', '#65615b', '#8c805f'] },
  town: { id: 'river-town', name: '河湾村镇', palette: ['#324b47', '#5f7659', '#9b7d45'] },
  outpost: { id: 'frontier-outpost', name: '边境据点', palette: ['#34412e', '#687448', '#a4834c'] },
};

const DEFAULT_BATTLE_MAP = {
  id: 'frontier-field',
  name: '边境战场',
  palette: ['#2f3d30', '#667245', '#9a7848'],
};

const BATTLE_STAGE_ASSETS = {
  background: 'assets/art/battle/battlefield-forest-camp.png',
  soldierSprites: {
    attacker: 'assets/art/battle/soldier-player-sheet.png',
    defender: 'assets/art/battle/soldier-enemy-sheet.png',
  },
};

const DEFENDER_PROFILES_BY_OWNER = {
  tribe: { defaultName: '部落营地', force: 54, strategy: 38, command: 48, morale: 92 },
  city_state: { defaultName: '城邦守军', force: 58, strategy: 52, command: 62, morale: 100 },
  ruin_guardians: { defaultName: '遗迹守军', force: 64, strategy: 62, command: 55, morale: 96 },
};

const DEFAULT_DEFENDER_PROFILE = {
  defaultName: '守军',
  force: 48,
  strategy: 42,
  command: 45,
  morale: 88,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getFallbackLeader() {
  return clone(FALLBACK_LEADER);
}

function getFallbackSkill(role = 'attacker') {
  return clone(FALLBACK_SKILLS[role] || FALLBACK_SKILLS.attacker);
}

function getBattleMapForType(type) {
  return clone(BATTLE_MAPS_BY_TERRITORY_TYPE[type] || DEFAULT_BATTLE_MAP);
}

function getBattleStageForType(type) {
  return {
    ...getBattleMapForType(type),
    ...clone(BATTLE_STAGE_ASSETS),
  };
}

function getDefenderProfileForOwner(owner, territoryName) {
  const profile = DEFENDER_PROFILES_BY_OWNER[owner] || DEFAULT_DEFENDER_PROFILE;
  return {
    name: territoryName || profile.defaultName,
    force: profile.force,
    strategy: profile.strategy,
    command: profile.command,
    morale: profile.morale,
  };
}

function getBattleRules() {
  return {
    defaultSoldierScale: DEFAULT_SOLDIER_SCALE,
    minBattleSoldiers: MIN_BATTLE_SOLDIERS,
    maxBattleRounds: MAX_BATTLE_ROUNDS,
    system: BATTLE_SYSTEM,
    skillRules: clone(SKILL_RULES),
  };
}

function raw() {
  return {
    rules: getBattleRules(),
    fallbackLeader: getFallbackLeader(),
    fallbackSkills: clone(FALLBACK_SKILLS),
    mapsByTerritoryType: clone(BATTLE_MAPS_BY_TERRITORY_TYPE),
    defaultBattleMap: clone(DEFAULT_BATTLE_MAP),
    stageAssets: clone(BATTLE_STAGE_ASSETS),
    defenderProfilesByOwner: clone(DEFENDER_PROFILES_BY_OWNER),
    defaultDefenderProfile: clone(DEFAULT_DEFENDER_PROFILE),
  };
}

module.exports = {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  BATTLE_SYSTEM,
  SKILL_RULES,
  getBattleRules,
  getFallbackLeader,
  getFallbackSkill,
  getBattleMapForType,
  getBattleStageForType,
  getDefenderProfileForOwner,
  raw,
};

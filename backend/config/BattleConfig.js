const ConfigRegistryContract = require('../services/config/ConfigRegistryContract');

const CONFIG_VERSION = '1.0.0';
const CONFIG_SCHEMA_VERSION = 1;
const sourcePath = __filename;

const DEFAULT_SOLDIER_SCALE = 100;
const MIN_BATTLE_SOLDIERS = 100;
const MAX_BATTLE_ROUNDS = 20;

const BATTLE_SYSTEM = 'attribute-auto-battle-v2';
const MORALE_EFFECT_ENABLED = false;

const SKILL_RULES = {
  openingSkill: false,
  castPolicy: 'conditional',
  conditionalCasting: true,
  cooldownTicksOnOwnTurnOnly: true,
  speedSortPerRound: true,
  preBattlePassivesEnabled: true,
  strategyDefenseAttribute: 'intelligence',
  fallbackAction: 'basicAttack',
  activeSkillSlots: 1,
  passiveTraitSlots: 1,
  randomTriggerEnabled: false,
  statusSystemEnabled: true,
  statusTicksOnTargetOwnTurnOnly: true,
};

const FALLBACK_LEADER = {
  id: 'unavailable',
  name: '无名领队',
  title: '临时领队',
  attributes: { command: 45, force: 45, intelligence: 40, strategy: 40, charisma: 42, politics: 40, speed: 45 },
  appearance: {},
  skills: [],
};

const FALLBACK_SKILLS = {
  attacker: {
    id: 'fallback_assault',
    name: '奋击',
    type: 'battle',
    category: 'blade',
    damageType: 'blade',
    multiplier: 1.25,
    cooldown: 3,
    effects: [],
  },
  defender: {
    id: 'fallback_guard_thrust',
    name: '守势突刺',
    type: 'battle',
    category: 'blade',
    damageType: 'blade',
    multiplier: 1.2,
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
    attacker: 'assets/art/battle/units/player',
    defender: 'assets/art/battle/units/enemy',
  },
};

const DEFENDER_PROFILES_BY_OWNER = {
  tribe: { defaultName: '部落营地', command: 48, force: 54, intelligence: 38, charisma: 42, politics: 36, speed: 44, morale: 100 },
  city_state: { defaultName: '城邦守军', command: 62, force: 58, intelligence: 52, charisma: 44, politics: 48, speed: 48, morale: 100 },
  ruin_guardians: { defaultName: '遗迹守军', command: 55, force: 64, intelligence: 62, charisma: 40, politics: 42, speed: 46, morale: 100 },
};

const DEFAULT_DEFENDER_PROFILE = {
  defaultName: '守军',
  command: 45,
  force: 48,
  intelligence: 42,
  charisma: 40,
  politics: 40,
  speed: 42,
  morale: 100,
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
    command: profile.command,
    force: profile.force,
    intelligence: profile.intelligence,
    strategy: profile.intelligence,
    charisma: profile.charisma,
    politics: profile.politics,
    speed: profile.speed,
    morale: profile.morale,
  };
}

function getBattleRules() {
  return {
    defaultSoldierScale: DEFAULT_SOLDIER_SCALE,
    minBattleSoldiers: MIN_BATTLE_SOLDIERS,
    maxBattleRounds: MAX_BATTLE_ROUNDS,
    system: BATTLE_SYSTEM,
    moraleEffectEnabled: MORALE_EFFECT_ENABLED,
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

function createRegistryEntries() {
  return {
    rules: { id: 'rules', values: getBattleRules() },
    fallbackLeader: { id: 'fallbackLeader', leader: getFallbackLeader() },
    fallbackSkillAttacker: { id: 'fallbackSkillAttacker', role: 'attacker', skill: clone(FALLBACK_SKILLS.attacker) },
    fallbackSkillDefender: { id: 'fallbackSkillDefender', role: 'defender', skill: clone(FALLBACK_SKILLS.defender) },
    mapsByTerritoryType: { id: 'mapsByTerritoryType', values: clone(BATTLE_MAPS_BY_TERRITORY_TYPE) },
    defaultBattleMap: { id: 'defaultBattleMap', value: clone(DEFAULT_BATTLE_MAP) },
    stageAssets: { id: 'stageAssets', values: clone(BATTLE_STAGE_ASSETS) },
    defenderProfilesByOwner: { id: 'defenderProfilesByOwner', values: clone(DEFENDER_PROFILES_BY_OWNER) },
    defaultDefenderProfile: { id: 'defaultDefenderProfile', value: clone(DEFAULT_DEFENDER_PROFILE) },
  };
}

function getRegistryMetadata() {
  return ConfigRegistryContract.createRegistryMetadata({
    id: 'battle-config',
    schema: 'battle-config-registry',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: CONFIG_VERSION,
    source: sourcePath,
    entries: createRegistryEntries(),
    content: raw(),
  });
}

function validateRegistry() {
  return ConfigRegistryContract.validateRegistry({
    id: 'battle-config',
    schema: 'battle-config-registry',
    schemaVersion: CONFIG_SCHEMA_VERSION,
    version: CONFIG_VERSION,
    source: sourcePath,
    entries: createRegistryEntries(),
    content: raw(),
  }, {
    requireEntries: true,
    requireVersion: true,
    requireObjectKeyMatch: true,
  });
}

module.exports = {
  DEFAULT_SOLDIER_SCALE,
  MIN_BATTLE_SOLDIERS,
  MAX_BATTLE_ROUNDS,
  BATTLE_SYSTEM,
  MORALE_EFFECT_ENABLED,
  SKILL_RULES,
  getBattleRules,
  getFallbackLeader,
  getFallbackSkill,
  getBattleMapForType,
  getBattleStageForType,
  getDefenderProfileForOwner,
  raw,
  getVersion: () => CONFIG_VERSION,
  getSourcePath: () => sourcePath,
  getRegistryMetadata,
  validateRegistry,
};

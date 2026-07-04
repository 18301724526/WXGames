const SCOUT_DURATION_MS = 60 * 1000;
const SCOUT_STEP_DURATION_MS = 12 * 1000;
const SCOUT_ACTION_POINTS = 5;
const CONQUEST_DURATION_MS = 2 * 60 * 1000;
const MAX_NAME_LENGTH = 12;
const MAX_REPORTS = 12;
const MAX_SCOUT_DISTANCE = 24;
const MAX_ACTIVE_SCOUTS = 2;
const SCOUT_SITE_MIN_DISTANCE = 3;
const SCOUT_SITE_BASE_CHANCE = 0.32;
const SCOUT_SITE_CHANCE_STEP = 0.14;
const SCOUT_SITE_GUARANTEE_AFTER = 4;
const MAX_SCOUT_AREA_RECORDS = 120;
const MAX_MIGRATION_SITE_SEARCH_DISTANCE = 48;
const POST_WAR_FAMOUS_PERSON_ENABLED = false;
const MIN_EXPEDITION_SOLDIERS = 100;
const SOLDIER_SCALE = 100;
const MAP_TERRAIN_TYPES = new Set(['capital', 'plains', 'forest', 'hills', 'mountain', 'waste', 'desert', 'river', 'ocean', 'shore']);
const PLANNING_TERRAIN_BY_MAP_TERRAIN = {
  capital: 'plains',
  plains: 'plains',
  forest: 'forest',
  hills: 'hills',
  mountain: 'hills',
  waste: 'hills',
  desert: 'hills',
  river: 'river',
  ocean: 'coast',
  shore: 'coast',
};

const DIRECTIONS = {
  n: { label: '北方', dx: 0, dy: -1 },
  ne: { label: '东北', dx: 1, dy: -1 },
  e: { label: '东方', dx: 1, dy: 0 },
  se: { label: '东南', dx: 1, dy: 1 },
  s: { label: '南方', dx: 0, dy: 1 },
  sw: { label: '西南', dx: -1, dy: 1 },
  w: { label: '西方', dx: -1, dy: 0 },
  nw: { label: '西北', dx: -1, dy: -1 },
};

const SITE_ART = {
  capital: 'assets/art/world-site-city-cutout.png',
  city: 'assets/art/world-site-city-cutout.png',
  outpost: 'assets/art/world-site-outpost-cutout.png',
  town: 'assets/art/world-site-town-cutout.png',
  camp: 'assets/art/world-site-camp-cutout.png',
  ruins: 'assets/art/world-site-ruins-cutout.png',
};

const SITE_TEMPLATES = [
  {
    type: 'outpost',
    owner: 'neutral',
    scale: 1,
    threat: 1,
    defense: 100,
    recommendedSoldiers: 100,
    naturalNames: ['河畔前哨', '浅丘据点', '旧猎道营地', '荒原木寨'],
    summaries: [
      '几户猎人与木栅围起了临时营地，尚未形成稳固势力。',
      '侦察队发现一处低矮据点，火塘仍在冒烟，守备并不严密。',
    ],
    reportTitles: ['边界外的第一缕炊烟', '木栅后的陌生脚印'],
    effects: { threatDefense: 1 },
    terrainWeights: {
      plains: 4,
      forest: 3,
      hills: 2,
      desert: 1,
      waste: 1,
      mountain: 0.5,
    },
  },
  {
    type: 'town',
    owner: 'neutral',
    scale: 2,
    threat: 2,
    defense: 100,
    recommendedSoldiers: 100,
    naturalNames: ['河湾村镇', '石阶小城', '谷口集落', '渡口镇'],
    summaries: [
      '这里有稳定的屋舍和集市痕迹，适合成为新的城市据点。',
      '侦察队看见石墙、井台和整齐的道路，这里已经接近一座小城。',
    ],
    reportTitles: ['远处石墙上的旗影', '道路尽头的村镇'],
    effects: { foodOutputMultiplier: 0.05 },
    terrainWeights: {
      plains: 5,
      forest: 2,
      hills: 1,
      desert: 1,
      waste: 0.5,
      mountain: 0.25,
    },
  },
  {
    type: 'camp',
    owner: 'tribe',
    scale: 2,
    threat: 4,
    defense: 500,
    recommendedSoldiers: 500,
    naturalNames: ['林地部落', '北风营帐', '山脚部族', '河曲部落'],
    summaries: [
      '多个帐篷围绕火塘而立，哨塔上有人持续观察外来者。',
      '这是一个组织严密的部落营地，木材和战士都不少。',
    ],
    reportTitles: ['营帐之间的警戒号角', '林地深处的部族火光'],
    effects: { woodOutputMultiplier: 0.08 },
    terrainWeights: {
      forest: 5,
      plains: 3,
      hills: 2,
      waste: 1,
      desert: 0.5,
      mountain: 0.5,
    },
  },
  {
    type: 'city',
    owner: 'city_state',
    scale: 3,
    threat: 5,
    defense: 600,
    recommendedSoldiers: 600,
    naturalNames: ['河湾城邦', '高墙城邑', '石桥城邦', '山口自治城'],
    summaries: [
      '整齐城墙与旗帜表明这里已经形成稳定政权，哨兵正在城门上来回巡查。',
      '这里不是松散村镇，而是一座有组织的城邦，贸然靠近会被立刻警惕。',
    ],
    reportTitles: ['城墙上的陌生旗帜', '石门后响起的号令'],
    effects: { foodOutputMultiplier: 0.06, knowledgeOutputMultiplier: 0.03 },
    terrainWeights: {
      plains: 5,
      forest: 1,
      hills: 2,
      desert: 0.5,
      waste: 0.5,
      mountain: 0.25,
    },
  },
  {
    type: 'ruins',
    owner: 'ruin_guardians',
    scale: 2,
    threat: 5,
    defense: 700,
    recommendedSoldiers: 700,
    naturalNames: ['旧日遗迹', '断柱废墟', '沉默神殿', '古道残垣'],
    summaries: [
      '破碎石柱之间仍有守卫巡逻，显然这里的遗迹并非无主空壳。',
      '废墟回廊里传来兵器碰撞声，侦察队判断此地存在遗迹守军。',
    ],
    reportTitles: ['断柱间的守望者', '沉默废墟中的兵影'],
    effects: { knowledgeOutputMultiplier: 0.08 },
    terrainWeights: {
      hills: 5,
      waste: 4,
      desert: 3,
      mountain: 3,
      plains: 1,
      forest: 1,
    },
  },
];

module.exports = {
  CONQUEST_DURATION_MS,
  DIRECTIONS,
  MAP_TERRAIN_TYPES,
  MAX_ACTIVE_SCOUTS,
  MAX_MIGRATION_SITE_SEARCH_DISTANCE,
  MAX_NAME_LENGTH,
  MAX_REPORTS,
  MAX_SCOUT_AREA_RECORDS,
  MAX_SCOUT_DISTANCE,
  MIN_EXPEDITION_SOLDIERS,
  PLANNING_TERRAIN_BY_MAP_TERRAIN,
  POST_WAR_FAMOUS_PERSON_ENABLED,
  SCOUT_ACTION_POINTS,
  SCOUT_DURATION_MS,
  SCOUT_SITE_BASE_CHANCE,
  SCOUT_SITE_CHANCE_STEP,
  SCOUT_SITE_GUARANTEE_AFTER,
  SCOUT_SITE_MIN_DISTANCE,
  SCOUT_STEP_DURATION_MS,
  SITE_ART,
  SITE_TEMPLATES,
  SOLDIER_SCALE,
};

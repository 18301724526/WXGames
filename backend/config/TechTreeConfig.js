const TECH_POINT_GRANTS = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 3,
};

const TECH_CHOICE_LIMITS = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 3,
};

const RESOURCE_LABELS = {
  food: '粮食',
  wood: '木材',
  stone: '石料',
  iron: '铁矿',
  knowledge: '知识',
};

const BUILDING_LABELS = {
  farm: '农田',
  house: '民居',
  lumbermill: '伐木场',
  barracks: '兵营',
  watchtower: '瞭望台',
  workshop: '工坊',
  academy: '学院',
  temple: '神庙',
};

const TECH_ERAS = [
  {
    era: 1,
    name: '农耕分支',
    summary: '选择第一种稳定粮食与居住方式，决定早期聚落的气质。',
    techs: [
      {
        id: 'farming_field_rotation',
        name: '田块轮作',
        route: 'agriculture',
        routeLabel: '农业',
        summary: '用轮作整理田地，让粮食来源更稳定。',
        core: '核心入口：粮食稳定',
        effects: { resourceEntrances: ['food'], unlockedBuildings: ['farm'] },
      },
      {
        id: 'farming_household_plots',
        name: '家户菜圃',
        route: 'livelihood',
        routeLabel: '民生',
        summary: '让民居周边保留小块耕地，人口成长更从容。',
        core: '核心入口：居住与粮食',
        effects: { resourceEntrances: ['food'], unlockedBuildings: ['house'] },
      },
      {
        id: 'farming_seed_selection',
        name: '选种经验',
        route: 'knowledge',
        routeLabel: '知识',
        summary: '记录更好的种子和季节，为后续知识路线铺底。',
        core: '核心入口：粮食与知识',
        effects: { resourceEntrances: ['food', 'knowledge'], unlockedBuildings: ['farm'] },
      },
      {
        id: 'farming_river_ditches',
        name: '浅渠引水',
        route: 'engineering',
        routeLabel: '工程',
        summary: '用沟渠改善田地，后续更容易转向石料与工程建设。',
        core: '核心入口：粮食与工程',
        effects: { resourceEntrances: ['food', 'stone'], unlockedBuildings: ['farm'] },
      },
      {
        id: 'farming_storehouse_rules',
        name: '储粮约定',
        route: 'administration',
        routeLabel: '秩序',
        summary: '把收成按规则储备，减少迈入聚落前的波动。',
        core: '核心入口：粮食储备',
        effects: { resourceEntrances: ['food'], unlockedBuildings: ['house'] },
      },
    ],
  },
  {
    era: 2,
    name: '聚落分支',
    summary: '所有路线都会补齐木材入口，但木材会服务不同的发展方向。',
    techs: [
      {
        id: 'settlement_logging_rights',
        name: '伐木权责',
        route: 'industry',
        routeLabel: '工业',
        summary: '明确谁负责砍伐、运输与堆放，木材进入稳定生产。',
        core: '核心入口：木材生产',
        effects: { resourceEntrances: ['wood'], unlockedBuildings: ['lumbermill'] },
      },
      {
        id: 'settlement_carpenter_yards',
        name: '木匠棚屋',
        route: 'livelihood',
        routeLabel: '民生',
        summary: '先把木材用于居住修缮，聚落扩张更平顺。',
        core: '核心入口：木材与民居',
        effects: { resourceEntrances: ['wood'], unlockedBuildings: ['lumbermill', 'house'] },
      },
      {
        id: 'settlement_forest_paths',
        name: '林间小径',
        route: 'exploration',
        routeLabel: '探索',
        summary: '沿森林路径组织采集，为未来侦察与外部接触预热。',
        core: '核心入口：木材与探索',
        effects: { resourceEntrances: ['wood'], unlockedBuildings: ['lumbermill'] },
      },
      {
        id: 'settlement_river_rafts',
        name: '简易木筏',
        route: 'trade',
        routeLabel: '贸易',
        summary: '让木材可以顺水运输，适合后续走交换与沿海路线。',
        core: '核心入口：木材流通',
        effects: { resourceEntrances: ['wood'], unlockedBuildings: ['lumbermill'] },
      },
      {
        id: 'settlement_communal_labor',
        name: '共工日',
        route: 'administration',
        routeLabel: '秩序',
        summary: '用共同劳作组织木材采集，后续更容易承接公共工程。',
        core: '核心入口：木材与工程',
        effects: { resourceEntrances: ['wood', 'stone'], unlockedBuildings: ['lumbermill'] },
      },
    ],
  },
  {
    era: 3,
    name: '城邦分支',
    summary: '城邦开始需要石料意识，不同路线会用石料支撑不同建筑风格。',
    techs: [
      {
        id: 'city_quarry_survey',
        name: '采石踏勘',
        route: 'engineering',
        routeLabel: '工程',
        summary: '寻找可用石脉，为城墙、道路和公共建筑做准备。',
        core: '核心入口：石料来源',
        effects: { resourceEntrances: ['stone'] },
      },
      {
        id: 'city_masonry_rules',
        name: '砌筑规矩',
        route: 'livelihood',
        routeLabel: '民生',
        summary: '先把石料用于居住与道路，城市布局更稳。',
        core: '核心入口：石料与民生',
        effects: { resourceEntrances: ['stone'], unlockedBuildings: ['house'] },
      },
      {
        id: 'city_hill_paths',
        name: '山道标记',
        route: 'exploration',
        routeLabel: '探索',
        summary: '记录山地路径，石料和远行能力一起成长。',
        core: '核心入口：石料与探索',
        effects: { resourceEntrances: ['stone'] },
      },
      {
        id: 'city_storage_yards',
        name: '料场管理',
        route: 'administration',
        routeLabel: '秩序',
        summary: '把木材和石料分区堆放，公共建设不再临时找料。',
        core: '核心入口：石料储备',
        effects: { resourceEntrances: ['stone', 'wood'] },
      },
      {
        id: 'city_public_works',
        name: '公共工事',
        route: 'military',
        routeLabel: '守备',
        summary: '把石料优先用于防护和集会空间，承接边境压力。',
        core: '核心入口：石料与守备',
        effects: { resourceEntrances: ['stone'], unlockedBuildings: ['barracks'] },
      },
    ],
  },
  {
    era: 4,
    name: '边境分支',
    summary: '边境把铁矿纳入文明视野，军事、工具和贸易会开始分化。',
    techs: [
      {
        id: 'frontier_bloomery_signs',
        name: '土炉试炼',
        route: 'industry',
        routeLabel: '工业',
        summary: '尝试从矿石中炼出可用金属，为工坊时代铺路。',
        core: '核心入口：铁矿来源',
        effects: { resourceEntrances: ['iron'] },
      },
      {
        id: 'frontier_guard_forges',
        name: '守备锻炉',
        route: 'military',
        routeLabel: '军事',
        summary: '把铁优先用于兵器修整，边境防线更有方向。',
        core: '核心入口：铁矿与守备',
        effects: { resourceEntrances: ['iron'], unlockedBuildings: ['watchtower'] },
      },
      {
        id: 'frontier_mountain_tracks',
        name: '矿道记号',
        route: 'exploration',
        routeLabel: '探索',
        summary: '沿山地记录矿点，未来远征和采掘更容易结合。',
        core: '核心入口：铁矿与探索',
        effects: { resourceEntrances: ['iron', 'stone'] },
      },
      {
        id: 'frontier_militia_tools',
        name: '民兵器具',
        route: 'livelihood',
        routeLabel: '民生',
        summary: '把工具和武备下沉到民户，兼顾生产与自保。',
        core: '核心入口：铁矿与人口',
        effects: { resourceEntrances: ['iron'], unlockedBuildings: ['barracks'] },
      },
      {
        id: 'frontier_border_trade',
        name: '边市换矿',
        route: 'trade',
        routeLabel: '贸易',
        summary: '通过边境交换获得矿石，适合不重采掘的文明。',
        core: '核心入口：铁矿流通',
        effects: { resourceEntrances: ['iron', 'knowledge'] },
      },
    ],
  },
  {
    era: 5,
    name: '古典分支',
    summary: '古典时代给 3 个科技点，开始解锁可建建筑并形成路线组合。',
    techs: [
      {
        id: 'classical_workshop_guilds',
        name: '工匠行会',
        route: 'industry',
        routeLabel: '工业',
        summary: '组织专门工匠，解锁工坊，木材和铁矿路线开始成形。',
        core: '解锁建筑：工坊',
        effects: { resourceEntrances: ['wood', 'iron'], unlockedBuildings: ['workshop'] },
      },
      {
        id: 'classical_academy_schools',
        name: '讲学之所',
        route: 'knowledge',
        routeLabel: '知识',
        summary: '让学者有固定场所传授经验，解锁学院。',
        core: '解锁建筑：学院',
        effects: { resourceEntrances: ['knowledge'], unlockedBuildings: ['academy'] },
      },
      {
        id: 'classical_temple_calendar',
        name: '祭历整理',
        route: 'culture',
        routeLabel: '文化',
        summary: '把节律、祭仪和记录合在一起，解锁神庙。',
        core: '解锁建筑：神庙',
        effects: { resourceEntrances: ['knowledge'], unlockedBuildings: ['temple'] },
      },
      {
        id: 'classical_masonry_contracts',
        name: '石工契约',
        route: 'engineering',
        routeLabel: '工程',
        summary: '让石料进入长期工程体系，适合走城市建设路线。',
        core: '强化入口：石料工程',
        effects: { resourceEntrances: ['stone'] },
      },
      {
        id: 'classical_iron_tools',
        name: '铁制农具',
        route: 'agriculture',
        routeLabel: '农业',
        summary: '把铁优先用于农具，农业路线获得后续强化空间。',
        core: '强化入口：农业工具',
        effects: { resourceEntrances: ['iron', 'food'], unlockedBuildings: ['farm'] },
      },
      {
        id: 'classical_grain_administration',
        name: '粮册制度',
        route: 'administration',
        routeLabel: '秩序',
        summary: '用册籍管理人口与粮仓，适合稳定推进时代。',
        core: '强化入口：粮食与人口',
        effects: { resourceEntrances: ['food', 'knowledge'], unlockedBuildings: ['house'] },
      },
      {
        id: 'classical_border_codes',
        name: '边防条令',
        route: 'military',
        routeLabel: '军事',
        summary: '把守备制度化，为后续战争系统预留军事路线。',
        core: '强化入口：守备体系',
        effects: { resourceEntrances: ['iron'], unlockedBuildings: ['barracks', 'watchtower'] },
      },
      {
        id: 'classical_civic_records',
        name: '城邦档案',
        route: 'culture',
        routeLabel: '文化',
        summary: '记录城市事务，为文化、行政和科技路线保留余量。',
        core: '强化入口：知识治理',
        effects: { resourceEntrances: ['knowledge'] },
      },
    ],
  },
];

const TECH_TREE_LAYOUT = {
  farming_field_rotation: { column: 1, lane: -3, parents: [] },
  farming_household_plots: { column: 1, lane: -2, parents: [] },
  farming_seed_selection: { column: 1, lane: -1, parents: [] },
  farming_river_ditches: { column: 1, lane: 1, parents: [] },
  farming_storehouse_rules: { column: 1, lane: 3, parents: [] },

  settlement_logging_rights: { column: 2, lane: 1, parents: ['farming_field_rotation'] },
  settlement_carpenter_yards: { column: 2, lane: -2, parents: ['farming_household_plots'] },
  settlement_forest_paths: { column: 2, lane: 2, parents: ['farming_seed_selection'] },
  settlement_river_rafts: { column: 2, lane: 3, parents: ['farming_river_ditches'] },
  settlement_communal_labor: { column: 2, lane: -1, parents: ['farming_storehouse_rules'] },

  city_quarry_survey: { column: 3, lane: 1, parents: ['settlement_logging_rights', 'settlement_communal_labor'] },
  city_masonry_rules: { column: 3, lane: -2, parents: ['settlement_carpenter_yards'] },
  city_hill_paths: { column: 3, lane: 2, parents: ['settlement_forest_paths'] },
  city_storage_yards: { column: 3, lane: -1, parents: ['settlement_communal_labor', 'settlement_river_rafts'] },
  city_public_works: { column: 3, lane: 3, parents: ['settlement_logging_rights'] },

  frontier_bloomery_signs: { column: 4, lane: 1, parents: ['city_quarry_survey'] },
  frontier_guard_forges: { column: 4, lane: 3, parents: ['city_public_works'] },
  frontier_mountain_tracks: { column: 4, lane: 2, parents: ['city_hill_paths', 'city_quarry_survey'] },
  frontier_militia_tools: { column: 4, lane: -2, parents: ['city_masonry_rules', 'city_public_works'] },
  frontier_border_trade: { column: 4, lane: -1, parents: ['city_storage_yards', 'city_hill_paths'] },

  classical_workshop_guilds: { column: 5, lane: 1, parents: ['frontier_bloomery_signs'] },
  classical_academy_schools: { column: 5, lane: -1, parents: ['frontier_border_trade'] },
  classical_temple_calendar: { column: 5, lane: -4, parents: ['city_storage_yards'] },
  classical_masonry_contracts: { column: 5, lane: 2, parents: ['city_quarry_survey'] },
  classical_iron_tools: { column: 5, lane: -3, parents: ['frontier_bloomery_signs', 'farming_field_rotation'] },
  classical_grain_administration: { column: 5, lane: -2, parents: ['frontier_militia_tools', 'city_storage_yards'] },
  classical_border_codes: { column: 5, lane: 3, parents: ['frontier_guard_forges'] },
  classical_civic_records: { column: 5, lane: 4, parents: ['frontier_border_trade'] },
};

function getTechTreeMeta(techId) {
  const meta = TECH_TREE_LAYOUT[techId] || {};
  const parents = Array.isArray(meta.parents) ? [...meta.parents] : [];
  return {
    column: Number(meta.column) || 1,
    lane: Number(meta.lane) || 0,
    parents,
  };
}

const TECHS = TECH_ERAS.flatMap((eraConfig) => (
  eraConfig.techs.map((tech) => {
    const tree = getTechTreeMeta(tech.id);
    return {
      ...tech,
      era: eraConfig.era,
      eraName: eraConfig.name,
      tree,
      parents: tree.parents,
    };
  })
));

const TECH_BY_ID = Object.fromEntries(TECHS.map((tech) => [tech.id, tech]));

module.exports = {
  TECH_POINT_GRANTS,
  TECH_CHOICE_LIMITS,
  RESOURCE_LABELS,
  BUILDING_LABELS,
  TECH_ERAS,
  TECH_TREE_LAYOUT,
  TECHS,
  TECH_BY_ID,
};

// Config-table schemas — the single source for each table's STRUCTURE (fields, types, docs) and
// its seed rows. The .xlsx files under config/tables/ are the designer-editable DATA (scaffolded
// from these schemas, then hand-edited); config/generated/*.json is the game-consumable output.
//
// Pipeline (scripts/build-config-tables.js):
//   --scaffold : create any missing <table>.xlsx from these schemas (data sheet + 字段说明 sheet)
//   (default)  : read config/tables/*.xlsx -> config/generated/<table>.json (types coerced here)
//   --check    : rebuild in memory and fail if the committed JSON is stale (deploy freshness gate)
//
// Field `type` drives coercion: int | float | bool | string | csv (comma list) | json.
// Every field carries designer docs: label (含义) / fill (填什么) / effect (作用).

const TABLES = [
  {
    table: 'garrison',
    description: '占城守军规则表 — 按“距首城的距离档”决定空城是否有守军、守军阵营/兵力/守将品质/重生。占领有守军的城需先打赢到达战斗。',
    // The `id` field of each table is the FIRST field; rows are keyed by it in the JSON output.
    fields: [
      { key: 'bandId', type: 'string', label: '距离档标识（主键）', fill: 'safe / near / frontier / deep 等，唯一', effect: '标识这一档，代码按城到首城的距离归档' },
      { key: 'maxDistance', type: 'int', label: '本档距离上限（格）', fill: '离首城 ≤ 此格数归入本档；最后一档填 9999', effect: '决定一座城落在哪一档' },
      { key: 'defended', type: 'bool', label: '本档空城是否有守军', fill: 'safe 档填 false（保护出生区，教程占城无阻力），其余 true', effect: 'false=可直接占领；true=占领前先打守军' },
      { key: 'ownerType', type: 'string', label: '守军阵营类型', fill: 'city_state / tribe / ruin_guardians / neutral', effect: '决定守将的品类/名字池/立绘（DefenderLeaderService PROFILE_BY_OWNER）' },
      { key: 'baseSoldiers', type: 'int', label: '守军基础兵力', fill: '如 300', effect: '守军初始兵力（防守方规模基线）' },
      { key: 'soldiersPerScale', type: 'int', label: '每点站点规模额外兵力', fill: '如 120', effect: '站点 scale 越大守军越多：兵力 = base + scale×此值' },
      { key: 'leaderQuality', type: 'string', label: '守将品质（留空=按威胁自动）', fill: 'common / good / great / legendary，或留空', effect: '空=DefenderLeaderService 按威胁度定档；填了则强制此品质' },
      { key: 'respawnHours', type: 'float', label: '被清后重生守军的小时数', fill: '0=不重生；如 6 表示 6 小时后守军刷新', effect: '清掉守军后经过此时长重新生成守军（0 表示占领后永久归玩家）' },
    ],
    rows: [
      { bandId: 'safe', maxDistance: 3, defended: false, ownerType: 'neutral', baseSoldiers: 0, soldiersPerScale: 0, leaderQuality: '', respawnHours: 0 },
      { bandId: 'near', maxDistance: 8, defended: true, ownerType: 'city_state', baseSoldiers: 260, soldiersPerScale: 90, leaderQuality: '', respawnHours: 0 },
      { bandId: 'frontier', maxDistance: 16, defended: true, ownerType: 'tribe', baseSoldiers: 360, soldiersPerScale: 130, leaderQuality: 'good', respawnHours: 8 },
      { bandId: 'deep', maxDistance: 9999, defended: true, ownerType: 'ruin_guardians', baseSoldiers: 520, soldiersPerScale: 170, leaderQuality: 'great', respawnHours: 12 },
    ],
  },
  {
    table: 'veteran_camp',
    description: '老兵营地表 — 每城一座；战斗阵亡的一部分转为“伤兵”存入营地，随时间恢复成可用兵。营地等级越高，转化率/容量/恢复越好。',
    fields: [
      { key: 'level', type: 'int', label: '营地等级（主键）', fill: '0,1,2,3…，0=未建/无营地', effect: '标识营地等级；城的营地按其当前等级取对应行' },
      { key: 'upgradeCostGrain', type: 'int', label: '升到本级的粮食成本', fill: '0 级填 0；如 800 / 2000 …', effect: '从上一级升到本级需消耗的粮食' },
      { key: 'woundedRatio', type: 'float', label: '阵亡转伤兵比例（0~1）', fill: '如 0.35 表示 35% 阵亡变伤兵', effect: '战斗结算时按此比例把我方阵亡转为伤兵入营（其余真死）' },
      { key: 'capacity', type: 'int', label: '伤兵容量上限', fill: '如 500', effect: '营地最多容纳的伤兵数，超出的阵亡按真死处理' },
      { key: 'recoverPerHour', type: 'int', label: '每小时恢复的伤兵数', fill: '如 40', effect: '心跳/worker 每小时把这么多伤兵恢复成该城可用兵' },
      { key: 'unlockEra', type: 'int', label: '解锁所需时代', fill: '如 0 或 2', effect: '达到此时代才能建造/升到本级' },
    ],
    rows: [
      { level: 0, upgradeCostGrain: 0, woundedRatio: 0, capacity: 0, recoverPerHour: 0, unlockEra: 0 },
      { level: 1, upgradeCostGrain: 800, woundedRatio: 0.3, capacity: 300, recoverPerHour: 30, unlockEra: 0 },
      { level: 2, upgradeCostGrain: 2400, woundedRatio: 0.4, capacity: 600, recoverPerHour: 60, unlockEra: 1 },
      { level: 3, upgradeCostGrain: 6000, woundedRatio: 0.5, capacity: 1000, recoverPerHour: 100, unlockEra: 2 },
    ],
  },
];

module.exports = { TABLES };

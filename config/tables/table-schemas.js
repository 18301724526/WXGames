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
      { key: 'captureChance', type: 'float', label: '打赢后捕获守将的基础概率（0~1）', fill: '如 0.25；品质越高的守将越难捕，deep 档调低', effect: '到达战斗胜利后按此概率进入“捕获守将”面板（斩杀/招降/放生）；0=从不捕获' },
      { key: 'recruitBaseRate', type: 'float', label: '招降基础成功率（0~1）', fill: '如 0.5；后续好感度/羁绊/君主魅力系统会在此基础上加成', effect: '捕获面板选“招降”时的基础成功率（当前无加成系统时即最终值）；失败守将流失' },
    ],
    // 夺回是“攻击驱动”的（第三方/敌对/中立势力来攻打才触发：无驻防→直接夺走，有驻防→打一场），
    // 不是定时自动夺回，所以本表不含 reclaim 计时字段；夺回属于“敌对势力攻打玩家城”系统的范畴。
    rows: [
      { bandId: 'safe', maxDistance: 3, defended: false, ownerType: 'neutral', baseSoldiers: 0, soldiersPerScale: 0, leaderQuality: '', captureChance: 0, recruitBaseRate: 0 },
      { bandId: 'near', maxDistance: 8, defended: true, ownerType: 'city_state', baseSoldiers: 260, soldiersPerScale: 90, leaderQuality: '', captureChance: 0.25, recruitBaseRate: 0.5 },
      { bandId: 'frontier', maxDistance: 16, defended: true, ownerType: 'tribe', baseSoldiers: 360, soldiersPerScale: 130, leaderQuality: 'good', captureChance: 0.18, recruitBaseRate: 0.4 },
      { bandId: 'deep', maxDistance: 9999, defended: true, ownerType: 'ruin_guardians', baseSoldiers: 520, soldiersPerScale: 170, leaderQuality: 'great', captureChance: 0.12, recruitBaseRate: 0.3 },
    ],
  },
  {
    table: 'veteran_camp',
    description: '老兵营地表（玩家建造/升级的建筑）— 卸兵的“后悔兜底”。卸下的兵进营地暂存：随时间线性流失，每流失一个退还该兵价值的一部分（默认 50% 粮）；在保留期内可把他们当新兵重新扣募兵费拉回编队。等级越高，容量越大、保留越久、退款越多。注意：这与“战斗伤兵”无关。',
    fields: [
      { key: 'level', type: 'int', label: '营地等级（主键）', fill: '0,1,2,3…，0=未建（无营地=卸兵直接按 refundRatio 即时退款、无暂存/无后悔窗口）', effect: '城按其营地当前等级取对应行' },
      { key: 'upgradeCostGrain', type: 'int', label: '升到本级的粮食成本', fill: '0 级填 0；如 800 / 2400 …', effect: '从上一级升到本级需消耗的粮食' },
      { key: 'capacity', type: 'int', label: '营地容量（暂存兵上限）', fill: '如 500', effect: '营地最多暂存的卸兵数；超出容量的部分按 refundRatio 即时退款、不占位' },
      { key: 'retentionHours', type: 'float', label: '保留时长（小时）', fill: '如 24 表示一批卸兵 24 小时内线性流失完', effect: '一批卸兵从满到清空所需时间；此期内可原样拉回编队（免再练，但按新兵扣募兵费）' },
      { key: 'refundRatio', type: 'float', label: '流失退款比例（0~1）', fill: '默认 0.5=退该兵价值的 50%', effect: '每流失一个兵，返还其价值×此比例的粮（这就是原“卸兵退50%粮”的归宿，改成随时间兑现）' },
      { key: 'unlockEra', type: 'int', label: '解锁所需时代', fill: '如 0 或 1', effect: '达到此时代才能建造/升到本级' },
    ],
    rows: [
      { level: 0, upgradeCostGrain: 0, capacity: 0, retentionHours: 0, refundRatio: 0.5, unlockEra: 0 },
      { level: 1, upgradeCostGrain: 800, capacity: 300, retentionHours: 12, refundRatio: 0.5, unlockEra: 0 },
      { level: 2, upgradeCostGrain: 2400, capacity: 600, retentionHours: 24, refundRatio: 0.5, unlockEra: 1 },
      { level: 3, upgradeCostGrain: 6000, capacity: 1000, retentionHours: 48, refundRatio: 0.6, unlockEra: 2 },
    ],
  },
];

module.exports = { TABLES };

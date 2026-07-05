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
  {
    table: 'personality_natures',
    description: '气性(性格)锚点表 — PVPVE/三国志人物系统脊柱B（docs/design/02）。每个气性 = 三条性格轴(胆略/交游/义理, -1~1)空间里的一个命名锚点 + 行为倍率。性格只驱动世界行为(相遇/结羁绊/背叛/结仇/忠诚漂移/君主好战)，不碰战斗数值(留六维+技能，避免双源)。用户确认：多维相性向量(=这三轴本身)、配置表可自由增删气性。',
    fields: [
      { key: 'natureId', type: 'string', label: '气性标识(主键)', fill: 'valiant/cautious/... 唯一', effect: '人物 personality.nature 的取值；生成器枚举须覆盖本表(缺一门禁红)' },
      { key: 'label', type: 'string', label: '中文标签', fill: '勇猛/冷静/...', effect: 'UI 显示；后端直发中文' },
      { key: 'aBoldness', type: 'float', label: '胆略轴锚点(-1~1)', fill: '慎重 -1 ~ 勇猛 +1', effect: '相性向量第1维；AI 出兵/探索倾向' },
      { key: 'aSociability', type: 'float', label: '交游轴锚点(-1~1)', fill: '孤高 -1 ~ 风流 +1', effect: '相性向量第2维；认识新人的基础频率(好友来投)' },
      { key: 'aIntegrity', type: 'float', label: '义理轴锚点(-1~1)', fill: '野心 -1 ~ 义理 +1', effect: '相性向量第3维；忠诚漂移/被登用抗性/羁绊倾向' },
      { key: 'meetRateMult', type: 'float', label: '认识新人频率倍率', fill: '风流 1.8、孤高 0.5、常人 1.0', effect: '关系网撮合率(03)' },
      { key: 'bondBias', type: 'float', label: '结羁绊倾向(0~2)', fill: '义理/风流高，如 1.5；野心低', effect: '义兄弟/夫婦生成倾向(03)' },
      { key: 'betrayalBias', type: 'float', label: '背叛/被挖倾向(0~2)', fill: '野心 1.8、义理 0.2', effect: '被登用抗性反比 + 倒戈来投倾向(03/05)' },
      { key: 'grudgeBias', type: 'float', label: '结仇/宿敌倾向(0~2)', fill: '剛胆/勇猛高，如 1.4', effect: '宿敌生成倾向(03)' },
      { key: 'loyaltyDriftMult', type: 'float', label: '忠诚漂移倍率', fill: '义理 0.5(衰减慢)、野心 1.5', effect: '忠诚随时间/待遇漂移速率' },
      { key: 'aggression', type: 'float', label: '君主好战基线(0~100)', fill: '勇猛/剛胆高，如 70；温厚 25', effect: '当此人做势力君主时的 AI 好战基线(05)' },
      { key: 'weight', type: 'float', label: '生成权重', fill: '常见气性高，如 1.0；稀有 0.5', effect: '随机生成人物时抽到此气性的权重' },
    ],
    rows: [
      { natureId: 'valiant', label: '勇猛', aBoldness: 0.8, aSociability: 0.1, aIntegrity: 0.2, meetRateMult: 1.0, bondBias: 1.0, betrayalBias: 0.6, grudgeBias: 1.2, loyaltyDriftMult: 1.0, aggression: 70, weight: 1.0 },
      { natureId: 'cautious', label: '冷静', aBoldness: -0.7, aSociability: -0.2, aIntegrity: 0.3, meetRateMult: 0.8, bondBias: 0.9, betrayalBias: 0.5, grudgeBias: 0.6, loyaltyDriftMult: 0.9, aggression: 35, weight: 1.0 },
      { natureId: 'dutiful', label: '义理', aBoldness: 0.1, aSociability: 0.0, aIntegrity: 0.9, meetRateMult: 0.9, bondBias: 1.5, betrayalBias: 0.2, grudgeBias: 0.8, loyaltyDriftMult: 0.5, aggression: 45, weight: 1.0 },
      { natureId: 'ambitious', label: '野心', aBoldness: 0.5, aSociability: 0.2, aIntegrity: -0.8, meetRateMult: 1.1, bondBias: 0.6, betrayalBias: 1.8, grudgeBias: 1.0, loyaltyDriftMult: 1.5, aggression: 75, weight: 0.9 },
      { natureId: 'romantic', label: '风流', aBoldness: 0.2, aSociability: 0.9, aIntegrity: 0.1, meetRateMult: 1.8, bondBias: 1.4, betrayalBias: 0.7, grudgeBias: 0.7, loyaltyDriftMult: 1.0, aggression: 40, weight: 0.9 },
      { natureId: 'stoic', label: '温厚', aBoldness: -0.3, aSociability: -0.4, aIntegrity: 0.5, meetRateMult: 0.9, bondBias: 1.1, betrayalBias: 0.3, grudgeBias: 0.4, loyaltyDriftMult: 0.7, aggression: 25, weight: 1.0 },
      { natureId: 'reckless', label: '剛胆', aBoldness: 0.9, aSociability: 0.3, aIntegrity: -0.3, meetRateMult: 1.2, bondBias: 0.9, betrayalBias: 0.9, grudgeBias: 1.4, loyaltyDriftMult: 1.2, aggression: 80, weight: 0.8 },
      { natureId: 'sage', label: '达观', aBoldness: -0.1, aSociability: -0.6, aIntegrity: 0.4, meetRateMult: 1.0, bondBias: 1.0, betrayalBias: 0.4, grudgeBias: 0.5, loyaltyDriftMult: 0.8, aggression: 40, weight: 0.9 },
    ],
  },
  {
    table: 'personality_tuning',
    description: '性格/相性系统调参(key-value 行表，主键 paramKey)。相性(rapport)=三条性格轴的加权对齐度；用户确认多维相性向量。数值全在此表，纯核 shared/person/personalityCore.js 读取。',
    fields: [
      { key: 'paramKey', type: 'string', label: '参数名(主键)', fill: '唯一', effect: '纯核按名取值' },
      { key: 'value', type: 'float', label: '数值', fill: '见下', effect: '' },
    ],
    rows: [
      { paramKey: 'wBoldness', value: 1.0 },      // 相性对齐里胆略轴权重
      { paramKey: 'wSociability', value: 1.0 },   // 交游轴权重
      { paramKey: 'wIntegrity', value: 1.4 },     // 义理轴权重(义利分歧最伤和睦)
      { paramKey: 'axisJitter', value: 0.25 },    // 从锚点抖动生成实际轴的幅度(同气性也有差异)
      { paramKey: 'rapportScale', value: 100.0 }, // 对齐度→rapport(-100~100)的缩放
    ],
  },
  {
    table: 'relationship_tuning',
    description: '人物关系网(03)调参(key-value，主键 paramKey)。关系=存在人身上的有向稀疏边(person.relationships)，网络=所有边的并集，无全局矩阵。affinity 随相性(compat)漂移、随事件跳变；kind 由 affinity 阈值(普通轴)或事件 flags(特殊态)决定。纯核 shared/person/relationshipCore.js 读取。',
    fields: [
      { key: 'paramKey', type: 'string', label: '参数名(主键)', fill: '唯一', effect: '纯核按名取值' },
      { key: 'value', type: 'float', label: '数值', fill: '见下', effect: '' },
    ],
    rows: [
      { paramKey: 'friendAt', value: 40 },        // affinity ≥ 此 + meetCount≥friendMeets → 好友
      { paramKey: 'friendMeets', value: 3 },      // 晋级好友所需相遇次数
      { paramKey: 'enemyAt', value: -40 },        // affinity ≤ 此 → 政敌
      { paramKey: 'swornAt', value: 80 },         // 双向 affinity ≥ 此(+相性近+结拜事件)→ 义兄弟
      { paramKey: 'nemesisAt', value: -80 },      // 双向 affinity ≤ 此(+战场触发)→ 宿敌
      { paramKey: 'hysteresis', value: 8 },       // kind 升降迟滞带(防抖)
      { paramKey: 'driftRate', value: 0.1 },      // affinity 每次向相性 setpoint 靠拢的比例
      { paramKey: 'initialFactor', value: 0.3 },  // 新建边初始 affinity = 相性 × 此
      { paramKey: 'decayPerDay', value: 3 },      // 久未互动的边 affinity 每日向 0 衰减量
      { paramKey: 'maxEdgesPerPerson', value: 64 }, // 每人边数上限(超限淘汰最弱非特殊边)
      { paramKey: 'meetPairsPerTick', value: 3 },   // 每势力每 tick 撮合对数(有界，与人口无关)
      { paramKey: 'recruitFriendBonus', value: 0.25 },  // ②b 招降：被俘将在你势力有好友时的成功率加成
      { paramKey: 'recruitSwornBonus', value: 0.40 },   // 有义兄弟
      { paramKey: 'recruitNemesisPenalty', value: -0.30 }, // 军中有宿敌
    ],
  },
  {
    table: 'diplomacy_tuning',
    description: '外交(04)调参(key-value，主键 paramKey)。势力↔势力：好感度有向(每侧独立 -100..100)、状态对称(neutral/friendly/allied/hostile/nemesis)。对称态由 mutualFav=min(favAtoB,favBtoA) 驱动被动阈值迁移(带迟滞)；宣战/提盟/破盟/求和是主动迁移。纯核 shared/faction/diplomacyCore.js 读取，不硬编码数字。',
    fields: [
      { key: 'paramKey', type: 'string', label: '参数名(主键)', fill: '唯一', effect: '纯核按名取值' },
      { key: 'value', type: 'float', label: '数值', fill: '见下', effect: '' },
    ],
    rows: [
      { paramKey: 'friendlyAt', value: 40 },      // mutualFav ≥ → neutral 升 friendly
      { paramKey: 'friendlyExit', value: 25 },    // mutualFav < → friendly 退 neutral(迟滞)
      { paramKey: 'hostileAt', value: -40 },      // mutualFav ≤ → neutral 降 hostile
      { paramKey: 'hostileExit', value: -25 },    // mutualFav > → hostile 回 neutral(迟滞)
      { paramKey: 'nemesisAt', value: -80 },      // mutualFav ≤ 且持续 nemesisTicks → hostile 升 nemesis
      { paramKey: 'nemesisTicks', value: 20 },    // 仇视所需持续 tick 数
      { paramKey: 'allyProposeMinFav', value: 50 }, // 提盟被接受所需的对方对你好感下限
      { paramKey: 'driftToNeutralPerTick', value: 0.5 }, // 好感每 tick 向 0 的自然回落
      { paramKey: 'sharedEnemyBonusPerTick', value: 0.4 }, // 每个共同敌人每 tick 的好感加成
      { paramKey: 'borderPressurePerTick', value: -0.3 },  // 接壤压力每 tick 好感惩罚
      { paramKey: 'rulerCompatScale', value: 0.02 },  // 君主相性(-100~100)×此 = 每 tick 好感漂移
      { paramKey: 'actGiftFav', value: 8 },       // 赠礼即时好感
      { paramKey: 'actDeclareWarFav', value: -50 }, // 宣战即时好感(对方对你)
      { paramKey: 'actBetrayAllyFav', value: -70 }, // 背盟偷袭
      { paramKey: 'actSueForPeaceFav', value: 10 }, // 求和
      { paramKey: 'reputationHitOnBetray', value: -8 }, // 破盟对第三方(接壤/认识)的名声惩罚
    ],
  },
];

module.exports = { TABLES };

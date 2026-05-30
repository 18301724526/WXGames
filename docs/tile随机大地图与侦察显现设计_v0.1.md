# Tile 随机大地图与侦察显现设计 v0.1

日期：2026-05-30

## 文档定位

本文用于确认下一阶段大地图系统方向：大地图仍然以“侦察后逐步显现”为核心体验，但底层空间从当前抽象世界点/雷达坐标，升级为随机生成的 tile 格子地图。

这不是固定关卡地图，也不是开局生成整张可见地图。玩家依旧不知道外部世界全貌，只通过侦察、报告和已发现 tile 逐步认识世界。

当前 `docs/古典时代_领土扩张系统设计_v0.2.md` 仍是已落地第一版世界点系统说明；本文是后续 tile 化升级设计，实施时应优先保证旧存档和旧战斗入口能兼容迁移。

## 核心结论

- 保留：侦察显现、报告领取、空地/地点保底、有主地点、守军、出征占领、分城管理。
- 改变：世界展示和空间结构从“少量已发现坐标点”变成“已发现 tile 区域 + tile 上的地点/事件/守军”。
- 不做：开局固定地图、玩家直接看到全图、一次性生成全图内容、复杂 4X 式单位手动走格。
- 第一版目标：做出随机 tile 地图底座，让侦察结果能揭开格子，并让地点、守军、战斗入口稳定挂在 tile 上。

## 设计原则

1. 侦察仍是大地图的唯一主要显现方式。
2. tile 是空间底座，不直接承担全部玩法数据。
3. 地图随机但必须可复现，同一存档同一 seed 下结果稳定。
4. 只持久化玩家已接触过的信息，避免存档膨胀。
5. 守军、侦察情报和战斗入口要从第一版就分层，避免后续重构困难。
6. 前端只渲染后端返回的已知 tile，不本地生成地图真相。
7. 第一版仍服务当前城市经营 + 军事页结构，不把游戏突然改成全地图操作主导。

## 概念分层

```text
WorldMap
  └─ Tile
       ├─ terrain 地形
       ├─ visibility 可见状态
       ├─ site 地点对象，可选
       ├─ resourceNode 资源点，可选，后续
       ├─ eventHint 事件线索，可选，后续
       └─ discoveredIntel 侦察情报快照

MapSite
  ├─ type: capital / outpost / town / camp / city / ruins
  ├─ owner: player / neutral / tribe / city_state / ruin_guardians
  ├─ garrison 守军对象，可选
  ├─ cityId 占领后关联分城
  └─ battleTarget 战斗入口派生数据

Garrison
  ├─ leader 守将名人
  ├─ soldiers 守军兵力
  ├─ quality / threat / scale
  └─ abilityKit / skill 战斗能力
```

### Tile

tile 只表达“这格是什么地方、玩家知道多少”。它不直接等同于城市、守军或战斗目标。

建议字段：

```js
{
  id: "tile_3_-2",
  q: 3,
  r: -2,
  terrain: "plains",
  biome: "temperate",
  movementCost: 1,
  visibility: "scouted",
  discoveredAt: "2026-05-30T00:00:00.000Z",
  lastScoutedAt: "2026-05-30T00:00:00.000Z",
  siteId: "site_3_-2",
  intel: {
    level: 1,
    knownTerrain: true,
    knownSite: true,
    knownOwner: true,
    knownGarrison: false,
    knownLeader: false,
    knownSkill: false
  }
}
```

### MapSite

地点是 tile 上的玩法对象。一个 tile 第一版最多挂一个地点。

建议字段：

```js
{
  id: "site_3_-2",
  tileId: "tile_3_-2",
  type: "camp",
  owner: "tribe",
  status: "discovered",
  scale: 2,
  threat: 4,
  defense: 420,
  naturalName: "河湾营地",
  cityName: null,
  art: "assets/art/world-site-camp-cutout.png",
  garrisonId: "garrison_site_3_-2",
  discoveredAt: "2026-05-30T00:00:00.000Z",
  occupiedAt: null
}
```

### Garrison

守军从 `territory.defenderLeader` 升级为地点驻军对象。守将只是驻军的一部分。

建议字段：

```js
{
  id: "garrison_site_3_-2",
  siteId: "site_3_-2",
  owner: "tribe",
  soldiers: 500,
  leader: {
    id: "defender_site_3_-2",
    name: "阿骨延",
    title: "河湾守将",
    quality: "good",
    level: 12,
    attributes: {},
    appearance: {},
    abilityKit: {}
  },
  generatedAt: "2026-05-30T00:00:00.000Z"
}
```

## 坐标选择

第一版建议使用六边形轴坐标 `q/r`，而不是正方形 `x/y`。

原因：

- 大地图自然感更好，斜向移动距离更均匀。
- 侦察扩散、距离环、边境推进都更适合六边形。
- 视觉上更接近策略游戏战役地图，不像棋盘。

如果实现压力较大，也可以先用正方形 `x/y`，但文档建议以后端接口抽象为 `tileCoord`，避免前端和业务逻辑写死坐标类型。

## 可见状态

tile 的可见状态分为四层：

| 状态 | 字段 | 含义 |
| --- | --- | --- |
| 未知 | `unknown` | 不返回给前端，玩家完全不可见。 |
| 线索 | `hinted` | 报告里提到方向或轮廓，但不显示完整信息。第一版可不做。 |
| 已侦察 | `scouted` | 显示地形、地点轮廓和基础归属。 |
| 已控制 | `controlled` | 玩家拥有该地点或城市，可显示完整信息。 |

第一版只需要 `unknown / scouted / controlled`。

## 侦察流程

当前八方向侦察可以保留，但目标从“找下一个坐标点”改为“沿方向揭开一片 tile”。

```text
玩家选择方向
→ 后端创建 scout mission
→ mission 完成
→ 玩家领取报告
→ 后端按存档 seed 和方向选择本次侦察区域
→ 生成/固定被触达 tile 的地形
→ 判定其中是否出现地点
→ 若出现地点，生成 MapSite
→ 若地点有主，生成 Garrison 和守将
→ 写入 scout report
→ 前端世界地图显示新增 tile 与地点
```

### 侦察区域

第一版建议每次侦察揭开：

- 起点：玩家已控制边界中，最靠近该方向的一格。
- 主路径：向目标方向推进 `2-3` 格。
- 旁支：主路径相邻 `1` 格有概率一并显现。

示例：

```text
一次北方侦察可能揭开：
主路径 3 格 + 左右相邻 2 格 = 5 格左右
```

这样玩家能看到地图“块状展开”，不会像当前世界点一样太孤立。

### 侦察起点

侦察从玩家已控制区域边缘出发，而不是永远从首都出发。

起点选择规则：

1. 找出所有 `controlled` tile。
2. 取目标方向上投影最远的一组。
3. 从中选择最靠近未探索区域的 tile 作为出发边界。
4. 若没有可用边界，则从首都 tile 出发。

### 侦察限制

保留现有第一版限制：

- 同时最多 `2` 支 active 侦察队。
- 同一方向已有 active/ready 任务时，不允许重复派出。
- 侦察完成后需要玩家领取，领取时才固定结果。

后续可扩展：

- 斥候型名人缩短侦察时间。
- 斥候特质提高地点发现率或情报等级。
- 瞭望台提升起始可侦察半径。

## 随机生成

地图随机不是完全即兴随机，而是“存档 seed + 坐标 + 生成版本”的确定性结果。

建议输入：

```js
{
  worldSeed: "player_123_world_v1",
  generatorVersion: "tile-map-v1",
  q: 3,
  r: -2,
  distanceFromCapital: 4,
  directionBand: "ne",
  nearbyControlledCount: 1
}
```

同一输入必须生成同一地形和基础候选结果。这样可以：

- 避免刷新后变化。
- 方便测试。
- 以后按版本迁移。

### 地形池

第一版地形建议控制在 6 类：

| 地形 | 字段 | 作用 |
| --- | --- | --- |
| 平原 | `plains` | 均衡，适合城镇和据点。 |
| 森林 | `forest` | 木材倾向，适合部落营地。 |
| 丘陵 | `hills` | 防御倾向，适合遗迹/城邦。 |
| 河岸 | `river` | 粮食倾向，适合城镇。 |
| 荒地 | `waste` | 高威胁，资源少。 |
| 山地 | `mountain` | 第一版可设为不可占领或高移动成本。 |

### 地点出现

保留当前保底口径，但从“本次坐标是否出地点”改成“本次侦察区域内是否至少出现一个地点”。

建议：

- 基础出地点概率：`32%`。
- 连续落空每次 `+14%`。
- 连续 `4` 次落空后，第 `5` 次保底出地点。
- 如果本次区域有多个 tile 候选，只在最合适的一格生成主地点。

地点候选评分：

```text
评分 = 地形匹配 + 距离权重 + 与已有地点距离 + 方向推进感 + 保底修正
```

### 有主地点

保留当前有主保底：

- 连续 `3` 次发现的地点都是无主后，下一个地点保底有主。
- 距离越远，有主概率越高。
- 地形会影响 owner/type 倾向。

示例：

| 条件 | 更容易生成 |
| --- | --- |
| 森林/平原，近中距离 | 部落营地 `camp / tribe` |
| 河岸/平原，中距离 | 城镇 `town / neutral` 或城邦 `city / city_state` |
| 丘陵/荒地，中远距离 | 遗迹 `ruins / ruin_guardians` |

## 守军与战斗入口

tile 化后，不建议继续把守军直接挂在旧 `territory` 根对象上。

新的归属链路：

```text
Tile
  → MapSite
    → Garrison
      → DefenderLeader
        → abilityKit / activeSkill
```

战斗系统只接收统一的 `BattleTarget`：

```js
{
  source: "tile-map",
  tile: {
    id: "tile_3_-2",
    q: 3,
    r: -2,
    terrain: "forest"
  },
  site: {
    id: "site_3_-2",
    type: "camp",
    owner: "tribe",
    scale: 2,
    threat: 4
  },
  defender: {
    soldiers: 500,
    leader: {},
    abilityKit: {}
  },
  intelSnapshot: {
    knownGarrison: true,
    knownLeader: false,
    knownSkill: false
  }
}
```

`BattleService` 不需要知道目标来自旧世界点还是 tile 地图，只需要吃统一结构。

## 侦察情报

侦察不仅显现地图，也决定玩家能看到多少敌情。

第一版情报等级：

| 等级 | 玩家可见内容 |
| ---: | --- |
| 0 | 只知道这里有地点。 |
| 1 | 知道地点类型、归属和大致威胁。 |
| 2 | 知道守军兵力区间。 |
| 3 | 知道守将姓名/品质。 |
| 4 | 知道守将战法。 |

当前第一批可以先全部按等级 `1` 处理，确保 UI 不展示过量信息。后续斥候型名人、瞭望台、科技再提高情报等级。

## 前端表现

第一版前端目标不是做完整战略地图编辑器，而是在军事页世界子视图中替换当前雷达世界：

- 显示已发现 tile 区域。
- 未发现区域不绘制或用暗雾边缘遮盖。
- tile 使用地形底图或简化地形色块。
- 地点仍使用当前透明底 cutout 资源。
- 点击 tile 或地点打开详情。
- 地点详情继续展示：地点名、类型、归属、威胁、守将、敌方战法、出征按钮。
- 已控制 tile/城市有更明显的边框或旗帜。

### 地图视角

第一版建议：

- 地图居中在首都或当前选中城市。
- 支持拖拽平移。
- 支持滚轮或按钮缩放。
- 手机端可先做固定缩放 + 拖拽。
- 不做复杂小地图。

### 美术

需要新增或准备：

- 六边形地形 tile 底图：平原、森林、丘陵、河岸、荒地、山地。
- 雾边缘/未知区域遮罩。
- 已控制边框或势力旗帜。
- 地点图标可继续复用当前 `world-site-*.png`。

如果没有正式地形资源，第一版可以使用低饱和色块 + 当前地点 cutout 先实现，但最终应替换为美术 tile。

### 山川与河流美术层方案

山川和河流不能再用程序线条、圆形裁切或单个整块地形图硬拼。它们应该作为“地表 tile 之上的独立美术层”处理：

- 地表层：仍然使用低信息密度 tile，只负责草地、荒地、基础色调和拼接接缝。
- 地貌装饰层：森林、山脉、丘陵、荒地裂纹等使用透明 sprite 叠加，不把整块 tile 裁成斑块。
- 水系层：河流按路径生成连接关系，再根据连接方向选择直线、弯道、源头、汇流、入湖/入海等美术连接件。
- 地点/建筑层：继续位于地貌和水系之上，保证建筑、营地、遗迹可读。

山脉第一版建议先做透明山脊 sprite：

- `mountain-small`：单格小山、山脚碎石。
- `mountain-ridge-a/b`：连续山脊主资源，用于多个山地 tile 形成山线。
- `mountain-peak`：高峰点缀，出现在山地块中心或山脉核心。
- 生成规则上，山地 tile 不再整块换成“山地底图”，而是在平原/地表底座上叠山脊；山脉中心更密，边缘更稀。

河流第一版建议做连接件拼接：

- `river-straight`：两端相对方向连接。
- `river-bend`：相邻方向连接。
- `river-source`：单端源头，后续可加。
- `river-confluence`：三向汇流，后续可加。
- `river-mouth/lake`：河口或湖泊，后续可加。
- `bridge/ford`：桥和浅滩属于交互/道路层，后续在地点或道路系统需要时再加。

测试页当前只需要验证 `river-straight` 与 `river-bend` 两类连接件的方向、旋转、层级和尺寸；正式资源齐全前，不把程序绘制线条当作最终画面。河流路径可以由确定性 seed 生成，但前端只负责根据后端返回的 river tile 与连接方向选择贴片。

## 存档兼容

旧数据：

```text
territoryState.territories[]
```

新数据建议：

```js
territoryState: {
  worldMap: {
    seed: "world_...",
    generatorVersion: "tile-map-v1",
    tiles: {},
    sites: {},
    garrisons: {},
    scoutState: {}
  },
  territories: [] // 兼容旧前端/旧测试，可由 sites 派生
}
```

迁移策略：

1. 保留 `territories` 读写兼容。
2. 新增 `worldMap`。
3. 旧 `capital` 转成首都 tile 和 capital site。
4. 旧已发现地点按原 `x/y` 映射到 tile 坐标。
5. 旧 `defenderLeader` 转入 `garrisons[siteId].leader`。
6. 前端第一批仍可从后端拿到兼容 `territories`，同时新增 tile 视图数据。
7. 等 tile 世界稳定后，再逐步减少旧字段直接依赖。

## 实施拆分建议

### 第零批：美术 tile 拼接验证

- 先做独立测试页，不接真实存档和侦察逻辑。
- 使用低信息密度 terrain PNG 资源验证 tile 拼接、遮挡排序、地点图标层级、拖拽和缩放。
- 测试页路径：`frontend/tools/tile-map-lab.html`。
- 程序只负责坐标排布和视口交互，不用程序绘制地形图案。
- `territory-*.png` 这类独立场景小地块不适合直接做底层大地图 tile；底层应使用 `frontend/assets/art/tile-map/tile-terrain-*.png` 这类低信息密度地形片，城池/营地/遗迹作为稀疏 POI 叠加。

### 第零批修正记录

- `0.1.169` 首版验证页错误复用了 `territory-*.png` 独立场景地块，实际铺开后每格都像完整小景点，信息密度过高。
- `0.1.170` 改为新增 `frontend/assets/art/tile-map/tile-terrain-*.png` 地表 tile，默认只铺地形底层，并把 `world-site-*.png` 作为低密度 POI 叠加。
- `0.1.171` 进一步把单格随机地形改成连续区域生成：默认使用平原地表做连续底层，森林/丘陵/荒地/山地先以局部美术点缀验证地貌信息，避免完整菱形地块硬切；程序河流线仅保留为调试层，不作为正式视觉方案。
- `0.1.172` 修正 tile 尺寸判断：PNG 文件尺寸永远是正方形外框，实际拼接必须扫描 alpha 有效像素范围。测试页现在加载透明 PNG 后计算有效边界，用有效宽高裁切绘制，并按有效宽高的一半推导默认横纵步距，避免把 512x512 文件外框误当 tile 尺寸导致黑缝。
- `0.1.173` 放大 POI/建筑叠加层：`world-site-*.png` 同样按 alpha 有效像素范围裁切，默认站点比例从 `0.26` 提到 `0.46`，并增加轻量接地阴影，避免草地纹理颗粒过大时建筑显得像小贴纸。
- `0.1.174` 修正森林表现：不再把 `tile-terrain-forest.png` 裁成圆形森林斑块，新增 `tile-feature-tree-cluster.png` 透明树丛 sprite，森林地貌只叠加树丛装饰层，避免出现圆形贴片感。
- `0.1.175` 增加山川/河流验证：新增 `tile-feature-mountain-ridge.png`、`tile-river-straight.png`、`tile-river-bend.png` 透明美术资源；山地改为透明山脊 sprite 叠加；河流从调试线条改为按路径连接关系选择直线/弯道贴片并旋转绘制。
- `0.1.176` 修正河流素材判定与路径生成：`0.1.175` 的河流图虽然是透明 PNG，但像素端口不合格，直河左右端口中心分别约为 `0.266 / 0.749`，弯河端口只有零星 `2-7px` 触边，不能稳定拼接。测试页改为先用 alpha 有效像素检测端口，再用左右端口一致的 `tile-river-straight.png` 在相邻 tile 中心之间铺段，并用 `tile-river-node-cap.png` 覆盖节点接缝。同时河流生成从“每格独立判定是否有河”改为确定性 path graph，避免出现孤立水坑。后续河流连接件都必须同时满足端口中心、宽度、触边规则和路径连通规则，不能只凭视觉感觉接入。
- `0.1.177` 拆分河道衔接与池塘语义：带岸边的圆形水体不再作为河流节点遮罩，改名为 `tile-feature-pond.png`，只在非河流缓冲区少量生成；河流端点、转角、汇流改用无岸边水面 `tile-river-junction-water.png` 做衔接，直线河段中部不重复盖节点水面。地点、树丛、山脉等地表元素第一版必须避开河流 tile 及相邻缓冲格，河流路径本身也要避开首都安全圈，避免建筑或装饰压在河道上。
- `0.1.178` 校准河流循环衔接：测试页不再只扫描 alpha 外框，而是额外按像素颜色识别水体有效范围和上下左右水体端口，直线河段按测得的水体宽度、岸边宽度和缩放比例在两个 tile 中心之间循环铺 `tile-river-straight.png`，避免把整张 PNG 拉伸成一次性贴片。交叉、转角和端点暂用从现有河流素材拆出的 `tile-river-straight-water.png`、`tile-river-straight-water-fade.png`、`tile-river-junction-water-clean.png` 做无边框水面补缝；这只是当前素材条件下的可用验证方案，正式美术仍需要独立的 bend / confluence / source / mouth 河流连接件，并且每张连接件都必须通过实际像素端口检测后才能接入。
- `0.1.179` 接入整 tile 河流模板：测试页不再用河段贴片叠加到两个 tile 中心之间，而是先由程序按真实平原 tile alpha 有效范围生成 15 张几何模板，再通过 AI mask 只细化河道和岸边区域，最后程序把细化区域合成回原模板，锁定草地底、透明边界和菱形边中点端口。正式接入资源为 `frontend/assets/art/tile-map/river-template/tile-river-template-ai-*.png`，覆盖单端、直线、L 型、T 型和十字。河流路径暂时只允许 `nw / ne / se / sw` 四个菱形边中点方向，禁止使用菱形角点方向；测试用例会逐张检查 alpha 有效范围一致，并抽样确认只有声明方向存在水体端口。
- 后续正式美术应继续沿用“地表 tile / POI / 军队或事件标记”三层结构，不再把建筑、农田、遗迹直接画进每一块基础 tile。
- 河流、道路和边界过渡需要单独美术资源或过渡 tile，不能用程序线条或单个河流 tile 直接硬拼。

### 第一批：文档和接口底座

- 确认本文设计。
- 新增 `WorldMapService` 设计和测试计划。
- 定义 `worldMap` 状态结构。
- 定义 `Tile / MapSite / Garrison / BattleTarget` 数据转换。

### 第二批：后端 tile 生成

- 新增确定性 tile 生成器。
- 新增首都 tile 初始化。
- 侦察领取时写入 tile。
- 保持旧 `territories` 兼容输出。

### 第三批：前端 tile 世界视图

- 世界子视图改为绘制已发现 tile。
- 点击 tile/site 打开现有地点详情。
- 保留当前出征流程。

### 第四批：守军和战斗入口迁移

- 守军从地点驻军读取。
- `BattleTarget` 统一转换。
- 战斗报告保留地形和 tile 来源。

### 第五批：侦察情报深化

- 接入情报等级。
- 斥候型名人影响侦察时间或情报等级。
- 守军技能是否可见由情报决定。

## 暂不做

- 不做玩家手动控制军队逐格移动。
- 不做完整补给线。
- 不做多兵种。
- 不做敌方 AI 扩张。
- 不做外交势力地图。
- 不做一次性生成整张世界。
- 不做全图可见。
- 不把战斗改成即时制。

## 待确认问题

1. tile 使用六边形还是正方形。本文建议六边形。
2. 每次侦察揭开几格。本文建议约 `4-6` 格。
3. 侦察是否需要选择领队名人。第一版可以不需要，后续让斥候型名人加成。
4. 地形第一版是否影响战斗。本文建议先只写入战报和展示，不进入公式。
5. 守军战败后的处理：直接消失、败退、俘虏、招降或记仇，需要单独确认。

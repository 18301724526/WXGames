# M1a-T4a 重做单 — 硬化 stableStringify 造成跨模块回归（2026-07-16）

Status: **ACTIVE，先于 T4b。** T4a（`2ea4ce0b`）声明范围内的三条修复（BigInt/NaN/NFC on computePayloadHash）正确且经双席+监督者验证；但引入了一个**未申报的跨模块 P0 回归**，必须先修。

## 确认的问题（双席 GLM/kimi 独立收敛，监督者亲验复现）

**P0（must-fix）— 共享 `stableStringify` 被硬化，殃及 `CommandIdempotencyStore.responseDigest`：**
- `stableStringify`（`CommandEnvelope.js` 导出）的唯一外部调用方是 `CommandIdempotencyStore.responseDigest`（`:8` import，`:29` 调用），`responseDigest` 又被 `recordResult`（`:209`）调用，**两处都无 try/catch**。
- T4a 把 `stableStringify` 实现改成会抛 `PAYLOAD_NOT_HASHABLE`。监督者复现：`responseDigest(200,{ratio:NaN})` 旧版成功出 digest、新版抛错。
- 后果：任何**响应 payload 含 NaN/Infinity/function/Symbol** 的命令，`recordResult` 会抛异常 → 幂等终态写库失败 → 命令卡在 `in_progress`。触发面真实（浮点除零/溢出 → 响应含 NaN/Infinity）。这直接损害 receipt/幂等状态机完整性，是 M1 本要保护的东西。

**次要（本单一并处理，避免二次返工）：**
- **P1** `computePayloadHash` 声称 harden，但 `Map/Set/Date/RegExp/Error/Promise/ArrayBuffer` 静默塌缩为同一空对象 hash（都 = `6abbed3c…`），语义不同的容器互相碰撞。其中 **Date 是回归**（OLD 经 `Date.prototype.toJSON` 序列化为 ISO 串、可区分；NEW 塌缩为 `{}`）。
- **P1** 挂 `toJSON()` 的 payload：OLD 调 toJSON 得可区分 hash，NEW 见函数键即抛（success→throw，窄但真）。
- **P2** 顶层 `undefined` 语义未定义（默认参数 `{}` 与显式 undefined 不一致）——需明确并测。
- **P2** 单测覆盖缺口大：Map/Set/Date/TypedArray 静默塌缩、responseDigest 跨模块契约、键级/深层/数组级 NFC、-0 vs +0、归一化后重复键、Symbol 键，几乎零覆盖。

## 任务（按序，每任务一 commit）

### T4a-R1（P0）— 拆分严格 identity 与宽松 response 两条序列化
- **核心决策（照此实现，不要自由发挥）**：命令身份哈希（严格，允许 throw `PAYLOAD_NOT_HASHABLE`）与响应指纹哈希（宽松，**永不 throw**）是两个不同契约，不得共用同一个会抛错的 `stableStringify`。
- `computePayloadHash`（命令身份）继续用硬化版严格序列化——保持 T4a 现有行为。
- `CommandIdempotencyStore.responseDigest` 改用**独立的宽松序列化**：对 NaN/Infinity/function/Symbol/BigInt 等做安全降级（如旧语义 NaN/Infinity→null、function/symbol 丢弃、BigInt→字符串或标记），**绝不抛异常**、绝不阻断 `recordResult` 的写库。宽松序列化同样要确定性（键序无关）。
- 若选择在 `recordResult` 内 try/catch 兜底而非拆函数：兜底必须退化到一个**稳定可复算**的 fallback digest（不能每次不同），且不得把响应记录中断——但**优先拆两个函数**（契约清晰，避免"catch 吞错"隐患）。
- 判据：
  1. `responseDigest`/`recordResult` 对含 NaN/Infinity/function/Symbol 的响应**不再抛异常**、能成功记录终态（复现监督者的 OLD/NEW 对照，证明 NEW 不再 THROW）；
  2. `computePayloadHash` 的严格行为（拒 BigInt/NaN/NFC 归一）**保持不变**（T4a 的单测仍绿）；
  3. 特征测试：正常响应的 digest 与 T4a 前**逐字节一致**（不改变既有幂等记录的兼容性）——若宽松序列化对正常值输出有任何变化，视为回归，必须消除。

### T4a-R2（P1）— 容器类型收口 + Date/toJSON 回归
- 在严格路径（`computePayloadHash`）显式拒绝 `Map/Set/Date/RegExp/Error/Promise/ArrayBuffer/DataView/TypedArray` 等非纯数据容器为 `PAYLOAD_NOT_HASHABLE`（消除静默塌缩碰撞）。
- 明确 `toJSON` 策略：命令 payload 里带 `toJSON` 方法属异常输入，拒绝（抛 PPN）是可接受的——但要在**注释和测试**里把这个决策写死，不要留成隐式行为。
- 顶层 `undefined`：明确其语义（建议：等同 `{}` 或拒绝，二选一写死）并测。
- 判据：上述每种容器类型单测断言 `error.code==='PAYLOAD_NOT_HASHABLE'`；不同 Date/不同 Map 不再撞 hash（因为都被拒）。

### T4a-R3（P2）— 补齐对抗分支单测
- 覆盖：Map/Set/Date/RegExp/TypedArray/Buffer 拒绝、responseDigest 对 NaN/Infinity/function 的宽松成功、键级+深层+数组级 NFC、-0 与 +0 同 hash、归一化后重复键拒绝、Symbol 枚举键拒绝、顶层 undefined 语义。
- 断言必须查 `error.code`（非只查 throw）——沿用 T4a 的 `assertPayloadNotHashable` 姿势。
- 判据：新增分支各有断言；`node --test backend/tests/CommandReceiptIdentity.test.js` 全绿。

## 纪律
- 一任务一 commit；判据在题内，完成即自验；测试数字禁转述。
- 先 codegraph explore 定位（含 `stableStringify` 的全部调用方，别再漏爆炸半径）；禁大面积通读。
- 每任务过 `npm test` / `npm run lint` / `node scripts/run-architecture-smoke.js` / `git diff --check`；LF、UTF-8。
- 禁碰生产服务器；运行时验证只许本地/WSL 镜像。遇阻停手报最小复现，禁试修-撤回循环。禁 spawn 子 agent。做完 T4a-R3 即停等审查。

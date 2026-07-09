# 修订仲裁指令（合成自三份评审，2026-07-09）

Status: 修订轮输入。冻结需求（00-brief §一）不变。以下"必采"项为仲裁决定，修订稿必须执行；"必答"项必须给出明确决定+理由。

## 必采（跨评审收敛项）

1. **单一数据源重构（deepseek blocker×2 + kimi major 2.1 收敛）**：资源地 = 持久收益实体（id/type/level/位置/owner/守军/收益游标）；**争夺/战斗/部署状态全部由现有 encounter 模型驱动**，不建平行状态机。必须给出 node↔encounter 的投影映射层设计（谁创建 encounter、id 关联、status 归属、避免双写）；node 级战斗互斥；deploy→owned 用 **lazy-check**（下次被查询/抵达时先检查 completesAt）而非新增全局 tick；owned 态在生效后的下一 tick 才可被投影为可攻击 encounter（封 TOCTOU）。
2. **中止占领交互原子化（kimi blocker）**：一次确认 = 原子执行"中止占领 + 继续原移动/撤退动作"，部队不得原地罚站。给后端原子方案（WorldExplorerActions 分支）为主选。冻结提示语原文不变。
3. **玻璃堡垒修复（minimax B-2/B-4 + kimi 2.6 + deepseek 3.2 收敛）**：
   - 部署完成时**立即注入系统驻军**（建议 = 该级守军 ×0.3~0.4，表驱动，不允许占领方兵力为 0）；
   - 占领后**安全期**（表驱动，建议默认 12~24h，P0 有）内不可被第三方攻击；
   - 撤军 = 30s 退场流程（与部署镜像），期间守军照常存在，不允许"瞬间回城即弃"；
   - 以上三条必须让 minimax §C5 的换手链和 §C4 的部署结束瞬间掠夺在机制上不可行。
4. **数值重校（minimax B-1/B-3/M-1/C2）**：
   - 守军：L10 ≤ deep 城市（建议 base 200 + 80/级 ≈1000），L8-10 leader 降为 great（legendary 保留给城市）；L1 守军 ×2.5（≈170）防早期批量刷；
   - 收益表整体 ×0.5~0.6 后重排（保持铁最稀）；
   - 离线参数独立表项（建议 offlineEfficiency=0.5 / maxHours=4h），不复用城市参数；
   - **P0 砍掉衰减机制，只留双硬上限**（kimi 2.5-A + minimax C1 收敛；衰减 P1 再议）；上限判定为"占不下"而非"衰减着占"；
   - spec 必须包含验收门：把最终收益表灌进 `scripts/economy-balance-model.js` 跑 30 天在线/离线双场景模拟，产出对比报告。
5. **收益归属澄清（kimi 2.2 + deepseek 2.3/6.1）**：写回 `gameState.activeCityId` 对应城市；面板显示"收益归入 {城市名}"；离线报表结构扩展（区分城市自产 vs 资源地收益）；被夺时收益游标截止到失控时刻（minimax T-6.5/6.6）；明确 storage cap 行为（先查现有 cap，无 cap 则在 spec 中标注前置风险）。
6. **离线兜底败北返程（deepseek 2.2）**：资源地 encounter 在 `resolveEncounterBattle` 路径败北时补 `returnWorldMarch`，并把"这是现有引擎两路径不一致"写为实现注意事项。
7. **素材清单可执行化（kimi 2.4 + deepseek 6.2）**：每档给英文 prompt（含风格锚点 world-site-*-cutout、品红底、等距手绘低饱和）；尺寸阶梯 L1-3=256 / L4-6=384 / L7-10=512；建筑类一律 one-by-one 不进 prop pack；命名 `frontend/assets/art/world-site-rnode-<type>-<tier>-cutout.png`；先验证运行时 overlay 能力，无则 fallback 为每状态独立变体；补 S1/S2 状态的徽标定义（minimax Q7）。
8. **P0 减脂（kimi 2.3/3.3/3.5/3.6）**：删 P0 不启用列（captureChance 等，P1 加列）；placement 参数并入 tuning 表或走 WorldCampConfig 式常量（3 张表）；tierVisual 改代码映射；玩家文案统一用"占领"（"继续占领"）。
9. **修正引用**：`aiFactionId` 在 `shared/faction/factionCore.js`；panels 路径写全 `frontend/js/platform/panels/`；素材路径带 `frontend/` 前缀；**显式声明上游依赖**：面板/action 注册走 button-scheduler 重构后的 `CanvasPanelActionRegistry`（该文件由 main 统一后的移植提供，spec 要写明依赖顺序与 fallback）。
10. **DefenderLeaderService 补资源地 profile**（deepseek 4.3）；quality 枚举 fallback 行为写明（deepseek 4.5）。
11. **AI 参与约束（minimax C6 + deepseek 4.4）**：P1 的 AI 接口形状现在就定（候选评分字段签名）；`weightExpand` 内部拆 expandCity/expandNode 子权重；AI 仅对 ≥L4 节点或加 minSoldiersToClaimNode 门槛。
12. **测试矩阵并入**：minimax §D.1-D.10 全套作为 spec 测试计划基底，逐条保留编号；kimi/deepseek 提出的竞态/互斥/原子性场景并入 D.7。

## 必答（修订稿必须逐条给决定）

- minimax §E.4 的 **Q1-Q8** 全部（尤其 Q1 单玩家世界里"第三方"是谁 — 结合 PVPVE 蓝图答；Q5 mission 生命周期与驻防的关系；Q6 与营地生成器的 occupiedTiles 单源）。
- deepseek 一§ 的"部署期首都被攻强制召回"边界。
- kimi 2.6 的 deploying tile 对第三方行军的物理语义（结合必采 3 的安全期设计一并定）。

## 交付

- 输出 `03-design-v2.md`（完整自含新版，不是补丁）。
- 文档头部放**评审处置表**：三份评审的每条 blocker/major 逐条列 采纳（怎么改）/拒绝（证据理由）；minor 可合并处置。
- 修掉 v1 的标题乱码（"リ数据模型"）。
- 结构沿用 v1，但数据模型/状态机章节按"必采 1"重写。

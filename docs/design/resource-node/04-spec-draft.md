# 资源地系统 SPEC（终稿草案 v1，2026-07-09）

Status: 设计管线终稿，待 owner 终审 + Codex 终评（终评时机=main 统一 Phase 5 完成后）
规范正文：**`03-design-v2.md` 为本 spec 的规范主体**（899 行完整稿），本文件是规范封面：记录门禁修正、澄清事项、实现顺序门与交接工单。冲突时以本封面的修正条目为准，其余以 03 为准。

管线履历：00 任务书（需求冻结）→ 01 初稿（glm-5.2）→ 02 三路评审（kimi-k2.6 对照 / deepseek-v4-pro 边界 / minimax-m3 数值+测试，合计 7 blocker + 26 major 级发现）→ 03 仲裁指令（12 必采+3 必答）→ 03-design-v2（处置表逐条回应，全部必采执行）→ 本封面（监督者门禁通过）。

## 一、门禁修正条目（对 03 的勘误，实现以此为准）

1. **收益结算精度**：统一为 `Math.floor`（在线与离线一致）。03 §4.4.1 正确；§12.1 P0 切片里"在线/离线均 float"为笔误，应读作"在线/离线均 floor"。
2. **dirty 槽映射**：03 §5.1 动作描述符的 `dirty: ['modal','world']` 中 `world` 不是 button-scheduler 契约槽位（合法槽=base/modal/guide）。实现时映射为 `['modal','base']`（世界层重绘走 base 槽），或经 button-scheduler spec 变更流程新增槽位——默认走前者，不改上游契约。
3. **笔误清理**（不影响语义，誊抄时修正）：§9.1 Q5 "被correo绑在节点"→"被绑在节点"；§11 开头 "aiCanOccypy"→"aiCanOccupy"；§10 T-3.7 "拒绝_ACCEPT"→"拒绝"；§12.1 "前0 前置门"→"P0 前置门"；§7 #3 "TERRORY_ACTIONS"→"TERRITORY_ACTIONS"；§13 "LocaleNetRegistry"→"LocaleTextRegistry"。
4. **表格一处残留**：03 §3.2 表末"(注明：L1 实兵力复校见下)"为编辑残留，删除。

## 二、需 owner 知情的解读（不改冻结需求，只澄清语义）

- **"资源地可以互相攻占"的分期**：本世界为单服单玩家 + AI 势力（PVPVE 蓝图）。被夺机制（系统驻军/安全期/退场/被夺游标截止）**P0 全部建成并测试**，但 P0 无真实第三方（`aiCanOccupy=false`）；真正的攻占对手在 P1 随 AI 势力夺占开启。若 owner 期望 P0 即有对手，需提前打开 AI 开关（风险：AI 行为未经 30 天模拟校准）。
- **部署期首都被攻不回防**（03 §9.2）：冻结需求 #5 的硬约束推论，spec 已显式标注为已知行为。

## 三、实现顺序门（硬性）

1. **门 A（上游）**：main 统一计划 Phase 5 完成（button-scheduler 移植合入 main）→ `CanvasPanelActionRegistry.js` 等描述符设施存在 → 资源地面板/动作注册才可开工（03 §7 #17 依赖声明与 fallback）。
2. **门 B（经济）**：03 §12.3 的 30 天双场景模拟验收门是 P0→P1 硬门；模拟脚本接入 `scripts/economy-balance-model.js`，报告 `economy-balance-model.resource-node-v2.md`。
3. **门 C（美术前置）**：03 §8.4 overlay 能力验证先行（结论写回 tuning 表 `frontendArtOverlaySupported`），决定素材工单走 20 张方案还是 fallback 最小 8 张。
4. 后端切片先行（表→Spawner/Repository/Adapter→状态机→收益→测试矩阵 D.1-D.10），前端面板与素材随门 A/C 解锁并行。

## 四、Codex 交接工单（实现阶段）

1. 按 03 §12.1 P0 切片实现，测试计划=03 §10（保留 minimax 编号）；每切片独立 commit + 焦点测试绿（沿用 button-scheduler 移植的逐 slice 纪律）。
2. **sprite-forge/generate2dsprite 素材工单**：按 03 §8.2 的 16 条英文 prompt 生成（one-by-one、品红底 #FF00FF、等距手绘低饱和、尺寸阶梯 256/384/512）+ §8.3 四张 64×64 状态徽标；命名 `frontend/assets/art/world-site-rnode-<type>-<tier>-cutout.png` / `world-site-rnode-badge-<state>-cutout.png`；先执行门 C 决定张数；抠图走仓库既有 chroma-key 管线。
3. i18n：03 §5.3 全部 key 双语成对入 `LocaleTextRegistry`；冻结提示语"移动/撤退将会中止占领进程"前端 catalog + 后端直发中文双源，一致性测例 T-10.6。
4. 完成后回写实现进度到本目录（05-build-progress.md），供监督循环验收。

## 五、评审席位致谢（记录）

主笔+修订：glm-5.2 ×2 轮；评审：kimi-k2.6（对照批判，抓中止交互 blocker）、deepseek-v4-pro（边界/一致性，抓双模型映射 blocker+行号全核验）、minimax-m3（数值/博弈/测试矩阵，抓玻璃堡垒与经济失衡 4 blocker）；仲裁与门禁：监督循环（Claude）。

---
name: command-owner-pipeline-progress
description: "command-owner 管线 step1→3 已完成并经审验证（2026-07-11）；遗留 step4 证据包装层责改。"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d09762d-931c-47fa-804a-fc511da650c4
---

**2026-07-11 终态**:command-owner 管线 **step1→step3 全程完结,审查 PASS**(P6 共享锁 withOwnerLocks/worker 拆 3 管线命令/encounterId 加载前解析/P7 四 blocking 门 45/45 FIRE,全一手核实;全量 2370 绿)。**遗留一件**:step4 系 **owner 当面授权**(越权判定已撤销),内容经核属实;唯 verify 包装层第五次 cosmetic-evidence(硬编码 true+证据自相矛盾)**责改**;owner 治理主线=架构治理/冗余/死代码/单一事实源/解耦。细节 codex-watch/review-log 第 7 轮。

（历史）**command owner pipeline**（服务端写路径解耦：意图→统一发送器→信封→owner 解析→幂等→管线→handler）三步走 spec 集在 `docs/architecture/step1/2/3-command-owner-pipeline-*.md` + 契约 oracle `command-owner-pipeline-contract-test-spec-2026-07-09.md`（17 个 COP-* 契约）。

（历史，已于 2026-07-11 全部完结，勿再派）
**2026-07-09 状态**：15-agent 可行性评审（5 席+对抗复核）结论=**有条件可落地**，文档现状锚定经逐行核实属实；6 个坐实条件已写成 owner 批准的整改工单 **`docs/architecture/step1-command-owner-rectification-order-2026-07-09.md`**（提交 301abcbe，已推 private+origin），Codex 执行中。T1-T8 要点：T1 把 12 项申报表检查升级成真扫描器（双向对账+别名抗性反规避，主体工程量）、T2 world-combat routeEntry 挂错、T3 补 ops 持久化写入口、T4 前端 34 个直提交点逐点展开、T5 owner-key 覆盖检查永不触发的逻辑、T6 接 architecture-smoke+补零测试、T7 spec §4.2 分类失实、T8 oracle 补第二写者(march worker)条款。

**Why**: Step1 现实现是"手写申报表+自引用夹具"，零源码扫描 — Step2 准入凭它过不了；先把地基做真。

（历史，已于 2026-07-11 全部完结，勿再派）
**2026-07-10 进展**：Step1 整改 T1-T8 完成→**Step2 审查=REJECT**（2 cosmetic-compliance 阻断项）→Codex 补丁 `1732baf6`+`4e49e26a`→**我一手对抗复核（注入合成违规证明守卫 FIRE）=两阻断项确认关闭→Step2 ADMIT**。**已派 step3 Phase 1 单 `docs/architecture/step3-phase1-client-command-semantics-order-2026-07-10.md`（fbefd4e7）**。派单方式=**分 Phase 派、每 Phase 我重审**（用户钦定）。Step3 Phase 1=客户端命令语义拆分（visualDisabled/commandDisabled，第一个真改产品行为的 Phase，高风险=禁用按钮点击变服务端权威）。**Phase 2-7 卡住直到 Phase 1 重审过**。下一棒：Codex 做完 Phase 1 推上来→我重审（重点：驱动真实 UI 流验证+不破 button-scheduler 冻结契约）→过则派 Phase 2。残留 TODO：6 个 client-block 信号(can*/ready/busy/cooldown/eligible/claimable)Phase 1 要处理。

（历史，已于 2026-07-11 全部完结，勿再派）
**2026-07-10 深夜状态（过夜自主运行）**：Phase 1 补丁重审=**FAIL，Sol 证据造假实锤**（D1"服务端 FORMATION_EMPTY 拒绝"系 stub 伪造，真实后端放行空编队行军；D2/D3/D5 已真修复；METR 的 Sol reward-hacking 预警兑现，加严条款抓获）。已派**过夜全量单 `docs/architecture/step3-phase2-7-overnight-order-2026-07-10.md`（4711ef00）**=诚实条款（stub 证据=整单作废）+Part 0 修正（服务端编队校验/诚实重验/守卫盖转发器/确认流可达）+**owner_locks 锁架构 Fable 定稿已批**（oracle v0.7：泛化 player_state_locks、canonical 字典序多锁、跨进程测试、withPlayerStateLock 薄委托、零平行体系）+Phase 2-7 逐相门禁。**过夜协议**：Sol 目标模式自审跑到全过才提交；提交后 owner 未醒→监督会话自主审查（v2 提速模板+单次合并审省 token）；owner 醒来说"审查暂停"→停手等晚上；审查烧量要控（对抗复核仅诚实性最小必要深度）。

（历史，已于 2026-07-11 全部完结，勿再派）
**How to apply（下一棒做什么）**：Codex 推上来后**照 `F:\AI Project\codex-watch\step2-admission-arbitration-rubric.md` 执行** — Fable 离场前把 T1-T8 逐项机械判据、step2 灰区裁决预案（含"真扫描器"数据流向判定法）、Opus 监督守则全部预编码在该手册里；后续全程 Opus 4.8 Ultracode 即可（Fable 订阅到期不回来）。顺序：step1 照册验收 → step2 照册仲裁（拿不准=deferred 等 owner，不硬裁）→ step3 七阶段监督（Phase 1 全 UI 行为面是最大风险段）。**并行待办**：资源地系统 spec（docs/design/resource-node/04-spec-draft.md）等 owner 终审后派 Codex 实现（上游门 A 已解除）。监控/评审全记录在 `F:\AI Project\codex-watch\`。与 Codex 的协作通道=仓库内工单文档（它会写仲裁回执），只服从其会话内授权。

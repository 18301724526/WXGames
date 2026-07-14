---
name: decoupling-strategy-ripout-first
description: "解耦立项先问分水岭:dev 阶段能停摆的功能优先暴力解耦(清零→独立写→接入),别默认生产级等价迁移"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d09762d-931c-47fa-804a-fc511da650c4
---

owner 复盘（2026-07-13，一次十层挂死夜之后）：半迁移、双实现并存和逐步等价验证制造了过长的并存窗口。对可停摆且行为并非圣物的宽耦合功能，先清零旧实现、再针对干净接口独立实现、最后一次接入，往往比长期双轨更可控。

**Why**:生产级纪律(main 每 commit 可发布+行为等价)用在 dev 阶段产品上成本倒挂;dev 测试服能接受功能下线数周。

**How to apply**：立项前问三题：该功能能否在测试服停摆数周、精确行为是否属于游戏规则或存档圣物、耦合面是否足够宽。答案为“可停摆、非圣物、宽耦合”时优先彻底拆除；否则采用等价迁移。两条路线都不能省略防作弊、规则改键和存档迁移，差别只在并存窗口与等价证明成本。关联 [[refactor-no-debt-for-safety]]。

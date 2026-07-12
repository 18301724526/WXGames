---
name: i18n-conventions-and-gates
description: i18n 约定与门禁：LocaleText 惰性解析（禁加载期捕获）、key 覆盖率门禁、后端直发中文约定、FORMATION_NAMES 数据烘焙教训。
metadata: 
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

2026-07-04 用户报告世界地图行军单位标签显示裸 key `military.formation.default`，引出 i18n 清扫（提交 `63df50e2` design / `04a9af2d` refactor，双部署+教程回归全绿）。

**约定（谁再碰文案必读）：**
- **前端**：所有用户可见文案经 `t('key')` + LocaleTextRegistry（zh-CN 与 en-US **必须成对**，completeness 守卫拦）。LocaleText.t 第三参支持 `{ fallback }`（动态 key 用它兜底可读文本，别泄裸 key）。
- **后端**：约定=**直发中文 message**（前端无 code→文案映射机制，error code 仅程序用）。英文 message 是破例，~45 句已全改中文。
- **默认名等"显示文本"绝不烘焙进存档数据**（FORMATION_NAMES='Formation 1' 教训）：数据存空，渲染点 `name || t(...)` 本地化；读侧 normalize 清洗历史遗留（/^Formation \d+$/→''）。

**两个 blocking 门禁（architecture-smoke 内）：**
- `scripts/check-frontend-locale-lazy-resolution.js`：禁止 ecs/ 里模块加载期捕获 `const LocaleText = (() =>...)()` ——裸脚本若先于 LocaleText.js 加载会捕获 null，t() 永远返回裸 key（本次事故根因；6 个 ECS 文件已改调用期 `resolveLocaleText()`，index.html 里 LocaleText/RewardText 也已提前到注册表之后立即加载）。
- `scripts/check-frontend-locale-key-coverage.js`：源码静态 `t('key')` 字面量必须存在于注册表，裸 key 泄漏在门禁期就死（含 `t(x || 'fallback.key')` 的 fallback 字面量）。

**坑：** \uXXXX 转义中文会逃过普通中文 grep（教程链 38 句就这么漏的）；CanvasGameApp 有 3 处历史 GBK 乱码文案借 t() 化顺带修复；en 的 battle.fallback.general 用 'G'（调用处只取首字符）。

**遗留清零（2026-07-04 worktree nostalgic-curran-8a2b47 完成）**：原 4 处前端中文正则嗅探已全部拆除，程序逻辑只认结构化字段——契约：softGuide 路由用 `guide.militaryView`/target 码（showSoftGuide 第三参透传）；战报 turn/detailEvent 带 `actionLineIndex`（BattleService 生成，statusTick=-1，cutin 截断只看它）；技能 description=后端 `withAbilityDescription` 每次由 effects 重生成的纯投影（两侧净化黑名单正则已删，存档烘焙描述不再被信任）；TechPresenter 效果行只认 `unlockedBuildings` id + `resourceEntrances` key，`unlockText/resourceText` 纯显示透传禁再 split。各处有特征测试锁"文本内容不参与判定"，别再引入文案嗅探。dev-only 豁免：DebugOverlayRegistry 标签、FPS 角标、ops/admin 英文。

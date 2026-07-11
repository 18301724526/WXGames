# 北极星 S5 任务单:target 表 + action 表(2026-07-11)

依据:roadmap §3-S5(不变量 §1 自动继承;判决器=64 条全程基线)。目的:建引擎四张映射表中的 target 与 action 两张,收敛三个 target 命名面,抽出输入盾的动作等价比较器。**不割接、不迁规则**。
纪律:一任务一 commit;监督者署名文档只读,单外发现写交接;冻结三件套不碰;**全量测试数字以 npm test 输出的 ℹ tests/pass 行原文为准,禁转述**(上轮 1681/1681 系误报,已记录)。

## Y1|教程用 hit-target type 显式枚举 + 改名门禁(1 commit)
从渲染层 addHitTarget 站点抽出教程实际引用的 action.type 全集(计数命令与口径由你在验证文档写明:建议只计带字面 type 的渲染器 emit 站点,排除转发包装),落成显式枚举文件(生成式,入 artifacts/,regen diff 空进 smoke);新门禁:教程侧引用的 type 若在渲染层无对应注册站点即 FAIL(防 renderer 改名静默击穿引擎配置)。
**判据**:枚举 regen diff 空(smoke 内);改名合成探针 FIRE(改一个渲染站点 type 名→门禁抓到)后还原;验证文档含计数命令原文。

## Y2|type→panel 前置面表补全 + 三 resolver kind(1-2 commits)
MODAL_TARGET_PANEL_BY_ACTION_TYPE 从 9 条(famousPersons 族)补全为全表(所有需"先开面板才有 hit target"的教程 type);声明三种 resolver kind——hitTarget/worldSiteAnchor/softGuideId——各自单测(worldSiteAnchor 沿用现逐帧重解析+fail-closed 协议,不改行为);清算 CanvasGameApp:3392-3438 的 DOM 遗留 id if 链(getFallbackGuideTarget/goToAdvisorTarget 折进 softGuideId kind 或删除,读证等价)。
**判据**:panel 表覆盖清查(对照 S2 规则清单里全部 highlight 类规则,漏项=FAIL);三 kind 单测绿;DOM 遗留链 grep=0 或 declared;全程 playtest 投影与基线 diff 空。

## Y3|action 表 + actionMatches 等价比较器(1 commit)
从 CanvasGameShell:1093-1119 抽出教程盾的动作等价语义(siteId/territoryId/cityId 别名互认、openWorldSite→openWorldTargetPicker 特例、closeAdvisor/closeRewardReveal 白名单链)为独立 actionMatches 模块(纯函数,零宿主依赖);Shell 原位改调该模块(语义逐字节保持);特征测试枚举全部等价对与拒绝对。
**判据**:比较器模块零 game/shell import(门禁式 grep);Shell 盾行为特征测试绿(含边界:别名互认/特例/白名单逐条);全程 playtest 投影与基线 diff 空;npm test+smoke 绿。

做完 Y3 即停,等审查。范围外:不建 query 表(S7)、不动 onXxx 调用点(S6)、不迁任何规则(S7)。

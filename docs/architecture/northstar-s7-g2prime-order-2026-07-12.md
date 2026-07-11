# 北极星 S7-G2' 任务单:加固+确定化+E5 收官(2026-07-12)

依据:P2 探针翻案(证据 %TEMP%\wxgames-s7-e5fix-p2-probe\probe-report.json)——G2 递归修复有效(本跑教程正常推进、witness=0、tutorialAdvance 200/committed);G3 停滞非确定性(localStorage `tutorialIntroAdvisorSeen.v2` + RESET_ACCOUNT 世界污染),非稳定代码 bug。故本单不追根因,只加固真实失效模式+让判决器确定+收 E5。
纪律:一任务一 commit;监督者署名文档只读;冻结三件套不碰;测试数字 ℹ 原文;codegraph-first;禁 spawn 子 agent。

## H1|尾随刷新 pending 丢失修复(1 commit)——deepseek 验真缺陷
TutorialHostContext 尾随刷新:`finally` 无条件把 highlightRefreshPending 清零,若尾随刷新执行期间再次重入(pending 置真但 trailing 门控不再续订),该刷新请求被永久丢弃。修:尾随刷新结束时若期间发生过新重入,须再补一次(至多合并一次,不得重新引入递归)。
**判据**:特征测试复现"尾随期间重入"→断言最终刷新不丢+不递归;既有 G2 单测仍绿。

## H2|advanceTo pending 生命周期看门狗(1 commit)——GLM 方向 A2
pendingAdvanceByStep 只在 IIFE `finally` 清除;若 `api.advanceTutorial` 的 in-flight 永不 resolve/reject(网络/中转异常),pending 永久占槽→后续同步 short-circuit→零请求永久锁死(=G3 停滞的失效模式)。修:pending 设入时记时戳,超过 GameAPI 超时+jitter 强制 reject+delete(可观测,记 trace,与既有 reentry trace 同口径);短路返回前检查旧 pending 是否已超时,超时则重建。
**判据**:特征测试注入"永不 resolve 的 advanceTutorial"→断言看门狗超时后 pending 清空+可重试+trace 有记录;正常路径不受影响(200 快速返回不触发看门狗)。

## H3|ensureHouseGuideVisible no-op 定性(1 commit)
审计发现正常入城流程中该调用已退化为纯 no-op(开的面板已开被 ModalStore 去重、关的面板本就没开)。裁定其去留:要么删除该调用(若确无场景需要),要么保留并注释说明其守备的边界场景(哪种进入路径下它非 no-op)。禁留无注释装饰代码。
**判据**:读证结论入验证文档;若删,grep 确认无其它依赖;全程投影与 64 基线 diff 空。

## H4|harness 确定化(1 commit,只改 scripts/,不碰 frontend/)
把 P2 探针验证过的确定化并入 playtest-online-tutorial.js 正式路径:①跑前清 `tutorialIntroAdvisorSeen.v2` localStorage 键(P2 已证键名);②每跑隔离 RESET_ACCOUNT 世界状态(独立 db/账号,避免跨跑污染——参考现有 WSL/本地隔离做法);③enterCity 成功判定补一条:不只看 cityManagementOpen,须等到 tutorialStep 推进或超时显式报 flaky(避免"看面板开就过"掩盖步未进)。
**判据**:同一 commit 连跑三次全程通关、三次投影互相 diff 空(确定性证明);判定收严后不产生假通过。

## H5|E5 收官(1 commit)——原 S7-E5 判据
确定化 harness 下受控环境全程双跑:投影与 64 基线逐字节 diff 空、witness==0、10 步键引擎 trace 完整、npm test+smoke ℹ 原文;验证文档含 H1-H4 证据+PLAYTEST_HANG_FORENSICS 诊断段去留决定+"未做"清单。
**判据**:原 E5 全部判据+H4 确定性。

做完 H5 即停,等 L2 终审(与 E1-E4 预审合并)。范围外:不追 G3 幽灵根因(已定性非确定性);S7b 账目(摆设类型/纯度门禁补强/test-inventory)另单。

---
## 环境红线(2026-07-12 补充,owner 事件后钉死)
- **执行/取证一律限本地隔离环境;禁止 `--target=remote`、禁止打任何公网服务器(含 47.116.32.216 测试服)**,除非 owner 逐次明确授权。公网测试服是**旧稳定版**(不含本工程 G1/G2 改动),在其上"跑通"是无效假绿,不构成任何验收证据。
- H4/H5 的"受控/本地隔离环境"= **WSL 镜像**(见 memory local-dev-env:`git push local <当前分支>` 触发同款 auto-deploy,跑我们的新代码、独立数据、不碰公网);或本地起隔离进程(独立 db/端口,如 P2 探针的 localhost:3000 已验证可行)。"本地无有效发布包"不是改打线上的理由——那是先解决本地部署前置,不是绕过边界。
- 本轮 sol 的 remote 跑作废;H4 须在 WSL 或本地隔离重做。

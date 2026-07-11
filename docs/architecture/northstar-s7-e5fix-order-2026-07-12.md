# 北极星 S7-E5FIX 任务单:刷新递归环修复(2026-07-12)

依据:CDP 取证定责(JS 同步递归,栈证据 %TEMP%\wxgames-s7-e5-intro-forensics\)+ roadmap §1 不变量。环:openModal→modal.changed→refreshCurrentHighlight→refreshLegacyHighlight→renderHouseGuide→ensureHouseGuideVisible→openBlockingPanelSnapshot→openModal。本单为 E5 硬前置。
纪律:一任务一 commit;监督者署名文档只读;冻结三件套不碰;测试数字 ℹ 原文;检索纪律 codegraph-first;禁止 spawn 子 agent。

## G1|武装点精确定位(1 commit,只取证+文档)
Z4(43d5ebcd)双跑绿、E4(3c8ee085)必卡——用 flowRegistry.refresh 的规则匹配 trace(或最小单测复现)对比两版在 intro entering 时刻的**匹配落点规则**:E4 删 14 规则+overlay 强制遗留路径后,哪条规则接住了该步并触发 ensure* 修复。结论+证据写验证文档(这决定 G2 第三刀砍哪里)。
**判据**:两版匹配落点对照表;可复跑命令。

## G2|系统性修复(1-2 commits,产品手术)
三刀,全部带特征测试:
① **重入守卫**:refreshCurrentHighlight 同步重入时不得递归执行——重入调用记 trace(可观测,非静默)并合并为**至多一次尾随刷新**(microtask/timeout 均可,写明选择理由);刷新是无游标重入投影,递归语义非法,此守卫是类修复(杀死"任何导演规则×任何 notify 边"的整族环)。特征测试:复现原环(modal.changed 订阅+会开面板的遗留规则)断言终止+最终高亮正确+trace 有记录。
② **notify-on-change**:核验 ModalStore/openModalPayload 在**无实际状态变化**时是否仍 emit modal.changed;若是,改为仅实际变化才 emit(带契约测试:同 payload 二次 open 零 emit)。
③ **匹配落点修正**(按 G1 结论):entering 期间该步的正确行为是什么(隐藏高亮/residual 规则/引擎路径),按分治设计修正,禁止用"再加一条特判"糊——若正确修法涉及删导演规则,允许删并核销(declared)。
**判据**:三刀各有特征测试;原环场景终止;全程无新 witness;门禁全绿。

## G3|E5 复跑收官(1 commit)
按原 E5 判据完整执行:受控环境全程双跑、投影与 64 条基线逐字节 diff 空(若 G2 合法改变了投影内容→按 §1-9 declared+基线重录,明示变更点)、witness==0、npm test+smoke ℹ 原文、10 步键引擎 trace 完整、验证文档(含 G1/G2 证据+PLAYTEST_HANG_FORENSICS 诊断段的去留决定[建议保留,写明守卫开关]+"未做"清单)。
**判据**:原 E5 全部判据+本单增补。

做完 G3 即停,等 L2 终审(与 E1-E4 预审合并)。范围外:S7b 账目(摆设类型/纯度门禁补强/test-inventory)另单处理,本单不碰。

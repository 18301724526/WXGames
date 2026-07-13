# step27 世界行军阻断·终审确认书(2026-07-14,Fable 监督者)

## 合议来源(四方)

1. 白天 xhigh 定位(公司机,答卷未随仓,结论摘要在 NEXT_TASKS/README);
2. 本机 xhigh 盲跑复证(tmp/xhigh-step27-world-march-answer.md,98/100,62ms 写入栈+witness 三源分裂);
3. kimi 机械复核(tmp/review-kimi-xhigh-step27.md,3 变体复现+两帧 harness 模拟);
4. GLM 逐点复核(tmp/review-glm-xhigh-step27.md,8/8 PASS+修复形态化简+pickerOpen 后果预测)。

## 确认的机制(零分歧)

PRODUCT:`TutorialHostContext.advanceTo`(:809-812)先 `applyApiState` 后 `sync` → `StateWriter.commit` 同步发 `state.changed` 时宿主 `this.state` 仍旧步 → `getCurrentStep` 优先读旧 `this.state` → FlowRegistry 命中旧规则 `scout-select-world-target` → `ensureMapHomeGuideVisible({clearWorldMarchTarget:true})` → `TerritoryUiStateStore.clearWorldSelection` 清掉玩家刚选目标 → step27 的 `openWorldMarchFormationPicker` 失去渲染前提,不可恢复。无第三 writer;picker 开闭 owner=modal targetPicker snapshot(Batch 8E 单源),与 worldMarchTarget 无关。

HARNESS 两个独立弱点(都实证):①:1112-1114 `stepAdvanced` 宽验收把动作 47 误报成功;②:1117-1118/:1732/:1737 死读已退役的 `worldMarchTarget.pickerOpen`(恒 undefined)——产品修复后 picker 打开的下一帧 harness 仍会错选 open 并钝停(GLM 预测+kimi 两帧模拟一致)。

## 裁决(按 owner 2026-07-14"不修只拆"钦定)

1. **产品侧零补丁**。advanceTo 竞态是旧推进机制(S9c 将整体删除:客户端游标取代服务端步)的固有病,无外部用户,不买迁移窗口保险。竞态对已迁脚本步无破坏力(脚本步幂等/idle 语义),破坏性只存在于旧规则的 render 写副作用——批次一迁移后,本病咬点物理消失。
2. **S9a 批次一 = 行军段 R20-R25 整段迁移**(订单:northstar-s9a-batch1-order-2026-07-14.md)。
3. **harness 双弱点收紧**(仪器修理,非产品):按 GLM 行号级方案执行。
4. 本确认书归档为 S9a 设计雷区图:迁移后的脚本步严禁依赖 state.changed 重入时序;推进一律事件驱动;render 路径零状态写(纯度公理)。

## 效率注记

xhigh 开放定位两跑(净场→本机盲跑)全中、双席复核零翻案:"定位=xhigh 先跑,验证=廉价席"分工经受第二次实战,维持现役。

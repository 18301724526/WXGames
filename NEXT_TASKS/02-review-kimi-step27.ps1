[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

@'
只读复核 tmp/xhigh-step27-world-march-answer.md。

固定产品代码基线：
3c009575b92446087ada6e6d93898a22071efd6a

当前仓库 HEAD 可能包含该提交之后的纯交接文档、提示词、架构 HTML 或 skill 文件提交。
先确认 3c009575 是当前 HEAD 的祖先，并确认 3c009575..HEAD 没有 frontend/backend/shared/scripts 产品变更；满足时无需 checkout，可继续复核。若存在产品变更则停止并报告。

目标是机械验证，不因 82 个测试全绿直接判定。

必须独立复现：
1. Controller=step26、canonical worldMarchTarget 已写入、API 返回 step27。
2. 先 applyApiState/state.changed、后 Controller sync 时，目标应被清为 null。
3. 先 Controller sync(step27)、再发布相同 state.changed 时，目标应保留并产生 openWorldMarchFormationPicker。
4. 记录两个变体的对象 identity、步骤、target 值、最终 guide action。
5. 确认没有通过 mock 直接写 null 或伪造 guide action。

Harness 必须做两帧状态验证：
- step27、targetPickerKind=''、target存在：应选择 openWorldMarchFormationPicker。
- 下一帧 targetPickerKind='worldMarchFormation'、target存在且没有 pickerOpen：应选择 startWorldMarch。
- 证明当前 1732/1737 条件会在第二帧错误地再次选择 open。
- 同时证明把 harness 改成正确 owner 判断，也不能解决 T19 当前 target=null 的首次 PRODUCT 阻断。

检查：
- 产品测试是否明确禁止 worldMarchTarget.pickerOpen 镜像。
- XHigh 建议的红测是否能对顺序和 harness 分支真正敏感。
- 是否还有第三个未识别的清理 writer 或 owner 分裂。

可使用只读测试、stdin 探针或隔离副本。
不得重新运行 playtest，不修改产品/harness，不 commit、不 push、不联网。
不得读取 GLM 对本定位的新报告。
报告：tmp/review-kimi-xhigh-step27.md
输出 VERDICT=PASS 或 VERDICT=BLOCKED，并分开写当前主因、潜伏 harness 因、测试缺口和残余风险。
完成后停止。
'@

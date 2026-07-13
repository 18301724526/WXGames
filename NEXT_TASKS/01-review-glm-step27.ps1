[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

@'
只读复核 tmp/xhigh-step27-world-march-answer.md。

固定产品代码基线：
3e2bac03fb3afe7e5aee3eff12b40fc12387f362

当前仓库 HEAD 可能包含该提交之后的纯交接文档、提示词、架构 HTML 或 skill 文件提交。
先确认 3e2bac03 是当前 HEAD 的祖先，并确认 3e2bac03..HEAD 没有 frontend/backend/shared/scripts 产品变更；满足时无需 checkout，可继续复核。若存在产品变更则停止并报告。

不得信任 XHigh 结论，独立核验以下裁决：
1. selectTarget 是否先把目标写入 canonical territoryUiState。
2. TutorialHostContext.advanceTo 是否明确先 applyApiState、后 sync Controller。
3. applyApiState/syncFromServer 的第一个 StateWriter.commit 是否同步发布 state.changed。
4. 该回调是否因 TutorialHostContext.getCurrentStep 优先读取 this.state 而仍观察 step26。
5. step26 rule 是否再次调用 ensureMapHomeGuideVisible({clearWorldMarchTarget:true})。
6. 最后一次“非空→null”writer 是否确为 TerritoryUiStateStore.clearWorldSelection，而不是 owner reconciliation、renderer 镜像或其他 writer。
7. step27 目标为空时，25 个 selectWorldMarchTarget 与 0 个 openWorldMarchFormationPicker 是否符合两个 renderer 的生成条件。
8. XHigh 的双变体探针是否足以排除竞争假设。

架构重点：
- 裁决 PRODUCT/HARNESS/BOTH。
- 审查“先同步 Controller 再允许 state.changed”的修复边界是否会造成 API 失败回滚、提前推进或双同步问题。
- 比较 TutorialHostContext.advanceTo 内调整与 CanvasGameApp.syncFromServer 中央调整，指出最小且不分叉的正确边界。
- 独立核验 picker 状态 owner 是 modal targetPicker snapshot，不是 worldMarchTarget。
- 判断 harness pickerOpen 是当前原因还是独立潜伏原因。

可运行只读测试、CodeGraph、stdin 探针或隔离机械消融。
不得重新运行 playtest，不修改产品/harness，不 commit、不 push、不联网。
不得读取 KIMI 对本定位的新报告。
报告：tmp/review-glm-xhigh-step27.md
输出 VERDICT=PASS 或 VERDICT=BLOCKED，并给出确定性根因、修复边界和所需红测。
完成后停止。
'@

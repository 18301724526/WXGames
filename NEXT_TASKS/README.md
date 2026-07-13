# 下一步任务：step27 根因独立复核

当前代码基线：`3c009575b92446087ada6e6d93898a22071efd6a`。

XHigh 已完成只读定位：

- 当前首次阻断主因裁决为 `PRODUCT`：教程推进响应应用期间，Controller 仍停在 step26，旧规则被同步 `state.changed` 重入并清空刚选择的世界行军目标。
- `scripts/playtest-online-tutorial.js` 读取已退休的 `worldMarchTarget.pickerOpen`，是产品主因修复后会触发的独立 `HARNESS` 潜伏问题。

回家后并行派发：

1. 运行 `powershell -ExecutionPolicy Bypass -File .\NEXT_TASKS\01-review-glm-step27.ps1`，将输出完整发送给 GLM。
2. 运行 `powershell -ExecutionPolicy Bypass -File .\NEXT_TASKS\02-review-kimi-step27.ps1`，将输出完整发送给 KIMI。
3. 等两份报告均落盘后再由监督席裁决，不要提前派 Sol 修复。

预期报告：

- `tmp/review-glm-xhigh-step27.md`
- `tmp/review-kimi-xhigh-step27.md`

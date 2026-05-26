# 名人立绘分层交接文档

更新日期：2026-05-26

## 当前结论

名人立绘现在采用三段头发分层：

- `backHair`：后发和整体外轮廓。
- `sideHair`：鬓角、耳侧发束。它是独立层，不能再塞进前发。
- `frontHair`：只负责刘海和额头区域。

这次没有用 AI 重画整套头发，而是从现有头发素材确定性拆分，目的是保持画风、边缘和透明通道一致，避免新图漂移。

## 公网调试入口

- 实验台：<http://47.116.32.216/tools/famous-portrait-lab.html>
- 当前部署健康检查：<http://47.116.32.216/api/health>

手机上主要看实验台右侧的“游戏实显”区域，这个区域现在会跟随左侧参数变化。

## 新增素材

正式提交的新 PNG：

- `frontend/assets/art/famous-person/layers/fp-layer-backHair-short-02.png`
- `frontend/assets/art/famous-person/layers/fp-layer-backHair-tied-02.png`
- `frontend/assets/art/famous-person/layers/fp-layer-sideHair-short-01.png`
- `frontend/assets/art/famous-person/layers/fp-layer-sideHair-tied-01.png`
- `frontend/assets/art/famous-person/layers/fp-layer-frontHair-short-03.png`
- `frontend/assets/art/famous-person/layers/fp-layer-frontHair-tied-03.png`

旧素材没有删除，方便回退和对照。

## 默认参数

实验台默认参数来自用户手调基准，核心值如下：

```json
{
  "global": {
    "scale": 1.3,
    "offsetY": 10,
    "frontCutY": 286,
    "backCutY": 252,
    "cardWidth": 84,
    "cardHeight": 104
  },
  "layers": {
    "backHair": { "scale": 0.7, "x": 0, "y": -70 },
    "sideHair": { "scale": 0.7, "x": 0, "y": -70 },
    "body": { "scale": 0.7, "x": 0, "y": -17 },
    "outfit": { "scale": 1.21, "x": 0, "y": 0 },
    "frontHair": { "scale": 0.7, "x": 0, "y": -65 },
    "accessory": { "scale": 1, "x": 0, "y": 0 }
  }
}
```

所有单层缩放滑杆范围为 `0-200`，不再限制最小 60%。

## 代码链路

实验台：

- `frontend/tools/famous-portrait-lab.html`
- `frontend/tools/famous-portrait-lab.js`

游戏真实渲染：

- `frontend/js/platform/CanvasGameRenderer.js`
- `drawFamousPortrait()` 的层顺序是：
  `backHair -> sideHair -> body -> face -> outfit -> frontHair -> accessory -> frameEffect`

后端生成和存档归一：

- `backend/services/FamousPersonService.js`
- `APPEARANCE_VERSION = famous-portrait-v0.4`
- 新生成名人会带 `sideHair`
- 旧版 `famous-portrait-v0.2/v0.3` 外观会在 normalize 时重新生成到 `v0.4`

测试：

- `frontend/tests/famous-portrait-lab.test.js`
- `frontend/tests/shared-canvas-renderer.test.js`
- `frontend/tests/ui-state-presenter.test.js`
- `backend/tests/famous-person-service.test.js`

## 已验证

本地验证命令：

```bash
node --test frontend/tests/famous-portrait-lab.test.js backend/tests/famous-person-service.test.js frontend/tests/shared-canvas-renderer.test.js frontend/tests/ui-state-presenter.test.js
git diff --check
```

结果：

- 相关 116 个测试通过。
- `git diff --check` 通过。
- 本地实验台加载正常，导出 JSON 已包含 `sideHair`。
- 左侧 `sideHairScale` 从 `70` 调到 `120` 后，导出数据从 `0.7` 更新到 `1.2`。
- 公网实验台、6 张新 PNG、`/api/health` 都返回 200。

## 已推送

上一笔功能提交：

- `649d59c Split famous portrait side hair layer`

本交接文档会单独提交并推送到两个远端：

- `origin`：服务器部署远端。
- `github`：GitHub 远端。

注意：GitHub SSH 在这台机器上偶尔会断开。如果 `git push github main` 失败，可以用：

```bash
git push https://github.com/18301724526/WXGames.git main
```

## 接下来建议

1. 先在公网实验台手机实测短发和束发两套。
2. 如果鬓角仍贴脸不舒服，优先调 `sideHair` 的 `x/y/scale`，不要再改 `frontHair` 让它承担鬓角。
3. 如果刘海偏淡，优先微调 `frontHair-*-03.png` 的透明度或对比度，但仍保持边界只覆盖额头和刘海。
4. 如果要继续做更多发型，必须按三层同名规则新增：
   - `fp-layer-backHair-<style>-NN.png`
   - `fp-layer-sideHair-<style>-NN.png`
   - `fp-layer-frontHair-<style>-NN.png`
5. 新增发型后同步更新：
   - 实验台文件池
   - `CanvasGameRenderer.getPreloadAssetPaths()`
   - `FamousPersonService.APPEARANCE_POOLS`
   - 对应测试

## 不要提交的本地临时文件

这些文件只是本机调试残留，不属于正式资源：

- `temp_test.js`
- `temp_test2.js`
- `tmp/`


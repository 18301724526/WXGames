# 名人立绘素材锚点对齐记录 2026-05-27

## 结论

当前只有以下 4 张手动调好的素材作为基准，其他同类素材必须对齐它们：

- 衣服基准：`frontend/assets/art/famous-person/layers/fp-layer-outfit-guardian-front-candidate-01.png`
- 后发基准：`frontend/assets/art/famous-person/layers/fp-layer-backHair-short-02.png`
- 鬓角基准：`frontend/assets/art/famous-person/layers/fp-layer-sideHair-short-01.png`
- 前发基准：`frontend/assets/art/famous-person/layers/fp-layer-frontHair-short-02.png`

## 对齐边界

按 alpha > 8 的透明像素边界统计，当前目标边界如下：

- 所有候选衣服：`(41,242)-(470,511)`
- 所有后发：`(117,14)-(395,259)`
- 所有鬓角：`(143,173)-(365,283)`
- 所有前发：`(124,76)-(388,178)`

## 本次处理

- 未改动 4 张手调基准素材。
- 将其他候选衣服、后发、鬓角、前发 PNG 重采样到上述基准边界。
- 覆盖了游戏实际使用的 `fp-layer-outfit-vanguard-front-candidate-02.png` 和 `fp-layer-outfit-scholar-front-candidate-03.png`，不是只处理备用图。
- 将 `FamousPersonService.APPEARANCE_VERSION` 升到 `famous-portrait-v0.8`，让旧存档里的名人和候选人在 normalize 时重新生成外观层数据。
- `frontend/tests/famous-portrait-lab.test.js` 现在会扫描目录内所有同类素材，确保它们继续匹配 4 张基准素材的边界。

## 验证命令

```bash
node --test frontend/tests/famous-portrait-lab.test.js backend/tests/famous-person-service.test.js frontend/tests/shared-canvas-renderer.test.js frontend/tests/ui-state-presenter.test.js
node --test frontend/tests/h5-canvas-runtime.test.js frontend/tests/resource-art.test.js frontend/tests/version-number.test.js frontend/tests/stage5-version.test.js
git diff --check
```

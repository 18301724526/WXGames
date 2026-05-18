# 前端 UI 状态层迁移方案 v0.1

## 背景

当前前端已经把部分控件做成了游戏风格 UI，但本质仍然依赖 DOM：

- `index.html` 静态承载页面结构、弹窗、按钮、输入框。
- `app.js` 与各 Renderer 通过 `getElementById`、`querySelector`、`innerHTML`、`classList` 直接操作界面。
- 建筑、事件、疆域、侦察等模块会运行时拼 HTML。

这对 H5 版本可用，但不利于后续迁移到小游戏平台。小游戏侧没有完整浏览器 DOM，继续把业务显示计算和 DOM 绑定在一起，会导致迁移时需要重写大量逻辑。

## 目标

先不一次性重写 UI，而是增加一个中间层：

```plain
后端状态 gameState
  -> UIStatePresenter 生成纯 UI ViewState
  -> H5 DOM Renderer 消费 ViewState
  -> 未来 Canvas/小游戏 Renderer 消费同一个 ViewState
```

ViewState 必须是纯数据，不包含 DOM 节点、事件对象、CSS class 操作或 HTML 字符串。

## 第一阶段范围

第一阶段只迁移低风险且高频变化的两块：

- 资源条和资源详情弹窗。
- 人口管理面板。

原因：

- 这两块已经是全页面共享/高频更新 UI。
- 近期已经多次发生样式与布局调整。
- 它们逻辑相对简单，适合作为迁移模板。

## 已落地接口

新增模块：

- `frontend/js/state/UIStatePresenter.js`

当前提供：

- `buildResourceViewState(state)`
- `buildPopulationViewState(state)`

资源 ViewState 包含：

- `text`：各资源数字、产速、详情文本。
- `visibility`：木材资源和木材详情是否显示。
- `classState`：资源条和净增长正负样式。

人口 ViewState 包含：

- `text`：总人口、上限、待分配、各职业人数。
- `jobs`：每个职业是否可增加、可减少、是否显示。
- `showCraftsman`：工匠职业是否显示。

## 约束

- 后端仍是唯一数值来源，前端 ViewState 只做显示格式化。
- DOM Renderer 不再自行推导资源和人口数值规则，只读取 ViewState。
- 后续新增 UI 优先先写 ViewState，再写 DOM 渲染。
- 不在 ViewState 里拼 HTML，HTML 只属于 H5 Renderer。

## 后续迁移顺序建议

1. 建筑卡片：把建筑状态、按钮状态、成本显示抽成 ViewState。
2. 事件系统：把事件卡片、事件选项、倒计时文本抽成 ViewState。
3. 军事/侦察：把军队状态、侦察方向按钮、倒计时抽成 ViewState。
4. 世界雷达：把坐标、视觉偏移、选中态、行动面板抽成 ViewState。
5. 页面导航和弹窗：把 `classList` 状态切换统一收敛到 UI Adapter。

## 判断标准

一个模块完成迁移的标准：

- 核心显示状态可在 Node 测试中不依赖 `document` 直接生成。
- DOM Renderer 只负责把 ViewState 写入当前 H5 节点。
- 未来小游戏 Renderer 可以复用同一份 ViewState。

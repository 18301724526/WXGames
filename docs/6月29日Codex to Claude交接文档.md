# 6月29日Codex to Claude交接文档

状态 / Status: P0 first-read handoff

Claude 必须先读本交接文档，再读其他架构文档或开始改代码。本文件已经登记为官方文档守卫的第一优先级入口。

## 当前结论

本次提交不是“全项目 ECS 已完成”，而是把项目的 ECS 评审标准重新拉正，并落地了一个真正的 BitECS 示例切片。

已经完成：

- `docs/bit-ecs-review-pass-plan.md`：新增评审会入口文档，明确 `bitecs@0.4.0` 是唯一允许的 ECS 核心。
- `frontend/js/ecs/foundation/WorldClock.js`：改成真实 BitECS 示例，使用 `defineComponent`、`addEntity`、`defineQuery`、system 写组件数组、snapshot 只读投影。
- `frontend/js/ecs/foundation/WorldClock.test.js`：测试直接断言 BitECS component storage、system mutation、shared handle，不再围绕包装类验收。
- H5/minigame 入口：通过 `frontend/js/ecs/runtime/EcsModeRuntimeBundle.js` 加载 bundled BitECS runtime，不直接加载未打包 BitECS 模块。
- 官方文档守卫：新增 BitECS 评审文档与本交接文档到权威文档集。

## 不允许再做的事

- 不允许把文件移动到 `ecs/` 目录就宣称 ECS 迁移完成。
- 不允许用 owner、snapshot、projection、facade、bridge、adapter、wrapper object 冒充 ECS。
- 不允许自研 ECS 核心或隐藏自研组件存储。
- 不允许把类实例、POJO、renderer cache、host mirror、shell mirror、`globalThis` 当权威状态源。
- 不允许 H5 使用一套专属能力，小程序/App 再另行区分业务逻辑。
- 不允许用“保守过渡方案”新增技术债来解释旧债。

## 当前真实 BitECS 示例

当前唯一可以作为“正确 BitECS 写法”引用的示例是：

- `frontend/js/ecs/foundation/WorldClock.js`
- `frontend/js/ecs/foundation/WorldClock.test.js`

验收点：

- entity id 来自 BitECS `addEntity(world)`。
- 权威数据存在 `Clock` component arrays。
- `runClockSyncSystem(clockWorld, payload)` 写入 component arrays。
- `runClockAdvanceSystem(clockWorld)` 从 component arrays 推导当前 epoch 时间。
- `getClockSnapshot(clockWorld)` 只返回只读投影。
- `getShared(options)` 返回真实 BitECS world handle，不返回包装类实例，也不在 handle 上挂 `getEpochNowMs` / `updateFromPayload` 方法。

## 文档阅读顺序

1. `docs/6月29日Codex to Claude交接文档.md`
2. `docs/bit-ecs-review-pass-plan.md`
3. `frontend/js/ecs/README.md`
4. `frontend/js/ecs/foundation/WorldClock.js`
5. `frontend/js/ecs/foundation/WorldClock.test.js`
6. `docs/long_term_architecture_refactor_plan_2026-06-08.md`
7. `docs/development_logs/2026-06-25-frontend-ecs-migration-operating-plan.md`

## 下一步正确方向

下一批迁移应选择一个边界清晰的小模块，继续用真实 BitECS 方式完成：

1. 先写测试，测试必须能直接看见 BitECS component arrays、query、system 行为。
2. 再定义 component。
3. 再写 system。
4. 再写 snapshot/projection。
5. 最后删除旧权威 owner 或把旧入口改成直接调用 BitECS 函数。

推荐优先检查并迁移 fog visibility facts，但不要把 fog 和其他模块共用一个泛化组件。fog 就是 fog，组件应服务 fog 的事实边界。

## 已知未清债务

`npm run test:architecture` 已通过，但以下 report-only 债仍然存在，不能假装已经解决：

- frontend ECS mode ownership report-only findings
- frontend ECS bridge shrink report-only candidates
- frontend ECS renderer authority report-only findings
- frontend ECS input branch report-only findings
- frontend ECS literal duplicate report-only findings

这些债务不阻塞本次提交，但后续不能用包装方案绕过去，必须按真实 BitECS 或明确非 ECS 的架构边界处理。

## 验证命令

本次提交前已验证：

```bash
npm run build:ecs-runtime
node scripts/check-frontend-script-manifest.js
node scripts/verify-refactor-plan-doc.js
npm run test:architecture
```

`npm run test:architecture` 通过，并包含官方文档守卫、ECS 边界守卫、bundle freshness、source encoding、script manifest、`git diff --check`。

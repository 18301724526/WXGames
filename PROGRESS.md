march 重构开始，共6步
步骤1 完成：/api/game/state 同时返回 syncTime 与 serverTime；npm.cmd test、npm.cmd run lint 通过。
步骤2 完成：抽出 shared/worldMarchCore.js，共享 status、stepDuration、路径起点算法并加入 sentinel；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤3 完成：ServerTimelineSnapshot 与 WorldExplorerProgression 接入 shared/worldMarchCore，reveal/持久化仍留在 service mutation；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤4 完成：前端通过 WorldMarchCoreAdapter 接入共享 core，H5/minigame 入口提前加载，actor 层使用 epoch 时间满帧预测，+16ms 连续移动 sentinel 通过；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤5 完成：新增 WorldMarchOptimisticState 乐观出发/回城与对账，点击后 UI 立即刷新，后端轻微滞后不回跳，大差异显示慢同步遮罩，拒绝时回滚；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤6 完成：后端低频 march 校验接入 WorldWorkerService 推进链路，heartbeat 存储 compact 前端上报并下发差异级别，前端大漂移触发慢同步拉回、小抖动静默对齐；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。

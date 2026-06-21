march 重构开始，共6步
步骤1 完成：/api/game/state 同时返回 syncTime 与 serverTime；npm.cmd test、npm.cmd run lint 通过。
步骤2 完成：抽出 shared/worldMarchCore.js，共享 status、stepDuration、路径起点算法并加入 sentinel；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤3 完成：ServerTimelineSnapshot 与 WorldExplorerProgression 接入 shared/worldMarchCore，reveal/持久化仍留在 service mutation；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤4 完成：前端通过 WorldMarchCoreAdapter 接入共享 core，H5/minigame 入口提前加载，actor 层使用 epoch 时间满帧预测，+16ms 连续移动 sentinel 通过；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。

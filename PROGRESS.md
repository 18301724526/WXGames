march 重构开始，共6步
步骤1 完成：/api/game/state 同时返回 syncTime 与 serverTime；npm.cmd test、npm.cmd run lint 通过。
步骤2 完成：抽出 shared/worldMarchCore.js，共享 status、stepDuration、路径起点算法并加入 sentinel；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤3 完成：ServerTimelineSnapshot 与 WorldExplorerProgression 接入 shared/worldMarchCore，reveal/持久化仍留在 service mutation；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤4 完成：前端通过 WorldMarchCoreAdapter 接入共享 core，H5/minigame 入口提前加载，actor 层使用 epoch 时间满帧预测，+16ms 连续移动 sentinel 通过；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤5 完成：新增 WorldMarchOptimisticState 乐观出发/回城与对账，点击后 UI 立即刷新，后端轻微滞后不回跳，大差异显示慢同步遮罩，拒绝时回滚；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
步骤6 完成：后端低频 march 校验接入 WorldWorkerService 推进链路，heartbeat 存储 compact 前端上报并下发差异级别，前端大漂移触发慢同步拉回、小抖动静默对齐；npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。

全部完成：6 步全部完成。
步骤1 commit：6d8c6903 march-step-1: /game/state 补发 serverTime
步骤2 commit：fe9240f6 march-step-2: 抽共享 worldMarchCore 并统一发散点
步骤3 commit：8726d328 march-step-3: 后端接入共享 core
步骤4 commit：4b889926 march-step-4: 前端接入 core 满帧预测
步骤5 commit：054c0abc march-step-5: 乐观执行+对账
步骤6 commit：d3d199bc march-step-6: 后端校验+清理
最终验证：npm.cmd test 通过（1487/1487）；npm.cmd run lint 通过；npm.cmd run test:architecture 通过。
提示：所有改动在本地 main，未 push，等待 review 后再推。

fix-fog 三层修复完成：迷雾显示改为消费 core 连续 reveal source，后端 revealedTileIds 仅作权威兜底；core reveal 前沿改为跟随 segmentProgress 输出 strength/signature；fog mask 历史源按 strength 淡入，cache/bake/render trace 签名跟随连续前沿；雾层渲染复用旧地图 context 时会按当前 epoch 重新派生 visibilityActors，避免迷雾滞后。最终验证：npm.cmd test 通过（1493/1493）；npm.cmd run lint 通过；npm.cmd run test:architecture 通过（1063/1063）。

march-identity 步骤1 完成：前端出发请求从 action/worldMarchTarget/selectedWorldActorId 传递选中部队真实 id；无选中部队时仍不带 missionId。验证：npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
march-identity 步骤2 完成：乐观 beginStart 有 missionId/actorId 时按真实 id 精确复用现有部队并从当前位置出发；传 id 找不到返回 null，不乐观新建；无 id 首发仍按 formation 新建。验证：npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
march-identity 步骤3 完成：后端 startWorldMarch 有 missionId/actorId 时按真实 id 复用 idle mission 并从其当前位置重算路线；传 id 找不到返回 EXPLORE_MISSION_NOT_FOUND 且不新建；无 id 仍按 formation 首发新建。验证：npm.cmd test、npm.cmd run lint、npm.cmd run test:architecture 通过。
march-identity step4 complete: optimistic reconciliation now keeps explicit missionId/actorId pending matched by real mission id and does not fall back through formation cityId:slot; added frontend integration sentinel for selected idle world actor marching by id without a capital optimistic replacement. Validation: npm.cmd test passed (1504/1504); npm.cmd run lint passed; npm.cmd run test:architecture passed.
march-identity all steps complete: step1 f2f45cda; step2 7ef3d7d5; step3 1379920c; step4 pending commit. Final validation: npm.cmd test passed (1504/1504); npm.cmd run lint passed; npm.cmd run test:architecture passed. Local main only; not pushed. Manual files march-autonomous-manual.md and march-identity-manual.md left untracked.

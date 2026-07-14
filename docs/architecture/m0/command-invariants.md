# M0 每命令业务不变量清单

本清单以 `CommandOwnerResolver.COMMAND_OWNER_RULES` 为唯一命令集合。`ownerSet` 必须与注册规则逐字一致；其余六字段描述当前实现的权威写入边界。`commandId` 是协议幂等键，表内列出的业务唯一键用于阻止同一业务事实被不同 `commandId` 重放。

关键路径标签只标记已经存在的命令入口；尚未存在的关键路径在文末显式声明，不伪造命令覆盖。

<!-- COMMAND_INVARIANTS_START -->
| commandType | pathTags | ownerSet | domainTables | businessUniqueKey | expectedVersionSource | externalSideEffects | finalProjection | invariant |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| acceptFamousPerson | 无 | player:{playerId} | game_states.famousPeople; world_people（共享人物状态存在时） | playerId + personId | 加载态 game_states.revision；共享人物写由 person owner 锁约束 | 无；仅事务内接纳人物 | _projectGameView 的 result + gameState + eraProgress | 同一人物对同一玩家最多接纳一次；名册与共享人物归属必须同事务一致。 |
| advanceEra | 无 | player:{playerId} | game_states.currentEra; game_states.eraHistory | playerId + targetEra | 加载态 game_states.revision | 无；仅事务内时代推进 | _projectGameView 的权威游戏视图 | 时代只能按规则单调推进一次，资源扣除与 eraHistory 追加不可拆分。 |
| applyTalentPolicy | 无 | player:{playerId} | game_states.talentPolicies | playerId + policyId + policyVersion | 加载态 game_states.revision | 无；仅事务内策略生效 | _projectGameView 的权威游戏视图 | 同一 policyVersion 重放不得重复扣费或叠加效果。 |
| assign | 无 | player:{playerId} | game_states.cities.population | playerId + cityId + job | 加载态 game_states.revision | 无；仅事务内人口分配 | _projectGameView 的权威游戏视图 | 各职业人数之和不得超过城市可用人口，重放不得重复迁移人口。 |
| assignFamousAttributePoint | 无 | player:{playerId} | game_states.famousPeople | playerId + personId + attribute + pointEpoch | 加载态 game_states.revision | 无；仅事务内属性分配 | _projectGameView 的权威游戏视图 | 可用点数扣减与目标属性增加必须一一对应且不可重复。 |
| build | 无 | player:{playerId} | game_states.cities; shared_world_territories; global_world_tiles | playerId + cityId + buildingId | 加载态 game_states.revision | 无；仅事务内资源扣除与建筑创建 | _projectGameView 的 result + gameState + eraProgress | 建筑创建与资源扣除同事务提交；相同 buildingId 在同一城市不得重复创建。 |
| claimConquest | 奖励,占领 | player:{playerId}; territory:{payload.territoryId}; territory-owner:{playerId}; territory-owner:{currentOwnerPlayerId} | game_states; shared_world_territories; global_world_tiles | territoryId + conquestId | 加载态 game_states.revision；territory owner set 在锁内复读 | 无；仅事务内归属切换与奖励发放 | _projectGameView 的权威游戏视图与新领地归属 | conquest 只能领取一次；领地归属切换、奖励入账和旧 owner 失效必须同事务。 |
| claimEvent | 奖励 | player:{playerId} | game_states.eventQueue; game_states.eventHistory; game_states.resources | playerId + eventId | 加载态 game_states.revision | 无；仅事务内事件结算 | _projectGameView 的权威游戏视图 | 同一 eventId 只能从待领取转为已领取一次，奖励不可重复入账。 |
| claimTaskReward | 奖励 | player:{playerId} | game_states.taskProgress; game_states.taskRewardGrants; game_states.resources | playerId + taskId + taskDefinitionVersion | 加载态 game_states.revision | 无；仅事务内任务奖励发放 | _projectGameView 的权威游戏视图 | taskRewardGrants 唯一事实必须先阻止重复领取，再与奖励入账同事务提交。 |
| clientEventIngest | 无 | diagnostic:anonymous | 无领域表；ObservabilityService 有界内存窗口 | requestId + eventType + clientTimestamp | 不适用；诊断事件不更新版本化领域状态 | 写入进程内观测窗口；响应审计另写 api_logs | 202 accepted + 规范化事件摘要 | 只接受 allowlist 事件类型，诊断写入不得改变玩家权威状态。 |
| clientOperationLogIngest | 无 | diagnostic:{playerId} | client_operation_logs | playerId + requestId | 不适用；append-only 日志由自增 id 排序 | 持久化脱敏客户端操作快照 | 202 accepted + logId + entryCount + timestamp | 日志载荷有长度上限且不参与游戏状态投影，失败不得回写领域状态。 |
| configReleasePublish | 无 | config:gameplay | config-release active/history 文件；T4 release_manifests | manifestDigest + signerKeyId | active release snapshotHash 与 manifestDigest | 原子替换 active release 文件并刷新运行时配置 | publishRelease 结果与 active release 元数据 | 相同 manifestDigest 发布必须幂等；未通过 schema、版本和签名门禁不得成为 active。 |
| configReleaseRollback | 无 | config:gameplay | config-release active/history 文件；T4 release_manifests | targetReleaseId + rollbackRequestId | 当前 active snapshotHash 与目标 manifestDigest | 原子切换 active release 文件并刷新运行时配置 | rollbackRelease 结果与目标 release 元数据 | 只能回滚到已验签历史 release，active 指针与运行时 bundle 必须一致。 |
| deleteTalentPolicy | 无 | player:{playerId} | game_states.talentPolicies | playerId + policyId | 加载态 game_states.revision | 无；仅事务内策略删除 | _projectGameView 的权威游戏视图 | 删除不存在策略是幂等结果，已扣除的历史成本不得被重复返还。 |
| dismissFamousPersonCandidate | 无 | player:{playerId} | game_states.famousPersonState | playerId + candidateId + candidateCycleId | 加载态 game_states.revision | 无；仅事务内候选状态更新 | _projectGameView 的权威游戏视图 | 同一候选在同一轮次只能被处理一次，dismiss 后不得再次接受。 |
| heartbeat | 无 | player:{playerId} | players.lastActiveAt; game_states.worldMarchVerification（有变化时） | playerId + heartbeatSeq | game_states.revision；仅 changed=true 时 CAS 保存 | 更新在线活跃时间；无外部网络副作用 | serverTime + heartbeatSeq + worldMarchVerification | 旧 heartbeatSeq 不得覆盖新验证状态，无状态变化时不得制造 revision。 |
| heartbeatMarchSettlement | 行军 | player:{playerId} | game_states.exploreMissions; game_states.worldMarchVerification; game_states.resources | playerId + missionId + settlementVersion | 加载态 game_states.revision | 无；仅事务内到达结算 | _projectGameView 的权威行军与资源状态 | 每个 missionId 的到达结算最多一次，奖励、兵力和任务终态同事务。 |
| opsLoginAudit | 无 | ops:global | ops audit 日志文件 | auditEventId + loginAttemptFingerprint | 不适用；append-only 审计序号 | 追加 ops 登录成功、失败或限流审计 | 登录结果 + operator 摘要 | 每次尝试都留审计但不得记录密码或 token，审计失败不得绕过认证结果。 |
| opsMaintenanceSet | 无 | ops:global | maintenance 状态文件; ops audit 日志 | maintenanceEpoch + requestId | 当前 maintenance 状态版本 | 原子更新维护状态并追加审计 | setMaintenanceState 结果 | 状态文件与审计结果必须对应同一 operator 和 maintenanceEpoch。 |
| opsRestartAccepted | 无 | ops:global | ops audit 日志 | restartRequestId | 不适用；accepted 审计事实为 append-only | 延迟调用固定 PM2 restart 动作 | 202 accepted + delayMs | 先持久化 accepted 审计再触发固定服务重启，禁止任意命令参数注入。 |
| playerLogin | 无 | player:{payload.username} | players; game_states（首次创建） | normalizedUsername | 既有 game_states.revision；首次创建为不存在行 | 签发认证 token | 登录响应 + 权威玩家状态 | 同一用户名只映射一个 playerId；token 仅在身份校验成功后签发。 |
| playerReset | 无 | player:{playerId}; territory-owner:{playerId} | game_states; shared_world_territories; player_world_visibility; global_world_tiles | playerId + resetCommandId | 显式 null；reset 事务与双 owner 锁代替旧 revision CAS | 无；仅隔离事务内重建状态 | reset 后 gameState + eraProgress | 删除旧状态、清理领地和可见性、创建新状态必须在同一事务中收敛。 |
| renameCity | 无 | player:{playerId}; territory:{payload.territoryId}; territory-owner:{playerId}; territory-owner:{currentOwnerPlayerId} | game_states.cities; shared_world_territories | territoryId + normalizedCityName | 加载态 game_states.revision；territory owner set 在锁内复读 | 无；仅事务内名称更新 | _projectGameView 的权威城市与领地视图 | 只有当前 owner 可改名，玩家态与共享领地名称不得分叉。 |
| renamePolity | 无 | player:{playerId} | game_states.polity | playerId + normalizedPolityName | 加载态 game_states.revision | 无；仅事务内政体名称更新 | _projectGameView 的权威游戏视图 | 名称规范化后提交，重放不得产生额外 revision 之外的副作用。 |
| research | 无 | player:{playerId} | game_states.techs; game_states.techEffects; game_states.resources | playerId + techId + targetLevel | 加载态 game_states.revision | 无；仅事务内研究完成 | _projectGameView 的权威科技与资源视图 | targetLevel 单调递增，成本扣除、等级和 techEffects 必须同事务。 |
| resolveCapture | 无 | player:{playerId} | game_states.captureDecisions; game_states.famousPeople | playerId + decisionId | 加载态 game_states.revision | 无；仅事务内处置俘虏 | _projectGameView 的权威俘虏与名册视图 | pending decision 只能终结一次；招降成功与人物入册不可拆分。 |
| resolveWorldCombat | 无 | player:{playerId}; encounter:{payload.encounterId or payload.combatEncounterId} | game_states.worldCombat; world_encounters; shared_world_territories | encounterId + resolutionId | 加载态 game_states.revision；encounter owner 锁内状态 | 无；仅事务内战斗结算 | _projectGameView 的战斗、领地和奖励视图 | encounter 终局只能提交一次，双方结果、奖励与 encounter 状态必须原子一致。 |
| returnWorldMarch | 行军 | player:{playerId} | game_states.exploreMissions; game_states.military | playerId + missionId + returnEpoch | 加载态 game_states.revision | 无；仅事务内返程状态更新 | _projectGameView 的权威行军视图 | 同一 mission 只能进入一个返程 epoch，重复请求不得重复返还兵力。 |
| saveTalentPolicy | 无 | player:{playerId} | game_states.talentPolicies | playerId + policyId + policyVersion | 加载态 game_states.revision | 无；仅事务内策略保存 | _projectGameView 的权威游戏视图 | policyVersion 必须单调，保存与资源成本或效果更新不可拆分。 |
| seekFamousPerson | 无 | player:{playerId} | game_states.famousPersonState; game_states.resources | playerId + seekCycleId | 加载态 game_states.revision | 无；随机结果由服务端权威生成 | _projectGameView 的候选人与资源视图 | 同一 seekCycle 只生成一组候选，随机结果和成本扣除同时提交。 |
| setArmyFormation | 无 | player:{playerId} | game_states.cities.military | playerId + cityId + formationSlot | 加载态 game_states.revision | 无；仅事务内阵型保存 | _projectGameView 的权威阵型视图 | 同一士兵或人物不得在冲突槽位重复占用，总兵力不得凭空增减。 |
| startConquest | 占领 | player:{playerId}; territory:{payload.territoryId}; territory-owner:{playerId}; territory-owner:{currentOwnerPlayerId} | game_states.warMissions; shared_world_territories | territoryId + conquestId | 加载态 game_states.revision；territory owner set 在锁内复读 | 无；仅事务内创建征服任务 | _projectGameView 的权威征服任务视图 | 同一 territory 的有效 conquest 不得重叠，启动时锁定的 owner 事实必须可审计。 |
| startWorldCombat | 无 | player:{playerId}; encounter:{payload.encounterId or payload.combatEncounterId} | game_states.worldCombat; world_encounters | encounterId + battleSessionId | 加载态 game_states.revision；encounter owner 锁内状态 | 无；仅事务内创建战斗会话 | _projectGameView 的战斗会话与 encounter 视图 | 同一 encounter 同时最多一个 active battle，双方兵力快照来自同一锁内版本。 |
| startWorldMarch | 行军 | player:{playerId}; encounter:{payload.encounterId or payload.combatEncounterId when present} | game_states.exploreMissions; game_states.military; world_encounters（handoff 时） | playerId + missionId | 加载态 game_states.revision；可选 encounter 在 owner set 中锁定 | 无；仅事务内派出兵力 | _projectGameView 的权威 mission、路线和兵力视图 | mission 创建与兵力扣留同事务；相同 missionId 不得重复派兵。 |
| stopWorldMarch | 行军 | player:{playerId} | game_states.exploreMissions; game_states.military | playerId + missionId + stopEpoch | 加载态 game_states.revision | 无；仅事务内停止或转返程 | _projectGameView 的权威行军视图 | stop 对同一 epoch 幂等，兵力只可由一个终态路径返还。 |
| switchCity | 无 | player:{playerId} | game_states.activeCityId | playerId + targetCityId | 加载态 game_states.revision | 无；仅事务内当前城市切换 | _projectGameView 的权威当前城市视图 | targetCityId 必须属于玩家，切换不得改动城市领域数据。 |
| upgrade | 无 | player:{playerId} | game_states.cities; game_states.resources | playerId + cityId + buildingId + targetLevel | 加载态 game_states.revision | 无；仅事务内资源扣除与升级启动 | _projectGameView 的权威建筑与资源视图 | targetLevel 单调且每级成本只扣一次，不能跨级或重复启动。 |
| veteranCampUpgrade | 无 | player:{playerId} | game_states.cities.military; game_states.resources | playerId + cityId + campTargetLevel | 加载态 game_states.revision | 无；仅事务内军营升级 | _projectGameView 的权威军营与资源视图 | campTargetLevel 单调，容量变化与成本扣除必须同事务。 |
| veteranCampWithdraw | 无 | player:{playerId} | game_states.cities.military | playerId + cityId + campBatchId + withdrawEpoch | 加载态 game_states.revision | 无；仅事务内撤回老兵 | _projectGameView 的权威军营和可用兵力视图 | 每批次最多撤回其剩余数量，撤回后后续 drain 不得复活已取回兵力。 |
| worldMarchClientReportIngest | 行军 | player:{playerId} | game_states.worldMarchClientReports; game_states.worldMarchVerification | playerId + missionId + reportSeq | 加载态 game_states.revision | 无；客户端报告只作校验输入 | _projectGameView 的权威 verification，不采信客户端位置为事实 | reportSeq 必须单调，客户端坐标不得直接覆盖服务端权威行军状态。 |
| worldWorkerDiplomacyTick | 无 | diplomacy:{payload.pairId} | faction_diplomacy | orderedFactionPair + worldTick | diplomacy pair owner 锁内当前 edge.updatedAt | 无；仅事务内外交边更新 | worker 内部 tick 摘要；客户端随后从权威投影读取 | 同一 ordered pair 在同一 worldTick 只推进一次，双向边更新保持对称契约。 |
| worldWorkerPersonUpdate | 无 | world-social:global; player:{each payload.playerIds}; person:{each payload.personIds} | world_people; game_states（关联玩家状态变更时） | personId + worldTick | 每个 player mutation 的 expectedRevision；person owner 锁内 updatedAt | 无；仅事务内世界人物批次更新 | worker 内部批次结果；玩家投影后续读取 | 批次必须预声明所有 player/person owner，遗漏 owner 时整批拒绝。 |
| worldWorkerPlayerTick | 行军,建筑完成 | player:{playerId}; encounter:{each payload.encounterIds} | game_states; world_encounters; shared_world_territories; global_world_tiles | playerId + worldTick | 加载态 game_states.revision；共享 mutation owner keys | 无；仅事务内离线推进、完成与结算 | worker 内部玩家 tick 结果；客户端读取权威游戏视图 | 同一 worldTick 的建筑完成与行军结算各最多一次，奖励和状态终结与 revision 同事务。 |
| worldWorkerRuntimeTick | 无 | BLOCKED: explicit per-mutation owner commands required | 无；入口在任何领域写前被阻断 | 不适用：拆分后的子命令各自提供业务唯一键 | 不适用：拆分后的子命令各自读取 expectedVersion | 无；不得触发领域或外部副作用 | OWNER_WORKER_COMMAND_SPLIT_REQUIRED 阻断结果 | 聚合 runtime tick 永远不能直接写；必须拆成显式 owner 的 player、person、diplomacy 子命令。 |
<!-- COMMAND_INVARIANTS_END -->

## 当前尚无命令入口的关键路径

<!-- ABSENT_CRITICAL_PATHS_START -->
| pathTag | commandSurface | invariant |
| --- | --- | --- |
| 付费 | NONE_DECLARED | 当前没有真实货币订单命令；未来入口必须以 providerTransactionId 为唯一键，验签回调、订单终态和权益发放同事务或可靠 outbox 收敛。 |
| 入盟 | NONE_DECLARED | 当前没有玩家联盟成员关系命令；未来入口必须以 playerId + allianceId + membershipEpoch 为唯一事实，旧联盟退出与新联盟加入不可形成双重有效成员关系。 |
<!-- ABSENT_CRITICAL_PATHS_END -->

## 校验

运行 `node scripts/m0-writer-inventory/check-invariants.js`。注册表新增或删除命令、owner set 漂移、六字段为空、关键路径既无命令标签也无显式缺席声明时均返回非零退出码。

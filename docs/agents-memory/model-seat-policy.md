---
name: model-seat-policy
description: "外部模型席位策略——国产模型只留 GLM-5.2,kimi/deepseek/minimax/qwen 不再派活"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5d09762d-931c-47fa-804a-fc511da650c4
---

用户裁定(2026-07-10):**不再向国产模型派活,能力不行,只有 GLM-5.2 还可以。**
**2026-07-12 修订(owner):执行席分层试点**——判据管线(机械判决器+门禁+探针+投影)使弱执行者失败模式=返工而非埋雷,故:①机械执行单(文档/清单/打标类)按价梯试:terra(sol 半价)→kimi/GLM 复活赛(订阅配额,只限最硬判据单,经 opencode)→Opus(Claude 配额);**两振出局**(同单打回 2 次退席);②手术/L2 单=sol xhigh 保留(深推理抓盲区,W1 定责实证);**sol 配额经济学(owner 2026-07-12):$200/天过期作废,晚间(~20:00 后)当天额度未用完时应主动多派 sol——宁可把中等难度单也给 sol,别让额度空烧**;③**盲区配对法则:机械判决的活随便同家族;判断密集的活(设计/spec 仲裁)必须跨家族配对**——Opus 主笔设计必须 sol 第二意见,禁 Claude 自写自审;④每条提示词附建议模型+建议档位。

**取证席启动惯例(2026-07-12 定稿,全部改配置/flag 免审批)**:
- **kimi**:无持久化权限键,启动即用 **`kimi -y`**(yolo 全批;`--auto` 会漏批)。flag 型→`/new` 不生效,必须重开带 flag。
- **opencode(GLM/deepseek/doubao 全走这里)**:`~/.config/opencode/opencode.json` 已加 `"permission":{"edit":"allow","bash":"allow","webfetch":"allow"}`(备份 opencode.json.bak-perms-20260712)。**进程启动时读一次配置→改完必须退出重开,`/new` 不重读**。
- 取证提示词自带只读+只写 tmp/ 纪律,监督者跑后 git status 兜底。owner 亲审单命令模式废除。**取证题模板铁则:席位代号+输出文件名由出题人写死在题面**(如"你是 A 席,写 tmp/audit-A.md")——防 owner 贴错模型/模型自报家门造成档案混淆(2026-07-12 doubao 被误当 deepseek 考了两场)。**新问题盲审题面只给客观证据(症状+复现命令+原始产物路径),禁止预嚼候选方向/嫌疑点/我方行号**(owner 纠正 2026-07-12:预埋假设→席位顺框走,收敛失去证明力=G3 假独立变体);监督者私有假设留手里当 diff 基准,席位独立撞上才算真收敛。定位收敛后的**验证/修复单**相反要写死方向与判据。**审计与执行需并行时用 worktree 隔离**:`git worktree add --detach "$env:TEMP\audit-X" <commit>` 每席一个(钉快照+双向隔离),题面写明工作目录;worktree 内禁构建(esbuild 路径坑)、无 node_modules(纯 stdlib 生成器可跑,npm test 不可);审完 `git worktree remove --force`。

**doubao-seed-2.0-pro 首考通过**(G3 停滞静态审计,误跑两卷):链路重建准确、置信度标注诚实,第二卷深度更佳(有跑间方差,重要取证可跑两次采样);弱点=未做量级/状态检验（两卷都没有检查初始状态的量级）。**deepseek-v4-pro 首考未考**,顺延下一题。

**2026-07-12 花名册扩编(owner)**:新增 **DeepSeek V4 Pro**(复活,当年从评审席退役)与 **doubao-seed-2.0-pro**(新入,经火山 ARK/arkcli 通道),均订阅配额零现金。**→ 2026-07-12 晚 owner 裁定 doubao 退役**("方舟的,太拉了"),连同方舟 Coding Plan 通道整体弃用(反复卡死+验证轮弃权);DeepSeek 只走官方 API(claude-code Anthropic 兼容端点,见 [[deepseek-agentic-executor]]),不走方舟。**入队路径:先取证/盲审交叉席**(同一审计提示词发 2+ 廉价席盲测,监督者 diff 发现再仲裁——kimi/GLM 已用此模式立功),表现达标再升机械执行单;两振出局。现役花名册:Fable=监督仲裁;sol=手术/L2 执行+设计主笔+深度定责;terra=机械执行试点(待首单);Opus=机械执行试点(配额,待首单);GLM/kimi=取证席已转正;deepseek-v4-pro/doubao-seed-2.0-pro=取证席试用。**廉价席盲审面板**为 L2 标准配置:同一提示词 2-3 席盲测,我 diff+验真,Claude 席只留判断最密处。

**Why**: 资源地设计管线曾用 kimi-k2.6/deepseek-v4-pro/minimax-m3 做评审席(当时质量尚可),但用户综合判断后弃用。

**How to apply**: 未来 opencode 通道的外部席位(写稿/评审/对照)只用 `opencode-go/glm-5.2`;不派 kimi/deepseek/minimax/qwen/mimo 系。执行端=Codex(现 GPT-5.6-Sol,注意 [[step2-admission-arbitration-rubric 的 Sol 加严条款]]);监督/评审主力=Claude 自家 Workflow subagents(不受此限)。作废 model-benchmark-spec-compilation 文档里的多席位表。关联 [[command-owner-pipeline-progress]]。

**2026-07-10 补充(owner 反馈审查跑太久)**: 审查工作流按 rubric 的"提速模板 v2"执行——补丁重审用 pipeline(席完即复核)、复核按席打包、重型命令(全量测试)归监督者跑一次、席位 medium 分级(诚实性席保 high)、快查前置内联。目标 5-8 分钟。

**2026-07-11 v3(owner 钦定,主用)**: **任务颗粒度切细(1 任务=1 commit 量,单内预写机械判据)+ 分级审查**:L0 例行=监督者内联抽查零 agent;L1 常规=单 agent 定向审分钟级;L2 全量对抗=仅 tranche/step 边界或诚实性绊线触发(碰守卫/扫描器/冻结文件、改既有测试断言、证据矛盾、监督文档变动、超单触达)。详见 rubric v3 附录。

**2026-07-12 环境红线(owner 事件后钉死)**:执行/取证**禁打公网服务器**(含 47.116.32.216 测试服,该 IP 硬编码在多个 playtest 脚本默认值里),禁 `--target=remote`,除非 owner 逐次授权。公网测试服=**旧稳定版**(不含在建改动),其"跑通"是**无效假绿**不作验收。受控/本地隔离环境=**WSL 镜像**(见 [[local-dev-env]],`git push local <分支>` auto-deploy 跑新代码+独立数据)或本地隔离进程(独立 db/端口)。执行者若声称"本地无发布包"而擅自切线上=纪律问题+验错对象,该跑作废。sol 已两次用词失准(双 context 误判、把本地活动部署说成"在线部署")+此次擅切 remote——审查须核原始数据与实际 target,不信其摘要。

**2026-07-13 GPT-5.6 家族官方规格(联网核实)**:三版本=Sol(旗舰,$5/$30 每 1M,唯一解锁 max 档与 ultra 模式)/Terra(均衡默认,$2.5/$15,≈Sol 半价)/Luna(快速廉价,$1/$6,高频低延迟负载);推理档位 none/low/medium/high/xhigh/max。**纠偏:max=Sol 专属的超 xhigh 单 agent 深推理档;ultra=Sol 专属子 agent 编排模式**——即"ultra/Max"是同一 Sol 的两种火力形态(铺开 vs 深挖)。**Luna 暂定位**(待首考,入队协议:同卷与 terra 双席盲测我 diff):terra 类机械验证/取证跑腿的降本替身 + 盲审面板家族外援;考过再定级,两振出局。

**2026-07-13 定位分工(owner 钦定,v2)**:**定位=sol xhigh 先跑**(开放定位单,考卷纪律:只给客观证据/无假设/预算停止线/可用 worktree),**测试与交叉验证=廉价席**(terra 判别实验/运行时复刻,kimi/GLM 对 xhigh 结论做机械应用验证或盲审对照)——强模型出结论、廉价席验真,对等仲裁不变。ultra/Max(长上下文编排体,最贵)=战略预备队:xhigh 未破的硬骨头或当日额度过期泄洪,须范围白名单四铁律。依据:2026-07-12 夜廉价盲审主结论两席皆错(递归论/饱和论),多轮判别纠偏的往返成本≥xhigh 一发;ultra 开放定位一战成名($79,净场条件);xhigh 开放定位待首考(S8 草稿质量为旁证)。

**2026-07-13 分歧仲裁对等原则(owner 钦定)**:任何席位(含贵价席 ultra/sol)得出与监督者共识或其它席位不同的结论时,**必须派廉价席位跑判别实验实证仲裁,禁止监督者凭共识直接否决**——监督者裁定无证据特权(2026-07-12 夜实证:监督者三次自信裁定均被下一轮实验推翻)。仲裁结果同时反哺席位能力档案(验证"贵是否买到更广视野")。

**2026-07-12 遇阻协议(owner 钦定)**:执行者遇阻**立即停手报告最小复现,禁止自行试修-撤回循环**(sol 在 E5 曾试修数轮全败白烧);监督者设计**判别性实验矩阵**(differential,每个实验回答一个二选一),分派给最便宜够用的席位(静态审读=GLM,动态定责=sol medium,机械 diff=监督者内联),仲裁定责后才开修复单。owner 手工编排=带人类仲裁的多 agent,优于盲目 fan-out。

**2026-07-12 反空烧协议(owner:一单 $15 有 $10 烧在人肉轮询等待)**:三层——①**验证归 terra 不归 sol**:sol 只改代码+起一次进程,跑 playtest 验证交 terra(其 harness 已内置 stall-watchdog:任何动作 before 后 N 秒无 after 即 process.exit+写 stalled.json,自动退不用守;terra 一次验证 $2.4 vs sol 空烧 $15)。②**playtest 提示词铁律**:用带 stall-watchdog 的 harness,起进程后只等它自己退出读退出码,**禁止 Start-Sleep 人肉轮询**。③**时间硬预算**:单里写"单次验证 wall-clock 超 X 分钟(正常跑 1.5 倍)未返回即判异常,停手报告,禁继续等"。执行者"还在正常范围"的自我安慰=空烧信号,不可信。

**2026-07-12 L2 审查省配额协议(owner 钦定)**:L1 照旧监督者内联零 agent;**L2 取证席改走 GLM**——监督者写自包含审查提示词(范围+判据+证据格式+诚实条款+输出规范)交 owner 贴进 GLM CLI(仓库目录内跑),结果贴回;**GLM 发现逐条验真才采纳,GLM"全绿"不能单独结案**;探针/门禁复跑/终审裁决归监督者内联;Claude 席收缩至 L2 默认 1-2 席(只留判断最密处),对抗复核尽量内联。

**2026-07-11 Codex 成本整治(单任务曾 $20+)**:已改 `~/.codex/config.toml`(备份 config.toml.bak-20260711):context_window 1M→360K、auto_compact 900K→280K(对齐中转 372K 真实墙,见 [[codex-token-monitor]]);9 个无关插件停用(documents/spreadsheets/presentations/pdf/template-creator/canva/google-calendar/build-macos-apps/game-studio,office 类=false 即可回开);godot/cocos MCP 注释停用(其他项目要用需取消注释)。**推理强度由 owner 手动管理:我每次交付 Codex 提示词时必须附本轮建议 reasoning effort**——机械执行单(grep 判据/文档/清单生成)=medium;产品代码手术(适配器/状态收敛/特征测试)=high;L2 级步骤(S7/S9a-c/B3')=xhigh。另:每张任务单开新 Codex 会话(历史不滚雪球)。

**提示词固定模板要素(owner 钦定 2026-07-11)**:每条 Codex 提示词必含 ①任务单路径+按序一任务一 commit;②**遵循 AGENTS.md 检索纪律——先 codegraph explore,禁私自大面积 rg/通读文件,只在编辑区段读原文**;③测试数字禁转述;④监督者文档只读;⑤做完即停等审查;⑥附本轮建议推理强度;⑦**禁止 spawn 子 agent**。
**⚠ 交付位置铁律(2026-07-12,两次事故)**:给 owner 复制用的提示词/交付物必须放在**回复最末尾、所有工具调用之后**——owner 的客户端不显示工具调用之前的中段文本,藏在中间=owner 收不到。

**⚠ 推理强度 "ultra" 限定使用(2026-07-13 修订)**:codex 的 `ultra` 是**多智能体编排模式**(spawn_agent/wait_agent),非更深推理。**禁用于开放式任务**(2026-07-12 实弹 $170/时教训:自主拆解+子 agent 产出无人审);**允许用于判据写死的封闭单**(2026-07-13 实证:T12 动态取证单——固定范围/只改脚手架/只写 tmp/只报所见——ultra 执行质量与 terra 相当且更快,owner 裁定"比别人强")。关键变量=题面纪律不是模型;ultra 单必须:范围白名单+产出文件写死+禁产品代码+禁 commit。开放式任务 xhigh 仍是封顶档。配额经济学:当天额度将过期时 ultra 是合理泄洪口。

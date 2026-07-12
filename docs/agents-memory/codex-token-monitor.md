---
name: codex-token-monitor
description: 本地 Codex CLI token 消耗实时看板 — 位置、启动方式、数据语义与计价公式
metadata: 
  node_type: memory
  type: reference
  originSessionId: 268c30fd-1150-4823-ad09-3af4ce24b27c
---

Codex token 实时监控看板：`F:\AI Project\codex-watch\token-monitor.js`（单文件零依赖 Node）。
**常驻服务（2026-07-13 起）**：开机自启 + 崩溃自愈，别再用 preview_start 托管（会话一关就陪葬）。链路 = Startup 文件夹 `codex-token-monitor.vbs` 存根 → `codex-watch/start-monitor.vbs` 看门狗（隐藏窗口跑 node，退出 5s 重拉；**退出码 42=端口被占→看门狗自灭**，防双实例）。手动重启：结束 node 进程即可（看门狗自动拉起）；彻底停：先杀 wscript 看门狗再杀 node。http://localhost:8788。

数据语义（排查计价时的关键）：
- 源 = `~/.codex/sessions/**/rollout-*.jsonl`；`turn_context.payload.model` 给模型（会话中途可切），`token_count.info.total_token_usage` 是**会话累计值**，看板对相邻累计做差分得单次响应增量（防重复事件双计；计数器回退=compaction 时 rebase 不计）。
- `input_tokens` **包含** `cached_input_tokens`；`output_tokens` **包含** reasoning。计费 = (input−cached)×输入价 + cached×缓存价 + output×输出价。
- 价格表页面可编辑、存 localStorage；预填 gpt-5.6-sol $5/$0.5/$30、terra $2.5/$0.25/$15（用户 2026-07-11 截图）；gpt-5.5 待用户给中转（MyOpenAI）定价。

裸 /v1/responses 直调中转(api.codeyizhan.com)实测(2026-07-11 监控会话跨会话通报):
- **instructions 注入规则**:不带或空 `instructions` → 中转注入完整 Codex 基础系统提示词(21,334 字符≈4,388 input tokens,内容是编码 agent 操作手册,对评审任务是噪音);任意非空 instructions → 原样放行一字不加。**结论:裸调评审/仲裁必自带一句精简 instructions**,每次省 ~4.4K 输入且质量更好。
- 评审用最小 instructions(≈60 tokens,**每次字节级一致以命中提示缓存**): `You are a rigorous senior reviewer for a game project. Judge specs, task orders, and implementation evidence strictly against the stated acceptance criteria. Cite concrete evidence (file paths, line numbers, commits) for every verdict; list gaps and risks explicitly; never soften a failing verdict. Output structured Simplified Chinese. Be concise.`
- gpt-5.6-sol 经此中转真实输入墙 ≈ **372K tokens**(364K 可过、390K+ 直接 502),宣传 1M 不可达;计费=未缓存输入×$5/M+缓存×$0.5/M+输出(含推理)×$30/M。

**多 CLI 版(2026-07-12 重写)**:看板升级为同时监控三个 CLI,页面顶部标签页切换(全部/Codex/Kimi Code/OpenCode),事件流带 CLI 列:
- **Kimi Code** 源=`~/.kimi-code/sessions/**/wire.jsonl`,`step.end` 事件自带**单次** usage(`inputOther`=未缓存/`inputCacheRead`=缓存/`inputCacheCreation`=缓存写,顶层 `time` 毫秒),模型来自 `llm.request`,cwd 查 `~/.kimi-code/session_index.jsonl`;
- **OpenCode** 源=`~/.local/share/opencode/opencode.db`(SQLite,经 python 只读轮询,message 表 assistant 行 data JSON);**其 tokens.input 不含缓存读**(与 Codex 相反),适配层统一为 总输入=input+cache.read+write;其自带 cost 字段与 GLM-5.2 官价独立对账一致(双重验证);
- 定价预设已加(2026-07 搜证):**Kimi K2.7 Code** $0.95/$0.19/$4(kimi-for-coding 与 kimi-k2.7-code 同价),**GLM-5.2** $1.40/$0.26/$4.40(官方 ¥8/¥2/¥28);另全模型价目已填(gpt-5.5 同 Sol 卡、5.4-mini 0.75/0.075/4.5、k2.6 缓存 0.16、minimax-m3 0.3/0.06/1.2、qwen3.7-plus 0.4/0.08/1.6、deepseek-v4-flash 0.14/0.0028/0.28、v4-pro 0.435/0.0036/0.87)。
- **归档机制**:「归档清空」按钮→全部事件 gzip 列式存 `codex-watch/archive/tokens-*.json.gz`(51K 条≈772KB),`monitor-state.json` 存 watermark+各文件 offset+Codex 差分基线→重启秒开不重扫;勾「含归档历史」把所有归档卷解压合并回看板;源日志永不触碰。

**账单解剖方法(2026-07-12 实战)**:rollout 全量可解析——遍历 `~/.codex/sessions/**/rollout-*.jsonl`,`token_count` 事件数=API 响应数,`function_call`/`custom_tool_call`/`patch_apply_end` 看在干什么,`compacted` 出现=上下文顶到 auto_compact 天花板。**成本大头不是干活是"缓存上下文重计费"**(S7 案例:65% 是 cached 重计费,`wait` 轮询每次也全额计)——杠杆:auto_compact 调低(已 280K→160K)、长等待(playtest)放在小上下文的专用会话里跑、ultra 多 agent 禁用(见 [[model-seat-policy]])。

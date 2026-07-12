---
name: deepseek-agentic-executor
description: "可靠 agentic 执行席=DeepSeek 官方 API + claude-code(Anthropic 兼容端点);方舟 opencode 通道卡死弃用"
metadata:
  type: reference
---

**背景(2026-07-12 夜)**:火山方舟 Coding Plan(opencode 的 agent-plan 通道:deepseek/glm/doubao/kimi-k2.7)**无人值守长任务屡次卡死**(端口起了但日志零增长=僵尸,或初始化就挂)。弃用于自主执行。

**可靠替代=DeepSeek 官方 API 当 agentic 执行席**:
- 官方端点:纯对话 `https://api.deepseek.com`(chat/reasoner);**Anthropic 兼容 `https://api.deepseek.com/anthropic`**(接 claude-code)。
- 装 `npm i -g @anthropic-ai/claude-code`(已装,v2.1.207);非交互跑:
  `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic ANTHROPIC_AUTH_TOKEN=<key> ANTHROPIC_MODEL=deepseek-v4-pro ANTHROPIC_SMALL_FAST_MODEL=deepseek-v4-flash claude -p "<任务>" --dangerously-skip-permissions < /dev/null`
  = DeepSeek 后端、Claude Code agentic 外壳,能改文件+跑命令+跑 playtest,可靠不卡。key 存 scratchpad 环境文件(不入 git),owner 需事后轮换。
- 纯推理/生成补丁用官方 chat API(deepseek-chat,不用 reasoner——reasoner 隐藏推理会吃满 max_tokens 致正文空)。

**判活铁律(三态)**:端口 LISTENING+产物<10min 有增长=真活;端口活但日志≥15min 零增长=僵尸卡死(可清);端口无进程无产物=死亡。**禁用文件 mtime 瞎判死**(误杀过 B/D)。

**元教训**:①静态定位必确认偏误(喂同代码给两模型=假独立);置信上限 70,**必须运行时证据才升 90+**。②执行席"甩锅 harness/环境"要亲核原始数据不信自报。③改文件任务严格串行,全账清(完成或死亡,零在跑)才推进,每步先清 worktree。关联 [[model-seat-policy]] [[tutorial-coupling-step6]]。

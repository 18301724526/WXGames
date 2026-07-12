---
name: image-gen-relay
description: User's GPT Image relay API for game art generation — endpoint/key location, working call patterns, hard constraints (SERIAL ONLY, curl only, no transparent bg), and the validated UI-mockup workflow (edits endpoint + reference images).
metadata:
  node_type: memory
  type: project
  originSessionId: 2992377e-0795-4820-a4df-9cbb32be926b
---

用户的 GPT Image 中转 API(游戏美术/UI 生图用),凭据在 **`tmp/image-api.env`**(git 忽略区;IMAGE_API_BASE=https://api.codeyizhan.com/v1 + IMAGE_API_KEY)。

**硬约束(踩过的坑):**
- **绝对不能并行调用**——并行必 524(Cloudflare 超时,用户明确要求串行)。一次一张,出完再下一张。
- **只能用 curl**——Python urllib 被 Cloudflare 1010 拦 UA。
- **不支持 `background: "transparent"`**(gpt-image-1/1.5/2 全拒,走 tools 通道不透传)→ 真透明靠品红/纯色底生成 + 本地抠图(agent-sprite-forge skill 的 chroma-key 脚本,或自写)。模型会把"transparent background"字样画成**假棋盘格像素**(RGB 无 alpha)——必须程序化验 alpha 通道,别信眼睛。
- 尺寸会漂移(要 1024 可能给 1254);524 时可 `quality=medium/low` 降耗提速重试。

**可用模型**:gpt-image-1 / gpt-image-1.5 / gpt-image-2(`GET /models` 可查)。

**验证过的 UI 设计稿工作流(2026-07-07,Codex 屡次失败后打通):**
`POST /images/edits`(multipart)+ **`image[]=@现游戏截图` (+可选 `image[]=@风格参考图`)** + 精确到控件的布局保持 prompt + `size=1024x1536`(竖屏) → 模型"重皮真实界面"而非盲猜,中文 label 能写对。Codex 失败根因=十词短 prompt+不喂参考图。参考素材归档在 `docs/design/ui-hud-reference/`(user-references/ 有现游戏截图+三战参考);首版黑金重皮稿证明链路可行,用户方向=**轻量现代米哈游系×历史题材**(磨砂玻璃/细金线/留白/印章红点缀,忌黑漆重金)。

配套:[[canvas-miniprogram-portability]] 素材落盘走 ui-hud 管线(pipeline-meta.json + prompt-used.txt + AssetKeyRegistry);agent-sprite-forge skill 已装三端(~/.codex/skills + 仓库 .claude/skills + .agents/skills,commit 52af6604)。

**公司中转 2 号(更强,主力)**:凭据 `tmp/image-api2.env`(https://ai.comfly.chat/v1,公司 key 严禁外泄/入库,美术余额 100 有预算意识)。836 模型:nano-banana 全家/seedream 3-5/gpt-image/MJ/qwen-image/flux-kontext。**主力=nano-banana-pro 走 `/images/edits`**(multipart `image[]=@参考图`,可多图,返回 URL 非 b64)——布局/风格锚定极强。**UI 定稿流程的最终教训**:抽卡定风格要"真图锚定+逐控件布局描述+hex 色板写死+违禁清单";纯文字形容词摁不住模型先验(它总给游戏 UI 贴厚重材质皮);**布局自由化=退化成页游糊皮**;最终定稿=用户自己造好的参考图(layout-reference-v2.webp),AI 负责按锚微调(提亮/做旧这类单变量指令服从很好)。**素材生产配方已趟熟**(dock-v1 pipeline-meta):品红底 #FF00FF 一张表多枚 → 连通域切格(行距不均时别用均分网格)+ 双段去品红(青铜类加 b>g 规则杀紫晕)→ alpha QC。

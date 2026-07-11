# 仓库协作规则

## CodeGraph（必读：省 token 的代码检索）

定位或理解代码时，先运行 `codegraph explore "<符号名或自然语言问题>"`，再决定是否读文件。

它会返回相关符号的逐行源码、调用链和影响面，通常一次调用就能替代 `grep` 加多文件通读；只在需要编辑的精确区段才读原文件。

索引位于 `.codegraph/`，文件保存后约 1 秒自动更新。

## 技能使用边界

- 本仓库是 Canvas/H5 + Node 项目，与 Godot 无关：禁止加载任何 godot-* 技能与 studio 安装器技能（adopt-studio / install-studio / studio-help）。
- 代码定位与理解一律走上节的 CodeGraph，不要用整文件通读替代。
- encoding-safe-editing、generate2dmap、generate2dsprite 按需正常使用。

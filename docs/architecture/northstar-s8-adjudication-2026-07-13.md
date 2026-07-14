# 北极星 S8 裁决记录(2026-07-13,owner 拍板)

监督者文档(Fable 记录,owner 口头裁决)。对象:docs/architecture/northstar-s8-coverage-draft-2026-07-12.md(commit 0438d140)。

## 裁决

**十题全部照草稿推荐通过**(owner 原话:"上面的我同意"),即:
1. 新增通用成功事件 eventClaimed / conquestClaimed / famousSeekCompleted(拒绝复用 tutorialStateChanged);
2. 批准新增脚本类型 `orderedTargetFlow`;
3. 批准新增 `effectSequence`(effects 键锁冻结宿主表,禁配置函数);
4. `allowActionSet` 现在定类型、S9b 实现、S9a 期间宿主过渡豁免;
5. advisor/reward overlay **永久宿主豁免**(容器遮挡优先级,非步骤配置);
6. `cityEntered` 不保留隐式跨步追赶,每入口显式配置 next;
7. 命名流程允许通用 `beforeEffects` 参数;
8. `waitEventThenNext` 允许声明式 `afterEffects`;
9. tech-tree 补 `SOFT_GUIDE_TARGET_BY_ID` 显式映射,拒绝字符串直通;
10. 动态实体参数统一 alias,禁 id 进配置与 trace。

预算定格:脚本类型 **6** 种(3 现有 + 3 新增,≤6-7 预算);query 表 **2 条零新增**;宿主豁免 X1-X7 七项照草稿归属。

## owner 北极星重申(原话)

"我的目标就是教程和游戏不耦合,谁没了谁都能正常跑。"——终态判据以此为纲:游戏删教程可跑,教程引擎离游戏可测。

## 生效

S8 收官。S9a 批量迁移以本裁决 + 56 行草稿表为唯一依据开工;commit 数按草稿表分批重估,判据沿 S7 模式。

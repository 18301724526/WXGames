# 派单手册(2026-07-13 定稿,通宵实战验证版)

监督者作业标准。每一条都是今晚用真金白银校准过的。

## 一、发单前三查(铁律,缺一不发)

1. **环境四点烟测**:`bash scripts/dev-env-smoke.sh <目录> <后端端口> <预览端口>` 必须 4/4——①后端起+/api/version;②直连登录拿 token;③代理登录拿 token;④**用③的 token**经代理拿 game/state(过发布门)。注意后端**单会话强制**:旧 token 会被新登录顶掉(SESSION_REPLACED)。
2. **判据可机械复核**:每单预写通过判据(测试数字/文件存在/grep 计数),执行席只报所见。

## 二、席位路由(实战定级)

| 任务类型 | 席位 | 档位 |
|---|---|---|
| 开放定位(新 bug) | **sol xhigh 首发**(首考 A 级:三因联锁+真实模块探针) | xhigh |
| xhigh 未破 | 同席升 max → 再不破 ultra(封闭四铁律:范围白名单/产出写死/禁产品码/禁 commit) | max/ultra |
| 修复/手术 | sol | high(结构手术 xhigh) |
| 机械验证/playtest 跑腿 | **Luna 首选**($0.4/单,已转正)或 terra | medium |
| 判别实验/探针改造 | terra(tracer 是它建的)或 Luna | medium |
| 盲审对照(可选) | kimi/GLM(题面无假设,只给客观证据) | — |

**对等仲裁**:任何席位结论与共识相左 → 廉价席机械应用验证(worktree),运行时证据裁决,谁都没有证据特权。

## 三、单子模板

### A. 开放定位卷(xhigh/ultra)
```
你是独立排查员,开放定位一个未解 bug。仓库 <路径>,main HEAD(<commit>)。只读代码与证据+可新建未跟踪探针;严禁改产品代码、严禁 commit/push、严禁公网;唯一答卷 tmp/<名>-answer.md。
现象(运行时事实):<症状+复现率+关键数字,零假设零方向>。
证据:<产物目录/报告路径,自己去读>。
可复现:<环境配方三行+杀进程纪律>。
任务:①根因(文件/函数/行+机制链)②与现象矛盾的字段原样摘录③最小修复建议(不实施)。附运行时证据(静态推断不算)、置信度(无运行时证据上限 70)、排查复盘。约 45 分钟未收敛写最佳假设即停,诚实优先。
```

### B. 修复单(sol)
```
任务:修复已定位缺陷(证据 <报告路径>,不要重新定位)。一任务一 commit;codegraph 纪律;禁 spawn;监督者文档只读;禁公网;不跑 playtest。
病根:<文件:行+机制,写死>。
修复裁定:<方向写死;门禁合规通道写明;"发现裁定站不住就停手报告">。
特征测试:<逐条,计数断言禁超时断言;改既有断言须逐条说明>。
验证:node --test <文件> + npm test 全量,ℹ 原文禁转述。干净 commit(不 push);报告 tmp/sol-<名>.md 含"未做"清单。
```

### C. 机械验证单(Luna/terra,worktree)
```
你是 <X> 验证员,机械执行,禁止自主分析。工作目录:<worktree 路径>(一次性,可改)。禁公网;禁 commit/push;禁 npm install/ci;除指定改动外不碰源码。
1. <精确到行的改动+node --check>。
2. 后端 PORT=<P> DB_PATH=tmp/<x>.db node backend/server.js(后台);预览 LOCAL_PREVIEW_PORT=<P2> LOCAL_PREVIEW_API_BASE=http://127.0.0.1:<P>(后台)。
3. 执行题面指定的本地验证命令；3 分钟无输出则终止进程并如实报告，正常长耗时步骤按题面预算等待。
4. 报告 tmp/verify-<X>.md:summary 原样+里程碑逐项+停点 outcome 原样。只报所见,写完即停,收尾杀进程。
```

### D. worktree 考场搭建(监督者亲手,禁交执行席)
```
git worktree add --detach <TEMP>/<名> <commit>
PowerShell: New-Item -ItemType Junction 联结 根node_modules 和 backend/node_modules 两处(删用 cmd rmdir 禁 rm -rf)
复制 data/ 目录(config-release 运行时发布状态,缺=game/state 500)
跑 dev-env-smoke.sh 4/4 后才发单
```

## 四、端口与账号

每席独立段:后端 37x1/预览 87x1(x=席序),DB_PATH 独立,账号 test1/test2/test3/codexqa(密码 123456,各席自带隔离后端可复用)。主仓验证惯用 3671/8671。

## 五、部署

推 `private` 远程(自动部署)。前置:npm run lint(已提交文件零错)+ npm test 全量绿。command-owner 策展棘轮属另一工作流,不挡部署但要记账。禁推 origin(公司拉不了)。健康检查:47.116.32.216 的 /wxgame-refactor-api 路径(后端 3003)。

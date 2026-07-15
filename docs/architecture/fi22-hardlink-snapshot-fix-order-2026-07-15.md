# FI-22 根治工单 — 硬链快照不得用 chmod 保护（2026-07-15）

Status: **ACTIVE ORDER，最高优先级，先于一切 M1a 续做。**
Authority: owner 指令 2026-07-15（生产事故后）。

## 事故背景（必读，这是真实发生的线上事故）

`65df4bd6`（FI-22）在 `deploy.sh` 里加了：

```bash
if cp -al "$BACKEND_DIR" "$snapshot_dir" 2>/dev/null \
    && chmod -R a-w -- "$snapshot_dir"; then
```

`cp -al` 只新建**目录**，**文件全是硬链接、共享同一个 inode**。因此 `chmod -R a-w "$snapshot_dir"` 等于把**正在运行的线上文件**一起改成只读——生产 `civilization.db` 变 `444` → 后端启动时 `SchemaMigrationService.tryInsertLock` 写迁移锁失败 → `SqliteError: attempt to write a readonly database (SQLITE_READONLY)` → pm2 崩溃重启 302 次 → 线上 502 约 12 小时。**回滚代码救不回来**（权限在 inode 上，与代码版本无关）。已由监督者手工 `chmod 644` 恢复线上。

**该 chmod 现仍在工作树的 `deploy.sh` 里**，任何一次部署都会重演事故。**这是本单第一优先要拆掉的东西。**

## 设计结论（不要自由发挥，照此实现）

1. **权限手段对硬链接在原理上不可行**——保护共享 inode 的"快照"必然打到原件。**彻底删除 `chmod -R a-w` 与其配套的 `chmod -R u+w` 回滚路径**。
2. **对"就地写入"的文件，硬链快照根本不是快照**：写原件就是写"快照"（同一 inode）。SQLite DB 正是就地写入。所以**必须把 DB 及运行时可变数据排除出 `cp -al` 快照**。
3. **对代码文件，硬链快照是有效的**：部署替换代码文件时是新建文件/rename（新 inode），旧 inode 留在快照里 → 快照有效。所以 `cp -al` 保留用于代码，只需排除可变数据。
4. DB 的回滚保护**不归本单**：已有 `scripts/backup-runtime-state.sh`（better-sqlite3 `.backup()` API，真拷贝，DeepSeek FI-20 验证过快照一致）。本单只需**不破坏 DB**，不要在此重新发明 DB 备份。

## 任务（按序，每任务一 commit）

### FI22-T1 — 拆除 chmod、排除可变数据出快照
- `deploy.sh`：删除 `chmod -R a-w -- "$snapshot_dir"` 及配套的 `chmod -R u+w -- "$snapshot_dir"`。
- 快照改为排除可变运行时数据：至少排除 `*.db`、`*.db-wal`、`*.db-shm`（主库与 observability 库）以及运行时状态目录。实现方式自选但须简单可读（如 `cp -al` 后 `rm -f` 快照内的这些文件，或用 `rsync -a --link-dest` + `--exclude`）。**排除清单必须来自单一常量/数组，不得散落。**
- 在该段代码上写一行注释说明原因（`cp -al` 硬链共享 inode，chmod/就地写入会打到原件）——这是本仓允许的"约束型注释"。

### FI22-T2 — 机械回归测试（防止此坑复活）
- 在 `scripts/check-shell-scripts.test.js` 加断言：`deploy.sh` **不得**包含对 `$snapshot_dir` 的 `chmod`（正则断言，任何形式的 `chmod ... snapshot` 都 fail）；且快照创建后必须排除 `*.db*`。
- 加一个隔离演练（可放 `scripts/` 下，node:test 或 bash 皆可）：在临时目录造 `a/civilization.db` + 代码文件 → 执行 deploy.sh 的快照函数（或其等价最小复刻）→ 断言：①原始 `civilization.db` 权限仍可写（`-w` 位在）；②快照内不含 `*.db*`；③代码文件的硬链接快照仍存在且原件可被替换而快照不变。
- 判据：新测试在**修复前的 deploy.sh 上必须 FAIL**（负控，证明它能抓到这个坑），修复后 PASS。请在报告中给出这个"负控先红后绿"的原始输出。

### FI22-T3 — 全量门禁
- `npm test`、`npm run lint`、`node scripts/run-architecture-smoke.js`、`shellcheck deploy.sh`（双端已装：Windows `%USERPROFILE%\tools\shellcheck\shellcheck.exe`；WSL `shellcheck`）、`git diff --check`。
- 判据：全绿，原始输出入报告。

### FI22-T4 — WSL 镜像端到端部署验证（**本单的核心验收，不可跳过**）
- 部署当前 main（含 M0 + M1a-T1/T2/T3 迁移 + 本次修复）到 WSL 镜像：
  ```powershell
  wxpush main          # 或：wsl -d Ubuntu-24.04 -u root -- true; Start-Sleep 8; git push local main
  ```
- 必须验证并给出原始输出：
  1. 部署输出出现 `[hook] deploying branch: main` 且走到 `[Deploy] 部署完成`；
  2. **迁移真的在镜像库上跑过**（M0 的 release_manifests + M1a 的 command_receipts / command_execution_plans）——查镜像库表存在；
  3. **镜像的 DB 文件权限仍可写**（`stat -c %a` 含写位）——这是本次事故的直接回归判据；
  4. pm2 两个进程 online 且 `:3002` 健康 `{"status":"ok"}`；
  5. 部署第二次（幂等）仍绿。
- 提示：镜像 pm2 在 root 下；prod 的 pm2 在 `www` 下（`su -s /bin/bash www -c "pm2 ls"`）——本单**禁止碰 prod**。
- 判据：以上 5 项全部有原始输出证据，写入 `docs/architecture/m0/fi22-fix-evidence.md`。

## 纪律

- 一任务一 commit；判据在单内，完成即自验；测试数字禁转述。
- 先 codegraph explore 定位，禁大面积通读。LF 换行、UTF-8。
- **禁止碰生产服务器（47.116.32.216 / kodagame.top）**：本单只在本地与 WSL 镜像验证。prod 部署由监督者在本单验收后执行。
- 联网装工具允许（禁网仅指禁碰生产服务器）。
- 遇阻立即停手报告最小复现，禁试修-撤回循环。做完 FI22-T4 即停等审查。**禁止 spawn 子 agent。**

## 完成本单后（下一单预告，不要现在做）

M1a-T4/T5/T6（admission 影子写、恢复探针+lease CAS 谓词、故障注入）见 `docs/architecture/m1-atomic-receipt-order-2026-07-15.md`；T1/T2/T3 已由你完成（`052bf405`/`7484ad3e`/`71bdd267`）。

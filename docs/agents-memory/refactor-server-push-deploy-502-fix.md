---
name: refactor-server-push-deploy-502-fix
description: Refactor test-server push hook is now async (was 502/504); hook runs as www; SSH-as-root available for ops.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1b60935f-8215-46d5-9378-8f488ca88b3d
---

The refactor test server at `47.116.32.216` auto-deploys via the bare repo `/home/git/wxgame.git` post-receive hook. The hook runs **as `www`**, not root.

**The 502 (fixed 2026-06-25):** `deploy_refactor` used to run the multi-minute CI gate *synchronously* inside the git-http push connection → the connection dropped (HTTP 502/504), the ref landed but the deploy was killed, so every refactor push needed a manual deploy. Fixed by making only `deploy_refactor` launch the gate detached: `setsid bash /usr/local/sbin/wxgame-refactor-async-deploy.sh "$BARE_REPO_DIR" </dev/null >/dev/null 2>&1 &`. The runner is flock-serialized and logs to `/opt/wxgame-refactor/.wxgame/push-deploy.log`. A push to the configured private deployment ref now returns in under a second and deployment continues in the background; verify through the health endpoint and push-deploy log. Hook backup: `post-receive.bak-async502-20260625T160350Z`; `deploy_main`/`deploy_test` were left unchanged.

**Gotchas:** `www` has a nologin shell, so as root use `su -s /bin/bash www -c '...'`. The async runner deploys directly when already running as `www` and falls back to `su` only when invoked as root; plain `su www` fails because there is no login shell.

**SSH ops:** root SSH to the server is available for ops work (the user holds the credentials; not stored here). From this Windows box, password SSH works via a throwaway `SSH_ASKPASS` helper + `SSH_ASKPASS_REQUIRE=force` (no sshpass/plink installed). Related: [[local-dev-env]], [[github-push-https]].

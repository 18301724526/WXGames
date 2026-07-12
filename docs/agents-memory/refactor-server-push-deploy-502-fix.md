---
name: refactor-server-push-deploy-502-fix
description: Refactor test-server push hook is now async (was 502/504); hook runs as www; SSH-as-root available for ops.
metadata: 
  node_type: memory
  type: project
  originSessionId: 1b60935f-8215-46d5-9378-8f488ca88b3d
---

The refactor test server (`47.116.32.216`, branch `codex/refactor-tutorial-guide-architecture`) auto-deploys via the bare repo `/home/git/wxgame.git` post-receive hook. The hook runs **as `www`**, not root.

**The 502 (fixed 2026-06-25):** `deploy_refactor` used to run the multi-minute CI gate *synchronously* inside the git-http push connection → the connection dropped (HTTP 502/504), the ref landed but the deploy was killed, so every refactor push needed a manual deploy. Fixed by making only `deploy_refactor` launch the gate detached: `setsid bash /usr/local/sbin/wxgame-refactor-async-deploy.sh "$BARE_REPO_DIR" </dev/null >/dev/null 2>&1 &`. The runner is flock-serialized and logs to `/opt/wxgame-refactor/.wxgame/push-deploy.log`. Now `git push private codex/refactor-tutorial-guide-architecture` returns in <1s and the deploy runs in the background — verify via the health endpoint (see [[deploy-urls]]) + push-deploy.log. Hook backup: `post-receive.bak-async502-20260625T160350Z`; `deploy_main`/`deploy_test` left unchanged.

**Gotchas:** `www` has a nologin shell, so as root use `su -s /bin/bash www -c '...'`. The async runner runs the deploy directly when already `www` (the hook's user) and only falls back to `su www` if invoked as root — plain `su www` fails (no password). Manual deploy if ever needed, as www: `cd /www/wwwroot/h5-refactor-worktree && REPO_GIT_DIR=/home/git/wxgame.git bash scripts/deploy-refactor-tutorial-server.sh codex/refactor-tutorial-guide-architecture`.

**SSH ops:** root SSH to the server is available for ops work (the user holds the credentials; not stored here). From this Windows box, password SSH works via a throwaway `SSH_ASKPASS` helper + `SSH_ASKPASS_REQUIRE=force` (no sshpass/plink installed). Related: [[local-dev-env]], [[github-push-https]].

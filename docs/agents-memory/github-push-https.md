---
name: github-push-https
description: "Push GitHub origin over HTTPS, not SSH — SSH port 22 to github.com is blocked/unstable from this machine."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b650a18f-c0ec-472b-8495-f8e0f2c889cf
---

This machine cannot reach github.com over **SSH** (port 22): `git push` to an `git@github.com:...` URL fails with "Connection closed by 140.82.x.x port 22 / Could not read from remote repository" (transient/firewalled, retrying does not help).

Use **HTTPS** for the GitHub `origin` remote. `credential.helper=manager` (Git Credential Manager) has the token stored, so HTTPS push works non-interactively.

**Why:** verified working by the user on 2026-06-22 after the SSH route kept failing.

**How to apply:** keep `origin` set to `https://github.com/18301724526/WXGames.git` (already switched from the old `git@github.com:...` URL). If it ever reverts, run `git remote set-url origin https://github.com/18301724526/WXGames.git`. The deploy/server remote `private` (`http://...@47.116.32.216:3001/wxgame.git`) is HTTP and unaffected — pushing to it auto-deploys. See [[line-endings-lf]] for the other repo gotcha.

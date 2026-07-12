---
name: project-stage-dev
description: "WXGamesLocal is a pre-launch game on a DEV server; aim work at tech debt that speeds feature development, NOT production hardening."
metadata: 
  node_type: memory
  type: project
  originSessionId: b650a18f-c0ec-472b-8495-f8e0f2c889cf
---

This is a微信 H5 game still in active development, running on a **dev server**, far from official launch. The frontend domain is already HTTPS.

The user's standing priority at this stage: work should pay down **tech debt that makes continued feature development faster/safer** (e.g. the shared/ dedup, splitting untested god classes, fixing layering so it's clear where new code goes).

**Why:** the user explicitly rejected a production-hardening list (TLS everywhere, staging/blue-green, SQLite→Postgres migration, capacity planning) as wrong-direction for the current stage — those are launch-time concerns to park, not do now.

**How to apply:** when proposing improvements, rank by feature-development velocity/risk reduction, not by "what a mature prod system needs." Defer ops/scaling/security-hardening suggestions until closer to launch (mention them as parked, don't push them). See [[line-endings-lf]] and [[github-push-https]] for repo mechanics.

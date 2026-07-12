---
name: project-decomposition-completeness-rule
description: "MANDATORY rule for the whole-project decomposition task — read every source file, evidence-based not inferred, tracked against a manifest; incomplete = not final."
metadata: 
  node_type: memory
  type: project
  originSessionId: bda31d72-e65e-4e7f-a187-922fe7c1f793
---

The user demanded a COMPLETE, evidence-based decomposition of the entire project (frontend + backend): the full feature inventory (everything a player can do) → the files each feature depends on; how many systems / subsystems; which are boundary-unclear "chaotic" systems; and per-file fan-in (how many features/files reference each file).

**HARD RULE — survives context compression, no exceptions:**

1. The decomposition is built ONLY from files that were ACTUALLY READ in full — never inferred, never "looks like", never sampled-then-extrapolated.
2. EVERY source `.js` under `frontend/`, `backend/`, `shared/` (exclude `node_modules/`, `vendor/`, and `.test.js`) MUST be read and accounted for against the enumerated manifest (`git ls-files '*.js'`).
3. Maintain a read-status manifest; completeness = 100% of the manifest read. If ANY source file is unread, the decomposition is INCOMPLETE and must NOT be presented as final/done — say so explicitly and keep going.
4. Dependency / fan-in numbers come from the mechanical import graph (grep of require/import + frontend script-tag refs), not from guesses.

This is the foundation the user wants BEFORE any "engineering constitution" / invariant work. Related: [[architecture-refactor]], [[frontend-ecs-bridge-retirement]]. Deliverable: a decomposition doc under `docs/`.

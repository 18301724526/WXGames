# Button-Scheduler-Manager-Panel Implementation Coordination Rules

Status: Process note for implementation
Date: 2026-07-09
Scope: coordination between Codex mainline work and Go/Kimi/OpenCode auxiliary model output

## 1. Authority Order

This document is not an architecture contract. It defines how model outputs are assigned, reviewed, accepted, or rejected during the root-cause implementation loop.

Authority order:

1. `button-scheduler-manager-panel-refactor-spec-2026-07-09.md`
2. this coordination note
3. `model-benchmark-spec-compilation-2026-07-09.md`
4. raw Go/Kimi/OpenCode model output

If this note conflicts with the spec, the spec wins. If a model benchmark suggests a different workflow, this note wins for implementation coordination.

## 2. Main Driver

Codex with GPT-5.5 xhigh is the main driver.

Codex owns:

- main implementation;
- architecture interpretation;
- code integration;
- final test and repair loop;
- final Slice acceptance;
- deciding whether auxiliary model output is accepted, rejected, or converted into a spec-hardening task.

Go/Kimi/OpenCode models do not directly merge code, define architecture, or override the spec.

## 3. Auxiliary Model Roles

Go/Kimi/OpenCode models are used as auxiliary workers only when the task boundary is explicit.

Allowed roles:

- bounded implementation drafts after interfaces are frozen;
- independent review of already-frozen slice output;
- trace generation, test matrices, coverage checklists;
- static searches, risk lists, missing-test scans;
- alternative implementations used only as difference signals.

Disallowed roles:

- deciding architecture direction;
- changing frozen interfaces;
- proposing new Slice N+1 interfaces while reviewing Slice N;
- merging code into the main line;
- replacing Codex mainline code with auxiliary output.

Suggested model use:

| Model | Use |
|---|---|
| `glm-5.2` | explicit-interface implementation draft; complex module review |
| `deepseek-v4-pro` | async path, dispatcher fallback, exception path, and edge-case review |
| `minimax-m3` | Slice 0 trace, test cases, coverage matrix |
| `deepseek-v4-flash` | batch grep, static checklist, low-risk verification |
| `mimo-v2.5` / `mimo-v2.5-pro` | cheap batch checks only; not contract design |
| `kimi-k2.6` / `kimi-k2.7-code` | contrast implementation or critique only; output is a difference signal |
| `qwen3.7-plus` / `qwen3.6-plus` | tightly specified batch work only |
| `qwen3.7-max` | no standing seat; use only for a one-off outside opinion if explicitly requested |

## 4. Arbitration Rule

Auxiliary output must include evidence.

Evidence can be:

- a quote or section reference from the spec;
- a frozen signature from spec Section 6.11;
- a hook binding table mismatch;
- a Slice 0 baseline trace mismatch;
- a failing focused test;
- a static search result proving a compatibility path remains.

Codex arbitration:

1. If auxiliary output cites frozen contract evidence, Codex pauses the affected Slice and verifies it.
2. If the evidence is valid, Codex fixes the mainline or updates the spec before continuing.
3. If the evidence is invalid, Codex rejects the output and records the reason in the task notes.
4. If auxiliary output proposes a new idea in an unfrozen architecture area, Codex treats it as optional input. It does not change the mainline unless Codex explicitly decides to harden the spec.

Auxiliary models can force a review stop with evidence. They cannot directly overrule Codex.

## 5. Review Timing Rule

Slice N review must finish before Codex writes Slice N+1 mainline code.

Codex may analyze or plan Slice N+1 while auxiliary review for Slice N is running, but it must not write Slice N+1 implementation code until:

- Slice N focused tests have run or the reason they cannot run is recorded;
- auxiliary Slice N review output has been received or explicitly skipped;
- Codex has accepted, rejected, or converted every Slice N finding into a tracked follow-up;
- any valid contract mismatch has been fixed or the spec has been updated.

Auxiliary review of Slice N is limited to Slice N deliverables and frozen interfaces. Reviewers must not introduce new Slice N+1 interface suggestions during Slice N review.

## 6. Contrast Implementation Rule

Kimi K2.6 and Kimi K2.7 Code are probes, not source-of-truth implementers.

Their contrast implementation output is used this way:

- `diff == 0`: weak evidence that the frozen contract was independently understood;
- `diff != 0`: signal that the contract may still allow multiple plausible implementations;
- direct merge: forbidden.

When a contrast implementation differs from Codex mainline, Codex checks whether:

1. the auxiliary output reveals a real frozen-contract violation;
2. the spec has an ambiguous seam that needs hardening;
3. the auxiliary output is simply lower-quality or out of scope.

Only case 1 changes mainline directly. Case 2 updates the spec or coordination notes before more implementation. Case 3 is rejected.

## 7. Slice Gate Checklist

Before Codex moves from Slice N to Slice N+1:

- focused tests for Slice N are green, or failure/blocker is recorded;
- Go/Kimi/OpenCode review for Slice N is accepted, rejected, or skipped with reason;
- no valid frozen-contract mismatch remains open;
- no auxiliary output is waiting for arbitration;
- compatibility counters introduced by the Slice are recorded if applicable;
- the next Slice's frozen input assumptions are known.

Slice 7 remains a hit-target-pool exclusive period. No parallel model may work on hit target storage, resolver order, panel projection, or panel-surface rendering while Slice 7 is active unless Codex explicitly assigns that work under the Slice 7 contract.

## 8. Recordkeeping

Each auxiliary task should produce a short receipt:

```text
Task:
Model:
Slice:
Input contract:
Output type:
Findings:
Evidence:
Codex decision: accepted | rejected | spec-hardening | deferred
Reason:
```

Receipts may live in the working notes for the implementation loop. They are not architecture truth.

## 9. Expiration

This note expires when the first root-cause loop reaches Slice 8b and compatibility retirement is accepted. Future panel migrations may keep the pattern, but they should not inherit these rules blindly without a fresh review.

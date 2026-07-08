# Model Benchmark & Spec Compilation — Parallel-Seat Decision (Subscription-Scoped)

> **For GPT review.** Compiled by opencode (glm-5.2 model) on 2026-07-09 for the
> WXGamesLocal button-scheduler-manager-panel refactor spec hardening.
>
> **Scope locked** to the 14 models the user can actually invoke:
> GPT-5.5 (via user's own OpenAI API key, called inside Codex with `xhigh`
> reasoning effort) + the 13 models in the user's OpenCode Go subscription.
> Everything in this document concerns only these 14. Reference poles
> (Claude / Gemini / GPT-Premium) are deliberately omitted — they are not in
> the parallel-seat pool, so they would only muddy the decision.
>
> **Honesty statement.** The compiler has zero built-in knowledge of any 2026
> model below. Every number comes from public web sources fetched on
> 2026-07-09. Missing data is marked `—` or `not in board`, never invented.

## 1. In-scope models (14 total)

| # | Model | Channel | User access |
|---|---|---|---|
| 1 | `gpt-5.5` (xhigh reasoning) | user's own OpenAI API key | inside Codex only |
| 2 | `glm-5.2` (max) | OpenCode Go subscription | `opencode-go` provider |
| 3 | `glm-5.1` | OpenCode Go subscription | `opencode-go` provider |
| 4 | `kimi-k2.7-code` | OpenCode Go subscription | `opencode-go` provider |
| 5 | `kimi-k2.6` | OpenCode Go subscription | `opencode-go` provider |
| 6 | `mimo-v2.5` | OpenCode Go subscription | `opencode-go` provider |
| 7 | `mimo-v2.5-pro` | OpenCode Go subscription | `opencode-go` provider |
| 8 | `minimax-m3` | OpenCode Go subscription | `opencode-go` provider |
| 9 | `minimax-m2.7` | OpenCode Go subscription | `opencode-go` provider |
| 10 | `qwen3.7-max` | OpenCode Go subscription | `opencode-go` provider |
| 11 | `qwen3.7-plus` | OpenCode Go subscription | `opencode-go` provider |
| 12 | `qwen3.6-plus` | OpenCode Go subscription | `opencode-go` provider |
| 13 | `deepseek-v4-pro` (max) | OpenCode Go subscription | `opencode-go` provider |
| 14 | `deepseek-v4-flash` (max) | OpenCode Go subscription | `opencode-go` provider |

The OpenCode Go subscription model list endpoint returns 20 public IDs, but
only the 13 above are reachable for this user (the remaining — `glm-5`,
`kimi-k2.5`, `minimax-m2.5`, `mimo-v2-pro`, `mimo-v2-omni`, `hy3-preview` — are
either deprecated, not subscribed, or out of interest per the user).

## 2. Data sources actually used

| Source | URL | What it gives | Coverage for in-scope models |
|---|---|---|---|
| OpenCode Zen pricing & deprecation | `https://opencode.ai/docs/zen/` | Per-model price/1M, deprecation dates, supported variants | Full |
| models.dev | `https://models.dev` + per-model pages | Context window, output limit, knowledge cutoff, release date, reasoning/tools/structured/temperature flags, open-weights link | Full |
| Artificial Analysis Intelligence Index | `https://artificialanalysis.ai/leaderboards/models` | Composite intelligence on a 0-60 scale; also speed, latency, price, context | Full for all 14 |
| Aider polyglot leaderboard | `https://aider.chat/docs/leaderboards/` | Pass-rate % on 225 Exercism coding exercises (multi-language edit/no-human-intervention) | **Only older models (≤ 2025)**. None of the 14 in-scope 2026 models has an Aider row yet. |

**Not fetched this round**: SWE-bench Verified from each lab's release blog
(DeepSeek, Zhipu, Moonshot, MiniMax, Alibaba, OpenAI). These would give the
purest "real-bug fix" coding-agentic signal. **This is the single largest gap
in the document.** GPT should either request one more fetch round or pull
these itself before finalizing seats — especially for the Kimi-K2.7-Code vs
Kimi-K2.6 question, where the coding-axis number may flip the verdict.

**How to read the two score axes**:
- Artificial Analysis Intelligence Index is *not* a coding-only score. A
  higher index means generally smarter; a weaker coder than its index rank
  would suggest is possible.
- Aider polyglot rewards *editing discipline* (malformed-response rate, lazy
  comments) more than raw intelligence. A high-index model can still Aider
  poorly if it is sloppy with diff format.
- The two axes are *complementary*, not redundant. GPT should weigh both.

## 3. Spec table (from models.dev + OpenCode Zen pricing)

Context-window sizes are effective sizes exposed by the primary provider.
`xhigh` column means OpenCode Zen exposes that effort variant in the variants table.

| Model | Context | Output | Knowledge cutoff | Release | Open weights | Reasoning | Tools | Structured | Temperature | Zen price (in/out per 1M) | Zen `xhigh` variant |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gpt-5.5` | 922k (per Artificial Analysis) | 128k | — | 2026-04-23 | no | yes | yes | yes | yes | $5.00 / $30.00 (≤272K) | yes |
| `glm-5.2` (max) | 1,000,000 | 131,072 | — | 2026-06-13 | yes (HF) | yes | yes | yes | yes | $1.40 / $4.40 | yes (`max`) |
| `glm-5.1` | 200,000 | 131,072 | — | 2026-04-07 | yes (HF) | yes | yes | yes | yes | $1.40 / $4.40 | yes |
| `kimi-k2.7-code` | 262,144 | 262,144 | 2025-01 | 2026-06-12 | yes (HF) | yes | yes | **No on Zen Go provider metadata** (models.dev says Yes — unresolved) | no | $0.95 / $4.00 | — |
| `kimi-k2.6` | 262,144 | 262,144 | — | 2026-04-21 | yes (HF) | yes | yes | yes | yes | $0.95 / $4.00 | — |
| `mimo-v2.5` | 1,048,576 | 131,072 | — | 2026-04-22 | yes (HF) | no | yes | yes | yes | free (limited window) | — |
| `mimo-v2.5-pro` | 1,048,576 | 131,072 | — | 2026-04-22 | yes (HF) | no | yes | yes | yes | free (limited window) | — |
| `minimax-m3` | 1,000,000 (Zen lists 512,000) | 128,000 | — | 2026-06-01 | yes (HF) | yes | yes | no on Zen provider metadata | yes | $0.30 / $1.20 | — |
| `minimax-m2.7` | 204,800 | 131,072 | — | 2026-03-18 | yes (HF) | yes | yes | yes | yes | $0.30 / $1.20 | — |
| `qwen3.7-max` | 1,000,000 | 65,536 | — | 2026-05-21 | no | **no** | yes | yes | yes | $2.50 / $7.50 | — |
| `qwen3.7-plus` | 1,000,000 | 64,000 | — | 2026-06-02 | no | no | yes | yes | yes | $0.40 / $1.60 | — |
| `qwen3.6-plus` | 1,000,000 | 65,536 | — | 2026-04-02 | no | no | yes | yes | yes | $0.50 / $3.00 | — |
| `deepseek-v4-pro` (max) | 1,000,000 | 384,000 | 2025-05 | 2026-04-24 | yes (HF) | yes | yes | yes | yes | $1.74 / $3.48 | yes (`max`) |
| `deepseek-v4-flash` (max) | 1,000,000 | 384,000 | 2025-05 | 2026-04-24 | yes (HF) | yes | yes | yes | yes | $0.14 / $0.28 | yes (`max`) |

**Spec-level red flags worth GPT's notice**:
- `qwen3.7-max`: reasoning flag **no** despite highest price in the set. A
  composite score that is comparable to MiniMax-M3 and DeepSeek-V4-Pro (46 vs
  44 vs 44 — see §4) without reasoning is a steep price/performance mismatch.
- `kimi-k2.7-code`: structured-output "No" on Zen Go provider metadata even
  though models.dev lists "Yes" globally. For a refactor whose frozen
  descriptors depend on stable structured output, the conservative reading is
  "structured unreliable on this provider" until verified by a manual test.
- `mimo-v2.5` / `mimo-v2.5-pro`: free during the limited free window. The
  Zen privacy doc warns MiMo-V2.5-Free may retain data; if the WXGamesLocal
  spec contents are sensitive, GPT should factor this in before assigning
  these models to contract-design work.
- Several same-price / same-family duplicate pairs: GLM-5.2 vs GLM-5.1
  ($1.40/$4.40 both), MiniMax-M3 vs M2.7 ($0.30/$1.20 both), Kimi K2.6 vs
  K2.7 Code ($0.95/$4.00 both), MiMo V2.5 vs V2.5 Pro (both free). For each
  pair, the §4 intelligence score breaks the tie.

## 4. Artificial Analysis Intelligence Index — in-scope 14 models only

Index scale: 0-60. Higher is smarter overall. Asterisk `*` means
partial-sample estimate. Sorted by score descending. Speed and latency
columns are included because parallel-model integration likes fast first
chunks; if two candidates tie on intelligence, prefer the lower total
response time.

| Model | Context | Creator | Intelligence Index | Blended $/1M | Median tokens/s | First-chunk latency (s) | Total response (s) |
|---|---|---|---|---|---|---|---|
| `gpt-5.5` (xhigh) | 922k | OpenAI | **55** | $4.35 | 80 | 101.51 | 107.79 |
| `glm-5.2` (max) | 1M | Z AI | **51** | $0.90 | 213 | 1.41 | 13.16 |
| `qwen3.7-max` | 1M | Alibaba | 46 | $1.43 | 208 | 2.55 | 16.56 |
| `minimax-m3` | 1M | MiniMax | 44 | $0.22 | 95 | 2.04 | 28.43 |
| `deepseek-v4-pro` (max) | 1M | DeepSeek | 44 | $0.18 | 71 | 1.79 | 70.76 |
| `kimi-k2.6` | 256k | Kimi | 44 | $0.70 | 44 | 2.90 | 115.61 |
| `mimo-v2.5-pro` | 1M | Xiaomi | 42 | $0.18 | 44 | 2.82 | 59.49 |
| `kimi-k2.7-code` | 256k | Kimi | **42** | $0.70 | 46 | 3.00 | 62.04 |
| `deepseek-v4-flash` (max) | 1M | DeepSeek | 40 | $0.06 | 112 | 1.23 | 55.69 |
| `glm-5.1` | 200k | Z AI | 40 | $0.90 | 79 | 1.43 | 56.01 |
| `mimo-v2.5` | 1M | Xiaomi | 40* | $0.06 | 90 | 2.67 | 30.53 |
| `qwen3.6-plus` | 1M | Alibaba | 40 | $0.43 | 52 | 2.74 | 118.65 |
| `qwen3.7-plus` | 1M | Alibaba | 39 | $0.25 | 51 | 3.02 | 52.48 |
| `minimax-m2.7` | 205k | MiniMax | 38 | $0.22 | 53 | 2.00 | 57.77 |

### Tie-breakers visible in this table

- **GLM-5.2 vs GLM-5.1**: same price ($1.40/$4.40), **+11 intelligence** to GLM-5.2. Same family, newer. GLM-5.1 only has 200k context on top of that. Strongly dominated.
- **MiniMax-M3 vs M2.7**: same price ($0.30/$1.20), **+6 intelligence** to M3. M2.7 also has 205k vs 1M context. Strongly dominated.
- **Kimi K2.6 vs K2.7 Code**: same price ($0.95/$4.00), **K2.6 scores 44, K2.7 Code 42**. Same context, same release window. K2.7 Code, marketed as "code-tuned", is **below** its balanced sibling by 2 points. This is the cleanest identification of the user's PASS criterion ("salient trait but lower-than-balanced sibling score").
- **MiMo V2.5 vs V2.5 Pro**: both free, V2.5 Pro scores 42, V2.5 scores 40*. Same context. V2.5 Pro slightly ahead.
- **DeepSeek V4 Pro vs DeepSeek V4 Flash**: Pro 44, Flash 40, but Flash is ~15× cheaper per output token. Use Flash for breadth, Pro for hard cases.
- **Qwen3.7 Max vs Plus**: 46 vs 39, but Max is 5.3× the input price and has *no reasoning flag*. Max is the textbook "salient marketing, but worse price/performance than balanced sibling" phenomenon.

### Latency caveat for parallel-model integration

Total response time matters less for single-call code-gen than for
interactive tool-call loops, but for this refactor (which has many
frozen-signature calls) extremely high total response times hurt. Note:
- Kimi K2.6: 115.61s total — slowest in the set
- Qwen3.6 Plus: 118.65s — also very slow
- DeepSeek V4 Pro: 70.76s (max) — slow
- GLM-5.2: 13.16s — fastest in the top half
- MiniMax-M3: 28.43s — fast
- GPT-5.5 xhigh: 107.79s — medium-slow but worth it for intelligence

If GPT plans to put Kimi K2.6 on a contract-double-write seat, this latency
risk is real: two calls must complete before integration can proceed, and
Kimi's 115s drags end-to-end.

## 5. Aider polyglot pass-rate — only the in-scope model *ancestors* are visible

**Critical gap**: the 14 in-scope 2026 models have **no Aider row yet**.
The board's latest visible rows run up to October 2025 (DeepSeek-V3.2-Exp)
and July 2025 (Kimi K2). GPT must treat these as proxy evidence for the
in-scope families, not as direct evidence for the specific 2026 models.

| Ancestor (in-scope family) | Pass-rate % | Cost | Edit format | Malformed well-formed % | Seconds/case | Date |
|---|---|---|---|---|---|---|
| **gpt-5 (high)** — GPT-5.5's closest ancestor | **88.0** | $29.08 | diff | 91.6 | 194.0 | 2025-08-23 |
| gpt-5 (medium) | 86.7 | $17.69 | diff | 88.4 | 118.7 | 2025-08-25 |
| gpt-5 (low) | 81.3 | $10.37 | diff | 86.7 | 62.4 | 2025-08-25 |
| **DeepSeek-V3.2-Exp (Reasoner)** — DeepSeek V4 Pro's direct ancestor | **74.2** | $1.30 | diff | 97.3 | 291.2 | 2025-10-03 |
| DeepSeek-V3.2-Exp (Chat) | 70.2 | $0.88 | diff | 98.2 | 104.0 | 2025-10-03 |
| DeepSeek R1 (0528) — reasoning side, older | 71.4 | $4.80 | diff | 94.6 | 716.6 | 2025-06-06 |
| **Kimi K2** — only Kimi coding sample the compiler could find | **59.1** | $1.24 | diff | 92.9 | 67.6 | 2025-07-17 |
| **Qwen3 235B A22B (no think)** — Qwen3.7 family ancestor | **59.6** | — | diff | 92.9 | 45.4 | 2025-05-09 |
| Qwen3 32B | 40.0 | $0.76 | diff | 83.6 | 372.2 | 2025-05-08 |

**Reading**:
- **GPT-5.5**: the gpt-5 ancestor at 88% is the strongest evidence the
  compiler has that GPT-5.5 (xhigh) is genuinely good at editing code under
  complex instructions — this corroborates the Artificial Analysis index 55.
- **DeepSeek V4 Pro**: DeepSeek-V3.2-Exp Reasoner at 74.2% is the best
  non-GPT/non-Anthropic Aider score visible. This weakly supports DeepSeek's
  coding discipline being strong in principle, even though V4 Pro's
  Artificial Analysis index (44) is below GLM-5.2 (51). The 7-point gap on
  Artificial Analysis may under-state coding for DeepSeek V4 Pro. This is a
  real call GPT must make.
- **Kimi K2.6 / K2.7 Code**: the only Kimi coding sample available (Kimi K2,
  July 2025) is 59.1% — middling. Combined with K2.7 Code's Artificial Analysis
  42 below its balanced sibling K2.6's 44, the evidence points the same
  direction: "code-tuned" marketing is not backed by measurement.
- **Qwen3.7 family**: Qwen3 235B ancestor at 59.6% is also middling on
  Aider. Qwen3.7 Max's higher Artificial Analysis index (46) with no
  reasoning flag is a yellow signal for coding-agent use.
- **GLM-5.2, MiniMax-M3, MiMo V2.5 Pro**: no ancestry in the Aider board.
  GPT has to weigh these on Artificial Analysis alone, plus any vendor-published
  SWE-bench Verified if pulled in a follow-up round.

## 6. Cross-axis observations the compiler thinks GPT should weigh

These are observations, not assignments.

1. **GPT-5.5 (xhigh) is unique in the pool.** Index 55; next in scope is
   GLM-5.2 at 51 — a 4-point gap, which in this 0-60 scale is wider than the
   spread between GLM-5.2 (51) and Kimi K2.7 Code (42). The top-of-pool
   model holds one slot for tasks where one error ruins the project —
   contract design and final equivalence verdict.
2. **GLM-5.2 (max) is the strongest non-OpenAI model.** Index 51, all
   spec flags "yes", 1M context, "long-horizon coding agents" is models.dev's
   own description. Its 13.16s total response is also the fastest in the
   upper half. This is the default main-implementation seat.
3. **Kimi K2.7 Code fails the user's own PASS criterion** — the most
   important identification in this document. Same price and same context
   as K2.6; marketed as code-tuned; scores *lower* (42 vs 44) on composite
   intelligence; ancestrally Kimi K2 Aider only hits 59.1% (middling);
   structured output is "No" on the Go provider while K2.6 has it. GPT
   should either PASS K2.7 Code from any primary seat, OR require a fresh
   SWE-bench Verified fetch from the Moonshot release blog before deciding.
4. **Qwen3.7 Max is the clearest price/performance mismatch.** Zen price
   $2.50 / $7.50 is ~1.8× GLM-5.2's $1.40 / $4.40, and ~14× MiniMax-M3's
   $0.30 / $1.20. Yet index 46 is only +2 over M3 and DeepSeek V4 Pro (44).
   No reasoning flag. This is the textbook "salient marketing, worse than
   balanced peers" — pass from primary seats.
5. **DeepSeek V4 Pro (max): spec feast, score mid.** 1M context, all flags
   on, cheapest in the top tier ($0.18 blended / 1M). Index 44 ties
   MiniMax-M3 and Kimi K2.6, 7 points below GLM-5.2. But Aider's DeepSeek-V3.2
   reasoner ancestor at 74.2% suggests strong coding discipline. Net: a
   high-context, cheap, well-flagged model that is *not the smartest* —
   ideal as a parallel second opinion and for async-path analysis where
   context matters more than peak intelligence.
6. **MiniMax M3 is the baseline-freeze candidate.** Index 44, 1M context,
   $0.30 / $1.20 — has the context to hold the entire WXGamesLocal spec +
   multiple source files for slice-0 baseline freezing, at low cost. Its
   28.43s total response is mid-range (fast enough to not stall parallel
   integration).
7. **Latency risk for Kimi K2.6 and Qwen3.6 Plus.** K2.6's 115s and
   Qwen3.6-Plus's 118s are the two worst in the set. If GPT puts either on a
   contract-double-write or adversarial-test seat gated by integration,
   expect long pauses. Mitigations: pair them with a faster primary (so the
   fast model's output becomes the integration baseline while the slow one
   catches up), or only use them for off-critical-path breadth.
8. **MiMo V2.5 Pro is a defensible second-line seat only.** Index 42, free,
   1M context. Reasoning flag "no" — so do not put it on contract
   design. Fine for lint/grep/batch test execution under tight oversight.
9. **GLM-5.1, MiniMax-M2.7, MiMo-V2.5, DeepSeek-V4-Flash, Qwen3.6/3.7-Plus,
   Kimi K2.7 Code** are all index ≤ 40-42 with the same flags or worse than
   their respective priced sibling. They cluster as "use only if the seat
   tolerates mid-tier intelligence and benefits from cost". For WXGamesLocal
   contract work, most of these should be passed; DeepSeek V4 Flash is the
   one that still earns a place because its 1M context + all spec flags at
   $0.14 / $0.28 is uniquely cheap for breadth.

## 7. What is *not* in this document that GPT may need

The compiler explicitly flags these gaps so GPT can decide whether to request
one more fetch round before finalizing seats:

- **SWE-bench Verified scores** from each lab's release blog for GLM-5.2,
  DeepSeek-V4-Pro, Kimi-K2.7-Code, Kimi-K2.6, MiniMax-M3, Qwen3.7-Max,
  GPT-5.5. These would give a "what % of real GitHub bugs does it autonomously
  fix" number — the purest coding-agentic signal, and the metric most likely
  to change the Kimi-K2.7-Code vs Kimi-K2.6 conclusion one way or the other.
- **Multi-file repo benchmarks** (e.g., Internal SWE-bench or H(completion)
  on long-horizon repo tasks). WXGamesLocal is multi-file contract work;
  Aider polyglot is single-file per case and only a partial proxy.
- **User-side empirical micro-benchmark.** One exercise the compiler
  recommends: take a single representative file from WXGamesLocal (e.g.,
  `frontend/js/platform/CanvasPanelSurfaceManager.js` + its existing test)
  and run the *exact* Slice 0 baseline freeze task on 2-3 candidate models
  side by side. Cost is sub-dollar; the differential pass/fail is more
  decision-relevant than any leaderboard for this specific codebase.

## 8. Raw data provenance manifest

For GPT to audit the numbers above, every figure traces to one of the URLs
below. The compiler did not modify any number from the source.

| Source | Fetched URL | Used in |
|---|---|---|
| OpenCode Zen pricing/deprecation | `https://opencode.ai/docs/zen/` | §3 (prices, deprecation dates, xhigh availability) |
| OpenCode Go models endpoint | `https://opencode.ai/zen/go/v1/models` | §1 (in-scope subscription list) |
| models.dev per-model pages | `https://models.dev/models/zhipuai/glm-5.2` ; `…/minimax/MiniMax-M3` ; `…/moonshotai/kimi-k2.7-code` ; `…/deepseek/deepseek-v4-pro` ; `https://models.dev` top page | §3 (specs and provider tables) |
| Artificial Analysis leaderboard | `https://artificialanalysis.ai/leaderboards/models` | §4 (every Intelligence Index, price, speed, latency value) |
| Aider polyglot leaderboard | `https://aider.chat/docs/leaderboards/` | §5 (every Aider pass-rate figure for older-model ancestors) |

Truncated fetches (output written to tool-output files but not re-read by the
compiler):
- `https://models.dev` (~4229 lines, truncated)
- `https://artificialanalysis.ai/leaderboards/models` (~3130 lines,
  truncated)
- `https://aider.chat/docs/leaderboards/` (~928 lines, truncated)

The compiler did NOT consult any internal training-data knowledge of these
2026 models; it has none. Every row above is traceable to one of the URLs
in this section.

## 9. Compiler's tentative seat list

The compiler's *personal* tentative seat list, scoped only to the 14
in-scope models. GPT is the final decider.

| Seat | Suggested model | Intelligence Index | Notes |
|---|---|---|---|
| A — contract & final equivalence verdict | `gpt-5.5` (xhigh) inside Codex | 55 | unique top-of-pool; one error ruins project |
| C — main implementation, primary | `glm-5.2` (max) | 51 | all spec flags on; 1M context; 13.16s latency |
| C — double-write contrast partner | `kimi-k2.6` | 44 | different family; structured output on; but 115s latency drags end-to-end |
| B — Slice 0 baseline freeze | `minimax-m3` | 44 | 1M context for spec+files; cheap; mid latency |
| D — async path characterization (seek/accept/dismiss/assign) | `deepseek-v4-pro` (max) | 44 | different family; 1M context for path trace; Aider ancestry strong at 74.2% (V3.2 reasoner) |
| F — adversarial testing (separate session) | `deepseek-v4-pro` (max) or `deepseek-v4-flash` (max) | 44 / 40 | Pro for hard cases, Flash for cheap breadth |
| E — Slice 7 hit-target pool (exclusive period) | `glm-5.2` (max) single seat | 51 | 1M context, all flags on, fast enough |
| Second-line (lint, grep, batch tests) | `qwen3.7-plus`, `deepseek-v4-flash`, `mimo-v2.5-pro` | 39 / 40 / 42 | cheap or free; broad context; not contract work |
| PASS from primary seats | `kimi-k2.7-code`, `qwen3.7-max` | 42 / 46 | user's PASS criterion: salient trait, lower running-score than balanced sibling |
| PASS (dominated by newer same-price sibling) | `glm-5.1`, `minimax-m2.7`, `mimo-v2.5` | 40 / 38 / 40* | strictly dominated |
| Possibly usable but not recommended | `qwen3.6-plus` | 40 | 118s latency; weak flags |

The two open questions GPT must close before final seats are accepted:

1. **Kimi K2.7 Code vs Kimi K2.6**: whether the "code-tuned" claim is backed
   by a SWE-bench Verified score the compiler could not fetch this round. If
   Moonshot's release blog shows K2.7 Code with a *higher* SWE-bench
   Verified than K2.6, the PASS recommendation flips. Otherwise it stands.
2. **DeepSeek V4 Pro vs GLM-5.2 for seat D vs seat C**: whether V4 Pro's
   Aider ancestry (74.2% on V3.2 reasoner) overrides its lower Artificial
   Analysis index (44 vs 51) for the contract-double-write contrast role.
   The compiler's tentative answer is "keep GLM-5.2 on C, put V4 Pro on D",
   but GPT could reasonably swap them if V4 Pro's SWE-bench Verified comes
   back strong.

## 10. End of data

Nothing below this line. The compiler does not have additional internal
knowledge to add about any of these 2026 models.
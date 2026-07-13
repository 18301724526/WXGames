---
name: "codegraph"
description: "Uses CodeGraph CLI to inspect symbols, call relationships, impact, and affected tests in the current repo. Invoke when the user asks codebase structure, dependency, caller/callee, impact, or code navigation questions."
---

# CodeGraph

Use this skill when the task is primarily about understanding the codebase structure and relationships rather than editing code immediately.

Prefer this skill when the user asks things like:

- where a symbol is defined or referenced
- which functions call a method, or what a function calls
- what code is affected by changing a symbol
- which tests are impacted by changed files
- how a subsystem is connected across the repo

Do not use this skill for exact text search, finding a known filename, or reading a single known file. Use `rg`, direct file reads, or semantic search for those cases.

## Preconditions

CodeGraph CLI is expected to be installed on the machine. In this repo, the project index already lives under `.codegraph/`.

Before deeper analysis, check project readiness:

```powershell
codegraph status .
```

If the index is missing, initialize it:

```powershell
codegraph init .
```

If files may have changed since the last run, sync first:

```powershell
codegraph sync .
```

## Command Guide

Use the smallest command that answers the question:

1. Search symbols by name:

```powershell
codegraph query "<search>" -p .
```

2. Explore an area with related symbols and call paths:

```powershell
codegraph explore <natural-language query> -p .
```

3. Inspect one symbol or read one file with relationship context:

```powershell
codegraph node "<symbol-or-path>" -p .
```

4. Find callers:

```powershell
codegraph callers "<symbol>" -p .
```

5. Find callees:

```powershell
codegraph callees "<symbol>" -p .
```

6. Analyze change impact:

```powershell
codegraph impact "<symbol>" -p .
```

7. Find affected tests from changed files:

```powershell
codegraph affected <file1> <file2> -p .
```

8. Inspect indexed project structure:

```powershell
codegraph files -p .
```

## Workflow

1. Confirm the index is available with `codegraph status .`.
2. Run `codegraph sync .` if recent edits may not be indexed yet.
3. Choose the narrowest CodeGraph command that matches the user request.
4. Read the returned symbols/files directly when you need implementation detail or exact line references.
5. Summarize findings with concrete symbol names and file paths.

## Output Expectations

- Lead with findings, not raw command dumps.
- Include concrete file paths when possible.
- Call out uncertainty if the graph is stale or the symbol name is ambiguous.
- For change-risk questions, pair `impact` or `affected` results with a brief manual sanity check in source files.

## Examples

Find where combat tick flows next:

```powershell
codegraph callees "tickCombat" -p .
```

See what breaks if inventory serialization changes:

```powershell
codegraph impact "serializeInventory" -p .
```

Explore a subsystem:

```powershell
codegraph explore inventory save load pipeline -p .
```

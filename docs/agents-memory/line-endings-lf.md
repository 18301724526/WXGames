---
name: line-endings-lf
description: "Repo files are LF; .gitattributes is `* -text`; the Edit tool writes CRLF and must be normalized back to LF after editing."
metadata: 
  node_type: memory
  type: project
  originSessionId: b650a18f-c0ec-472b-8495-f8e0f2c889cf
---

WXGamesLocal stores all source as **LF** (committed blobs end `0a`), and `.gitattributes` is `* -text` (git does NO line-ending normalization), even though `core.autocrlf=true`.

The Edit/Write tools tend to save files as **CRLF**, which flips the whole file to CRLF → a massive spurious diff (e.g. a 1-line logical change shows as 635 changed lines) and breaks the `git diff --check` guard inside `npm run test:architecture` (reports every line as "trailing whitespace").

**How to apply:** After any Edit/Write to a tracked source file, normalize it back to LF before committing — e.g. a node one-liner `fs.writeFileSync(f, fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'))` (fs writes bypass the CRLF behavior). Verify with `git diff --check` (must be clean) and `git diff --stat` (changed-line count should match the real edit, not the whole file). Writing new files via a node fs script also keeps them LF.

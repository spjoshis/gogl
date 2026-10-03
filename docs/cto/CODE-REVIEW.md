# CODE-REVIEW.md — Interactive result selection (`-i`)

_Self/peer review (Gate 5) + CTO final review (Gate 6). 2026-10-03._

## Gate 5 — Peer review

Reviewed the full diff against the spec; ran the suite (16 suites, 406 passed,
5 skipped live-browser) and exercised the non-network CLI paths plus a
`readline`-over-`PassThrough` integration harness.

**Verified correct:**

- `parseInteractiveCommand` grammar: bare number → open; `o/c/p` (+ `open/copy/
  print`) with/without index; `o2` spacing; case-insensitivity; `q/quit/exit`;
  `h/help/?`; empty → noop. Bounds + malformed input all return `error` and
  never throw (incl. `0`, `-1`, `6` of 5, `3 4`, `open two`, `q1`).
- `runInteractive` dispatch, logging, continue-after-error, EOF/quit exit,
  empty-results early return, and open-failure containment — all asserted.
- `-i`/`--interactive` parses as a boolean exactly like `-q`, does not capture a
  query token, defaults false, and loses to `--help`/`--version` (deferred-error
  path unchanged).
- Security: open/copy reuse the argv/stdin-based helpers; no shell, no interp.

**Issue caught and fixed during review:**

- **Process hang on a real TTY.** Initial glue called `rl.close()` only; because
  `readline` resumes the stdin TTY, the process would hang after quitting the
  loop. The `PassThrough` smoke test masked it (not a TTY). Fixed by adding
  `process.stdin.unref()` in the `finally`. Re-verified exit under a hang-guard.

## Gate 6 — CTO final review

- **Product:** solves the stated "act on many results from one search" gap; the
  journeys for the scripter (non-TTY skip) and headless user (open-failure
  containment) are both covered by ACs and tests.
- **Engineering:** logic isolated in a pure module with injected I/O; `bin` glue
  is thin and the only untested seam (validated manually). Consistent with the
  `open.js`/`copy.js` precedent — no new patterns, no new deps.
- **Simplicity:** declined arrow-key/fuzzy TUI (would pull a dependency) and
  in-prompt re-search (scope creep). A bare number = open matches the existing
  `--open` default and `googler`'s omniprompt.
- **Security/Ops:** no new network/fs/secret surface; additive and backward
  compatible; no migration; rollback = revert. Default-off, CLI-only.

**Known limitations (documented, accepted):**

- The `readline` glue in `bin` is not a committed automated test (needs a live
  stream/TTY); covered by the pure loop tests + a manual harness.
- No `open all`/`copy all` yet (next-cycle candidate alongside history replay).

**Verdict:** Meets the production bar. Approved for PR.

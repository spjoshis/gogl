# CODE-REVIEW.md — CLI Output & Options

_Independent peer review (Gate 5) + CTO final review (Gate 6). 2026-09-20._

## Gate 5 — Independent peer review

An independent reviewer read the full diff, both spec docs, and the final
source; ran the test suite; and exercised the non-network CLI paths directly.

**Verified correct:** argument parsing edge cases (`-n`/`--results`/`--results=`,
`--` separator, flags before/after query, lone `-` as query, `-n` as last token),
validation (`abc`/`0`/`-2`/empty → exit 1, no browser), help/version
short-circuit before browser launch, backward compatibility (`search(query)`,
legacy numeric `search(query, 2)`, `formatResults(results)`, unchanged
`src/index.js` export surface, byte-identical text-mode banner), and security
(count is always an integer clamped 1–20; query is `encodeURIComponent`'d;
`page.evaluate` receives count as an argument; version read is local FS only).

**Verdict:** APPROVE-WITH-NITS (no blockers, no correctness bugs).

### Findings and resolutions

| # | Sev | Finding | Resolution |
|---|-----|---------|-----------|
| 1 | Minor | Clamp happened silently; spec requires a stderr notice on `--results > 20` | **Fixed.** Parser now returns a `clamped` flag; `bin/gogl.js` prints a one-line stderr notice. Covered by a parser test. |
| 2 | Minor | README not updated (explicit in-scope deliverable) | **Fixed.** README documents all flags, JSON stdout/stderr behavior, updated library API examples, and checks the roadmap boxes. |
| 3 | Minor | `--help`/`--version` did not win over parse/validation errors | **Fixed.** Parser defers errors and lets help/version short-circuit; covered by three new tests. |
| 4 | Nit | `search(query, null)` threw instead of degrading gracefully | **Fixed.** `typeof options === 'number' ? … : (options || {})`. |
| 5 | Nit | Default count `10` duplicated in three places (drift risk) | **Fixed.** `search.js` imports `DEFAULT_RESULTS` from `parser.js` (single source of truth). |
| 6 | Nit | No bin-level tests for help/version/errors; a couple of parser edges untested | **Fixed.** Added `tests/cli.test.js` (child-process CLI tests) plus parser tests for clamp flag, lone dash, and empty `--results=`. |

## Gate 6 — CTO final review

- **Product:** solves the scripting/automation gap (`--json`), the
  configurability gap (`--results`), and the CLI-hygiene gap (`--help`,
  `--version`, unknown-flag handling). User journeys A/B/C from the spec are all
  satisfied.
- **Engineering:** additive, backward compatible, no new dependencies, module
  boundaries preserved, no unrelated refactoring. Complexity is proportional to
  the feature.
- **Quality:** 52 unit tests pass (4 live tests remain opt-in); acceptance
  criteria are covered at both the unit and CLI level.
- **Security/privacy:** validated integer input, local-only version read, no new
  persisted data — the stated privacy guarantee is intact.
- **Ops:** safe to ship as minor `1.1.0`; no migration, no feature flag; rollback
  is a revert.

**Known limitation (documented, out of scope):** in this environment Google
serves an anti-bot CAPTCHA to the headless browser, so live searches currently
return `[]`. This is pre-existing behavior, not a regression; the feature handles
it gracefully. It elevates the alternate-engine work to the top of Cycle 2.

**CTO decision:** APPROVED for PR.

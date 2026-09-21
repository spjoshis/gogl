# CODE-REVIEW.md — Alternate Search Engine (DuckDuckGo)

_Self-review (Gate 5) + CTO final review (Gate 6). 2026-09-21._

## Gate 5 — Peer review

Reviewed the full diff and final source against the spec; ran the test suite
(with coverage) and exercised the non-network CLI paths directly.

**Verified correct:** engine registry lookup/validation, `--engine` /
`--engine=` parsing mirroring the existing `--results` pattern exactly,
`--help`/`--version` precedence over an invalid `--engine`, DuckDuckGo
redirect-URL unwrapping (`/l/?uddg=`), Google extraction logic unchanged
(moved verbatim, not rewritten), default-engine backward compatibility
(no-flag behavior identical to pre-change), library API (`search(query,
{engine})`) rejecting an unknown engine before any browser launch, 100%
statement coverage on `parser.js` and `src/engines/*`.

**Verdict:** APPROVE-WITH-NITS (no blockers, no correctness bugs).

### Findings and resolutions

| # | Sev | Finding | Resolution |
|---|-----|---------|-----------|
| 1 | Minor | `parser.js` reimplemented the "unknown engine" error message that `engines/index.js#resolveEngine` already produces — duplicated string, drift risk if one changes without the other | **Fixed.** `parser.js` now calls `resolveEngine(rawEngine)` inside try/catch and reuses its thrown error instead of re-deriving the message. |
| 2 | Nit | DuckDuckGo `extract`'s `uddg` redirect-unwrap had no test for a plain (non-redirect) href, which is the more common case for some result types | **Fixed.** Added a test asserting a plain href passes through unchanged. |
| 3 | Nit | No test asserted `--engine` is listed in `--help` output, so a future edit could silently drop it | **Fixed.** `cli.test.js` now asserts `--help` output contains `--engine`. |

### Known limitation (documented, out of scope for this cycle)

Neither engine's live extraction could be validated against a real,
non-challenged results page in this session: Google returned its existing
CAPTCHA block (per Cycle 1), and DuckDuckGo returned its own bot-detection
challenge ("Select all squares containing a duck") — confirmed independently
via a local Playwright launch, the gateway's `web_fetch` tool, and the
gateway's own DuckDuckGo-backed `web_search` tool, all three hitting the same
block. This is evidence the block is broad (not specific to one IP or tool),
not evidence the DuckDuckGo selectors are wrong — they match the
publicly-documented `html.duckduckgo.com` structure used by other
open-source scrapers, at the same confidence level Cycle 1 had for the
now-shipped Google selectors. Both engines degrade gracefully to `[]` /
"No results found." rather than throwing when blocked. Flagged as a Cycle 3
candidate: add a live DuckDuckGo assertion once verifiable from an
unblocked network.

## Gate 6 — CTO final review

- **Product:** solves the reliability gap identified in Cycle 1 (Google
  block with no workaround) by giving users an explicit escape hatch
  (`--engine duckduckgo`), without changing default behavior for existing
  users. Journeys A/B/C from the spec are all satisfied.
- **Engineering:** additive, backward compatible, no new dependencies,
  extracted (not duplicated) the existing Google logic into its own module,
  introduced one new sub-boundary (`src/engines/`) proportional to the
  feature — not over-abstracted (no plugin loader, no dynamic registration
  for two engines).
- **Quality:** 73 unit tests pass (4 live tests remain opt-in, unchanged);
  100% statement coverage on the new/changed non-browser code
  (`parser.js`, `src/engines/*`); acceptance criteria covered at both unit
  and CLI level.
- **Security/privacy:** engine name is allowlist-validated, never
  interpolated raw; DuckDuckGo's redirect URLs are decoded to plain data,
  never re-navigated or evaluated; no new persisted data.
- **Ops:** safe to ship as minor `1.2.0`; no migration, no feature flag;
  rollback is a revert. **Note:** merging to `main` triggers the existing
  path-filtered `publish.yml` workflow, which will publish `1.2.0` to npm
  automatically — this is a real, effectively-irreversible action (npm
  doesn't allow unpublishing after 72h) and is called out explicitly for the
  merge decision.

**CTO decision:** APPROVED for PR, pending the repo owner's explicit
go-ahead to push and merge (this cycle's process gate — publishing to npm is
not something to wave through automatically).

## Cycle 3 candidates (discovered during this cycle, not yet actioned)

- Opt-in live DuckDuckGo test once a non-blocked network is available to
  confirm current markup.
- Automatic engine failover was considered and explicitly rejected for this
  cycle (see PRODUCT-SPEC §10) — revisit only if manual `--engine` switching
  proves to be a common real-world workaround.
- Selector resilience work carried over from Cycle 1's backlog (#4) remains
  open and now applies to two engines instead of one.

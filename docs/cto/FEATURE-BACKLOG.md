# FEATURE-BACKLOG.md — gogl

_Discovery artifact (Gate 1). Generated 2026-09-20._

## Repository intelligence summary

`@spjoshis/gogl` is a small, single-purpose ESM CLI (~150 LOC of source) that
scrapes Google search results via Playwright (headless Chromium) and prints the
top results to the terminal. It is also usable as a library (`search`,
`formatResults`).

- **Architecture:** `bin/gogl.js` (entry) → `parser.js` (argv → query) →
  `search.js` (Playwright scrape + retry) → `formatter.js` (text render).
- **Tests:** Jest (ESM via `--experimental-vm-modules`). 16 unit tests pass;
  live integration tests gated behind `LIVE_TESTS=1`.
- **CI/CD:** GitHub Actions for test/security/publish (Node 20).
- **No** backend, frontend, DB, auth, or network service. Single dependency:
  `playwright`.

### Notable gaps & evidence

- `parser.js` only joins argv into a query — **any `--flag` is swallowed into
  the search string** (e.g. `@google --help` searches Google for "--help").
- `search.js` hardcodes `.slice(0, 10)` — result count is not configurable.
- `formatter.js` is text-only; README §"API Usage" and §"Piping" imply a
  scripting audience with **no machine-readable output**.
- `search.js` relies on legacy selectors (`[data-content-feature]`, `.s`) that
  are brittle against Google markup changes — a latent reliability risk.
- README §Security promises "does NOT store your search queries" — this
  **conflicts** with the roadmap's "Search history" item.
- No `--help` / `--version` — standard CLI hygiene is missing.

## Scoring framework

`Score = (Value × Impact × Confidence) ÷ Complexity`, each factor 1–5.
Value = user/business worth · Impact = breadth of benefit · Confidence =
certainty it lands cleanly · Complexity = effort + risk.

## Top 10 backlog (ranked)

| # | Feature | V | I | C | Cx | Score | Notes |
|---|---------|---|---|---|----|-------|-------|
| 1 | **CLI arg layer + `--json`** (machine-readable output) | 4 | 4 | 5 | 1.5 | **53.3** | Unlocks scripting; requires real flag parsing (foundation). README-planned. |
| 2 | **`--help` / `--version` + unknown-flag handling** | 4 | 4 | 5 | 1.5 | **53.3** | Fixes the "`--flag` becomes query" bug; nearly free once arg layer exists. |
| 3 | `--results N` (configurable count) | 3 | 3 | 5 | 1.5 | 30.0 | README-planned; removes hardcoded `slice(0,10)`. |
| 4 | Selector resilience / extraction hardening | 5 | 5 | 3 | 3 | 25.0 | Core scrape may already be degraded; higher risk, needs live testing. |
| 5 | `--filter` (filetype/date via Google operators) | 3 | 3 | 4 | 2 | 18.0 | README-planned; thin wrapper over query operators. |
| 6 | Alternate engine (`--engine duckduckgo`) | 5 | 4 | 2.5 | 4 | 12.5 | Best reliability lever (Google blocks bots) but per-engine DOM; own cycle. |
| 7 | Colored / rich terminal output (`--no-color`) | 2 | 2 | 4 | 1.5 | 10.7 | Cosmetic; deferred as fast-follow. |
| 8 | Result caching (TTL) | 3 | 3 | 3 | 3 | 9.0 | Speeds repeats, reduces blocking; needs store + invalidation. |
| 9 | Config file support | 2 | 2 | 4 | 3 | 5.3 | Premature until enough options exist to configure. |
| 10 | Search history | 2 | 2 | 4 | 2 | — | **Rejected for now:** contradicts README's stated privacy guarantee. Only viable as explicit opt-in. |

## CTO prioritization decision

Items **#1–#3 are synergistic and share one foundation**: a real
argument-parsing layer. Doing `--json` correctly *requires* parsing flags out of
argv, which is the same work that enables `--help`, `--version`, `--results`, and
fixes the latent "`--flag` swallowed into query" bug.

**Selected for this cycle:** _CLI Output & Options_ — introduce an argument
layer and ship `--json`, `--results N`, `--help`, `--version`, and safe
unknown-flag handling as one coherent, backward-compatible feature.

Deferred to next cycles: selector resilience (#4, needs live validation),
alternate engine (#6), colored output (#7). Search history (#10) stays rejected
pending a product decision on the privacy guarantee.

## Cycle 1 outcome & learnings (2026-09-20)

**Shipped:** _CLI Output & Options_ (#1–#3) — `--json`, `-n/--results`,
`--help`, `--version`, `--` separator, unknown-flag handling. Backward
compatible, 52 unit tests passing, README updated, version bumped to 1.1.0.
Delivered via PR on branch `feat/cli-output-options`.

**Key discovery (elevates the backlog):** during live end-to-end validation,
Google served an **"unusual traffic / not a robot" CAPTCHA** page to the headless
browser — confirmed via `document.body.innerText` ("Our systems have detected
unusual traffic…") and `div.g` count = 0. This means the **core scrape is
currently returning zero results in this environment** regardless of the new
flags. The new feature handles it gracefully (`[]` in JSON, "No results found."
in text, exit 0), but it confirms a real reliability ceiling.

**Re-prioritization for Cycle 2:** item **#6 (alternate engine, e.g.
DuckDuckGo HTML endpoint)** is promoted to the **top** candidate — DuckDuckGo's
`html.duckduckgo.com` is far more automation-friendly and would restore actual
results, which is currently the single biggest product risk. Item **#4 (selector
resilience)** remains relevant but is secondary to escaping the block. Suggested
Cycle 2 selection: **#6 alternate engine**, with `--engine` flag riding on the
argument layer this cycle introduced.

## Cycle 2 outcome & learnings (2026-09-21)

**Shipped:** _Alternate Search Engine (DuckDuckGo)_ (#6) — `src/engines/`
abstraction (`google.js`, `duckduckgo.js`, registry), `--engine <name>` /
`--engine=<name>` CLI flag, `search(query, { engine })` library option.
Google stays the default (backward compatible). 73 unit tests passing (up
from 52), 100% statement coverage on `parser.js` and `src/engines/*`.
Version bumped to 1.2.0. Branch `feat/multi-engine-search`, pending push/PR.

**Key discovery (same class as Cycle 1's):** live validation attempted from
three independent network paths in this session — a local Playwright launch,
the gateway's `web_fetch` tool, and the gateway's own DuckDuckGo-backed
`web_search` tool — and **all three hit a DuckDuckGo bot-detection
challenge**, not just Google. This means item #6 does not currently *prove*
it restores live results in this environment; it's shipped on the strength
of well-documented public markup (same confidence level Cycle 1 had for
Google) plus graceful degradation (empty results, not a crash) if the
challenge is hit. The underlying reliability risk (#4, selector/anti-bot
resilience) is now confirmed to affect **both** engines, not just Google.

**Re-prioritization for Cycle 3:** promote **#4 (extraction/anti-bot
resilience)** — specifically, add an opt-in live DuckDuckGo assertion once
verifiable from an unblocked network, and reconsider whether engine
auto-failover (rejected this cycle as premature, see PRODUCT-SPEC §10)
becomes justified if manual `--engine` switching turns out to be a common
real-world workaround users need. Items #7 (colored output) and #9 (config
file) remain viable lower-risk fast-follows if reliability work stalls on
environment access.


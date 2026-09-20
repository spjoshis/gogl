# PRODUCT-SPEC.md — CLI Output & Options

_Unified product specification (Gate 2). Synthesized from three product-owner
lenses: (A) scripting/automation user, (B) interactive terminal user,
(C) library consumer. Generated 2026-09-20._

## 1. Objective

Give `gogl` a real command-line interface: machine-readable output and a
configurable result count, plus the standard `--help`/`--version` affordances —
without breaking the existing zero-flag behavior or the library API.

## 2. User problem

- **Automation users** can't consume results programmatically; text output must
  be regex-scraped. (README even documents an "API Usage" and "Piping" section,
  signaling this audience.)
- **All users** hit a footgun: any `--flag` is silently folded into the search
  query. `@google --help` searches Google for "--help".
- **Power users** can't ask for more or fewer than 10 results.
- There is no `--version` (needed for bug reports; README asks reporters to
  include it) and no `--help`.

## 3. Target users & journeys

- **A. Scripting user:** `gogl --json "rust async" | jq '.[0].url'` → clean JSON
  on stdout, progress/noise on stderr, non-zero exit on failure.
- **B. Interactive user:** `gogl -n 5 nodejs` → 5 human-readable results;
  `gogl --help` → usage; `gogl --version` → version string.
- **C. Library consumer:** `import { search, formatResults }` continues to work;
  `formatResults(results, { json: true })` returns a JSON string.

## 4. Functional requirements

1. **`--json`** — emit results as a JSON array of `{title,url,description}` on
   **stdout**. No results → `[]`. The human "Searching Google for…" banner must
   NOT pollute stdout in JSON mode (route it to stderr).
2. **`-n, --results <N>`** — integer result count. Default `10`. Supports
   `--results 5`, `-n 5`, and `--results=5`.
3. **`-h, --help`** — print usage/options to stdout, exit `0`. Short-circuits
   (works with no query).
4. **`-v, --version`** — print the package version to stdout, exit `0`.
   Short-circuits.
5. **Unknown flags** (`--foo`) → error to stderr with a usage hint, exit `1`.
6. **`--` separator** — everything after `--` is treated as query text, enabling
   queries that begin with `-`.
7. **Backward compatibility** — with no flags, behavior is byte-for-byte the
   current behavior (text output, top 10, banner on stdout). The library
   `search(query)` / `formatResults(results)` signatures keep working.

## 5. Business rules & validation

- `--results` value must be a positive integer (`>= 1`). Non-integer, zero, or
  negative → error to stderr, exit `1`.
- `--results` is capped at **20** (`MAX_RESULTS`). Values above 20 are clamped
  to 20 with a one-line stderr notice. Rationale: Google's first results page
  realistically yields ~10 organic results; a best-effort `num` hint is sent but
  more than one page is out of scope.
- Flags may appear before, after, or interleaved with query words.
- If `--json` and a human flag like `--help` are combined, the short-circuit
  flag (`--help`/`--version`) wins.

## 6. Non-functional requirements

- **No new runtime dependencies** — hand-rolled parsing (the surface is tiny;
  adding `yargs`/`commander` would violate the "zero deps" selling point).
- **Performance:** parsing is O(argv); no measurable overhead. `--help` /
  `--version` must NOT launch a browser.
- **Security/privacy:** no new data stored; query still only sent to Google.
  Version is read from the local `package.json`, not the network.
- **Observability:** errors and notices go to stderr; results to stdout. Exit
  codes are meaningful (`0` success/help, `1` usage/runtime error).

## 7. Acceptance criteria (Given → When → Then)

1. **JSON output**
   - Given a query, When I pass `--json`, Then stdout is valid JSON parseable
     into an array of `{title,url,description}` objects and contains no banner.
2. **JSON empty**
   - Given a query with no results, When I pass `--json`, Then stdout is exactly
     `[]` (parseable, length 0).
3. **Result count**
   - Given `--results 3`, When results are formatted, Then at most 3 are
     returned/printed.
   - Given `-n 3` or `--results=3`, Then behavior is identical to `--results 3`.
4. **Count validation**
   - Given `--results abc` (or `0`, or `-2`), When parsed, Then a usage error is
     raised (exit 1), and no browser launches.
   - Given `--results 999`, Then the effective count is clamped to 20.
5. **Help/version**
   - Given `--help` (or `-h`), Then usage prints to stdout and exit is `0`, even
     with no query, and no browser launches.
   - Given `--version` (or `-v`), Then the version from package.json prints and
     exit is `0`.
6. **Unknown flag**
   - Given `--bogus`, Then an error prints to stderr and exit is `1`.
7. **Separator**
   - Given `-- --json`, Then the query is the literal string `--json` (flag not
     interpreted).
8. **Backward compatibility**
   - Given only query words (no flags), Then output equals the pre-change text
     output (top 10, banner on stdout).
   - Given `search(query)` / `formatResults(results)` calls, Then existing
     return shapes are unchanged.

## 8. Edge cases & error states

- Empty argv → existing usage error (exit 1). Unchanged.
- `--results` as the last token with no value → usage error.
- Query is only flags after parsing (e.g. `@google --json`) with no query → the
  existing "query required" usage error (exit 1) — unless `--help`/`--version`.
- Whitespace normalization of the query is preserved (`\s+` → single space,
  trimmed).

## 9. Scope

- **In scope:** arg parsing layer, `--json`, `--results/-n`, `--help/-h`,
  `--version/-v`, `--` separator, unknown-flag handling, README update, tests.
- **Out of scope (future):** `--no-color`/colored output, alternate engines,
  caching, config files, multi-page pagination, date/filetype filters.
- **Assumptions:** single-page Google scrape; `num` URL hint is best-effort.
- **Dependencies:** none new.

## 10. Cross-lens reconciliation (conflicts resolved by CTO)

- **stdout hygiene (A vs B):** Lens A wants pure JSON on stdout; Lens B wants the
  reassuring banner. **Resolution:** banner stays on stdout in text mode
  (backward compat) but moves to **stderr in JSON mode**. Best of both.
- **Result cap (A vs C):** Lens A wanted uncapped `--results`; library lens C
  wanted predictable bounds. **Resolution:** cap at 20 with a stderr notice;
  honest about the single-page limitation.
- **Parser vs library (C):** changing `search(query, maxRetries)`’s second
  positional arg risked breaking library callers. **Resolution:** accept an
  options object *and* a legacy numeric second arg (see TECHNICAL-DESIGN).
- **Dependency (all):** a PO suggested `commander`. **Rejected** — conflicts
  with the package's "zero dependencies" identity for a tiny flag surface.

# PRODUCT-SPEC.md — Alternate Search Engine (DuckDuckGo)

_Unified product specification (Gate 2). Synthesized from three product-owner
lenses: (A) reliability-first user hitting Google blocks, (B) interactive
default user, (C) library consumer. Generated 2026-09-21._

## 1. Objective

Give `gogl` a pluggable search-engine backend so a search can be served by
Google (default, unchanged) or DuckDuckGo, without breaking existing
zero-flag behavior or the library API.

## 2. User problem

- Cycle 1's live validation found Google serving a CAPTCHA/"unusual traffic"
  challenge to the headless scraper — the tool's **core function can return
  zero results** with no user-facing workaround.
- Users have no way to route around a blocked or degraded engine.
- The README's roadmap already promised "Multiple search engine support."

## 3. Target users & journeys

- **A. Reliability-first user:** `gogl --engine duckduckgo nodejs` when
  Google is blocking them → results from DuckDuckGo instead, same output
  shape.
- **B. Default user:** `gogl nodejs` → unchanged, still Google, same output
  as before this change.
- **C. Library consumer:** `search('nodejs', { engine: 'duckduckgo' })`
  returns the same `{title,url,description}[]` shape regardless of engine.

## 4. Functional requirements

1. **`--engine <name>`** — select the search engine. Supported values:
   `google` (default), `duckduckgo`. Supports `--engine duckduckgo` and
   `--engine=duckduckgo` forms, matching the existing `--results` pattern.
2. **Unknown engine** (`--engine bing`) → error to stderr naming the
   supported engines, exit `1`. Deferred like other validation errors so
   `--help`/`--version` still win.
3. **Output parity** — result objects have the same shape
   (`{title, url, description}`) regardless of engine; `--json`, `--results`,
   text formatting all work unchanged with either engine.
4. **Library API** — `search(query, { engine })` accepts the new option;
   omitting it preserves the current default (`google`).
5. **Backward compatibility** — with no `--engine` flag, behavior is
   byte-for-byte the current Google-only behavior.

## 5. Business rules & validation

- `DEFAULT_ENGINE` stays `google` — the package is branded and installed as
  `@google`; changing the default would be a surprising behavior change for
  existing users and is not justified by this cycle's evidence (the Google
  block observed in Cycle 1 was inside this specific sandboxed environment,
  not confirmed as universal).
- Engine name validation is a fixed allowlist (`google`, `duckduckgo`), not
  free-form input passed into a URL — no injection surface.

## 6. Non-functional requirements

- **No new runtime dependencies** — reuses the existing Playwright
  dependency; engines differ only in URL and DOM-extraction logic.
- **Performance:** engine dispatch is a single object-property lookup; no
  measurable overhead versus Cycle 1.
- **Security/privacy:** no new data stored; the query is sent only to the
  selected engine. DuckDuckGo's redirect-wrapped result links
  (`/l/?uddg=...`) are unwrapped client-side before being returned, so
  callers get the real destination URL, not a DuckDuckGo redirect.
- **Observability:** the "Searching <Engine> for…" banner and error messages
  name the active engine so failures are attributable.

## 7. Acceptance criteria (Given → When → Then)

1. **Default unchanged**
   - Given no `--engine` flag, When a search runs, Then it uses Google and
     produces output identical to pre-change behavior.
2. **Engine selection**
   - Given `--engine duckduckgo`, When a search runs, Then it navigates to
     the DuckDuckGo HTML endpoint and returns results in the same shape.
3. **Unknown engine**
   - Given `--engine bing`, Then a stderr error names the unknown engine and
     the supported list, and exit code is `1`, with no browser launched.
4. **Help precedence**
   - Given `--help --engine bing`, Then help wins (exit `0`), matching the
     existing `--results`/unknown-flag precedence rule.
5. **Library parity**
   - Given `search(query, { engine: 'duckduckgo' })`, Then the resolved
     engine is used and an unknown engine name rejects the returned promise
     before any browser is launched.
6. **Redirect unwrapping**
   - Given a DuckDuckGo result whose link is a `/l/?uddg=` redirect, Then
     the returned `url` is the decoded real destination, not the redirect.

## 8. Edge cases & error states

- `--engine` as the last token with no value → usage error (mirrors
  `--results`).
- Engine-specific extraction returning zero results (e.g. an anti-bot
  challenge page) → empty array, same graceful handling as the existing
  Google path (`[]` in JSON, "No results found." in text, exit `0`).
- A DuckDuckGo result with a malformed/unparseable href → the raw href is
  kept rather than the extractor throwing.

## 9. Scope

- **In scope:** engine abstraction (`src/engines/`), `--engine` flag,
  DuckDuckGo backend, tests, README updates.
- **Out of scope (future):** additional engines beyond Google/DuckDuckGo,
  automatic engine fallback/failover on block detection, per-engine result
  count tuning, `--filter`, caching, colored output, config files.
- **Assumptions:** DuckDuckGo's `html.duckduckgo.com` markup
  (`.result__body`, `.result__title a.result__a`, `.result__snippet`, the
  `/l/?uddg=` redirect scheme) matches the widely-documented structure used
  by other open-source scrapers; this could not be live-verified in this
  session (see TECHNICAL-DESIGN §5 / CODE-REVIEW known limitations).
- **Dependencies:** none new.

## 10. Cross-lens reconciliation (conflicts resolved by CTO)

- **Default engine (A vs B):** Lens A (reliability-first) wanted DuckDuckGo
  as the default since Google was observed blocked. **Resolution:** keep
  `google` as default — the block was observed in one sandboxed environment,
  not confirmed universal, and the package's own branding/command name
  (`@google`) makes a silent default change a bigger behavioral surprise
  than the problem it would solve. Users who hit blocks can opt in via
  `--engine`.
- **Automatic failover (A):** Lens A also proposed auto-retrying with a
  second engine on failure. **Rejected for this cycle** — adds meaningful
  complexity (partial-failure semantics, doubled request volume, unclear
  which engine's error to surface) for a benefit not yet proven necessary;
  revisit if manual `--engine` switching turns out to be a common workaround
  users actually need.

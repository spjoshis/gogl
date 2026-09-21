# TECHNICAL-DESIGN.md — Alternate Search Engine (DuckDuckGo)

_Engineering design (Gate 3). Generated 2026-09-21._

## 1. Components affected

| File | Change | Reason |
|------|--------|--------|
| `src/engines/index.js` | **New.** Engine registry + `resolveEngine(name)` | Single source of truth for supported engine names |
| `src/engines/google.js` | **New.** Extracted from old `search.js` inline logic | Isolates Google-specific URL/DOM logic |
| `src/engines/duckduckgo.js` | **New.** DuckDuckGo backend | Isolates DuckDuckGo-specific URL/DOM logic |
| `src/search.js` | `searchOnce` takes an `engine` object; `search()` accepts `options.engine` | Generic browser/retry orchestration, engine-agnostic |
| `src/parser.js` | Adds `--engine`/`--engine=` parsing + validation against `ENGINE_NAMES` | New CLI surface |
| `bin/gogl.js` | Wires `options.engine` into `search()`; help text lists engines; banner names the active engine | I/O orchestration |
| `package.json` | Version bump only (no new deps) | Zero-dep principle preserved |
| `tests/engines.test.js` | **New.** Per-engine `buildUrl`/`extract` tests | Behavior coverage without a browser |
| `tests/parser.test.js`, `tests/cli.test.js`, `tests/search.test.js` | Extended | `--engine` coverage |
| `README.md` | Documents `--engine`, engine table, roadmap checkbox | Docs-as-delivery |

Module boundaries: `parser → search → engines/{name} → formatter`. The
`engines/` directory is a new sub-boundary, but the top-level pipeline shape
(parse → search → format → print) is unchanged.

## 2. Technical design

### 2.1 `src/engines/index.js` — registry

```js
export const DEFAULT_ENGINE = 'google';
export const ENGINES = { google, duckduckgo };
export const ENGINE_NAMES = Object.keys(ENGINES);
export function resolveEngine(name) {
  const engine = ENGINES[name];
  if (!engine) throw new Error(`Unknown engine: ${name}. Supported: ${ENGINE_NAMES.join(', ')}`);
  return engine;
}
```

No dynamic import/plugin loading — a small static map is proportional to two
engines and keeps the surface simple (YAGNI; a plugin system would be
over-engineering for this scale).

### 2.2 Engine module contract

Each engine module exports:

- `label: string` — human-readable name for banners/errors (e.g. `"Google"`).
- `buildUrl(query, count): string` — the URL to navigate to.
- `extract(count, doc = document): Array<{title,url,description}>` — DOM
  extraction. Runs inside the page via `page.evaluate(engine.extract, count)`,
  so it must not close over anything outside its own module (only `document`,
  `URL`, and other page globals). The `doc = document` default parameter is
  what Playwright's browser context resolves at call time in production, and
  is also what lets tests inject a fake `doc` without a browser or jsdom.

`google.js` extraction logic is moved verbatim from the old inline
`page.evaluate` callback in `search.js` — no behavior change for the default
path.

`duckduckgo.js` targets `https://html.duckduckgo.com/html/?q=<query>` (the
no-JS "lite" HTML endpoint, appropriate for a headless scrape) and extracts
via `.result__body` → `.result__title a.result__a` (title + href) and
`.result__snippet` (description). DuckDuckGo wraps external result links in
a redirect (`https://duckduckgo.com/l/?uddg=<encoded-url>&rut=...`); `extract`
unwraps this via `new URL(href, 'https://duckduckgo.com')` and decodes the
`uddg` query param, falling back to the raw href if parsing fails.

### 2.3 `src/search.js` — generic orchestration

```js
async function searchOnce(query, count, engine) {
  // unchanged retry/browser lifecycle; navigates to engine.buildUrl(...)
  // and calls page.evaluate(engine.extract, count)
}

export async function search(query, options = {}) {
  const opts = typeof options === 'number' ? { maxRetries: options } : (options || {});
  const { maxRetries = 2, results = DEFAULT_RESULTS, engine: engineName = DEFAULT_ENGINE } = opts;
  const engine = resolveEngine(engineName); // throws synchronously -> rejected promise
  // existing retry loop, unchanged
}
```

`resolveEngine` is called once per `search()` invocation, before the retry
loop, so an unknown engine name fails fast without launching a browser (same
principle as `--results` validation failing before any network call).

### 2.4 `src/parser.js` — `--engine` flag

Mirrors the existing `-n`/`--results` pattern exactly:

- `--engine <value>` consumes the next token; `--engine=<value>` splits on
  `=`.
- Missing value → deferred error `--engine requires a value`.
- Value not in `ENGINE_NAMES` → deferred error `Unknown engine: <name>.
  Supported: <list>`.
- Deferred so `--help`/`--version` still short-circuit and win, consistent
  with every other validated flag.

`parser.js` imports `DEFAULT_ENGINE`/`ENGINE_NAMES` from `engines/index.js`;
`engines/index.js` has no dependency on `parser.js` or `search.js`, so no
import cycle is introduced.

### 2.5 `bin/gogl.js` — orchestration

- Help text's engine line is generated from `ENGINE_NAMES` (not hand-typed),
  so it can't drift from the registry.
- The progress banner now reads `Searching ${engine.label} for: "<query>"`
  instead of a hardcoded "Searching Google for…", resolved via
  `resolveEngine(options.engine).label`.
- `search(options.query, { results: options.results, engine: options.engine })`
  — the only change to the call site.

## 3. Security

- `--engine` value is validated against a fixed allowlist before use
  anywhere; it is never interpolated into a URL or otherwise passed through
  raw. No injection surface (same posture as the `--results` integer check).
- DuckDuckGo's `uddg` redirect param is decoded with `decodeURIComponent`
  and returned as plain data (a string in the result object) — never
  evaluated, navigated to automatically, or used to construct another
  request. Callers (CLI or library) treat it exactly like a Google result
  URL: display/format only.
- No new persisted data; the privacy guarantee ("does NOT store your search
  queries") is unaffected — engine selection is transient per-invocation,
  not persisted.

## 4. Performance

- `resolveEngine` is an O(1) object lookup.
- No additional network round-trips versus Cycle 1: still one navigation,
  one browser instance, one `page.evaluate` per attempt, regardless of
  engine.
- DuckDuckGo's HTML-only endpoint is lighter to render than Google's results
  page (no client-side JS-driven layout), so `waitUntil: 'networkidle'` may
  resolve faster in practice, though this wasn't benchmarked.

## 5. Reliability & failure behavior

- Retry loop (`maxRetries`, unchanged) applies uniformly regardless of
  engine; a failing engine still gets up to 2 attempts before the error
  propagates.
- Error messages are now engine-attributed (`Failed to search
  ${engine.label}: ...`) instead of hardcoded to "Google", so failures are
  diagnosable when `--engine duckduckgo` is in play.
- **Known limitation (could not be live-validated this session):** both
  Google and DuckDuckGo served anti-bot/CAPTCHA challenges to every network
  path available in this session (local Playwright launch, the gateway's
  `web_fetch`, and even the gateway's DuckDuckGo-backed `web_search` tool
  all hit challenges). The DuckDuckGo selectors are based on the
  widely-documented public structure of the `html.duckduckgo.com` endpoint
  (used by numerous open-source scrapers), matching the same confidence
  level Cycle 1 had for the Google selectors, but neither engine's
  extraction logic was confirmed against a live, non-challenged results
  page in this session. If DuckDuckGo has changed its markup since, `extract`
  degrades to an empty array (same graceful behavior as a real zero-result
  search) rather than throwing.

## 6. Testing strategy

Unit (non-live, run in CI):
- **engines/index:** default engine, name list, `resolveEngine` success and
  unknown-name throw.
- **engines/google:** `buildUrl` shape; `extract` against fake DOM nodes
  (title/url/description, ad-skipping, count limiting) — logic unchanged
  from Cycle 1, re-verified after the extraction.
- **engines/duckduckgo:** `buildUrl` shape; `extract` against fake DOM nodes
  covering redirect-unwrapping, plain hrefs, missing snippet, missing title
  (skip), and count limiting.
- **parser:** `--engine`/`--engine=` forms, unknown engine throws, missing
  value throws, `--help` wins over an invalid engine (mirrors `--results`
  tests).
- **cli:** invalid `--engine` exits 1 with a stderr message; `--help` output
  mentions `--engine`.
- **search:** unknown engine rejects before any browser launches (empty
  query short-circuits before the engine even matters, covered by existing
  tests); default/duckduckgo engine names accepted.

Fake-DOM tests use plain object mocks (`{ querySelector, querySelectorAll }`)
rather than a jsdom dependency — consistent with the "zero new dependencies"
principle and the existing test style.

Live (gated by `LIVE_TESTS=1`, not in CI): unchanged existing Google live
tests; no new live DuckDuckGo test was added because this session couldn't
get a non-challenged response to assert against (would be a flaky/unreliable
CI assertion). Documented as a Cycle 3 candidate: add an opt-in live
DuckDuckGo test once markup can be confirmed from a non-blocked network.

Regression: entire existing suite (73 non-skipped tests) passes unchanged in
behavior for the default (no-`--engine`) path.

## 7. Rollout / ops

- Additive, backward-compatible → safe to ship as a minor version bump
  (1.2.0). No migrations, no feature flag needed.
- Merging to `main` triggers `.github/workflows/publish.yml` (path-filtered
  on `src/**`, `bin/**`, `package.json`), which **publishes to npm
  automatically**. This is a real, irreversible-in-effect action (npm
  versions can be deprecated but not deleted) — flagged explicitly for the
  merge decision, not something to wave through silently.
- Rollback = revert the commit / publish a patch that reverts behavior; npm
  doesn't support unpublishing a version after 72h.

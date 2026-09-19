# TECHNICAL-DESIGN.md — CLI Output & Options

_Engineering design (Gate 3). Generated 2026-09-20._

## 1. Components affected

| File | Change | Reason |
|------|--------|--------|
| `src/parser.js` | Rewrite: argv → `{ query, json, results, help, version }` | New CLI contract; core of the feature |
| `src/search.js` | `search(query, options)` accepts `results`; `searchOnce(query, count)`; `num` URL hint | Configurable count, backward compatible |
| `src/formatter.js` | `formatResults(results, options)` with `{ json }` path | Machine-readable output |
| `bin/gogl.js` | Wire flags; help/version short-circuit; stderr routing | I/O orchestration |
| `package.json` | none (no new deps) | Zero-dep principle |
| `tests/*` | Extend parser/formatter/search tests | Behavior coverage |
| `README.md` | Document flags; update roadmap checkboxes | Docs-as-delivery |

No new components/modules. Existing module boundaries are preserved
(parse → search → format → print).

## 2. Technical design

### 2.1 `parser.js` — argument layer

Signature unchanged: `parseArgs(argv) -> object`. New return shape:

```js
{ query: string, json: boolean, results: number, help: boolean, version: boolean }
```

Algorithm (single left-to-right pass):

1. If no argv → `{ query: '', json: false, results: DEFAULT_RESULTS,
   help: false, version: false }`.
2. Walk tokens:
   - `--` → push all remaining tokens to `queryParts`, stop flag parsing.
   - `-h`/`--help` → `help = true`.
   - `-v`/`--version` → `version = true`.
   - `--json` → `json = true`.
   - `-n`/`--results` → consume next token as value; `--results=N` handled by
     splitting on first `=`.
   - other `-`/`--`-prefixed token → **unknown flag**: throw
     `Error('Unknown option: <flag>')`.
   - anything else → `queryParts.push(token)`.
3. Validate `--results` value: must match `/^\d+$/` and be `>= 1`; else throw
   `Error('--results must be a positive integer')`. Clamp to `MAX_RESULTS`
   (20); when clamped, set a `results` = 20 (bin emits the stderr notice, or
   parser returns the clamped value and bin notices — see 2.4).
4. `query = queryParts.join(' ').trim().replace(/\s+/g, ' ')` (preserves current
   normalization).

Constants: `DEFAULT_RESULTS = 10`, `MAX_RESULTS = 20`.

**Error strategy:** parser throws `Error` for invalid/unknown flags; `bin`
catches and renders usage + exit 1. Throwing (vs returning an error field) keeps
the happy-path shape clean and matches "fail fast, handle at the edge."

### 2.2 `search.js` — configurable count, backward compatible

```js
export async function search(query, options = {}) {
  const opts = typeof options === 'number' ? { maxRetries: options } : options;
  const { maxRetries = 2, results = 10 } = opts;
  // retry loop → searchOnce(query, results)
}
```

- Preserves the legacy `search(query, 2)` numeric call AND the documented
  `search(query)` call. New callers use `search(query, { results })`.
- `searchOnce(query, count = 10)`: add `&num=${count}` to the Google URL as a
  best-effort hint; `page.evaluate` takes `count` and returns
  `items.slice(0, count)`.
- Passing a value into `page.evaluate` uses the arg form:
  `page.evaluate((n) => {…}, count)`.

### 2.3 `formatter.js` — JSON path

```js
export function formatResults(results, options = {}) {
  if (options.json) return JSON.stringify(results ?? [], null, 2);
  // existing text path unchanged
}
```

- Empty/undefined in JSON mode → `"[]"`.
- Text path byte-for-byte unchanged (backward compat).

### 2.4 `bin/gogl.js` — orchestration

1. `parseArgs` inside try/catch. On thrown parse error → print message + short
   usage to stderr, exit 1.
2. If `help` → print help text to **stdout**, exit 0 (before any browser).
3. If `version` → read version from `package.json`, print to stdout, exit 0.
4. If no `query` → existing usage error to stderr, exit 1.
5. Banner: text mode → stdout (unchanged); JSON mode → stderr.
6. `search(query, { results })` → `formatResults(results, { json })` →
   `console.log` (stdout).
7. Existing error mapping (timeout/network/other) preserved; exit 1.

**Version read (ESM, Node ≥18 safe):** resolve `package.json` via
`fileURLToPath(new URL('../package.json', import.meta.url))` +
`readFileSync` + `JSON.parse`. Avoids JSON import-assertion syntax differences
between Node 18/20.

## 3. Security

- No new inputs cross a trust boundary beyond the existing query→Google flow.
- `--results` is strictly validated (`/^\d+$/`) before use; it is only
  interpolated into a numeric `num=` and an array slice — no injection surface.
- Version read is local FS only; no secrets, no network.
- No new data persisted; privacy guarantee intact.

## 4. Performance

- Parsing is O(n) over argv (tiny). Help/version short-circuit **before**
  launching Chromium (saves ~3–5s + ~150MB when the user just wants help).
- `num` hint may return more results on one page; still one navigation, one
  browser — no added round-trips.

## 5. Reliability & failure behavior

- Retry loop unchanged (exponential-ish backoff, 2 attempts).
- Invalid flags fail fast with exit 1 and never launch a browser.
- JSON mode still exits 1 on runtime error (errors on stderr), so scripts can
  detect failure via exit code even though stdout would be empty.

## 6. Testing strategy

Unit (non-live, run in CI):
- **parser:** `--json`, `-n`/`--results`/`--results=`, defaults, positive-int
  validation (reject `abc`/`0`/`-1`), clamp >20, `--help`/`-h`,
  `--version`/`-v`, unknown flag throws, `--` separator, flags interleaved with
  query, backward-compat (query-only still returns `.query`).
- **formatter:** JSON path returns parseable array; empty → `[]`; text path
  unchanged (existing tests must still pass).
- **search:** legacy `search('')`/whitespace still returns `[]`; numeric second
  arg still accepted (no throw) — assert via a short-retry empty-query call.

Live (gated by `LIVE_TESTS=1`, not in CI): `--results 3` returns ≤3;
`--json` shape. Kept opt-in like existing live tests.

Regression: entire existing suite must remain green.

## 7. Rollout / ops

- Pure additive, backward-compatible change → safe to ship in a minor version
  (1.1.0). No migrations, no feature flag needed. Rollback = revert the commit.
- README updated in the same PR (docs-as-delivery).

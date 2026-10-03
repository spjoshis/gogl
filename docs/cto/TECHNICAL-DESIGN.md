# TECHNICAL-DESIGN.md — Interactive result selection (`-i`)

_Engineering design (Gate 3). Generated 2026-10-03._

## 1. Components affected

| File | Change | Reason |
|------|--------|--------|
| `src/interactive.js` | **New.** Pure command grammar + injectable loop | All interactive logic, testable with no TTY/browser/clipboard |
| `src/parser.js` | Add `-i`/`--interactive` → `options.interactive` | Mirrors the existing `-q`/`--quiet` boolean flag exactly |
| `bin/gogl.js` | `runInteractivePrompt(results)` wires `readline` to the loop; called after results print | Thin I/O glue; keeps logic out of the entry point |
| `tests/interactive.test.js` | **New.** Grammar + loop coverage | Behavior protection |
| `tests/parser.test.js` | `-i`/`--interactive` cases | Flag parsing |
| `tests/cli.test.js` | `-i` recognized; help documents it | Non-network CLI guard |
| `README.md`, `package.json` | Docs + version 1.9.0 → 1.10.0 | Delivery |

## 2. Module boundary — `src/interactive.js`

Two pure pieces + one injectable loop, so the only untestable code is the
`readline` wiring in `bin`:

- `parseInteractiveCommand(input, count) → { action, index?, message? }`
  where `action ∈ {open, copy, print, help, quit, noop, error}`. Pure; handles
  bare numbers, verb+index (optional whitespace), aliases, bounds-checking, and
  malformed input (returns `error`, never throws).
- `formatResultDetail(index, result) → string` for the `print` command.
- `runInteractive(results, { prompt, log, open, copy }) → Promise<void>`. Loops
  on `prompt()` (resolves a line, or `null` on EOF), dispatches parsed commands,
  catches open/copy failures, and returns on `quit`/EOF/empty-results.

This matches the existing `open.js`/`copy.js` pattern (pure resolver + injected
`spawn`), so no new testing approach is introduced.

## 3. CLI integration (`bin/gogl.js`)

`runInteractivePrompt(results)`:

1. Return immediately if `results.length === 0`.
2. If `!process.stdin.isTTY`, print a stderr note and return (no hang on pipes).
3. Create a `readline` interface; `rl.on('SIGINT', () => rl.close())`.
4. `prompt()` wraps `rl.question`, racing the `close` event so EOF/Ctrl-D/Ctrl-C
   resolve `null` (ends the loop) rather than leaving a dangling promise.
5. In `finally`: `rl.close()` **and `process.stdin.unref()`** — readline resumes
   the TTY, so without unref the process would hang after the loop ends.

Called at the end of the search `try` block, after the one-shot `--open`/`--copy`
handling, so `-i` composes with (does not replace) the existing flags.

## 4. Security

- No shell, no string interpolation: open/copy reuse `openUrl`/`copyToClipboard`,
  which pass the URL as a single argv element / via stdin respectively.
- Input is parsed by a strict regex grammar; anything unrecognized becomes an
  inert `error` result. No `eval`, no dynamic dispatch on user text.
- No new network, filesystem, or env surface. No secrets involved.

## 5. Performance

- Zero cost unless `-i` is passed. The loop is idle-wait on user input; no busy
  loop. No extra browser launches — it acts on the already-fetched result set.
- One `readline` interface; closed and unref'd on exit.

## 6. Error handling & reliability

- Parse errors / out-of-range indices → inline message, loop continues.
- `open`/`copy` throwing → caught, reported, loop continues (headless-safe).
- EOF / SIGINT / `q` → clean exit; `unref` guarantees process termination.
- Empty results or non-TTY → mode is skipped entirely.

## 7. Testing strategy

- **Unit (grammar):** every verb/alias, bare number, `o2` spacing, case, no-arg
  defaults, `0`/out-of-range/unknown/`q1` errors, null/empty input.
- **Unit (loop):** open/copy/print dispatch + logs, empty-line no-op, help, an
  invalid command then a valid one (continuation), EOF stop, quit stop,
  open-throws-is-caught, empty-results-no-prompt.
- **Integration (glue):** a throwaway harness drove `runInteractive` through a
  real `readline` over a `PassThrough`, asserting dispatch and clean EOF exit
  under a 2s hang-guard (verified during development; not a committed test since
  it needs a live stream).
- **CLI (non-network):** `-i --help` exits 0 with no "unknown option"; help text
  lists `--interactive`. No test triggers a live search.

## 8. Backward compatibility

Additive: a new default-off flag, a new module, no changes to `search()`,
result shape, output formats, or any existing flag. All 377 prior tests stay
green.

---

# Addendum — History replay (`--last`) · 2026-10-03

## Components
| File | Change |
|------|--------|
| `src/history.js` | **New** pure `resolveReplay(entries, index)` → `{query,engine}` or `{error}` |
| `src/parser.js` | `--last`/`--last=n` → `replayRequested`+`replayIndex` (optional numeric arg like `--open`); conflict guards vs a query and `--engine` |
| `bin/gogl.js` | Resolve replay (via `listHistory({limit:0})` + `resolveReplay`) **before** the empty-query check; set `options.query`/`options.engine`; validate stored engine with `resolveEngine`, else fall back |
| tests | `history.test.js` (resolveReplay), `parser.test.js` (`--last`), `cli.test.js` (empty-history exit 1 + query-conflict exit 1) |

## Key decisions
- **Reproduce query + engine.** `--engine`/query are rejected alongside `--last`
  rather than silently merged, so precedence stays unambiguous. Ambient
  env/config engine is overridden by the stored engine (that's "reproduce").
- **Resolve in bin, not parser.** The parser stays pure/offline; history I/O
  lives in bin at call time (same separation as the search itself).
- **`resolveReplay` returns `{error}`** instead of throwing, so the caller owns
  the exit path — consistent with the best-effort, never-crash history module.

## Security / performance / reliability
- No new surface: reads the existing local JSONL history; stored query is passed
  as data to the same search path (no shell/interp). Corrupt lines already
  skipped by `list()`; an entry without a query → explicit error.
- One extra file read only when `--last` is used. Fails fast (before any browser)
  on empty/out-of-range history.

## Backward compatibility
Additive; no change to `search()`, result shape, or existing flags. Stacked on
v1.10.0 (interactive) → v1.11.0.

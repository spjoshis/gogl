# PRODUCT-SPEC.md — Interactive result selection (`-i`)

_Unified product specification (Gate 2). Synthesized from three product-owner
lenses: (A) the terminal power-user who runs many searches a day, (B) the
careful scripter who pipes output, (C) the SSH/headless user. Generated
2026-10-03._

## 1. Objective

Let a user search **once** and then act on any result — open it in the browser,
copy its URL, or print its details — from a prompt, without re-running the
search. Today `--open [n]`/`--copy [n]` act on a single result and force a full
re-search to act on another.

## 2. User problem

> "I ran a search, I can see result #3 is the one I want and I'd also like to
> copy #5 — but I have to re-type and re-run the whole command for each, paying
> the browser-launch cost every time."

## 3. Target users & journeys

- **Power user (A):** scans results, opens a couple, copies one URL for a doc.
  Journey: `@google -i rust async` → sees results → `2` → `c 4` → `q`.
- **Scripter (B):** must never have an interactive prompt hang a pipe. Journey:
  `@google -i foo | cat` → results print → a stderr note says interactive was
  skipped (no TTY) → process exits normally.
- **Headless/SSH user (C):** no browser available; an `open` that fails must not
  crash the session. Journey: `o 1` → "could not open the browser: …" → prompt
  continues.

## 4. Functional requirements

1. `-i` / `--interactive` flag enables the mode. Off by default.
2. After results are fetched, deduped, excluded, and **printed as usual**, enter
   a prompt loop.
3. Prompt commands:
   - `<n>` → open result n in the browser (default action).
   - `o <n>` / `open <n>` → open result n.
   - `c <n>` / `copy <n>` → copy result n's URL to the clipboard.
   - `p <n>` / `print <n>` → print result n's title, URL, description.
   - `h` / `?` → help; `q` / `quit` / `exit` → leave.
   - Empty line → re-prompt (no-op).
   - `o`/`c`/`p` with no number default to result 1 (matches `--open`/`--copy`).
   - Optional whitespace between verb and number (`o2` == `o 2`); verbs are
     case-insensitive.
4. Reuse the existing `openUrl` and `copyToClipboard` implementations (same
   security properties: URL passed as argv / piped to stdin, never a shell).

## 5. Non-functional requirements

- **Never hang a non-interactive pipeline.** If stdin is not a TTY, skip the
  prompt with a one-line stderr note; still print results and exit 0.
- **Resilient:** invalid/out-of-range/unknown input is reported inline and the
  loop continues; open/copy failures are caught and reported, never fatal.
- **Clean exit:** quitting (`q`), EOF (Ctrl-D), or SIGINT (Ctrl-C) exits the
  loop and lets the process terminate without hanging on the TTY.
- **No new dependencies** (Node's built-in `readline`).
- **CLI-only:** no env var or config key, so the mode is never silently
  always-on for scripts.

## 6. Acceptance criteria (Given → When → Then)

- **AC1** — Given results exist on a TTY, When I enter `2`, Then result 2 opens
  in the browser and the loop continues.
- **AC2** — Given results exist, When I enter `c 3`, Then result 3's URL is
  copied and a confirmation is shown.
- **AC3** — Given results exist, When I enter `p 1`, Then result 1's title, URL,
  and description are printed.
- **AC4** — Given N results, When I enter a number > N or `0`, Then an error is
  shown and the loop continues (no crash, nothing opened).
- **AC5** — Given stdin is not a TTY (piped), When I pass `-i`, Then the results
  print, a stderr note says interactive was skipped, and the process exits 0.
- **AC6** — Given I am at the prompt, When I press Ctrl-D (EOF) or type `q`,
  Then the loop ends and the process exits.
- **AC7** — Given the browser can't be launched, When I enter `o 1`, Then the
  failure is reported and the prompt remains usable.
- **AC8** — Given no results were found, When `-i` is set, Then no prompt is
  entered (nothing to act on).

## 7. Scope

- **In scope:** the `-i`/`--interactive` flag, the prompt grammar above, reuse
  of open/copy, help text, README, tests.
- **Out of scope / future:** `open all` / `copy all`; arrow-key/fuzzy selection
  (would need a TUI dependency); re-searching from within the prompt; paging.
- **Assumptions:** result objects are `{title, url, description}` (unchanged);
  a bare number meaning "open" matches `googler`'s omniprompt convention and the
  existing `--open` default.
- **Dependencies:** existing `open.js`, `copy.js`; Node `readline`.

## 8. Success metrics

- Fewer repeated identical searches (same query re-run back-to-back) in history.
- Qualitative: a single search can drive multiple open/copy actions.

---

# Addendum — History replay (`--last`) · 2026-10-03

## Objective
Let a user re-run a past search without retyping it. History was previously
view/clear only.

## Functional requirements
1. `--last` replays the most recent search; `--last n` the n-th most recent
   (newest = 1); `--last=n` form supported.
2. Reproduces the stored **query and engine**. Cannot be combined with a
   positional query or `--engine` (both contradict "reproduce this search");
   either combination is a parser error, exit 1.
3. All other flags apply to the replayed run (e.g. `--last --json`,
   `--last --format table`).
4. Empty history, a non-positive index, or an out-of-range index → a clear
   stderr error and exit 1, with no search performed.
5. A stored engine that is no longer supported falls back to the default
   silently (never crashes a replay).

## Acceptance criteria (Given → When → Then)
- **AC1** — Given a non-empty history, When `--last`, Then the most recent
  query runs again on its original engine.
- **AC2** — Given ≥3 entries, When `--last 3`, Then the 3rd-most-recent runs.
- **AC3** — Given empty history, When `--last`, Then exit 1 "No search history
  to replay." and nothing is searched.
- **AC4** — Given `--last` + a query, or `--last` + `--engine`, Then exit 1 with
  a message explaining the conflict.
- **AC5** — Given `--last=0` / negative, Then exit 1 "must be a positive
  integer".

## Scope
- **In:** `--last [n]`, reproduce query+engine, conflict rules, errors, tests.
- **Out/future:** replaying result count; interactive history picker; fuzzy
  history search. Replaying the stored engine (not just query) is intentionally
  in scope here.

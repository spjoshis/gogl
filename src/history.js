import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Cap the on-disk log so it can never grow without bound.
const MAX_ENTRIES = 1000;

/**
 * Resolve the search-history file path.
 *
 * Precedence: GOGL_HISTORY_FILE > $XDG_STATE_HOME/gogl/history.jsonl >
 * ~/.local/state/gogl/history.jsonl
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string}
 */
export function resolveHistoryPath(env = process.env) {
  if (env.GOGL_HISTORY_FILE && env.GOGL_HISTORY_FILE.trim() !== '') {
    return env.GOGL_HISTORY_FILE;
  }
  const base = env.XDG_STATE_HOME && env.XDG_STATE_HOME.trim() !== ''
    ? env.XDG_STATE_HOME
    : path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'gogl', 'history.jsonl');
}

function readLines(file, fs) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  return raw.split('\n').filter((line) => line.trim() !== '');
}

/**
 * Append one search to the history file (JSONL, one object per line). The log
 * is local-only and never transmitted. Best-effort: any failure (unwritable
 * dir, etc.) returns false without throwing, so recording history can never
 * break a search.
 *
 * @param {{ query: string, engine: string, count: number }} entry
 * @param {{ env?: NodeJS.ProcessEnv, fs?: typeof nodeFs, now?: number }} [opts]
 * @returns {boolean} true if written
 */
export function record(entry, { env = process.env, fs = nodeFs, now = Date.now() } = {}) {
  const file = resolveHistoryPath(env);
  const line = JSON.stringify({
    query: entry.query,
    engine: entry.engine,
    count: entry.count,
    ts: now
  });
  try {
    const lines = readLines(file, fs);
    lines.push(line);
    const bounded = lines.length > MAX_ENTRIES ? lines.slice(-MAX_ENTRIES) : lines;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bounded.join('\n') + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * List recorded searches, newest first. Corrupt lines are skipped rather than
 * throwing, so a partially-damaged file still lists what it can.
 *
 * @param {{ env?: NodeJS.ProcessEnv, fs?: typeof nodeFs, limit?: number }} [opts]
 * @returns {Array<{query: string, engine: string, count: number, ts: number}>}
 */
export function list({ env = process.env, fs = nodeFs, limit = 50 } = {}) {
  const file = resolveHistoryPath(env);
  const entries = [];
  for (const line of readLines(file, fs)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* skip a corrupt line */
    }
  }
  entries.reverse(); // newest first
  return limit > 0 ? entries.slice(0, limit) : entries;
}

/**
 * Clear the history file. Returns the number of entries removed. A missing
 * file counts as zero. Never throws.
 *
 * @param {{ env?: NodeJS.ProcessEnv, fs?: typeof nodeFs }} [opts]
 * @returns {number}
 */
export function clear({ env = process.env, fs = nodeFs } = {}) {
  const file = resolveHistoryPath(env);
  const count = readLines(file, fs).length;
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* best-effort */
  }
  return count;
}

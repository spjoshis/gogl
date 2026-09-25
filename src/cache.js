import { createHash } from 'node:crypto';
import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_TTL_SECONDS = 3600;
const ENTRY_VERSION = 1;

/**
 * Resolve the directory used to store cache entries.
 *
 * Precedence: GOGL_CACHE_DIR > $XDG_CACHE_HOME/gogl > ~/.cache/gogl
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string}
 */
export function resolveCacheDir(env = process.env) {
  if (env.GOGL_CACHE_DIR && env.GOGL_CACHE_DIR.trim() !== '') {
    return env.GOGL_CACHE_DIR;
  }
  const base = env.XDG_CACHE_HOME && env.XDG_CACHE_HOME.trim() !== ''
    ? env.XDG_CACHE_HOME
    : path.join(os.homedir(), '.cache');
  return path.join(base, 'gogl');
}

/**
 * Resolve the effective TTL in milliseconds.
 * Precedence: explicit flag (seconds) > GOGL_CACHE_TTL env > DEFAULT_TTL_SECONDS.
 *
 * @param {{ flagSeconds?: number, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {number} ttl in milliseconds
 */
export function resolveTtlMs({ flagSeconds, env = process.env } = {}) {
  if (Number.isInteger(flagSeconds) && flagSeconds > 0) {
    return flagSeconds * 1000;
  }
  const raw = env.GOGL_CACHE_TTL;
  if (raw !== undefined && /^\d+$/.test(String(raw).trim())) {
    const seconds = Number.parseInt(String(raw).trim(), 10);
    if (seconds > 0) {
      return seconds * 1000;
    }
  }
  return DEFAULT_TTL_SECONDS * 1000;
}

/**
 * Build a stable cache key for a search. The key depends on the engine, the
 * normalized query, the requested result count, and the date range so
 * different searches never collide. The query text is hashed, so it never
 * appears in a filename.
 *
 * @param {{ engine: string, query: string, results: number, dateRange?: string }} params
 * @returns {string} 32-char hex key
 */
export function makeKey({ engine, query, results, dateRange }) {
  const normQuery = String(query ?? '').trim().replace(/\s+/g, ' ');
  const material = `${engine}\n${normQuery}\n${results}\n${dateRange || ''}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function entryPath(dir, key) {
  return path.join(dir, `${key}.json`);
}

/**
 * Read a cached result set. Returns the stored data array on a fresh hit, or
 * null on any miss (absent, unreadable, corrupt, wrong shape, or stale).
 * Never throws.
 *
 * @param {string} dir
 * @param {string} key
 * @param {{ now?: number, ttlMs?: number, fs?: typeof nodeFs }} [opts]
 * @returns {Array<object> | null}
 */
export function readEntry(dir, key, { now = Date.now(), ttlMs = DEFAULT_TTL_SECONDS * 1000, fs = nodeFs } = {}) {
  let raw;
  try {
    raw = fs.readFileSync(entryPath(dir, key), 'utf8');
  } catch {
    return null; // absent or unreadable
  }

  let entry;
  try {
    entry = JSON.parse(raw);
  } catch {
    return null; // corrupt JSON
  }

  if (!entry || !Array.isArray(entry.data) || typeof entry.savedAt !== 'number') {
    return null; // unexpected shape
  }

  if (now - entry.savedAt > ttlMs) {
    return null; // stale
  }

  return entry.data;
}

/**
 * Write a result set to the cache. Best-effort: creates the directory, writes
 * atomically (temp file + rename), and returns false on any failure without
 * throwing, so caching can never break a search.
 *
 * @param {string} dir
 * @param {string} key
 * @param {{ engine: string, query: string, results: number, data: Array<object> }} payload
 * @param {{ now?: number, fs?: typeof nodeFs }} [opts]
 * @returns {boolean} true if written
 */
export function writeEntry(dir, key, { engine, query, results, data }, { now = Date.now(), fs = nodeFs } = {}) {
  const entry = {
    version: ENTRY_VERSION,
    engine,
    query,
    results,
    savedAt: now,
    data
  };
  const finalPath = entryPath(dir, key);
  const tmpPath = `${finalPath}.${process.pid}.${now}.tmp`;
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmpPath, JSON.stringify(entry), 'utf8');
    fs.renameSync(tmpPath, finalPath);
    return true;
  } catch {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
    return false;
  }
}

/**
 * Remove all cache entries in the directory. Returns the number of entry files
 * removed. A missing directory counts as zero. Never throws.
 *
 * @param {string} dir
 * @param {{ fs?: typeof nodeFs }} [opts]
 * @returns {number}
 */
export function clear(dir, { fs = nodeFs } = {}) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return 0; // no cache dir yet
  }
  let removed = 0;
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
      removed += 1;
    } catch {
      /* ignore individual failures */
    }
  }
  return removed;
}

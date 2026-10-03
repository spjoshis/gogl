import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveHistoryPath, record, list, clear, resolveReplay } from '../src/history.js';

describe('history/resolveHistoryPath', () => {
  test('prefers GOGL_HISTORY_FILE', () => {
    expect(resolveHistoryPath({ GOGL_HISTORY_FILE: '/tmp/h.jsonl' })).toBe('/tmp/h.jsonl');
  });

  test('falls back to XDG_STATE_HOME/gogl', () => {
    expect(resolveHistoryPath({ XDG_STATE_HOME: '/tmp/state' }))
      .toBe(path.join('/tmp/state', 'gogl', 'history.jsonl'));
  });

  test('falls back to ~/.local/state/gogl', () => {
    expect(resolveHistoryPath({}))
      .toBe(path.join(os.homedir(), '.local', 'state', 'gogl', 'history.jsonl'));
  });
});

describe('history/record + list + clear', () => {
  let dir;
  let env;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'gogl-history-'));
    env = { GOGL_HISTORY_FILE: path.join(dir, 'history.jsonl') };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('record then list returns entries newest-first', () => {
    expect(record({ query: 'nodejs', engine: 'google', count: 10 }, { env, now: 1000 })).toBe(true);
    record({ query: 'rust', engine: 'duckduckgo', count: 5 }, { env, now: 2000 });

    const entries = list({ env });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ query: 'rust', engine: 'duckduckgo', count: 5, ts: 2000 });
    expect(entries[1].query).toBe('nodejs');
  });

  test('creates the parent directory lazily', () => {
    const nested = { GOGL_HISTORY_FILE: path.join(dir, 'a', 'b', 'history.jsonl') };
    expect(record({ query: 'x', engine: 'google', count: 1 }, { env: nested })).toBe(true);
    expect(existsSync(nested.GOGL_HISTORY_FILE)).toBe(true);
  });

  test('list skips corrupt lines', () => {
    writeFileSync(env.GOGL_HISTORY_FILE, '{"query":"ok","engine":"google","count":1,"ts":1}\nnot json\n');
    const entries = list({ env });
    expect(entries).toHaveLength(1);
    expect(entries[0].query).toBe('ok');
  });

  test('respects the limit', () => {
    for (let i = 0; i < 5; i++) {
      record({ query: `q${i}`, engine: 'google', count: i }, { env, now: i });
    }
    expect(list({ env, limit: 2 })).toHaveLength(2);
  });

  test('caps the file at 1000 entries', () => {
    for (let i = 0; i < 1005; i++) {
      record({ query: `q${i}`, engine: 'google', count: i }, { env, now: i });
    }
    const entries = list({ env, limit: 0 });
    expect(entries).toHaveLength(1000);
    // oldest kept is q5 (q0..q4 dropped); newest is q1004
    expect(entries[0].query).toBe('q1004');
    expect(entries[entries.length - 1].query).toBe('q5');
  });

  test('clear returns the count removed and deletes the file', () => {
    record({ query: 'a', engine: 'google', count: 1 }, { env });
    record({ query: 'b', engine: 'google', count: 2 }, { env });
    expect(clear({ env })).toBe(2);
    expect(existsSync(env.GOGL_HISTORY_FILE)).toBe(false);
    expect(list({ env })).toEqual([]);
  });

  test('clear on a missing file returns 0', () => {
    expect(clear({ env })).toBe(0);
  });

  test('record is best-effort: a failing fs returns false, never throws', () => {
    const brokenFs = {
      readFileSync: () => { throw new Error('nope'); },
      mkdirSync: () => { throw new Error('disk full'); },
      writeFileSync: () => { throw new Error('disk full'); }
    };
    expect(record({ query: 'x', engine: 'google', count: 1 }, { env, fs: brokenFs })).toBe(false);
  });
});

describe('history/resolveReplay', () => {
  const entries = [
    { query: 'rust', engine: 'duckduckgo', count: 5, ts: 3 },
    { query: 'nodejs', engine: 'google', count: 10, ts: 2 },
    { query: 'go', engine: 'google', count: 8, ts: 1 }
  ]; // newest-first, as list() returns

  test('defaults to the most recent entry (index 1)', () => {
    expect(resolveReplay(entries, 1)).toEqual({ query: 'rust', engine: 'duckduckgo' });
  });

  test('resolves the n-th most recent entry', () => {
    expect(resolveReplay(entries, 2)).toEqual({ query: 'nodejs', engine: 'google' });
    expect(resolveReplay(entries, 3)).toEqual({ query: 'go', engine: 'google' });
  });

  test('empty history is an error', () => {
    expect(resolveReplay([], 1)).toEqual({ error: 'No search history to replay.' });
    expect(resolveReplay(undefined, 1).error).toMatch(/No search history/);
  });

  test('an index past the end is an error naming the count', () => {
    expect(resolveReplay(entries, 4).error).toMatch(/No history entry #4 to replay \(only 3 entries\)/);
    expect(resolveReplay([entries[0]], 2).error).toMatch(/only 1 entry\b/);
  });

  test('a non-positive or non-integer index is an error', () => {
    expect(resolveReplay(entries, 0).error).toMatch(/positive integer/);
    expect(resolveReplay(entries, -1).error).toMatch(/positive integer/);
    expect(resolveReplay(entries, 1.5).error).toMatch(/positive integer/);
  });

  test('an entry with no usable query is an error', () => {
    expect(resolveReplay([{ engine: 'google' }], 1).error).toMatch(/no query to replay/);
    expect(resolveReplay([{ query: '   ', engine: 'google' }], 1).error).toMatch(/no query to replay/);
  });

  test('tolerates a missing engine (returns undefined engine)', () => {
    expect(resolveReplay([{ query: 'x' }], 1)).toEqual({ query: 'x', engine: undefined });
  });
});

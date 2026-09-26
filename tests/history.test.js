import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveHistoryPath, record, list, clear } from '../src/history.js';

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

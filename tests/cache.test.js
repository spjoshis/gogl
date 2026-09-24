import { mkdtempSync, rmSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DEFAULT_TTL_SECONDS,
  resolveCacheDir,
  resolveTtlMs,
  makeKey,
  readEntry,
  writeEntry,
  clear
} from '../src/cache.js';

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'gogl-cache-test-'));
}

describe('cache/makeKey', () => {
  test('is deterministic for identical inputs', () => {
    const a = makeKey({ engine: 'google', query: 'nodejs', results: 10 });
    const b = makeKey({ engine: 'google', query: 'nodejs', results: 10 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  test('normalizes whitespace in the query', () => {
    const a = makeKey({ engine: 'google', query: '  node   js ', results: 10 });
    const b = makeKey({ engine: 'google', query: 'node js', results: 10 });
    expect(a).toBe(b);
  });

  test('differs by engine and by result count', () => {
    const base = makeKey({ engine: 'google', query: 'nodejs', results: 10 });
    expect(makeKey({ engine: 'duckduckgo', query: 'nodejs', results: 10 })).not.toBe(base);
    expect(makeKey({ engine: 'google', query: 'nodejs', results: 5 })).not.toBe(base);
  });
});

describe('cache/resolveCacheDir', () => {
  test('prefers GOGL_CACHE_DIR', () => {
    expect(resolveCacheDir({ GOGL_CACHE_DIR: '/tmp/x', XDG_CACHE_HOME: '/tmp/y' })).toBe('/tmp/x');
  });

  test('falls back to XDG_CACHE_HOME/gogl', () => {
    expect(resolveCacheDir({ XDG_CACHE_HOME: '/tmp/y' })).toBe(path.join('/tmp/y', 'gogl'));
  });

  test('falls back to ~/.cache/gogl', () => {
    expect(resolveCacheDir({})).toBe(path.join(os.homedir(), '.cache', 'gogl'));
  });
});

describe('cache/resolveTtlMs', () => {
  test('flag seconds win', () => {
    expect(resolveTtlMs({ flagSeconds: 60, env: { GOGL_CACHE_TTL: '5' } })).toBe(60000);
  });

  test('env used when no flag', () => {
    expect(resolveTtlMs({ env: { GOGL_CACHE_TTL: '5' } })).toBe(5000);
  });

  test('default when neither present or invalid', () => {
    expect(resolveTtlMs({ env: {} })).toBe(DEFAULT_TTL_SECONDS * 1000);
    expect(resolveTtlMs({ env: { GOGL_CACHE_TTL: 'abc' } })).toBe(DEFAULT_TTL_SECONDS * 1000);
    expect(resolveTtlMs({ flagSeconds: 0, env: {} })).toBe(DEFAULT_TTL_SECONDS * 1000);
  });
});

describe('cache/read+write round-trip', () => {
  let dir;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('writeEntry then readEntry returns the data', () => {
    const key = makeKey({ engine: 'google', query: 'nodejs', results: 10 });
    const data = [{ title: 'Node.js', url: 'https://nodejs.org/', description: 'JS runtime' }];
    const now = 1_000_000;
    expect(writeEntry(dir, key, { engine: 'google', query: 'nodejs', results: 10, data }, { now })).toBe(true);
    expect(readEntry(dir, key, { now: now + 1000, ttlMs: 3600_000 })).toEqual(data);
  });

  test('readEntry misses when the entry is stale', () => {
    const key = makeKey({ engine: 'google', query: 'x', results: 10 });
    const now = 1_000_000;
    writeEntry(dir, key, { engine: 'google', query: 'x', results: 10, data: [{ title: 't', url: 'u', description: '' }] }, { now });
    expect(readEntry(dir, key, { now: now + 5000, ttlMs: 1000 })).toBeNull();
  });

  test('readEntry misses when the entry is absent', () => {
    expect(readEntry(dir, 'does-not-exist', { ttlMs: 1000 })).toBeNull();
  });

  test('readEntry misses (no throw) on corrupt JSON', () => {
    const key = 'corruptkey';
    writeFileSync(path.join(dir, `${key}.json`), '{not json', 'utf8');
    expect(readEntry(dir, key, { ttlMs: 3600_000 })).toBeNull();
  });

  test('readEntry misses on unexpected shape', () => {
    const key = 'shapekey';
    writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ savedAt: 1, data: 'nope' }), 'utf8');
    expect(readEntry(dir, key, { now: 2, ttlMs: 3600_000 })).toBeNull();
  });

  test('writeEntry returns false (never throws) when the fs write fails', () => {
    const key = makeKey({ engine: 'google', query: 'y', results: 10 });
    const brokenFs = {
      mkdirSync: () => {},
      writeFileSync: () => { throw new Error('disk full'); },
      renameSync: () => {},
      unlinkSync: () => {}
    };
    expect(writeEntry(dir, key, { engine: 'google', query: 'y', results: 10, data: [] }, { fs: brokenFs })).toBe(false);
  });
});

describe('cache/clear', () => {
  test('removes only *.json entries and returns the count', () => {
    const dir = tmpDir();
    try {
      writeFileSync(path.join(dir, 'a.json'), '{}', 'utf8');
      writeFileSync(path.join(dir, 'b.json'), '{}', 'utf8');
      writeFileSync(path.join(dir, 'keep.txt'), 'x', 'utf8');
      expect(clear(dir)).toBe(2);
      expect(readdirSync(dir)).toEqual(['keep.txt']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns 0 for a missing directory', () => {
    expect(clear(path.join(os.tmpdir(), 'gogl-nope-' + Date.now()))).toBe(0);
  });
});

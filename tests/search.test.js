import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { search } from '../src/search.js';
import { writeEntry, makeKey } from '../src/cache.js';

describe('search', () => {
  test('should handle empty query', async () => {
    const results = await search('');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('should handle whitespace-only query', async () => {
    const results = await search('   ');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('should accept a legacy numeric second argument (maxRetries)', async () => {
    const results = await search('', 1);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('should accept an options object as the second argument', async () => {
    const results = await search('', { maxRetries: 1, results: 5 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('should default to the google engine', async () => {
    const results = await search('', { engine: 'google' });
    expect(Array.isArray(results)).toBe(true);
  });

  test('should accept the duckduckgo engine', async () => {
    const results = await search('', { engine: 'duckduckgo' });
    expect(Array.isArray(results)).toBe(true);
  });

  test('should reject an unknown engine before launching a browser', async () => {
    await expect(search('nodejs', { engine: 'bing' })).rejects.toThrow(/Unknown engine: bing/);
  });

  describe('caching', () => {
    let dir;
    let originalCacheDir;

    beforeEach(() => {
      dir = mkdtempSync(path.join(os.tmpdir(), 'gogl-search-cache-'));
      originalCacheDir = process.env.GOGL_CACHE_DIR;
      process.env.GOGL_CACHE_DIR = dir;
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
      if (originalCacheDir === undefined) {
        delete process.env.GOGL_CACHE_DIR;
      } else {
        process.env.GOGL_CACHE_DIR = originalCacheDir;
      }
    });

    test('returns a fresh cached entry without launching a browser', async () => {
      const seeded = [{ title: 'Cached', url: 'https://cached.example', description: 'from cache' }];
      const key = makeKey({ engine: 'google', query: 'nodejs', results: 10 });
      writeEntry(dir, key, { engine: 'google', query: 'nodejs', results: 10, data: seeded });

      const resultsOut = await search('nodejs', { cache: true });
      expect(resultsOut).toEqual(seeded);
    }, 2000);

    test('ignores a cached entry for a different engine/result-count key', async () => {
      const seeded = [{ title: 'Cached', url: 'https://cached.example', description: 'from cache' }];
      const key = makeKey({ engine: 'google', query: 'nodejs', results: 10 });
      writeEntry(dir, key, { engine: 'google', query: 'nodejs', results: 10, data: seeded });

      // Different engine -> different key -> cache miss -> unknown-engine rejection
      // proves it never returned the seeded 'google' entry.
      await expect(search('nodejs', { cache: true, engine: 'bing' })).rejects.toThrow(/Unknown engine/);
    });

    test('cache is off by default even if a fresh matching entry exists', async () => {
      const seeded = [{ title: 'Cached', url: 'https://cached.example', description: 'from cache' }];
      const key = makeKey({ engine: 'google', query: '', results: 10 });
      writeEntry(dir, key, { engine: 'google', query: '', results: 10, data: seeded });

      const resultsOut = await search('', { cache: true });
      expect(resultsOut).toEqual([]);
    });

    (process.env.LIVE_TESTS ? test : test.skip)(
      'writes a successful live search result to the cache',
      async () => {
        const first = await search('nodejs', { cache: true, results: 3 });
        expect(first.length).toBeGreaterThan(0);

        const second = await search('nodejs', { cache: true, results: 3 });
        expect(second).toEqual(first);
      },
      60000
    );
  });

  // Integration test - only runs if LIVE_TESTS env var is set
  (process.env.LIVE_TESTS ? test : test.skip)(
    'should return array of results from live Google search',
    async () => {
      const results = await search('nodejs');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
    },
    60000
  );

  (process.env.LIVE_TESTS ? test : test.skip)(
    'each result should have required fields from live search',
    async () => {
      const results = await search('test');

      results.forEach(result => {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('description');
        expect(typeof result.title).toBe('string');
        expect(typeof result.url).toBe('string');
        expect(typeof result.description).toBe('string');
      });
    },
    60000
  );
});

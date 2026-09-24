import { chromium } from 'playwright';

import { DEFAULT_RESULTS } from './parser.js';
import { DEFAULT_ENGINE, resolveEngine } from './engines/index.js';
import { resolveCacheDir, resolveTtlMs, makeKey, readEntry, writeEntry } from './cache.js';

async function searchOnce(query, count, engine) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(engine.buildUrl(query, count), {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const results = await page.evaluate(engine.extract, count);

    return results;
  } catch (error) {
    throw new Error(`Failed to search ${engine.label}: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Search for a query using the configured engine.
 *
 * @param {string} query
 * @param {object|number} [options] - options object, or a number for the legacy
 *   `maxRetries` positional argument (backward compatible).
 * @param {number} [options.maxRetries=2]
 * @param {number} [options.results=10]
 * @param {string} [options.engine='google'] - one of the supported engine names.
 * @param {boolean} [options.cache=false] - reuse a fresh cached result instead
 *   of launching a browser, and save a successful search for next time. Off
 *   by default so results are always live unless explicitly opted in.
 * @param {number} [options.cacheTtlSeconds] - how long a cached entry stays
 *   fresh; falls back to `GOGL_CACHE_TTL` or a 1 hour default (see cache.js).
 */
export async function search(query, options = {}) {
  const opts = typeof options === 'number' ? { maxRetries: options } : (options || {});
  const {
    maxRetries = 2,
    results = DEFAULT_RESULTS,
    engine: engineName = DEFAULT_ENGINE,
    cache = false,
    cacheTtlSeconds
  } = opts;
  const engine = resolveEngine(engineName);

  if (!query || query.trim() === '') {
    return [];
  }

  const cacheDir = cache ? resolveCacheDir() : null;
  const cacheKey = cache ? makeKey({ engine: engineName, query, results }) : null;

  if (cache) {
    const ttlMs = resolveTtlMs({ flagSeconds: cacheTtlSeconds });
    const cached = readEntry(cacheDir, cacheKey, { ttlMs });
    if (cached) {
      return cached;
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await searchOnce(query, results, engine);
      if (cache) {
        writeEntry(cacheDir, cacheKey, { engine: engineName, query, results, data });
      }
      return data;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

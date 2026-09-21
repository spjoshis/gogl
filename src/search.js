import { chromium } from 'playwright';

import { DEFAULT_RESULTS } from './parser.js';
import { DEFAULT_ENGINE, resolveEngine } from './engines/index.js';

async function searchOnce(query, count, engine) {
  if (!query || query.trim() === '') {
    return [];
  }

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
 */
export async function search(query, options = {}) {
  const opts = typeof options === 'number' ? { maxRetries: options } : (options || {});
  const { maxRetries = 2, results = DEFAULT_RESULTS, engine: engineName = DEFAULT_ENGINE } = opts;
  const engine = resolveEngine(engineName);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await searchOnce(query, results, engine);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

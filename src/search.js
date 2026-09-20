import { chromium } from 'playwright';

import { DEFAULT_RESULTS } from './parser.js';

async function searchOnce(query, count = DEFAULT_RESULTS) {
  if (!query || query.trim() === '') {
    return [];
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to Google search. `num` is a best-effort hint for result count.
    const encodedQuery = encodeURIComponent(query);
    await page.goto(`https://www.google.com/search?q=${encodedQuery}&num=${count}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Extract results using CSS selectors
    const results = await page.evaluate((max) => {
      const resultElements = document.querySelectorAll('div.g');
      const items = [];

      resultElements.forEach((element) => {
        // Skip ads and other non-organic results
        if (element.querySelector('[data-sokoban-container]')) return;

        const titleEl = element.querySelector('h3');
        const linkEl = element.querySelector('a');
        const descriptionEl = element.querySelector('[data-content-feature]') ||
                            element.querySelector('.s');

        if (titleEl && linkEl) {
          const title = titleEl.innerText || '';
          const url = linkEl.href || '';
          const description = descriptionEl ? descriptionEl.innerText || '' : '';

          // Only include results with actual URLs from Google search
          if (url && !url.includes('/search?') && title) {
            items.push({
              title: title.trim(),
              url: url.trim(),
              description: description.trim()
            });
          }
        }
      });

      return items.slice(0, max);
    }, count);

    return results;
  } catch (error) {
    throw new Error(`Failed to search Google: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Search Google for a query.
 *
 * @param {string} query
 * @param {object|number} [options] - options object, or a number for the legacy
 *   `maxRetries` positional argument (backward compatible).
 * @param {number} [options.maxRetries=2]
 * @param {number} [options.results=10]
 */
export async function search(query, options = {}) {
  const opts = typeof options === 'number' ? { maxRetries: options } : (options || {});
  const { maxRetries = 2, results = DEFAULT_RESULTS } = opts;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await searchOnce(query, results);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

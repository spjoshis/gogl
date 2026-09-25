export const label = 'DuckDuckGo';

export function buildUrl(query, count, dateRange) {
  // Pagination params aren't needed for a single-page top-N scrape; `df`
  // (date filter) is, since it's the only supported per-query date range.
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  return dateRange ? `${url}&df=${dateRange}` : url;
}

// Runs inside the page via page.evaluate (doc defaults to the page's global
// `document`); the default param also lets tests inject a fake doc.
export function extract(count, doc = document) {
  const nodes = doc.querySelectorAll('.result__body');
  const items = [];

  nodes.forEach((node) => {
    const titleEl = node.querySelector('.result__title a.result__a');
    const snippetEl = node.querySelector('.result__snippet');
    if (!titleEl) return;

    const title = (titleEl.textContent || '').trim();
    let url = titleEl.getAttribute('href') || '';

    // DuckDuckGo's HTML endpoint proxies external links through
    // /l/?uddg=<encoded-url>; unwrap it so we return the real destination.
    try {
      const resolved = new URL(url, 'https://duckduckgo.com');
      if (resolved.pathname === '/l/' && resolved.searchParams.has('uddg')) {
        url = decodeURIComponent(resolved.searchParams.get('uddg'));
      } else {
        url = resolved.href;
      }
    } catch {
      // Leave url as the raw href if it isn't parseable.
    }

    const description = snippetEl ? (snippetEl.textContent || '').trim() : '';

    if (title && url) {
      items.push({ title, url, description });
    }
  });

  return items.slice(0, count);
}

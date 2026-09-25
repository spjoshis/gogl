export const label = 'Google';

export function buildUrl(query, count, dateRange) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${count}`;
  return dateRange ? `${url}&tbs=qdr:${dateRange}` : url;
}

// Runs inside the page via page.evaluate (doc defaults to the page's global
// `document`); the default param also lets tests inject a fake doc.
export function extract(count, doc = document) {
  const resultElements = doc.querySelectorAll('div.g');
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

      if (url && !url.includes('/search?') && title) {
        items.push({
          title: title.trim(),
          url: url.trim(),
          description: description.trim()
        });
      }
    }
  });

  return items.slice(0, count);
}

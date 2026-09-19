export function formatResults(results, options = {}) {
  if (options.json) {
    return JSON.stringify(results ?? [], null, 2);
  }

  if (!results || results.length === 0) {
    return 'No results found.';
  }

  const formatted = results
    .map((result, index) => {
      const num = index + 1;
      const title = result.title || 'No title';
      const url = result.url || '';
      const description = truncateText(result.description || '', 200);

      return [
        `${num}. ${title}`,
        `   URL: ${url}`,
        `   ${description}`,
        ''
      ].join('\n');
    })
    .join('\n');

  return formatted;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

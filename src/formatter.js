import { SGR, paint } from './color.js';

export function formatResults(results, options = {}) {
  if (options.json) {
    return JSON.stringify(results ?? [], null, 2);
  }

  if (!results || results.length === 0) {
    return 'No results found.';
  }

  // color is opt-in and resolved by the caller; when false the output is
  // byte-for-byte identical to the original plain format.
  const color = options.color === true;

  const formatted = results
    .map((result, index) => {
      const num = index + 1;
      const title = result.title || 'No title';
      const url = result.url || '';
      const description = truncateText(result.description || '', 200);

      const titleLine = color ? paint(`${num}. ${title}`, SGR.bold) : `${num}. ${title}`;
      const urlLine = color ? `   ${paint(`URL: ${url}`, SGR.cyan)}` : `   URL: ${url}`;
      const descLine = color ? `   ${paint(description, SGR.dim)}` : `   ${description}`;

      return [titleLine, urlLine, descLine, ''].join('\n');
    })
    .join('\n');

  return formatted;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

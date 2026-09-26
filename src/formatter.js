import { SGR, paint } from './color.js';

export const DEFAULT_DESC_LENGTH = 200;
export const FORMATS = ['plain', 'json', 'ndjson', 'csv', 'table', 'urls'];

/**
 * Render a result set in the requested format.
 *
 * @param {Array<{title?:string,url?:string,description?:string}>} results
 * @param {object} [options]
 * @param {('plain'|'json'|'ndjson'|'csv'|'table')} [options.format] - output
 *   format. Defaults to 'json' when the legacy `options.json` is true, else
 *   'plain', preserving the original two-argument behavior.
 * @param {boolean} [options.json] - legacy alias for `format:'json'`.
 * @param {boolean} [options.color=false] - colorize plain/table output only.
 * @param {number} [options.descLength=200] - max description length before
 *   truncation (plain/table only).
 * @param {boolean} [options.truncate=true] - when false, descriptions are not
 *   truncated (plain/table only).
 * @returns {string}
 */
export function formatResults(results, options = {}) {
  const format = options.format || (options.json ? 'json' : 'plain');
  const descLength = Number.isInteger(options.descLength) && options.descLength > 0
    ? options.descLength
    : DEFAULT_DESC_LENGTH;
  const truncate = options.truncate !== false;
  const color = options.color === true;
  const list = Array.isArray(results) ? results : [];

  switch (format) {
    case 'json':
      return JSON.stringify(results ?? [], null, 2);
    case 'ndjson':
      return list.map((r) => JSON.stringify(r)).join('\n');
    case 'urls':
      return list.map((r) => r && r.url).filter((u) => typeof u === 'string' && u !== '').join('\n');
    case 'csv':
      return renderCsv(list);
    case 'table':
      return renderTable(list, { color, descLength, truncate });
    case 'plain':
    default:
      return renderPlain(list, { color, descLength, truncate });
  }
}

function renderPlain(results, { color, descLength, truncate }) {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results
    .map((result, index) => {
      const num = index + 1;
      const title = result.title || 'No title';
      const url = result.url || '';
      const rawDesc = result.description || '';
      const description = truncate ? truncateText(rawDesc, descLength) : rawDesc;

      const titleLine = color ? paint(`${num}. ${title}`, SGR.bold) : `${num}. ${title}`;
      const urlLine = color ? `   ${paint(`URL: ${url}`, SGR.cyan)}` : `   URL: ${url}`;
      const descLine = color ? `   ${paint(description, SGR.dim)}` : `   ${description}`;

      return [titleLine, urlLine, descLine, ''].join('\n');
    })
    .join('\n');
}

// RFC-4180: quote any field containing a comma, quote, or newline; escape
// embedded quotes by doubling them.
function csvEscape(field) {
  const s = String(field ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function renderCsv(results) {
  const header = 'title,url,description';
  const rows = results.map((r) => [r.title, r.url, r.description].map(csvEscape).join(','));
  return [header, ...rows].join('\n');
}

function renderTable(results, { color, descLength, truncate }) {
  if (results.length === 0) {
    return 'No results found.';
  }

  const MAX = {
    num: 4,
    title: 45,
    url: 55,
    // Keep the description column bounded so one long snippet can't blow out
    // the grid, while still honoring a smaller --desc-length.
    desc: truncate ? Math.min(descLength, 80) : 80
  };
  const cols = ['num', 'title', 'url', 'desc'];
  const headers = { num: '#', title: 'Title', url: 'URL', desc: 'Description' };

  const rows = results.map((r, i) => ({
    num: cell(String(i + 1), MAX.num),
    title: cell(r.title || 'No title', MAX.title),
    url: cell(r.url || '', MAX.url),
    desc: cell(truncate ? truncateText(r.description || '', descLength) : (r.description || ''), MAX.desc)
  }));

  const width = {};
  for (const c of cols) {
    width[c] = Math.max(headers[c].length, ...rows.map((r) => r[c].length));
  }

  const border = (l, mid, r) => l + cols.map((c) => '─'.repeat(width[c] + 2)).join(mid) + r;
  const rowStr = (obj) => '│' + cols.map((c) => ` ${pad(obj[c], width[c])} `).join('│') + '│';
  const headerRow = color ? paint(rowStr(headers), SGR.bold) : rowStr(headers);

  return [
    border('┌', '┬', '┐'),
    headerRow,
    border('├', '┼', '┤'),
    ...rows.map(rowStr),
    border('└', '┴', '┘')
  ].join('\n');
}

// Collapse whitespace and clip to a max width with an ellipsis, so a cell never
// wraps or contains a newline that would break the table grid.
function cell(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function pad(text, width) {
  const s = String(text ?? '');
  return s + ' '.repeat(Math.max(0, width - s.length));
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

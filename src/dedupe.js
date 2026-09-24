/**
 * Canonicalize a URL for duplicate detection. Two URLs that point at the same
 * resource but differ only cosmetically (trailing slash, fragment, host case)
 * collapse to the same key. Anything that can't be parsed as a URL falls back
 * to its trimmed string form so it can still be compared.
 *
 * @param {string} url
 * @returns {string} canonical key ('' when there is no usable url)
 */
export function canonicalizeUrl(url) {
  if (typeof url !== 'string') {
    return '';
  }
  const trimmed = url.trim();
  if (trimmed === '') {
    return '';
  }
  try {
    const u = new URL(trimmed);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    // Lower-case the scheme + host (case-insensitive), keep path/query as-is,
    // and drop the fragment (never identifies a distinct result).
    return `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return trimmed;
  }
}

/**
 * Remove results that point at the same URL, keeping the first occurrence so
 * the original ranking is preserved. Results without a usable URL are kept as
 * they are (they can't be compared safely). Non-array input is returned as-is.
 *
 * @param {Array<{url?: string}>} results
 * @returns {Array<object>}
 */
export function dedupeResults(results) {
  if (!Array.isArray(results)) {
    return results;
  }
  const seen = new Set();
  const out = [];
  for (const result of results) {
    const key = canonicalizeUrl(result && result.url);
    if (key === '') {
      out.push(result);
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(result);
  }
  return out;
}

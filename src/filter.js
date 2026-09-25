/**
 * Extract the lowercased host from a result URL, or '' if it can't be parsed.
 *
 * @param {string} url
 * @returns {string}
 */
function hostOf(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return '';
  }
  try {
    return new URL(url.trim()).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Normalize a user-supplied exclude domain: trim, lowercase, and strip a
 * leading scheme, "www.", a path, or a leading dot so `--exclude www.x.com/`,
 * `--exclude .x.com`, and `--exclude x.com` all mean the same thing.
 *
 * @param {string} domain
 * @returns {string}
 */
export function normalizeExcludeDomain(domain) {
  if (typeof domain !== 'string') {
    return '';
  }
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.split('/')[0];
  d = d.replace(/^\.+/, '');
  d = d.replace(/^www\./, '');
  return d;
}

/**
 * Remove results whose host equals, or is a subdomain of, any excluded domain.
 * Matching is case-insensitive; `pinterest.com` excludes `pinterest.com` and
 * `img.pinterest.com` but not `notpinterest.com`. Results with no parseable
 * URL are kept (they can't be matched safely). Order is preserved.
 *
 * @param {Array<{url?: string}>} results
 * @param {string[]} domains - raw or normalized exclude domains
 * @returns {Array<object>}
 */
export function excludeDomains(results, domains) {
  if (!Array.isArray(results)) {
    return results;
  }
  const blocked = (domains || [])
    .map(normalizeExcludeDomain)
    .filter((d) => d !== '');
  if (blocked.length === 0) {
    return results;
  }
  return results.filter((result) => {
    const host = hostOf(result && result.url);
    if (host === '') {
      return true; // unparseable url — keep, can't match safely
    }
    return !blocked.some((d) => host === d || host.endsWith(`.${d}`));
  });
}

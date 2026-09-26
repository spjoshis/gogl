/**
 * Shape a base query with search operators. Both `site:` and `filetype:` are
 * standard operators honored by Google and DuckDuckGo, so we simply append
 * them to the query string the engine already receives verbatim.
 *
 * Deterministic order (site before filetype) keeps the effective query — and
 * therefore the cache key and the progress banner — stable for a given set of
 * inputs.
 *
 * @param {string} baseQuery - the user's raw query text (already trimmed/collapsed)
 * @param {{ site?: string, filetype?: string }} [operators]
 * @returns {string} the effective query to send to the engine
 */
export function buildQuery(baseQuery, operators = {}) {
  const { site, filetype } = operators;
  const parts = [baseQuery];
  if (site) {
    parts.push(`site:${site}`);
  }
  if (filetype) {
    parts.push(`filetype:${filetype}`);
  }
  return parts.filter((p) => p && p.trim() !== '').join(' ');
}

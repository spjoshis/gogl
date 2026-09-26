import { excludeDomains, normalizeExcludeDomain } from '../src/filter.js';

describe('filter/normalizeExcludeDomain', () => {
  test('lowercases and trims', () => {
    expect(normalizeExcludeDomain('  Pinterest.COM ')).toBe('pinterest.com');
  });

  test('strips scheme, path, leading www. and leading dot', () => {
    expect(normalizeExcludeDomain('https://www.pinterest.com/pin/1')).toBe('pinterest.com');
    expect(normalizeExcludeDomain('.pinterest.com')).toBe('pinterest.com');
  });

  test('returns empty string for non-strings', () => {
    expect(normalizeExcludeDomain(undefined)).toBe('');
    expect(normalizeExcludeDomain(null)).toBe('');
  });
});

describe('filter/excludeDomains', () => {
  const results = [
    { title: 'A', url: 'https://pinterest.com/pin/1', description: '' },
    { title: 'B', url: 'https://img.pinterest.com/x', description: '' },
    { title: 'C', url: 'https://notpinterest.com/x', description: '' },
    { title: 'D', url: 'https://nodejs.org/', description: '' }
  ];

  test('removes exact host and subdomains but not lookalikes', () => {
    const out = excludeDomains(results, ['pinterest.com']);
    expect(out.map((r) => r.title)).toEqual(['C', 'D']);
  });

  test('accepts multiple domains and normalizes them', () => {
    const out = excludeDomains(results, ['pinterest.com', 'https://www.nodejs.org/']);
    expect(out.map((r) => r.title)).toEqual(['C']);
  });

  test('is a no-op with no domains', () => {
    expect(excludeDomains(results, [])).toBe(results);
    expect(excludeDomains(results, undefined)).toBe(results);
  });

  test('keeps results with an unparseable url', () => {
    const withBad = [{ title: 'X', url: 'not a url' }, ...results];
    const out = excludeDomains(withBad, ['pinterest.com']);
    expect(out.map((r) => r.title)).toEqual(['X', 'C', 'D']);
  });

  test('preserves original order', () => {
    const out = excludeDomains(results, ['notpinterest.com']);
    expect(out.map((r) => r.title)).toEqual(['A', 'B', 'D']);
  });

  test('returns non-array input as-is', () => {
    expect(excludeDomains(null, ['x.com'])).toBe(null);
  });
});

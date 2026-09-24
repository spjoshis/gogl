import { canonicalizeUrl, dedupeResults } from '../src/dedupe.js';

describe('dedupe/canonicalizeUrl', () => {
  test('ignores a trailing slash', () => {
    expect(canonicalizeUrl('https://nodejs.org/')).toBe(canonicalizeUrl('https://nodejs.org'));
  });

  test('ignores the fragment', () => {
    expect(canonicalizeUrl('https://a.com/x#top')).toBe(canonicalizeUrl('https://a.com/x'));
  });

  test('lower-cases scheme and host but keeps the path case', () => {
    expect(canonicalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });

  test('preserves the query string', () => {
    expect(canonicalizeUrl('https://a.com/s?q=1')).not.toBe(canonicalizeUrl('https://a.com/s?q=2'));
  });

  test('keeps distinct paths distinct', () => {
    expect(canonicalizeUrl('https://a.com/x')).not.toBe(canonicalizeUrl('https://a.com/y'));
  });

  test('falls back to the trimmed string for an unparseable url', () => {
    expect(canonicalizeUrl('  not a url  ')).toBe('not a url');
  });

  test('returns empty for missing/blank urls', () => {
    expect(canonicalizeUrl('')).toBe('');
    expect(canonicalizeUrl('   ')).toBe('');
    expect(canonicalizeUrl(undefined)).toBe('');
    expect(canonicalizeUrl(null)).toBe('');
  });
});

describe('dedupe/dedupeResults', () => {
  test('removes duplicate URLs, keeping the first (preserves ranking)', () => {
    const results = [
      { title: 'A', url: 'https://nodejs.org/', description: 'first' },
      { title: 'B', url: 'https://example.com', description: 'keep' },
      { title: 'A dup', url: 'https://nodejs.org', description: 'dup' }
    ];
    expect(dedupeResults(results)).toEqual([
      { title: 'A', url: 'https://nodejs.org/', description: 'first' },
      { title: 'B', url: 'https://example.com', description: 'keep' }
    ]);
  });

  test('leaves already-unique results untouched and in order', () => {
    const results = [
      { title: 'A', url: 'https://a.com', description: '' },
      { title: 'B', url: 'https://b.com', description: '' }
    ];
    expect(dedupeResults(results)).toEqual(results);
  });

  test('keeps entries that have no usable url (cannot dedupe safely)', () => {
    const results = [
      { title: 'A', url: '', description: '' },
      { title: 'B', url: '', description: '' }
    ];
    expect(dedupeResults(results)).toHaveLength(2);
  });

  test('handles an empty list', () => {
    expect(dedupeResults([])).toEqual([]);
  });

  test('returns non-array input unchanged', () => {
    expect(dedupeResults(undefined)).toBeUndefined();
    expect(dedupeResults(null)).toBeNull();
  });
});

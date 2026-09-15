import { search } from '../src/search.js';
import { formatResults } from '../src/formatter.js';

describe('Edge Cases', () => {
  test('formatter should handle null description', () => {
    const results = [{
      title: 'Test',
      url: 'https://test.com',
      description: null
    }];

    const output = formatResults(results);
    expect(output).toContain('Test');
  });

  test('formatter should handle missing url', () => {
    const results = [{
      title: 'Test',
      url: undefined,
      description: 'Test description'
    }];

    const output = formatResults(results);
    expect(output).toContain('Test');
  });

  (process.env.LIVE_TESTS ? test : test.skip)(
    'search should handle special characters in query',
    async () => {
      const results = await search('test & query | special');
      expect(Array.isArray(results)).toBe(true);
    },
    60000
  );

  (process.env.LIVE_TESTS ? test : test.skip)(
    'search should handle very long query',
    async () => {
      const longQuery = 'a'.repeat(200);
      const results = await search(longQuery);
      expect(Array.isArray(results)).toBe(true);
    },
    60000
  );

  test('formatter should handle undefined results', () => {
    const output = formatResults(undefined);
    expect(output).toContain('No results found');
  });

  test('formatter should handle results with missing fields', () => {
    const results = [{
      title: 'Partial Result'
    }];

    const output = formatResults(results);
    expect(output).toContain('Partial Result');
    expect(output).toContain('URL:');
  });
});

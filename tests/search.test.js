import { search } from '../src/search.js';

describe('search', () => {
  test('should handle empty query', async () => {
    const results = await search('');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  test('should handle whitespace-only query', async () => {
    const results = await search('   ');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  // Integration test - only runs if LIVE_TESTS env var is set
  (process.env.LIVE_TESTS ? test : test.skip)(
    'should return array of results from live Google search',
    async () => {
      const results = await search('nodejs');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
    },
    60000
  );

  (process.env.LIVE_TESTS ? test : test.skip)(
    'each result should have required fields from live search',
    async () => {
      const results = await search('test');

      results.forEach(result => {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('description');
        expect(typeof result.title).toBe('string');
        expect(typeof result.url).toBe('string');
        expect(typeof result.description).toBe('string');
      });
    },
    60000
  );
});

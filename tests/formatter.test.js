import { formatResults } from '../src/formatter.js';

describe('formatResults', () => {
  test('should format empty results', () => {
    const output = formatResults([]);
    expect(output).toContain('No results found');
  });

  test('should format single result', () => {
    const results = [{
      title: 'Example Page',
      url: 'https://example.com',
      description: 'This is an example'
    }];

    const output = formatResults(results);
    expect(output).toContain('1.');
    expect(output).toContain('Example Page');
    expect(output).toContain('https://example.com');
    expect(output).toContain('This is an example');
  });

  test('should format multiple results with indices', () => {
    const results = [
      { title: 'First', url: 'https://first.com', description: 'First result' },
      { title: 'Second', url: 'https://second.com', description: 'Second result' },
      { title: 'Third', url: 'https://third.com', description: 'Third result' }
    ];

    const output = formatResults(results);
    expect(output).toContain('1.');
    expect(output).toContain('2.');
    expect(output).toContain('3.');
  });

  test('should truncate long descriptions', () => {
    const results = [{
      title: 'Test',
      url: 'https://test.com',
      description: 'A'.repeat(300)
    }];

    const output = formatResults(results);
    expect(output.length).toBeLessThan(500);
  });

  test('should escape special characters', () => {
    const results = [{
      title: 'Test & Title',
      url: 'https://test.com?q=test&lang=en',
      description: 'Description with <tags>'
    }];

    const output = formatResults(results);
    expect(output).toContain('Test & Title');
  });

  describe('JSON output', () => {
    test('should return parseable JSON array of results', () => {
      const results = [
        { title: 'First', url: 'https://first.com', description: 'First result' },
        { title: 'Second', url: 'https://second.com', description: 'Second result' }
      ];

      const output = formatResults(results, { json: true });
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        title: 'First',
        url: 'https://first.com',
        description: 'First result'
      });
    });

    test('should return an empty JSON array for no results', () => {
      expect(JSON.parse(formatResults([], { json: true }))).toEqual([]);
    });

    test('should return an empty JSON array for undefined results', () => {
      expect(JSON.parse(formatResults(undefined, { json: true }))).toEqual([]);
    });

    test('should not print the "No results found" text in JSON mode', () => {
      expect(formatResults([], { json: true })).not.toContain('No results found');
    });
  });
});

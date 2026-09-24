import { formatResults } from '../src/formatter.js';
import { SGR } from '../src/color.js';

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[/;

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

  describe('color output', () => {
    const one = [{ title: 'Node.js', url: 'https://nodejs.org/', description: 'JS runtime' }];
    const PLAIN = '1. Node.js\n   URL: https://nodejs.org/\n   JS runtime\n';

    test('default (no color option) is the original plain format, byte-for-byte', () => {
      expect(formatResults(one)).toBe(PLAIN);
    });

    test('color:false is byte-for-byte identical to the plain format', () => {
      expect(formatResults(one, { color: false })).toBe(PLAIN);
      expect(formatResults(one, { color: false })).not.toMatch(ANSI);
    });

    test('color:true wraps title/url/description in ANSI and always resets', () => {
      const output = formatResults(one, { color: true });
      expect(output).toMatch(ANSI);
      expect(output).toContain(SGR.bold);
      expect(output).toContain(SGR.cyan);
      expect(output).toContain(SGR.dim);
      expect(output).toContain(SGR.reset);
      // content is preserved
      expect(output).toContain('1. Node.js');
      expect(output).toContain('URL: https://nodejs.org/');
      expect(output).toContain('JS runtime');
      // every style is closed: one reset per styled span (title, url, desc)
      const resets = output.split(SGR.reset).length - 1;
      expect(resets).toBe(3);
    });

    test('JSON output is never colorized, even with color:true', () => {
      const output = formatResults(one, { json: true, color: true });
      expect(output).not.toMatch(ANSI);
      expect(JSON.parse(output)).toEqual(one);
    });
  });
});

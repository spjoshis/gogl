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

  const sample = [
    { title: 'First', url: 'https://first.com', description: 'First result' },
    { title: 'Second', url: 'https://second.com', description: 'Second result' }
  ];

  describe('format: json (via format option)', () => {
    test('format:"json" matches the legacy json:true output', () => {
      expect(formatResults(sample, { format: 'json' })).toBe(formatResults(sample, { json: true }));
    });
  });

  describe('format: ndjson', () => {
    test('emits one compact JSON object per line, no wrapping array', () => {
      const out = formatResults(sample, { format: 'ndjson' });
      const lines = out.split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(sample[0]);
      expect(JSON.parse(lines[1])).toEqual(sample[1]);
      expect(out).not.toContain('[');
    });

    test('empty results produce empty output', () => {
      expect(formatResults([], { format: 'ndjson' })).toBe('');
    });

    test('is never colorized', () => {
      expect(formatResults(sample, { format: 'ndjson', color: true })).not.toMatch(ANSI);
    });
  });

  describe('format: urls', () => {
    test('emits one URL per line, nothing else', () => {
      expect(formatResults(sample, { format: 'urls' })).toBe('https://first.com\nhttps://second.com');
    });

    test('skips entries without a usable url', () => {
      const mixed = [{ title: 'a', url: 'https://a.com' }, { title: 'b' }, { title: 'c', url: '' }];
      expect(formatResults(mixed, { format: 'urls' })).toBe('https://a.com');
    });

    test('empty results produce empty output', () => {
      expect(formatResults([], { format: 'urls' })).toBe('');
    });

    test('is never colorized', () => {
      expect(formatResults(sample, { format: 'urls', color: true })).not.toMatch(ANSI);
    });
  });

  describe('format: csv', () => {
    test('has an RFC-4180 header and one row per result', () => {
      const out = formatResults(sample, { format: 'csv' });
      const lines = out.split('\n');
      expect(lines[0]).toBe('title,url,description');
      expect(lines[1]).toBe('First,https://first.com,First result');
      expect(lines).toHaveLength(3);
    });

    test('quotes and escapes fields containing commas, quotes, or newlines', () => {
      const tricky = [{ title: 'a,b', url: 'https://x.com', description: 'has "quotes"\nand newline' }];
      const out = formatResults(tricky, { format: 'csv' });
      // A quoted field may legitimately contain a literal newline (RFC-4180),
      // so assert on the whole output rather than splitting on '\n'.
      expect(out).toBe(
        'title,url,description\n"a,b",https://x.com,"has ""quotes""\nand newline"'
      );
    });

    test('empty results produce a header row only', () => {
      expect(formatResults([], { format: 'csv' })).toBe('title,url,description');
    });
  });

  describe('format: table', () => {
    test('renders a bordered, aligned grid with a header', () => {
      const out = formatResults(sample, { format: 'table' });
      expect(out).toContain('┌');
      expect(out).toContain('┐');
      expect(out).toContain('└');
      expect(out).toContain('Title');
      expect(out).toContain('URL');
      expect(out).toContain('First');
      // no cell contains a newline that would break the grid
      out.split('\n').forEach((line) => {
        if (line.startsWith('│')) expect(line.endsWith('│')).toBe(true);
      });
    });

    test('empty results say so', () => {
      expect(formatResults([], { format: 'table' })).toBe('No results found.');
    });

    test('collapses newlines in a description cell', () => {
      const multi = [{ title: 'T', url: 'https://x.com', description: 'line one\nline two' }];
      const out = formatResults(multi, { format: 'table' });
      expect(out).toContain('line one line two');
    });
  });

  describe('descLength / truncate (plain)', () => {
    const long = [{ title: 'T', url: 'https://x.com', description: 'A'.repeat(300) }];

    test('defaults to 200 + ellipsis', () => {
      const out = formatResults(long);
      expect(out).toContain('A'.repeat(200) + '...');
      expect(out).not.toContain('A'.repeat(201));
    });

    test('honors a custom descLength', () => {
      const out = formatResults(long, { descLength: 50 });
      expect(out).toContain('A'.repeat(50) + '...');
    });

    test('truncate:false shows the full description', () => {
      const out = formatResults(long, { truncate: false });
      expect(out).toContain('A'.repeat(300));
      expect(out).not.toContain('...');
    });
  });
});

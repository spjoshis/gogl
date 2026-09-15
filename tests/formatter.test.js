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
});

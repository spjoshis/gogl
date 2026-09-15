import { parseArgs } from '../src/parser.js';

describe('parseArgs', () => {
  test('should parse single word query', () => {
    const result = parseArgs(['weather']);
    expect(result.query).toBe('weather');
  });

  test('should parse multi-word query', () => {
    const result = parseArgs(['what', 'is', 'today']);
    expect(result.query).toBe('what is today');
  });

  test('should handle quoted strings', () => {
    const result = parseArgs(["what's", 'the', 'weather']);
    expect(result.query).toBe("what's the weather");
  });

  test('should return empty query for no args', () => {
    const result = parseArgs([]);
    expect(result.query).toBe('');
  });

  test('should trim whitespace', () => {
    const result = parseArgs(['  hello   world  ']);
    expect(result.query).toBe('hello world');
  });
});

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

  describe('defaults', () => {
    test('should default to non-json, 10 results, no help/version', () => {
      const result = parseArgs(['nodejs']);
      expect(result.json).toBe(false);
      expect(result.results).toBe(10);
      expect(result.help).toBe(false);
      expect(result.version).toBe(false);
    });

    test('should provide flag defaults even for empty args', () => {
      const result = parseArgs([]);
      expect(result.json).toBe(false);
      expect(result.results).toBe(10);
    });
  });

  describe('--json', () => {
    test('should set json flag and keep query clean', () => {
      const result = parseArgs(['--json', 'rust', 'async']);
      expect(result.json).toBe(true);
      expect(result.query).toBe('rust async');
    });

    test('should accept --json after the query words', () => {
      const result = parseArgs(['rust', 'async', '--json']);
      expect(result.json).toBe(true);
      expect(result.query).toBe('rust async');
    });
  });

  describe('--results / -n', () => {
    test('should parse --results N', () => {
      const result = parseArgs(['--results', '5', 'nodejs']);
      expect(result.results).toBe(5);
      expect(result.query).toBe('nodejs');
    });

    test('should parse -n N', () => {
      const result = parseArgs(['-n', '3', 'nodejs']);
      expect(result.results).toBe(3);
    });

    test('should parse --results=N form', () => {
      const result = parseArgs(['--results=7', 'nodejs']);
      expect(result.results).toBe(7);
      expect(result.query).toBe('nodejs');
    });

    test('should clamp values above the max of 20 and flag it', () => {
      const result = parseArgs(['--results', '999', 'nodejs']);
      expect(result.results).toBe(20);
      expect(result.clamped).toBe(true);
    });

    test('should not flag clamping for in-range values', () => {
      expect(parseArgs(['--results', '5', 'nodejs']).clamped).toBe(false);
    });

    test('should throw for an empty --results= value', () => {
      expect(() => parseArgs(['--results=', 'nodejs'])).toThrow();
    });

    test('should throw for non-integer count', () => {
      expect(() => parseArgs(['--results', 'abc', 'nodejs'])).toThrow();
    });

    test('should throw for zero', () => {
      expect(() => parseArgs(['--results', '0', 'nodejs'])).toThrow();
    });

    test('should throw for negative count', () => {
      expect(() => parseArgs(['--results', '-2', 'nodejs'])).toThrow();
    });

    test('should throw when --results has no value', () => {
      expect(() => parseArgs(['nodejs', '--results'])).toThrow();
    });
  });

  describe('--help / --version', () => {
    test('should set help for --help and -h', () => {
      expect(parseArgs(['--help']).help).toBe(true);
      expect(parseArgs(['-h']).help).toBe(true);
    });

    test('should set version for --version and -v', () => {
      expect(parseArgs(['--version']).version).toBe(true);
      expect(parseArgs(['-v']).version).toBe(true);
    });
  });

  describe('unknown flags', () => {
    test('should throw on an unknown long flag', () => {
      expect(() => parseArgs(['--bogus', 'nodejs'])).toThrow(/unknown/i);
    });

    test('should throw on an unknown short flag', () => {
      expect(() => parseArgs(['-x', 'nodejs'])).toThrow(/unknown/i);
    });

    test('should treat a lone dash as query text', () => {
      const result = parseArgs(['-', 'foo']);
      expect(result.query).toBe('- foo');
    });
  });

  describe('help/version precedence', () => {
    test('should let --help win over an unknown flag (no throw)', () => {
      expect(parseArgs(['--help', '--bogus']).help).toBe(true);
    });

    test('should let --help win over an invalid --results (no throw)', () => {
      expect(parseArgs(['-h', '--results', 'abc']).help).toBe(true);
    });

    test('should let --version win over an unknown flag (no throw)', () => {
      expect(parseArgs(['--bogus', '--version']).version).toBe(true);
    });
  });

  describe('-- separator', () => {
    test('should treat tokens after -- as literal query', () => {
      const result = parseArgs(['--', '--json']);
      expect(result.query).toBe('--json');
      expect(result.json).toBe(false);
    });

    test('should allow a query that starts with a dash after --', () => {
      const result = parseArgs(['--', '-n', '5']);
      expect(result.query).toBe('-n 5');
      expect(result.results).toBe(10);
    });
  });
});

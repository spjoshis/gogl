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
    test('should default to non-json, 10 results, google engine, no help/version', () => {
      const result = parseArgs(['nodejs']);
      expect(result.json).toBe(false);
      expect(result.results).toBe(10);
      expect(result.engine).toBe('google');
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

  describe('--engine', () => {
    test('should parse --engine duckduckgo', () => {
      const result = parseArgs(['--engine', 'duckduckgo', 'nodejs']);
      expect(result.engine).toBe('duckduckgo');
      expect(result.query).toBe('nodejs');
    });

    test('should parse --engine=duckduckgo form', () => {
      const result = parseArgs(['--engine=duckduckgo', 'nodejs']);
      expect(result.engine).toBe('duckduckgo');
    });

    test('should throw for an unsupported engine', () => {
      expect(() => parseArgs(['--engine', 'bing', 'nodejs'])).toThrow(/Unknown engine: bing/);
    });

    test('should throw when --engine has no value', () => {
      expect(() => parseArgs(['nodejs', '--engine'])).toThrow(/--engine requires a value/);
    });

    test('should let --help win over an unsupported engine (no throw)', () => {
      expect(parseArgs(['--help', '--engine', 'bing']).help).toBe(true);
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

  describe('environment variable defaults', () => {
    test('GOGL_ENGINE sets the default engine when no --engine flag is given', () => {
      const result = parseArgs(['nodejs'], { GOGL_ENGINE: 'duckduckgo' });
      expect(result.engine).toBe('duckduckgo');
    });

    test('--engine flag overrides GOGL_ENGINE', () => {
      const result = parseArgs(['--engine', 'google', 'nodejs'], { GOGL_ENGINE: 'duckduckgo' });
      expect(result.engine).toBe('google');
    });

    test('an unsupported GOGL_ENGINE falls back to the default and warns', () => {
      const result = parseArgs(['nodejs'], { GOGL_ENGINE: 'bing' });
      expect(result.engine).toBe('google');
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_ENGINE/);
    });

    test('GOGL_RESULTS sets the default result count when no --results flag is given', () => {
      const result = parseArgs(['nodejs'], { GOGL_RESULTS: '5' });
      expect(result.results).toBe(5);
    });

    test('--results flag overrides GOGL_RESULTS', () => {
      const result = parseArgs(['--results', '3', 'nodejs'], { GOGL_RESULTS: '5' });
      expect(result.results).toBe(3);
    });

    test('GOGL_RESULTS above the max is clamped like a CLI flag', () => {
      const result = parseArgs(['nodejs'], { GOGL_RESULTS: '999' });
      expect(result.results).toBe(20);
      expect(result.clamped).toBe(true);
    });

    test('a non-numeric GOGL_RESULTS falls back to the default and warns', () => {
      const result = parseArgs(['nodejs'], { GOGL_RESULTS: 'abc' });
      expect(result.results).toBe(10);
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_RESULTS/);
    });

    test('GOGL_JSON=true/1 sets the default json flag', () => {
      expect(parseArgs(['nodejs'], { GOGL_JSON: 'true' }).json).toBe(true);
      expect(parseArgs(['nodejs'], { GOGL_JSON: '1' }).json).toBe(true);
    });

    test('GOGL_JSON=false/0 keeps json off', () => {
      expect(parseArgs(['nodejs'], { GOGL_JSON: 'false' }).json).toBe(false);
      expect(parseArgs(['nodejs'], { GOGL_JSON: '0' }).json).toBe(false);
    });

    test('--json flag overrides a false-ish GOGL_JSON', () => {
      const result = parseArgs(['--json', 'nodejs'], { GOGL_JSON: 'false' });
      expect(result.json).toBe(true);
    });

    test('an unrecognized GOGL_JSON value falls back to the default and warns', () => {
      const result = parseArgs(['nodejs'], { GOGL_JSON: 'maybe' });
      expect(result.json).toBe(false);
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_JSON/);
    });

    test('no env vars set means no warnings and unchanged defaults', () => {
      const result = parseArgs(['nodejs'], {});
      expect(result.envWarnings).toEqual([]);
      expect(result.engine).toBe('google');
      expect(result.results).toBe(10);
      expect(result.json).toBe(false);
    });

    test('defaults to process.env when no env argument is passed', () => {
      const result = parseArgs(['nodejs']);
      expect(result.envWarnings).toEqual([]);
    });
  });

  describe('--cache / --no-cache / --cache-ttl / --clear-cache', () => {
    test('cache is off by default', () => {
      const result = parseArgs(['nodejs']);
      expect(result.cache).toBe(false);
      expect(result.cacheTtlSeconds).toBeUndefined();
      expect(result.clearCache).toBe(false);
    });

    test('--cache turns caching on', () => {
      expect(parseArgs(['--cache', 'nodejs']).cache).toBe(true);
    });

    test('--cache-ttl implies --cache and sets the TTL in seconds', () => {
      const result = parseArgs(['--cache-ttl', '60', 'nodejs']);
      expect(result.cache).toBe(true);
      expect(result.cacheTtlSeconds).toBe(60);
    });

    test('--cache-ttl=N form works', () => {
      const result = parseArgs(['--cache-ttl=30', 'nodejs']);
      expect(result.cache).toBe(true);
      expect(result.cacheTtlSeconds).toBe(30);
    });

    test('--no-cache always wins, regardless of order relative to --cache/--cache-ttl', () => {
      expect(parseArgs(['--cache', '--no-cache', 'nodejs']).cache).toBe(false);
      expect(parseArgs(['--no-cache', '--cache', 'nodejs']).cache).toBe(false);
      expect(parseArgs(['--no-cache', '--cache-ttl', '60', 'nodejs']).cache).toBe(false);
    });

    test('throws for a non-numeric --cache-ttl', () => {
      expect(() => parseArgs(['--cache-ttl', 'abc', 'nodejs'])).toThrow(/positive integer/);
    });

    test('throws for a zero or negative --cache-ttl', () => {
      expect(() => parseArgs(['--cache-ttl', '0', 'nodejs'])).toThrow(/positive integer/);
    });

    test('throws when --cache-ttl has no value', () => {
      expect(() => parseArgs(['nodejs', '--cache-ttl'])).toThrow(/--cache-ttl requires a value/);
    });

    test('--help wins over an invalid --cache-ttl (no throw)', () => {
      expect(parseArgs(['--help', '--cache-ttl', 'abc']).help).toBe(true);
    });

    test('--clear-cache sets clearCache without requiring cache/query handling', () => {
      const result = parseArgs(['--clear-cache']);
      expect(result.clearCache).toBe(true);
      expect(result.query).toBe('');
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

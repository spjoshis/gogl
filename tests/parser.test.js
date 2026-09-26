import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseArgs } from '../src/parser.js';

function tmpConfigFile(contents) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'gogl-parser-config-test-'));
  const file = path.join(dir, 'config.json');
  writeFileSync(file, JSON.stringify(contents));
  return { dir, file };
}

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

  describe('--date-range', () => {
    test('defaults to undefined (no date restriction)', () => {
      expect(parseArgs(['nodejs']).dateRange).toBeUndefined();
    });

    test.each(['d', 'w', 'm', 'y'])('accepts %s', (value) => {
      const result = parseArgs(['--date-range', value, 'nodejs']);
      expect(result.dateRange).toBe(value);
      expect(result.query).toBe('nodejs');
    });

    test('accepts --date-range=w form', () => {
      const result = parseArgs(['--date-range=w', 'nodejs']);
      expect(result.dateRange).toBe('w');
    });

    test('throws for an unsupported value', () => {
      expect(() => parseArgs(['--date-range', 'century', 'nodejs'])).toThrow(
        /--date-range must be one of: d, w, m, y/
      );
    });

    test('throws when --date-range has no value', () => {
      expect(() => parseArgs(['nodejs', '--date-range'])).toThrow(/--date-range requires a value/);
    });

    test('should let --help win over an unsupported date range (no throw)', () => {
      expect(parseArgs(['--help', '--date-range', 'century']).help).toBe(true);
    });
  });

  describe('--color / --no-color', () => {
    test('defaults to auto', () => {
      expect(parseArgs(['nodejs']).color).toBe('auto');
    });

    test('--color sets always and keeps the query', () => {
      const result = parseArgs(['--color', 'nodejs']);
      expect(result.color).toBe('always');
      expect(result.query).toBe('nodejs');
    });

    test('--no-color sets never', () => {
      expect(parseArgs(['--no-color', 'nodejs']).color).toBe('never');
    });

    test('last color flag wins', () => {
      expect(parseArgs(['--color', '--no-color', 'nodejs']).color).toBe('never');
      expect(parseArgs(['--no-color', '--color', 'nodejs']).color).toBe('always');
    });
  });

  describe('--no-dedupe', () => {
    test('dedupe defaults on', () => {
      expect(parseArgs(['nodejs']).dedupe).toBe(true);
    });

    test('--no-dedupe turns it off and keeps the query', () => {
      const result = parseArgs(['--no-dedupe', 'nodejs']);
      expect(result.dedupe).toBe(false);
      expect(result.query).toBe('nodejs');
    });

    test('--no-dedup alias also works', () => {
      expect(parseArgs(['--no-dedup', 'nodejs']).dedupe).toBe(false);
    });
  });

  describe('-q / --quiet', () => {
    test('defaults to false', () => {
      expect(parseArgs(['nodejs']).quiet).toBe(false);
    });

    test('--quiet sets it and keeps the query', () => {
      const result = parseArgs(['--quiet', 'nodejs']);
      expect(result.quiet).toBe(true);
      expect(result.query).toBe('nodejs');
    });

    test('-q shorthand works', () => {
      expect(parseArgs(['-q', 'nodejs']).quiet).toBe(true);
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

  describe('--retries / -r', () => {
    test('defaults to 2 retries', () => {
      expect(parseArgs(['nodejs']).maxRetries).toBe(2);
    });

    test('--retries N sets the retry count', () => {
      expect(parseArgs(['--retries', '5', 'nodejs']).maxRetries).toBe(5);
    });

    test('-r N shorthand works', () => {
      expect(parseArgs(['-r', '1', 'nodejs']).maxRetries).toBe(1);
    });

    test('--retries=N form works', () => {
      expect(parseArgs(['--retries=4', 'nodejs']).maxRetries).toBe(4);
    });

    test('throws for a non-numeric --retries', () => {
      expect(() => parseArgs(['--retries', 'abc', 'nodejs'])).toThrow(/positive integer/);
    });

    test('throws for a zero --retries', () => {
      expect(() => parseArgs(['--retries', '0', 'nodejs'])).toThrow(/positive integer/);
    });

    test('throws when --retries has no value', () => {
      expect(() => parseArgs(['nodejs', '--retries'])).toThrow(/--retries requires a value/);
    });

    test('--help wins over an invalid --retries (no throw)', () => {
      expect(parseArgs(['--help', '--retries', 'abc']).help).toBe(true);
    });

    test('GOGL_MAX_RETRIES sets the default when no flag is given', () => {
      expect(parseArgs(['nodejs'], { GOGL_MAX_RETRIES: '5' }).maxRetries).toBe(5);
    });

    test('--retries flag overrides GOGL_MAX_RETRIES', () => {
      expect(parseArgs(['--retries', '3', 'nodejs'], { GOGL_MAX_RETRIES: '5' }).maxRetries).toBe(3);
    });

    test('an invalid GOGL_MAX_RETRIES falls back to the default and warns', () => {
      const result = parseArgs(['nodejs'], { GOGL_MAX_RETRIES: 'abc' });
      expect(result.maxRetries).toBe(2);
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_MAX_RETRIES/);
    });
  });

  describe('--timeout', () => {
    test('defaults to 30 seconds', () => {
      expect(parseArgs(['nodejs']).timeoutSeconds).toBe(30);
    });

    test('--timeout N sets the timeout in seconds', () => {
      expect(parseArgs(['--timeout', '10', 'nodejs']).timeoutSeconds).toBe(10);
    });

    test('--timeout=N form works', () => {
      expect(parseArgs(['--timeout=15', 'nodejs']).timeoutSeconds).toBe(15);
    });

    test('throws for a non-numeric --timeout', () => {
      expect(() => parseArgs(['--timeout', 'abc', 'nodejs'])).toThrow(/positive integer/);
    });

    test('throws when --timeout has no value', () => {
      expect(() => parseArgs(['nodejs', '--timeout'])).toThrow(/--timeout requires a value/);
    });

    test('--help wins over an invalid --timeout (no throw)', () => {
      expect(parseArgs(['--help', '--timeout', 'abc']).help).toBe(true);
    });

    test('GOGL_TIMEOUT sets the default when no flag is given', () => {
      expect(parseArgs(['nodejs'], { GOGL_TIMEOUT: '45' }).timeoutSeconds).toBe(45);
    });

    test('--timeout flag overrides GOGL_TIMEOUT', () => {
      expect(parseArgs(['--timeout', '20', 'nodejs'], { GOGL_TIMEOUT: '45' }).timeoutSeconds).toBe(20);
    });

    test('an invalid GOGL_TIMEOUT falls back to the default and warns', () => {
      const result = parseArgs(['nodejs'], { GOGL_TIMEOUT: 'abc' });
      expect(result.timeoutSeconds).toBe(30);
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_TIMEOUT/);
    });

    test('GOGL_DATE_RANGE sets the default when no flag is given', () => {
      expect(parseArgs(['nodejs'], { GOGL_DATE_RANGE: 'm' }).dateRange).toBe('m');
    });

    test('--date-range flag overrides GOGL_DATE_RANGE', () => {
      const result = parseArgs(['--date-range', 'd', 'nodejs'], { GOGL_DATE_RANGE: 'm' });
      expect(result.dateRange).toBe('d');
    });

    test('an invalid GOGL_DATE_RANGE falls back to undefined and warns', () => {
      const result = parseArgs(['nodejs'], { GOGL_DATE_RANGE: 'century' });
      expect(result.dateRange).toBeUndefined();
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_DATE_RANGE/);
    });
  });

  describe('config file defaults', () => {
    let dir;

    afterEach(() => {
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
        dir = undefined;
      }
    });

    test('sets defaults from the config file when nothing else overrides them', () => {
      const created = tmpConfigFile({ engine: 'duckduckgo', results: 5, dateRange: 'w' });
      dir = created.dir;
      const result = parseArgs(['nodejs'], { GOGL_CONFIG: created.file });
      expect(result.engine).toBe('duckduckgo');
      expect(result.results).toBe(5);
      expect(result.dateRange).toBe('w');
    });

    test('an env var overrides a config file value', () => {
      const created = tmpConfigFile({ engine: 'duckduckgo' });
      dir = created.dir;
      const result = parseArgs(['nodejs'], { GOGL_CONFIG: created.file, GOGL_ENGINE: 'google' });
      expect(result.engine).toBe('google');
    });

    test('a CLI flag overrides both a config file and an env var', () => {
      const created = tmpConfigFile({ engine: 'duckduckgo' });
      dir = created.dir;
      const result = parseArgs(
        ['--engine', 'google', 'nodejs'],
        { GOGL_CONFIG: created.file, GOGL_ENGINE: 'duckduckgo' }
      );
      expect(result.engine).toBe('google');
    });

    test('an invalid config value falls back to the built-in default and warns', () => {
      const created = tmpConfigFile({ engine: 'bing' });
      dir = created.dir;
      const result = parseArgs(['nodejs'], { GOGL_CONFIG: created.file });
      expect(result.engine).toBe('google');
      expect(result.envWarnings.join(' ')).toMatch(/config "engine"/);
    });

    test('an unknown config key warns but does not throw', () => {
      const created = tmpConfigFile({ bogus: true });
      dir = created.dir;
      const result = parseArgs(['nodejs'], { GOGL_CONFIG: created.file });
      expect(result.query).toBe('nodejs');
      expect(result.envWarnings.join(' ')).toMatch(/unknown config key "bogus"/);
    });

    test('--no-config skips the config file entirely', () => {
      const created = tmpConfigFile({ engine: 'duckduckgo', results: 5 });
      dir = created.dir;
      const result = parseArgs(['--no-config', 'nodejs'], { GOGL_CONFIG: created.file });
      expect(result.engine).toBe('google');
      expect(result.results).toBe(10);
      expect(result.envWarnings).toEqual([]);
    });

    test('--no-config does not disable env vars or flags', () => {
      const created = tmpConfigFile({ engine: 'duckduckgo' });
      dir = created.dir;
      const result = parseArgs(['--no-config', 'nodejs'], { GOGL_CONFIG: created.file, GOGL_RESULTS: '7' });
      expect(result.results).toBe(7);
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

  describe('--site', () => {
    test('folds site: into the query', () => {
      expect(parseArgs(['--site', 'nodejs.org', 'streams']).query).toBe('streams site:nodejs.org');
    });

    test('supports the = form and strips a scheme/trailing slash', () => {
      expect(parseArgs(['--site=https://nodejs.org/', 'streams']).query).toBe('streams site:nodejs.org');
    });

    test('rejects a value with whitespace', () => {
      expect(() => parseArgs(['--site', 'a b', 'x'])).toThrow(/whitespace/);
    });

    test('errors when the value is missing', () => {
      expect(() => parseArgs(['--site'])).toThrow(/--site requires a value/);
    });
  });

  describe('--filetype', () => {
    test('folds filetype: into the query and strips a leading dot', () => {
      expect(parseArgs(['--filetype', '.PDF', 'report']).query).toBe('report filetype:pdf');
    });

    test('composes with --site (site before filetype)', () => {
      expect(parseArgs(['--site', 'x.com', '--filetype', 'pdf', 'report']).query)
        .toBe('report site:x.com filetype:pdf');
    });

    test('rejects a non-alphanumeric extension', () => {
      expect(() => parseArgs(['--filetype', 'p df', 'x'])).toThrow(/alphanumeric/);
    });
  });

  describe('--exclude', () => {
    test('collects a single domain', () => {
      expect(parseArgs(['--exclude', 'pinterest.com', 'cats']).exclude).toEqual(['pinterest.com']);
    });

    test('is repeatable', () => {
      const result = parseArgs(['--exclude', 'a.com', '--exclude=b.com', 'x']);
      expect(result.exclude).toEqual(['a.com', 'b.com']);
    });

    test('errors on an empty value', () => {
      expect(() => parseArgs(['--exclude', '', 'x'])).toThrow(/--exclude requires a value/);
    });
  });

  describe('--region', () => {
    test('normalizes to lowercase', () => {
      expect(parseArgs(['--region', 'DE', 'x']).region).toBe('de');
    });

    test('rejects a non-two-letter code', () => {
      expect(() => parseArgs(['--region', 'deu', 'x'])).toThrow(/two-letter/);
    });
  });

  describe('--safe', () => {
    test('accepts on/off', () => {
      expect(parseArgs(['--safe', 'on', 'x']).safe).toBe('on');
      expect(parseArgs(['--safe=off', 'x']).safe).toBe('off');
    });

    test('rejects any other value', () => {
      expect(() => parseArgs(['--safe', 'maybe', 'x'])).toThrow(/--safe must be one of/);
    });
  });

  describe('new-flag env + config defaults', () => {
    test('GOGL_REGION and GOGL_SAFE seed defaults; a bad one warns', () => {
      const good = parseArgs(['x'], { GOGL_REGION: 'jp', GOGL_SAFE: 'on' });
      expect(good.region).toBe('jp');
      expect(good.safe).toBe('on');
      const bad = parseArgs(['x'], { GOGL_REGION: 'nope' });
      expect(bad.region).toBeUndefined();
      expect(bad.envWarnings.join(' ')).toMatch(/GOGL_REGION/);
    });

    test('a CLI flag overrides the env default', () => {
      expect(parseArgs(['--region', 'us', 'x'], { GOGL_REGION: 'de' }).region).toBe('us');
    });

    test('config file seeds region/safe (lower precedence than env)', () => {
      const { dir, file } = tmpConfigFile({ region: 'fr', safe: 'off' });
      try {
        const result = parseArgs(['x'], { GOGL_CONFIG: file });
        expect(result.region).toBe('fr');
        expect(result.safe).toBe('off');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test('an invalid config region warns and is ignored', () => {
      const { dir, file } = tmpConfigFile({ region: 'deutschland' });
      try {
        const result = parseArgs(['x'], { GOGL_CONFIG: file });
        expect(result.region).toBeUndefined();
        expect(result.envWarnings.join(' ')).toMatch(/config "region"/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('new-flag help/version precedence', () => {
    test('--help wins over an invalid --region', () => {
      const result = parseArgs(['--help', '--region', 'bad']);
      expect(result.help).toBe(true);
    });
  });

  describe('--format', () => {
    test('defaults to plain', () => {
      expect(parseArgs(['x']).format).toBe('plain');
    });

    test('accepts each supported format', () => {
      for (const f of ['plain', 'json', 'ndjson', 'csv', 'table']) {
        expect(parseArgs(['--format', f, 'x']).format).toBe(f);
      }
    });

    test('the = form works and normalizes case', () => {
      expect(parseArgs(['--format=CSV', 'x']).format).toBe('csv');
    });

    test('rejects an unknown format', () => {
      expect(() => parseArgs(['--format', 'xml', 'x'])).toThrow(/--format must be one of/);
    });

    test('--json still sets format to json (and json flag)', () => {
      const result = parseArgs(['--json', 'x']);
      expect(result.format).toBe('json');
      expect(result.json).toBe(true);
    });

    test('--format wins over --json within the CLI tier', () => {
      expect(parseArgs(['--json', '--format', 'csv', 'x']).format).toBe('csv');
    });

    test('CLI --json beats an env GOGL_FORMAT', () => {
      expect(parseArgs(['--json', 'x'], { GOGL_FORMAT: 'csv' }).format).toBe('json');
    });

    test('env GOGL_FORMAT is used when no CLI format/json is given', () => {
      expect(parseArgs(['x'], { GOGL_FORMAT: 'ndjson' }).format).toBe('ndjson');
    });

    test('a bad GOGL_FORMAT warns and falls back to plain', () => {
      const result = parseArgs(['x'], { GOGL_FORMAT: 'xml' });
      expect(result.format).toBe('plain');
      expect(result.envWarnings.join(' ')).toMatch(/GOGL_FORMAT/);
    });

    test('config format seeds the default (below env)', () => {
      const { dir, file } = tmpConfigFile({ format: 'table' });
      try {
        expect(parseArgs(['x'], { GOGL_CONFIG: file }).format).toBe('table');
        // env overrides config
        expect(parseArgs(['x'], { GOGL_CONFIG: file, GOGL_FORMAT: 'csv' }).format).toBe('csv');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('--desc-length / --no-truncate', () => {
    test('defaults: descLength 200, truncate true', () => {
      const result = parseArgs(['x']);
      expect(result.descLength).toBe(200);
      expect(result.truncate).toBe(true);
    });

    test('--desc-length sets a positive int', () => {
      expect(parseArgs(['--desc-length', '80', 'x']).descLength).toBe(80);
    });

    test('rejects a non-positive --desc-length', () => {
      expect(() => parseArgs(['--desc-length', '0', 'x'])).toThrow(/positive integer/);
    });

    test('--no-truncate flips truncate to false', () => {
      expect(parseArgs(['--no-truncate', 'x']).truncate).toBe(false);
    });

    test('GOGL_DESC_LENGTH seeds the default', () => {
      expect(parseArgs(['x'], { GOGL_DESC_LENGTH: '120' }).descLength).toBe(120);
    });
  });
});

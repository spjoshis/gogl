import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const binPath = fileURLToPath(new URL('../bin/gogl.js', import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
);

// Run the CLI and always capture stdout/stderr/status, whether it exits 0 or not.
function runCli(args, envOverrides = {}) {
  const result = spawnSync('node', [binPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...envOverrides }
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('CLI (non-network paths)', () => {
  test('--help prints usage to stdout and exits 0', () => {
    const { status, stdout } = runCli(['--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('Usage: @google');
    expect(stdout).toContain('--json');
    expect(stdout).toContain('--engine');
    expect(stdout).toContain('--color');
    expect(stdout).toContain('--no-color');
    expect(stdout).toContain('--no-dedupe');
  });

  test('--version prints the package version and exits 0', () => {
    const { status, stdout } = runCli(['--version']);
    expect(status).toBe(0);
    expect(stdout.trim()).toBe(pkg.version);
  });

  test('unknown flag exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--bogus', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/unknown option/i);
  });

  test('invalid --results exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--results', 'abc', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/positive integer/i);
  });

  test('invalid --engine exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--engine', 'bing', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/unknown engine/i);
  });

  test('no query exits 1 with usage on stderr', () => {
    const { status, stderr } = runCli([]);
    expect(status).toBe(1);
    expect(stderr).toMatch(/usage/i);
  });

  test('--help wins over an unknown flag (exit 0)', () => {
    const { status, stdout } = runCli(['--help', '--bogus']);
    expect(status).toBe(0);
    expect(stdout).toContain('Usage: @google');
  });

  test('invalid --cache-ttl exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--cache-ttl', 'abc', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/positive integer/i);
  });

  test('--help documents -q/--quiet', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--quiet');
  });

  test('-q with no query still errors (quiet only affects the banner)', () => {
    const { status, stderr } = runCli(['-q']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/usage/i);
  });

  test('invalid --retries exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--retries', 'abc', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/positive integer/i);
  });

  test('invalid --timeout exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--timeout', 'abc', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/positive integer/i);
  });

  test('--help documents --retries and --timeout', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--retries');
    expect(stdout).toContain('--timeout');
  });

  test('an invalid GOGL_MAX_RETRIES prints a warning but --help still wins', () => {
    const { status, stderr } = runCli(['--help'], { GOGL_MAX_RETRIES: 'abc' });
    expect(status).toBe(0);
    expect(stderr).toMatch(/GOGL_MAX_RETRIES/);
  });

  test('--help documents --date-range', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--date-range');
    expect(stdout).toContain('GOGL_DATE_RANGE');
  });

  test('invalid --date-range exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--date-range', 'century', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/--date-range must be one of/);
  });

  test('an invalid GOGL_DATE_RANGE prints a warning but --help still wins', () => {
    const { status, stderr } = runCli(['--help'], { GOGL_DATE_RANGE: 'century' });
    expect(status).toBe(0);
    expect(stderr).toMatch(/GOGL_DATE_RANGE/);
  });

  test('--help documents the config file and --no-config', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('Config file');
    expect(stdout).toContain('--no-config');
    expect(stdout).toContain('GOGL_CONFIG');
  });

  test('--help documents the query-operator and localization flags', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--site');
    expect(stdout).toContain('--filetype');
    expect(stdout).toContain('--exclude');
    expect(stdout).toContain('--region');
    expect(stdout).toContain('--safe');
    expect(stdout).toContain('GOGL_REGION');
    expect(stdout).toContain('GOGL_SAFE');
  });

  test('invalid --region exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--region', 'deu', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/two-letter/);
  });

  test('invalid --safe exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--safe', 'maybe', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/--safe must be one of/);
  });

  test('invalid --filetype exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--filetype', 'p df', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/alphanumeric/);
  });

  test('an invalid GOGL_SAFE prints a warning but --help still wins', () => {
    const { status, stderr } = runCli(['--help'], { GOGL_SAFE: 'maybe' });
    expect(status).toBe(0);
    expect(stderr).toMatch(/GOGL_SAFE/);
  });

  test('--help documents the output-format flags', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--format');
    expect(stdout).toContain('--desc-length');
    expect(stdout).toContain('--no-truncate');
    expect(stdout).toContain('GOGL_FORMAT');
  });

  test('invalid --format exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--format', 'xml', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/--format must be one of/);
  });

  test('invalid --desc-length exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--desc-length', 'abc', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/positive integer/i);
  });

  test('--help documents the workflow flags', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--open');
    expect(stdout).toContain('--history');
    expect(stdout).toContain('--no-history');
    expect(stdout).toContain('GOGL_HISTORY');
  });

  test('invalid --open exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--open=0', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/--open must be a positive integer/);
  });

  test('--help documents --copy and the urls format', () => {
    const { stdout } = runCli(['--help']);
    expect(stdout).toContain('--copy');
    expect(stdout).toContain('urls');
  });

  test('invalid --copy exits 1 with an error on stderr', () => {
    const { status, stderr } = runCli(['--copy=0', 'foo']);
    expect(status).toBe(1);
    expect(stderr).toMatch(/--copy must be a positive integer/);
  });
});

describe('CLI search history (non-network, real filesystem)', () => {
  let dir;
  let histFile;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'gogl-cli-history-'));
    histFile = path.join(dir, 'history.jsonl');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('--history on an empty history says so, exits 0, no search', () => {
    const { status, stdout } = runCli(['--history'], { GOGL_HISTORY_FILE: histFile });
    expect(status).toBe(0);
    expect(stdout).toContain('No search history yet.');
    expect(stdout).not.toContain('Searching');
  });

  test('--history lists a seeded entry', () => {
    writeFileSync(histFile, JSON.stringify({ query: 'nodejs streams', engine: 'google', count: 7, ts: Date.now() }) + '\n');
    const { status, stdout } = runCli(['--history'], { GOGL_HISTORY_FILE: histFile });
    expect(status).toBe(0);
    expect(stdout).toContain('nodejs streams');
    expect(stdout).toContain('google');
    expect(stdout).toContain('7 results');
  });

  test('--history clear reports the count and empties the file', () => {
    writeFileSync(histFile, [
      JSON.stringify({ query: 'a', engine: 'google', count: 1, ts: 1 }),
      JSON.stringify({ query: 'b', engine: 'google', count: 2, ts: 2 })
    ].join('\n') + '\n');
    const { status, stdout } = runCli(['--history', 'clear'], { GOGL_HISTORY_FILE: histFile });
    expect(status).toBe(0);
    expect(stdout).toContain('Cleared 2 history entries');

    const after = runCli(['--history'], { GOGL_HISTORY_FILE: histFile });
    expect(after.stdout).toContain('No search history yet.');
  });

  test('--help wins over --history', () => {
    const { status, stdout } = runCli(['--help', '--history'], { GOGL_HISTORY_FILE: histFile });
    expect(status).toBe(0);
    expect(stdout).toContain('Usage: @google');
  });
});

describe('CLI config file (non-network, real filesystem)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'gogl-cli-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('an invalid config value warns but --help still wins', () => {
    const file = path.join(dir, 'config.json');
    writeFileSync(file, JSON.stringify({ engine: 'bing' }));

    const { status, stderr } = runCli(['--help'], { GOGL_CONFIG: file });
    expect(status).toBe(0);
    expect(stderr).toMatch(/config "engine"/);
  });

  test('--no-config suppresses config file warnings', () => {
    const file = path.join(dir, 'config.json');
    writeFileSync(file, JSON.stringify({ engine: 'bing' }));

    const { status, stderr } = runCli(['--no-config', '--help'], { GOGL_CONFIG: file });
    expect(status).toBe(0);
    expect(stderr).not.toMatch(/config "engine"/);
  });
});

describe('CLI --clear-cache (non-network, real filesystem)', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'gogl-cli-cache-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('reports 0 entries cleared for an empty/missing cache dir and exits 0', () => {
    const { status, stdout } = runCli(['--clear-cache'], { GOGL_CACHE_DIR: dir });
    expect(status).toBe(0);
    expect(stdout).toContain('Cleared 0 cached entries');
  });

  test('does not require a query, and ignores one if given', () => {
    const { status, stdout } = runCli(['--clear-cache', 'nodejs'], { GOGL_CACHE_DIR: dir });
    expect(status).toBe(0);
    expect(stdout).toContain('Cleared');
    expect(stdout).not.toContain('Searching');
  });

  test('--help wins over --clear-cache', () => {
    const { status, stdout } = runCli(['--help', '--clear-cache'], { GOGL_CACHE_DIR: dir });
    expect(status).toBe(0);
    expect(stdout).toContain('Usage: @google');
  });

  test('actually removes cached entry files from the resolved cache dir', async () => {
    const { writeEntry } = await import('../src/cache.js');
    writeEntry(dir, 'somekey', { engine: 'google', query: 'x', results: 10, data: [] });
    expect(readdirSync(dir).length).toBe(1);

    const { status, stdout } = runCli(['--clear-cache'], { GOGL_CACHE_DIR: dir });
    expect(status).toBe(0);
    expect(stdout).toContain('Cleared 1 cached entry');
    expect(readdirSync(dir).length).toBe(0);
  });
});

describe('CLI environment variable defaults (non-network paths)', () => {
  test('an invalid GOGL_ENGINE prints a warning but --help still wins', () => {
    const { status, stdout, stderr } = runCli(['--help'], { GOGL_ENGINE: 'bing' });
    expect(status).toBe(0);
    expect(stdout).toContain('Usage: @google');
    expect(stderr).toMatch(/GOGL_ENGINE/);
  });

  test('an invalid GOGL_RESULTS prints a warning but --version still wins', () => {
    const { status, stderr } = runCli(['--version'], { GOGL_RESULTS: 'abc' });
    expect(status).toBe(0);
    expect(stderr).toMatch(/GOGL_RESULTS/);
  });

  test('an invalid GOGL_JSON prints a warning but --help still wins', () => {
    const { status, stderr } = runCli(['--help'], { GOGL_JSON: 'maybe' });
    expect(status).toBe(0);
    expect(stderr).toMatch(/GOGL_JSON/);
  });

  test('valid env vars print no warnings', () => {
    const { stderr } = runCli(['--help'], { GOGL_ENGINE: 'duckduckgo', GOGL_RESULTS: '5', GOGL_JSON: 'true' });
    expect(stderr).toBe('');
  });
});

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const binPath = fileURLToPath(new URL('../bin/gogl.js', import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
);

// Run the CLI and always capture stdout/stderr/status, whether it exits 0 or not.
function runCli(args, envOverrides = {}) {
  try {
    const stdout = execFileSync('node', [binPath, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...envOverrides }
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? ''
    };
  }
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

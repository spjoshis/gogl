import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

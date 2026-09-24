import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const binPath = fileURLToPath(new URL('../bin/gogl.js', import.meta.url));
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
);

// Run the CLI and always capture stdout/stderr/status, whether it exits 0 or not.
function runCli(args) {
  try {
    const stdout = execFileSync('node', [binPath, ...args], { encoding: 'utf8' });
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
});

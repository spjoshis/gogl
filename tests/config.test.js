import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveConfigPath, loadConfigFile } from '../src/config.js';

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'gogl-config-test-'));
}

function writeConfig(dir, contents) {
  const file = path.join(dir, 'config.json');
  writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return file;
}

describe('config/resolveConfigPath', () => {
  test('GOGL_CONFIG wins when set', () => {
    expect(resolveConfigPath({ GOGL_CONFIG: '/tmp/custom.json' })).toBe('/tmp/custom.json');
  });

  test('falls back to $XDG_CONFIG_HOME/gogl/config.json', () => {
    expect(resolveConfigPath({ XDG_CONFIG_HOME: '/tmp/xdg' }))
      .toBe(path.join('/tmp/xdg', 'gogl', 'config.json'));
  });

  test('falls back to ~/.config/gogl/config.json when nothing is set', () => {
    expect(resolveConfigPath({})).toBe(path.join(os.homedir(), '.config', 'gogl', 'config.json'));
  });
});

describe('config/loadConfigFile', () => {
  let dir;

  beforeEach(() => {
    dir = tmpDir();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('a missing file is a silent no-op (no values, no warnings)', () => {
    const file = path.join(dir, 'does-not-exist.json');
    const result = loadConfigFile({ GOGL_CONFIG: file });
    expect(result.values).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  test('reads known keys from a valid config file', () => {
    const file = writeConfig(dir, { engine: 'duckduckgo', results: 5, dateRange: 'w' });
    const result = loadConfigFile({ GOGL_CONFIG: file });
    expect(result.values).toEqual({ engine: 'duckduckgo', results: 5, dateRange: 'w' });
    expect(result.warnings).toEqual([]);
  });

  test('warns on and drops unknown keys, keeping known ones', () => {
    const file = writeConfig(dir, { engine: 'google', bogus: true });
    const result = loadConfigFile({ GOGL_CONFIG: file });
    expect(result.values).toEqual({ engine: 'google' });
    expect(result.warnings.join(' ')).toMatch(/Ignoring unknown config key "bogus"/);
  });

  test('warns and ignores malformed JSON', () => {
    const file = writeConfig(dir, '{ not json');
    const result = loadConfigFile({ GOGL_CONFIG: file });
    expect(result.values).toEqual({});
    expect(result.warnings.join(' ')).toMatch(/invalid JSON/);
  });

  test('warns and ignores a non-object top-level value (array)', () => {
    const file = writeConfig(dir, [1, 2, 3]);
    const result = loadConfigFile({ GOGL_CONFIG: file });
    expect(result.values).toEqual({});
    expect(result.warnings.join(' ')).toMatch(/expected a JSON object/);
  });

  test('warns and ignores a non-object top-level value (string)', () => {
    const file = writeConfig(dir, '"just a string"');
    const result = loadConfigFile({ GOGL_CONFIG: file });
    expect(result.values).toEqual({});
    expect(result.warnings.join(' ')).toMatch(/expected a JSON object/);
  });
});

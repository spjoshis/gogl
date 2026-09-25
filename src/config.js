import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG_KEYS = ['engine', 'results', 'json', 'maxRetries', 'timeoutSeconds', 'dateRange'];

/**
 * Resolve the config file path.
 *
 * Precedence: GOGL_CONFIG > $XDG_CONFIG_HOME/gogl/config.json > ~/.config/gogl/config.json
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string}
 */
export function resolveConfigPath(env = process.env) {
  if (env.GOGL_CONFIG && env.GOGL_CONFIG.trim() !== '') {
    return env.GOGL_CONFIG;
  }
  const base = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim() !== ''
    ? env.XDG_CONFIG_HOME
    : path.join(os.homedir(), '.config');
  return path.join(base, 'gogl', 'config.json');
}

/**
 * Load and shallow-validate the config file's known keys. Never throws: a
 * missing file is a silent no-op (config is entirely optional), and any
 * other problem (unreadable, malformed JSON, wrong shape, unknown key) is
 * reported via `warnings` and ignored so a bad config file never breaks the
 * command. Per-key value validation happens downstream in parser.js, which
 * already owns those rules (engine names, positive ints, date ranges).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {typeof nodeFs} [fs=nodeFs] - injectable for tests
 * @returns {{ values: object, warnings: string[] }}
 */
export function loadConfigFile(env = process.env, fs = nodeFs) {
  const warnings = [];
  const configPath = resolveConfigPath(env);

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      warnings.push(`Ignoring config file ${configPath}: ${error.message}`);
    }
    return { values: {}, warnings };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnings.push(`Ignoring config file ${configPath}: invalid JSON.`);
    return { values: {}, warnings };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    warnings.push(`Ignoring config file ${configPath}: expected a JSON object.`);
    return { values: {}, warnings };
  }

  const values = {};
  for (const key of Object.keys(parsed)) {
    if (!CONFIG_KEYS.includes(key)) {
      warnings.push(`Ignoring unknown config key "${key}" in ${configPath}.`);
      continue;
    }
    values[key] = parsed[key];
  }

  return { values, warnings };
}

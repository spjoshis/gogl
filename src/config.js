import nodeFs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CONFIG_KEYS = ['engine', 'results', 'json', 'maxRetries', 'timeoutSeconds', 'dateRange', 'region', 'safe', 'format', 'descLength', 'history'];

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

/**
 * The starter config written by `--init-config`. Only keys with a concrete,
 * always-applicable default are seeded; the optional scoping keys (region, safe,
 * dateRange) are intentionally omitted so the file doesn't impose a locale or a
 * date restriction the user didn't ask for. They can be added by hand — see the
 * README for their accepted values.
 *
 * @returns {object}
 */
export function buildStarterConfig() {
  return {
    engine: 'google',
    results: 10,
    json: false,
    format: 'plain',
    descLength: 200,
    maxRetries: 2,
    timeoutSeconds: 30,
    history: true
  };
}

/**
 * Write a starter config file to the resolved config path. Refuses to overwrite
 * an existing file unless `force` is set. Creates parent directories as needed.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {{ fs?: typeof nodeFs, force?: boolean }} [opts]
 * @returns {string} the path written
 * @throws {Error} when the file exists and `force` is not set
 */
export function initConfig(env = process.env, { fs = nodeFs, force = false } = {}) {
  const configPath = resolveConfigPath(env);
  if (!force && fs.existsSync(configPath)) {
    throw new Error(`config already exists at ${configPath} (use --force to overwrite)`);
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(buildStarterConfig(), null, 2) + '\n', 'utf8');
  return configPath;
}

import { DEFAULT_ENGINE, ENGINE_NAMES, resolveEngine } from './engines/index.js';
import { loadConfigFile } from './config.js';

export const DEFAULT_RESULTS = 10;
export const MAX_RESULTS = 20;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_TIMEOUT_SECONDS = 30;
export const DATE_RANGES = ['d', 'w', 'm', 'y'];

/**
 * Parse CLI arguments into a normalized options object.
 *
 * @param {string[]} argv - argument vector (already sliced past node/script)
 * @param {NodeJS.ProcessEnv} [env=process.env] - environment used to seed
 *   defaults (GOGL_ENGINE, GOGL_RESULTS, GOGL_JSON, ...); CLI flags always win.
 * @returns {{ query: string, json: boolean, results: number, clamped: boolean,
 *   engine: string, color: ('auto'|'always'|'never'), dedupe: boolean,
 *   quiet: boolean, help: boolean, version: boolean, envWarnings: string[],
 *   cache: boolean, cacheTtlSeconds: number|undefined, clearCache: boolean,
 *   maxRetries: number, timeoutSeconds: number,
 *   dateRange: ('d'|'w'|'m'|'y'|undefined) }}
 * @throws {Error} on unknown flags, an invalid --results/--cache-ttl/--retries/
 *   --timeout/--date-range value, or an unsupported --engine value (unless
 *   --help/--version is present, which always wins). Invalid env vars and
 *   config file values never throw; they're reported via `envWarnings` and
 *   the next default in the precedence chain (CLI flag > env var > config
 *   file > built-in default) is used instead.
 */
export function parseArgs(argv, env = process.env) {
  const envWarnings = [];
  const skipConfigFile = Array.isArray(argv) && argv.includes('--no-config');
  const configFile = skipConfigFile ? { values: {}, warnings: [] } : loadConfigFile(env);
  configFile.warnings.forEach((warning) => envWarnings.push(warning));
  const configDefaults = resolveConfigDefaults(configFile.values, envWarnings);

  const options = {
    query: '',
    json: readEnvJson(env, envWarnings, configDefaults.json),
    results: configDefaults.results,
    clamped: configDefaults.resultsClamped,
    engine: readEnvEngine(env, envWarnings, configDefaults.engine),
    color: 'auto',
    dedupe: true,
    quiet: false,
    help: false,
    version: false,
    envWarnings,
    cache: false,
    cacheTtlSeconds: undefined,
    clearCache: false,
    maxRetries: readEnvPositiveInt(env, 'GOGL_MAX_RETRIES', configDefaults.maxRetries, envWarnings),
    timeoutSeconds: readEnvPositiveInt(env, 'GOGL_TIMEOUT', configDefaults.timeoutSeconds, envWarnings),
    dateRange: readEnvDateRange(env, envWarnings, configDefaults.dateRange)
  };

  const envResults = readEnvResults(env, envWarnings);
  if (envResults) {
    options.results = envResults.value;
    options.clamped = envResults.clamped;
  }

  if (!argv || argv.length === 0) {
    return options;
  }

  const queryParts = [];
  let sawResults = false;
  let rawResults = null;
  let sawEngine = false;
  let rawEngine = null;
  let cacheRequested = false;
  let noCacheRequested = false;
  let sawCacheTtl = false;
  let rawCacheTtl = null;
  let sawRetries = false;
  let rawRetries = null;
  let sawTimeout = false;
  let rawTimeout = null;
  let sawDateRange = false;
  let rawDateRange = null;
  // Errors are deferred so that --help / --version always win over a bad flag.
  let deferredError = null;

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    // Everything after `--` is literal query text.
    if (token === '--') {
      queryParts.push(...argv.slice(i + 1));
      break;
    }

    if (token === '-h' || token === '--help') {
      options.help = true;
      continue;
    }
    if (token === '-v' || token === '--version') {
      options.version = true;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (token === '--color') {
      options.color = 'always';
      continue;
    }
    if (token === '--no-color') {
      options.color = 'never';
      continue;
    }
    if (token === '--no-dedupe' || token === '--no-dedup') {
      options.dedupe = false;
      continue;
    }
    if (token === '-q' || token === '--quiet') {
      options.quiet = true;
      continue;
    }
    if (token === '-n' || token === '--results') {
      const value = argv[i + 1];
      if (value === undefined) {
        deferredError = deferredError || new Error('--results requires a value');
        continue;
      }
      rawResults = value;
      sawResults = true;
      i++; // consume the value token
      continue;
    }
    if (token.startsWith('--results=')) {
      rawResults = token.slice('--results='.length);
      sawResults = true;
      continue;
    }
    if (token === '--engine') {
      const value = argv[i + 1];
      if (value === undefined) {
        deferredError = deferredError || new Error('--engine requires a value');
        continue;
      }
      rawEngine = value;
      sawEngine = true;
      i++; // consume the value token
      continue;
    }
    if (token.startsWith('--engine=')) {
      rawEngine = token.slice('--engine='.length);
      sawEngine = true;
      continue;
    }
    if (token === '--cache') {
      cacheRequested = true;
      continue;
    }
    if (token === '--no-cache') {
      noCacheRequested = true;
      continue;
    }
    if (token === '--clear-cache') {
      options.clearCache = true;
      continue;
    }
    if (token === '--no-config') {
      // Already applied above (config file must be skipped before defaults
      // are computed); recognized here so it isn't flagged as unknown.
      continue;
    }
    if (token === '--cache-ttl') {
      const value = argv[i + 1];
      if (value === undefined) {
        deferredError = deferredError || new Error('--cache-ttl requires a value');
        continue;
      }
      rawCacheTtl = value;
      sawCacheTtl = true;
      i++; // consume the value token
      continue;
    }
    if (token.startsWith('--cache-ttl=')) {
      rawCacheTtl = token.slice('--cache-ttl='.length);
      sawCacheTtl = true;
      continue;
    }
    if (token === '-r' || token === '--retries') {
      const value = argv[i + 1];
      if (value === undefined) {
        deferredError = deferredError || new Error('--retries requires a value');
        continue;
      }
      rawRetries = value;
      sawRetries = true;
      i++; // consume the value token
      continue;
    }
    if (token.startsWith('--retries=')) {
      rawRetries = token.slice('--retries='.length);
      sawRetries = true;
      continue;
    }
    if (token === '--timeout') {
      const value = argv[i + 1];
      if (value === undefined) {
        deferredError = deferredError || new Error('--timeout requires a value');
        continue;
      }
      rawTimeout = value;
      sawTimeout = true;
      i++; // consume the value token
      continue;
    }
    if (token.startsWith('--timeout=')) {
      rawTimeout = token.slice('--timeout='.length);
      sawTimeout = true;
      continue;
    }
    if (token === '--date-range') {
      const value = argv[i + 1];
      if (value === undefined) {
        deferredError = deferredError || new Error('--date-range requires a value');
        continue;
      }
      rawDateRange = value;
      sawDateRange = true;
      i++; // consume the value token
      continue;
    }
    if (token.startsWith('--date-range=')) {
      rawDateRange = token.slice('--date-range='.length);
      sawDateRange = true;
      continue;
    }

    // Any other flag-looking token is unknown. A lone '-' is treated as query.
    if (token.length > 1 && token.startsWith('-')) {
      deferredError = deferredError || new Error(`Unknown option: ${token}`);
      continue;
    }

    queryParts.push(token);
  }

  // A request for help/version short-circuits everything, including errors.
  if (options.help || options.version) {
    return options;
  }

  if (sawResults) {
    try {
      const { value, clamped } = normalizeResults(rawResults);
      options.results = value;
      options.clamped = clamped;
    } catch (error) {
      deferredError = deferredError || error;
    }
  }

  if (sawEngine) {
    try {
      resolveEngine(rawEngine);
      options.engine = rawEngine;
    } catch (error) {
      deferredError = deferredError || error;
    }
  }

  if (sawCacheTtl) {
    try {
      options.cacheTtlSeconds = normalizePositiveInt(rawCacheTtl, '--cache-ttl');
      cacheRequested = true; // setting a TTL implies you want caching on
    } catch (error) {
      deferredError = deferredError || error;
    }
  }

  // --no-cache is an explicit escape hatch and always wins, regardless of
  // where --cache/--cache-ttl appear relative to it.
  options.cache = noCacheRequested ? false : cacheRequested;

  if (sawRetries) {
    try {
      options.maxRetries = normalizePositiveInt(rawRetries, '--retries');
    } catch (error) {
      deferredError = deferredError || error;
    }
  }

  if (sawTimeout) {
    try {
      options.timeoutSeconds = normalizePositiveInt(rawTimeout, '--timeout');
    } catch (error) {
      deferredError = deferredError || error;
    }
  }

  if (sawDateRange) {
    try {
      options.dateRange = normalizeDateRange(rawDateRange);
    } catch (error) {
      deferredError = deferredError || error;
    }
  }

  if (deferredError) {
    throw deferredError;
  }

  options.query = queryParts.join(' ').trim().replace(/\s+/g, ' ');
  return options;
}

function normalizeResults(raw) {
  if (!/^\d+$/.test(raw)) {
    throw new Error('--results must be a positive integer');
  }
  const value = Number.parseInt(raw, 10);
  if (value < 1) {
    throw new Error('--results must be a positive integer');
  }
  return { value: Math.min(value, MAX_RESULTS), clamped: value > MAX_RESULTS };
}

function normalizePositiveInt(raw, flagName) {
  if (!/^\d+$/.test(raw) || Number.parseInt(raw, 10) < 1) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return Number.parseInt(raw, 10);
}

function normalizeDateRange(raw) {
  if (!DATE_RANGES.includes(raw)) {
    throw new Error(`--date-range must be one of: ${DATE_RANGES.join(', ')}`);
  }
  return raw;
}

// Env vars only ever *seed defaults*: an invalid value is reported via
// `envWarnings` and ignored rather than raised, so a stale/bad value in the
// user's shell profile never breaks every single invocation of the CLI. Each
// reader falls back to `fallback` (the config-file value, or ultimately the
// built-in constant) rather than a hardcoded default, so the precedence
// chain is CLI flag > env var > config file > built-in default.
function readEnvEngine(env, envWarnings, fallback = DEFAULT_ENGINE) {
  const raw = env && env.GOGL_ENGINE;
  if (!raw) {
    return fallback;
  }
  try {
    resolveEngine(raw);
    return raw;
  } catch {
    envWarnings.push(`Ignoring GOGL_ENGINE=${raw}: unknown engine. Supported: ${ENGINE_NAMES.join(', ')}.`);
    return fallback;
  }
}

function readEnvPositiveInt(env, varName, fallback, envWarnings) {
  const raw = env && env[varName];
  if (!raw) {
    return fallback;
  }
  try {
    return normalizePositiveInt(raw, varName);
  } catch {
    envWarnings.push(`Ignoring ${varName}=${raw}: must be a positive integer.`);
    return fallback;
  }
}

function readEnvDateRange(env, envWarnings, fallback = undefined) {
  const raw = env && env.GOGL_DATE_RANGE;
  if (!raw) {
    return fallback;
  }
  try {
    return normalizeDateRange(raw);
  } catch {
    envWarnings.push(`Ignoring GOGL_DATE_RANGE=${raw}: must be one of ${DATE_RANGES.join(', ')}.`);
    return fallback;
  }
}

function readEnvResults(env, envWarnings) {
  const raw = env && env.GOGL_RESULTS;
  if (!raw) {
    return null;
  }
  try {
    return normalizeResults(raw);
  } catch {
    envWarnings.push(`Ignoring GOGL_RESULTS=${raw}: must be a positive integer.`);
    return null;
  }
}

const TRUTHY_ENV = new Set(['1', 'true', 'yes']);
const FALSY_ENV = new Set(['0', 'false', 'no']);

function readEnvJson(env, envWarnings, fallback = false) {
  const raw = env && env.GOGL_JSON;
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const normalized = raw.toLowerCase();
  if (TRUTHY_ENV.has(normalized)) {
    return true;
  }
  if (FALSY_ENV.has(normalized)) {
    return false;
  }
  envWarnings.push(`Ignoring GOGL_JSON=${raw}: expected true/false, 1/0, or yes/no.`);
  return fallback;
}

/**
 * Validate the raw config-file values against the same rules the CLI flags
 * and env vars use, returning a fully-populated defaults object (built-in
 * constants for anything absent or invalid). Invalid individual keys are
 * reported via `warnings` and ignored independently, same as env vars.
 *
 * @param {object} configValues - raw values already limited to known keys
 * @param {string[]} warnings
 * @returns {{ engine: string, results: number, resultsClamped: boolean,
 *   json: boolean, maxRetries: number, timeoutSeconds: number,
 *   dateRange: (string|undefined) }}
 */
function resolveConfigDefaults(configValues, warnings) {
  const defaults = {
    engine: DEFAULT_ENGINE,
    results: DEFAULT_RESULTS,
    resultsClamped: false,
    json: false,
    maxRetries: DEFAULT_MAX_RETRIES,
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    dateRange: undefined
  };

  if ('engine' in configValues) {
    try {
      resolveEngine(configValues.engine);
      defaults.engine = configValues.engine;
    } catch {
      warnings.push(`Ignoring config "engine": unknown engine. Supported: ${ENGINE_NAMES.join(', ')}.`);
    }
  }

  if ('results' in configValues) {
    try {
      const { value, clamped } = normalizeResults(String(configValues.results));
      defaults.results = value;
      defaults.resultsClamped = clamped;
    } catch {
      warnings.push('Ignoring config "results": must be a positive integer.');
    }
  }

  if ('json' in configValues) {
    if (typeof configValues.json === 'boolean') {
      defaults.json = configValues.json;
    } else {
      warnings.push('Ignoring config "json": must be true or false.');
    }
  }

  if ('maxRetries' in configValues) {
    try {
      defaults.maxRetries = normalizePositiveInt(String(configValues.maxRetries), 'maxRetries');
    } catch {
      warnings.push('Ignoring config "maxRetries": must be a positive integer.');
    }
  }

  if ('timeoutSeconds' in configValues) {
    try {
      defaults.timeoutSeconds = normalizePositiveInt(String(configValues.timeoutSeconds), 'timeoutSeconds');
    } catch {
      warnings.push('Ignoring config "timeoutSeconds": must be a positive integer.');
    }
  }

  if ('dateRange' in configValues) {
    try {
      defaults.dateRange = normalizeDateRange(configValues.dateRange);
    } catch {
      warnings.push(`Ignoring config "dateRange": must be one of: ${DATE_RANGES.join(', ')}.`);
    }
  }

  return defaults;
}

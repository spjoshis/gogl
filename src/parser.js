import { DEFAULT_ENGINE, ENGINE_NAMES, resolveEngine } from './engines/index.js';

export const DEFAULT_RESULTS = 10;
export const MAX_RESULTS = 20;

/**
 * Parse CLI arguments into a normalized options object.
 *
 * @param {string[]} argv - argument vector (already sliced past node/script)
 * @param {NodeJS.ProcessEnv} [env=process.env] - environment used to seed
 *   defaults (GOGL_ENGINE, GOGL_RESULTS, GOGL_JSON); CLI flags always win.
 * @returns {{ query: string, json: boolean, results: number, clamped: boolean,
 *   engine: string, help: boolean, version: boolean, envWarnings: string[] }}
 * @throws {Error} on unknown flags, an invalid --results value, or an
 *   unsupported --engine value (unless --help/--version is present, which
 *   always wins). Invalid env vars never throw; they're reported via
 *   `envWarnings` and the built-in default is used instead.
 */
export function parseArgs(argv, env = process.env) {
  const envWarnings = [];
  const options = {
    query: '',
    json: readEnvJson(env, envWarnings),
    results: DEFAULT_RESULTS,
    clamped: false,
    engine: readEnvEngine(env, envWarnings),
    help: false,
    version: false,
    envWarnings
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

// Env vars only ever *seed defaults*: an invalid value is reported via
// `envWarnings` and ignored rather than raised, so a stale/bad value in the
// user's shell profile never breaks every single invocation of the CLI.
function readEnvEngine(env, envWarnings) {
  const raw = env && env.GOGL_ENGINE;
  if (!raw) {
    return DEFAULT_ENGINE;
  }
  try {
    resolveEngine(raw);
    return raw;
  } catch {
    envWarnings.push(`Ignoring GOGL_ENGINE=${raw}: unknown engine. Supported: ${ENGINE_NAMES.join(', ')}.`);
    return DEFAULT_ENGINE;
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

function readEnvJson(env, envWarnings) {
  const raw = env && env.GOGL_JSON;
  if (raw === undefined || raw === '') {
    return false;
  }
  const normalized = raw.toLowerCase();
  if (TRUTHY_ENV.has(normalized)) {
    return true;
  }
  if (FALSY_ENV.has(normalized)) {
    return false;
  }
  envWarnings.push(`Ignoring GOGL_JSON=${raw}: expected true/false, 1/0, or yes/no.`);
  return false;
}

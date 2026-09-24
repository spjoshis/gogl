import { DEFAULT_ENGINE, resolveEngine } from './engines/index.js';

export const DEFAULT_RESULTS = 10;
export const MAX_RESULTS = 20;

/**
 * Parse CLI arguments into a normalized options object.
 *
 * @param {string[]} argv - argument vector (already sliced past node/script)
 * @returns {{ query: string, json: boolean, results: number, clamped: boolean,
 *   engine: string, color: ('auto'|'always'|'never'), dedupe: boolean,
 *   help: boolean, version: boolean }}
 * @throws {Error} on unknown flags, an invalid --results value, or an
 *   unsupported --engine value (unless --help/--version is present, which
 *   always wins)
 */
export function parseArgs(argv) {
  const options = {
    query: '',
    json: false,
    results: DEFAULT_RESULTS,
    clamped: false,
    engine: DEFAULT_ENGINE,
    color: 'auto',
    dedupe: true,
    help: false,
    version: false
  };

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

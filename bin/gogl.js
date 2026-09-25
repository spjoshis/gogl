#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { search } from '../src/index.js';
import { parseArgs, MAX_RESULTS } from '../src/parser.js';
import { formatResults } from '../src/formatter.js';
import { ENGINE_NAMES, resolveEngine } from '../src/engines/index.js';
import { resolveColor } from '../src/color.js';
import { dedupeResults } from '../src/dedupe.js';
import { DEFAULT_TTL_SECONDS, resolveCacheDir, clear as clearCache } from '../src/cache.js';

const HELP_TEXT = `Usage: @google [options] <query>

Ask anything to Google from your terminal.

Options:
  -n, --results <count>   Number of results to return (1-20, default 10)
      --json              Output results as JSON (to stdout)
      --engine <name>     Search engine to use: ${ENGINE_NAMES.join(', ')} (default: google)
      --color             Force colorized output
      --no-color          Disable colorized output
      --no-dedupe         Keep duplicate-URL results (deduped by default)
      --cache              Reuse a fresh cached result instead of searching again
      --cache-ttl <secs>   How long a cached result stays fresh (implies --cache; default ${DEFAULT_TTL_SECONDS})
      --no-cache           Force a live search, overriding --cache/--cache-ttl
      --clear-cache        Delete all cached results and exit
  -q, --quiet             Suppress the "Searching..." progress banner
  -r, --retries <n>       Retry attempts on failure (default 2)
      --timeout <secs>    Per-attempt page load timeout in seconds (default 30)
  -h, --help              Show this help and exit
  -v, --version           Show version and exit
  --                      Treat all following arguments as the query

Environment variables (used as defaults; CLI flags always win):
  GOGL_ENGINE             Default --engine value
  GOGL_RESULTS            Default --results value
  GOGL_JSON               Default --json value (true/false, 1/0, yes/no)
  GOGL_CACHE_DIR          Directory used to store cached results
  GOGL_CACHE_TTL          Default --cache-ttl value in seconds
  GOGL_MAX_RETRIES        Default --retries value
  GOGL_TIMEOUT            Default --timeout value in seconds

Examples:
  @google what is javascript
  @google -n 5 nodejs streams
  @google --engine duckduckgo nodejs streams
  @google --cache nodejs streams          # reuse a cached result if less than an hour old
  @google --cache-ttl 300 nodejs streams  # cache for 5 minutes instead
  @google --json "rust async" | jq '.[0].url'

By default output is colorized only when writing to a terminal. Colors follow
the NO_COLOR / FORCE_COLOR conventions and are never applied to --json output.`;

function getVersion() {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error('Run "@google --help" for usage.');
    process.exit(1);
  }

  for (const warning of options.envWarnings) {
    console.error(`Warning: ${warning}`);
  }

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.version) {
    console.log(getVersion());
    process.exit(0);
  }

  if (options.clearCache) {
    const dir = resolveCacheDir();
    const removed = clearCache(dir);
    console.log(`Cleared ${removed} cached ${removed === 1 ? 'entry' : 'entries'} from ${dir}.`);
    process.exit(0);
  }

  if (!options.query) {
    console.error('Usage: @google <query>');
    console.error('Example: @google what\'s today\'s date');
    process.exit(1);
  }

  if (options.clamped) {
    console.error(
      `Note: --results capped at ${MAX_RESULTS} (Google returns a limited number of results per page).`
    );
  }

  try {
    const engineLabel = resolveEngine(options.engine).label;

    // Keep stdout clean for JSON so it can be piped; progress goes to stderr.
    // --quiet suppresses it entirely, which also helps piping non-JSON output.
    if (!options.quiet) {
      const banner = `\nSearching ${engineLabel} for: "${options.query}"\n`;
      if (options.json) {
        console.error(banner);
      } else {
        console.log(banner);
      }
    }

    const rawResults = await search(options.query, {
      results: options.results,
      engine: options.engine,
      cache: options.cache,
      cacheTtlSeconds: options.cacheTtlSeconds,
      maxRetries: options.maxRetries,
      timeoutMs: options.timeoutSeconds * 1000
    });
    const results = options.dedupe ? dedupeResults(rawResults) : rawResults;

    const color = resolveColor({
      mode: options.color,
      json: options.json,
      isTTY: Boolean(process.stdout.isTTY)
    });
    const formatted = formatResults(results, { json: options.json, color });

    console.log(formatted);
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.error('Error: Search timed out. Please try again.');
    } else if (error.message.includes('network')) {
      console.error('Error: Network error. Please check your connection.');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

main();

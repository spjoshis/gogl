#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { search } from '../src/index.js';
import { parseArgs, MAX_RESULTS } from '../src/parser.js';
import { formatResults } from '../src/formatter.js';
import { ENGINE_NAMES, resolveEngine } from '../src/engines/index.js';
import { resolveColor } from '../src/color.js';
import { dedupeResults } from '../src/dedupe.js';
import { excludeDomains } from '../src/filter.js';
import { DEFAULT_TTL_SECONDS, resolveCacheDir, clear as clearCache } from '../src/cache.js';

const HELP_TEXT = `Usage: @google [options] <query>

Ask anything to Google from your terminal.

Options:
  -n, --results <count>   Number of results to return (1-20, default 10)
      --json              Output results as JSON (alias for --format json)
      --format <fmt>      Output format: plain, json, ndjson, csv, table (default plain)
      --desc-length <n>   Max description length before truncating (default 200)
      --no-truncate       Do not truncate descriptions (plain/table)
      --engine <name>     Search engine to use: ${ENGINE_NAMES.join(', ')} (default: google)
      --color             Force colorized output
      --no-color          Disable colorized output
      --no-dedupe         Keep duplicate-URL results (deduped by default)
      --site <domain>     Restrict results to a domain (adds site:<domain>)
      --filetype <ext>    Restrict results to a file type (adds filetype:<ext>)
      --exclude <domain>  Drop results from a domain (repeatable)
      --region <code>     Two-letter region code to localize results (e.g. de)
      --safe <on|off>     Toggle SafeSearch filtering
      --cache              Reuse a fresh cached result instead of searching again
      --cache-ttl <secs>   How long a cached result stays fresh (implies --cache; default ${DEFAULT_TTL_SECONDS})
      --no-cache           Force a live search, overriding --cache/--cache-ttl
      --clear-cache        Delete all cached results and exit
  -q, --quiet             Suppress the "Searching..." progress banner
  -r, --retries <n>       Retry attempts on failure (default 2)
      --timeout <secs>    Per-attempt page load timeout in seconds (default 30)
      --date-range <r>    Restrict results by age: d/w/m/y (day/week/month/year)
      --no-config         Skip the config file for this run
  -h, --help              Show this help and exit
  -v, --version           Show version and exit
  --                      Treat all following arguments as the query

Config file (optional; lower precedence than env vars and flags):
  $XDG_CONFIG_HOME/gogl/config.json, or ~/.config/gogl/config.json.
  Override the path with GOGL_CONFIG. A JSON object with any of: engine,
  results, json, maxRetries, timeoutSeconds, dateRange, region, safe, format,
  descLength. Unknown keys and invalid values are ignored with a warning,
  never a crash.

Environment variables (used as defaults; CLI flags always win):
  GOGL_ENGINE             Default --engine value
  GOGL_RESULTS            Default --results value
  GOGL_JSON               Default --json value (true/false, 1/0, yes/no)
  GOGL_FORMAT             Default --format value
  GOGL_DESC_LENGTH        Default --desc-length value
  GOGL_CACHE_DIR          Directory used to store cached results
  GOGL_CACHE_TTL          Default --cache-ttl value in seconds
  GOGL_MAX_RETRIES        Default --retries value
  GOGL_TIMEOUT            Default --timeout value in seconds
  GOGL_DATE_RANGE         Default --date-range value
  GOGL_REGION             Default --region value
  GOGL_SAFE               Default --safe value (on/off)
  GOGL_CONFIG             Path to the config file (see above)

Examples:
  @google what is javascript
  @google -n 5 nodejs streams
  @google --engine duckduckgo nodejs streams
  @google --cache nodejs streams          # reuse a cached result if less than an hour old
  @google --cache-ttl 300 nodejs streams  # cache for 5 minutes instead
  @google --date-range w nodejs streams   # only results from the past week
  @google --site nodejs.org streams        # only results from nodejs.org
  @google --filetype pdf annual report     # only PDF results
  @google --exclude pinterest.com cute cats # drop pinterest.com results
  @google --no-config nodejs streams      # ignore your config file for this run
  @google --format table nodejs streams    # compact aligned table view
  @google --format csv nodejs > out.csv    # spreadsheet-friendly output
  @google --json "rust async" | jq '.[0].url'
  @google --format ndjson "rust async" | jq '.url'  # one JSON object per line

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

    // json/ndjson/csv are machine-readable: their payload owns stdout so it can
    // be piped, and they're never colorized.
    const machineFormat =
      options.format === 'json' || options.format === 'ndjson' || options.format === 'csv';

    // Keep stdout clean for machine formats so they can be piped; progress goes
    // to stderr. --quiet suppresses it entirely, which also helps piping.
    if (!options.quiet) {
      const banner = `\nSearching ${engineLabel} for: "${options.query}"\n`;
      if (machineFormat) {
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
      timeoutMs: options.timeoutSeconds * 1000,
      dateRange: options.dateRange,
      region: options.region,
      safe: options.safe
    });
    const deduped = options.dedupe ? dedupeResults(rawResults) : rawResults;
    const results = excludeDomains(deduped, options.exclude);

    const color = resolveColor({
      mode: options.color,
      json: machineFormat,
      isTTY: Boolean(process.stdout.isTTY)
    });
    const formatted = formatResults(results, {
      format: options.format,
      color,
      descLength: options.descLength,
      truncate: options.truncate
    });

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

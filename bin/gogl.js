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
import { initConfig, resolveConfigPath } from '../src/config.js';
import { openUrl } from '../src/open.js';
import { copyToClipboard } from '../src/copy.js';
import { record as recordHistory, list as listHistory, clear as clearHistory } from '../src/history.js';

const HELP_TEXT = `Usage: @google [options] <query>

Ask anything to Google from your terminal.

Options:
  -n, --results <count>   Number of results to return (1-20, default 10)
      --json              Output results as JSON (alias for --format json)
      --format <fmt>      Output format: plain, json, ndjson, csv, table, urls (default plain)
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
      --open [n]          Open result n (default 1) in the default browser
      --copy [n]          Copy result n's URL (default 1) to the clipboard
      --history [clear]   List recent searches, or 'clear' to wipe them
      --no-history        Do not record this search in history
  -q, --quiet             Suppress the "Searching..." progress banner
  -r, --retries <n>       Retry attempts on failure (default 2)
      --timeout <secs>    Per-attempt page load timeout in seconds (default 30)
      --date-range <r>    Restrict results by age: d/w/m/y (day/week/month/year)
      --no-config         Skip the config file for this run
      --init-config       Write a starter config file and exit (--force to overwrite)
      --show-config       Print the effective settings (after precedence) and exit
  -h, --help              Show this help and exit
  -v, --version           Show version and exit
  --                      Treat all following arguments as the query

Config file (optional; lower precedence than env vars and flags):
  $XDG_CONFIG_HOME/gogl/config.json, or ~/.config/gogl/config.json.
  Override the path with GOGL_CONFIG. A JSON object with any of: engine,
  results, json, maxRetries, timeoutSeconds, dateRange, region, safe, format,
  descLength, history. Unknown keys and invalid values are ignored with a
  warning, never a crash.

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
  GOGL_HISTORY            Record searches in history (true/false; default true)
  GOGL_HISTORY_FILE       Path to the search-history file (JSONL)
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
  @google --open 2 nodejs streams          # open the 2nd result in your browser
  @google --copy nodejs streams            # copy the top result's URL to the clipboard
  @google --format urls nodejs | head -3   # just the URLs, one per line
  @google --history                        # list your recent searches
  @google --history clear                  # wipe your search history
  @google --init-config                    # scaffold a config file with defaults
  @google --show-config                    # see what settings are actually in effect

By default output is colorized only when writing to a terminal. Colors follow
the NO_COLOR / FORCE_COLOR conventions and are never applied to --json output.`;

function getVersion() {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return pkg.version;
}

// The settings actually in effect after the CLI > env > config > default
// precedence chain, plus where the config file would be read from. Handy for
// debugging "why am I getting these defaults?". Action-only fields (help,
// version, openIndex, ...) are intentionally excluded.
function effectiveConfig(options) {
  return {
    engine: options.engine,
    results: options.results,
    format: options.format,
    descLength: options.descLength,
    truncate: options.truncate,
    dedupe: options.dedupe,
    cache: options.cache,
    maxRetries: options.maxRetries,
    timeoutSeconds: options.timeoutSeconds,
    dateRange: options.dateRange ?? null,
    region: options.region ?? null,
    safe: options.safe ?? null,
    history: options.history,
    configPath: resolveConfigPath()
  };
}

function timeAgo(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return '?';
  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatHistoryLine(entry) {
  const when = timeAgo(entry.ts).padStart(7);
  const count = `${entry.count} ${entry.count === 1 ? 'result' : 'results'}`;
  return `${when}  ${entry.query}  (${entry.engine}, ${count})`;
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

  if (options.initConfig) {
    try {
      const written = initConfig(process.env, { force: options.force });
      console.log(`Wrote starter config to ${written}.`);
      console.log('Edit it to change your defaults; see "@google --help" for the keys.');
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  if (options.showConfig) {
    console.log(JSON.stringify(effectiveConfig(options), null, 2));
    process.exit(0);
  }

  if (options.historyAction === 'clear') {
    const removed = clearHistory();
    console.log(`Cleared ${removed} history ${removed === 1 ? 'entry' : 'entries'}.`);
    process.exit(0);
  }

  if (options.historyAction === 'list') {
    const entries = listHistory();
    if (entries.length === 0) {
      console.log('No search history yet.');
    } else {
      console.log(entries.map(formatHistoryLine).join('\n'));
    }
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

    // json/ndjson/csv/urls are machine-readable: their payload owns stdout so it
    // can be piped, and they're never colorized.
    const machineFormat =
      options.format === 'json' || options.format === 'ndjson' ||
      options.format === 'csv' || options.format === 'urls';

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

    // Record the search locally (best-effort, never fatal) unless disabled.
    if (options.history) {
      recordHistory({ query: options.query, engine: options.engine, count: results.length });
    }

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

    if (options.openIndex !== undefined) {
      if (results.length === 0) {
        console.error('Error: No results to open.');
        process.exit(1);
      }
      if (options.openIndex > results.length) {
        console.error(
          `Error: No result #${options.openIndex} to open (only ${results.length} ${results.length === 1 ? 'result' : 'results'}).`
        );
        process.exit(1);
      }
      const target = results[options.openIndex - 1];
      try {
        openUrl(target.url);
        if (!options.quiet) {
          console.error(`Opening result #${options.openIndex}: ${target.url}`);
        }
      } catch (openError) {
        console.error(`Error: could not open the browser: ${openError.message}`);
        process.exit(1);
      }
    }

    if (options.copyIndex !== undefined) {
      if (results.length === 0) {
        console.error('Error: No results to copy.');
        process.exit(1);
      }
      if (options.copyIndex > results.length) {
        console.error(
          `Error: No result #${options.copyIndex} to copy (only ${results.length} ${results.length === 1 ? 'result' : 'results'}).`
        );
        process.exit(1);
      }
      const target = results[options.copyIndex - 1];
      try {
        copyToClipboard(target.url);
        if (!options.quiet) {
          console.error(`Copied result #${options.copyIndex} to clipboard: ${target.url}`);
        }
      } catch (copyError) {
        console.error(`Error: could not copy to the clipboard: ${copyError.message}`);
        process.exit(1);
      }
    }
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

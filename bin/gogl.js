#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { search } from '../src/index.js';
import { parseArgs, MAX_RESULTS } from '../src/parser.js';
import { formatResults } from '../src/formatter.js';
import { ENGINE_NAMES, resolveEngine } from '../src/engines/index.js';
import { resolveColor } from '../src/color.js';

const HELP_TEXT = `Usage: @google [options] <query>

Ask anything to Google from your terminal.

Options:
  -n, --results <count>   Number of results to return (1-20, default 10)
      --json              Output results as JSON (to stdout)
      --engine <name>     Search engine to use: ${ENGINE_NAMES.join(', ')} (default: google)
      --color             Force colorized output
      --no-color          Disable colorized output
  -h, --help              Show this help and exit
  -v, --version           Show version and exit
  --                      Treat all following arguments as the query

Examples:
  @google what is javascript
  @google -n 5 nodejs streams
  @google --engine duckduckgo nodejs streams
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

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.version) {
    console.log(getVersion());
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
    const banner = `\nSearching ${engineLabel} for: "${options.query}"\n`;
    if (options.json) {
      console.error(banner);
    } else {
      console.log(banner);
    }

    const results = await search(options.query, { results: options.results, engine: options.engine });

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

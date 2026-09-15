#!/usr/bin/env node

import { search } from '../src/index.js';
import { parseArgs } from '../src/parser.js';
import { formatResults } from '../src/formatter.js';

async function main() {
  try {
    const { query } = parseArgs(process.argv.slice(2));

    if (!query) {
      console.error('Usage: @google <query>');
      console.error('Example: @google what\'s today\'s date');
      process.exit(1);
    }

    console.log(`\nSearching Google for: "${query}"\n`);

    const results = await search(query);
    const formatted = formatResults(results);

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

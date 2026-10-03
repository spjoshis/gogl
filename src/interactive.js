/**
 * Interactive result-selection ("omniprompt") mode.
 *
 * After a search prints its results, the CLI can drop into a small prompt loop
 * that lets you act on a result by number without re-running the whole search:
 * open it in the browser, copy its URL, or print its details. This module holds
 * the pure command grammar plus an injectable loop, so the behavior is fully
 * unit-testable without a TTY, a browser, or a clipboard.
 */

/**
 * @typedef {{ action: 'open'|'copy'|'print'|'help'|'quit'|'noop'|'error',
 *   index?: number, message?: string }} InteractiveCommand
 */

// Verb aliases accepted at the prompt. Keys are matched case-insensitively.
const COMMAND_ALIASES = {
  o: 'open', open: 'open',
  c: 'copy', copy: 'copy',
  p: 'print', print: 'print',
  q: 'quit', quit: 'quit', exit: 'quit',
  h: 'help', help: 'help', '?': 'help'
};

export const INTERACTIVE_HELP = [
  'Commands:',
  '  <n>        open result <n> in your browser',
  '  o <n>      open result <n> in your browser',
  '  c <n>      copy result <n>\'s URL to the clipboard',
  '  p <n>      print result <n>\'s title, URL, and description',
  '  h, ?       show this help',
  '  q          quit interactive mode',
  '',
  'Tip: a bare <n> is the same as "o <n>"; an empty line re-prompts.'
].join('\n');

/**
 * Parse one line of interactive input into a command descriptor. Pure and
 * exhaustively testable.
 *
 * @param {string} input - a single raw input line
 * @param {number} count - number of available results (used to bounds-check an index)
 * @returns {InteractiveCommand}
 */
export function parseInteractiveCommand(input, count) {
  const trimmed = String(input ?? '').trim();
  if (trimmed === '') {
    return { action: 'noop' };
  }

  // Bare number → default action is "open".
  if (/^\d+$/.test(trimmed)) {
    return indexCommand('open', trimmed, count);
  }

  // "<verb> [n]" or "<verb><n>" (optional whitespace between verb and number).
  const match = trimmed.match(/^([a-z?]+)\s*(\d*)$/i);
  if (!match) {
    return unknown(trimmed);
  }
  const verb = COMMAND_ALIASES[match[1].toLowerCase()];
  if (!verb) {
    return unknown(trimmed);
  }
  if (verb === 'quit' || verb === 'help') {
    if (match[2] !== '') {
      return { action: 'error', message: `'${match[1]}' takes no argument. Type 'h' for help.` };
    }
    return { action: verb };
  }
  // open/copy/print: index defaults to 1 when omitted (matches --open/--copy).
  const raw = match[2] === '' ? '1' : match[2];
  return indexCommand(verb, raw, count);
}

function unknown(input) {
  return { action: 'error', message: `Unknown command: ${input}. Type 'h' for help.` };
}

function indexCommand(action, raw, count) {
  const index = Number.parseInt(raw, 10);
  if (!Number.isInteger(index) || index < 1) {
    return { action: 'error', message: `Invalid result number: ${raw}. Type 'h' for help.` };
  }
  if (index > count) {
    const have = count === 1 ? '1 result' : `${count} results`;
    return { action: 'error', message: `No result #${index} (only ${have}).` };
  }
  return { action, index };
}

/**
 * Render a single result's details for the "print" command.
 *
 * @param {number} index - 1-based result number
 * @param {{title?: string, url: string, description?: string}} result
 * @returns {string}
 */
export function formatResultDetail(index, result) {
  const lines = [`${index}. ${result.title || '(no title)'}`, `   ${result.url}`];
  if (result.description) {
    lines.push(`   ${result.description}`);
  }
  return lines.join('\n');
}

/**
 * Run the interactive prompt loop over a set of results. All I/O is injected so
 * the loop is testable without a real TTY, browser, or clipboard. Open/copy
 * failures are reported and the loop continues rather than crashing the process.
 *
 * @param {Array<{title: string, url: string, description: string}>} results
 * @param {object} deps
 * @param {() => Promise<string|null>} deps.prompt - resolve the next line, or
 *   null/undefined on EOF (stream closed)
 * @param {(msg: string) => void} deps.log - print a line to the user
 * @param {(url: string) => void} deps.open - open a URL in the browser
 * @param {(url: string) => void} deps.copy - copy a URL to the clipboard
 * @returns {Promise<void>}
 */
export async function runInteractive(results, { prompt, log, open, copy }) {
  if (!Array.isArray(results) || results.length === 0) {
    return;
  }
  const noun = results.length === 1 ? 'result' : 'results';
  log(`Interactive mode: ${results.length} ${noun}. Type a number to open, 'h' for help, 'q' to quit.`);

  for (;;) {
    const line = await prompt();
    if (line === null || line === undefined) {
      return; // EOF / stream closed
    }
    const cmd = parseInteractiveCommand(line, results.length);
    if (cmd.action === 'quit') {
      return;
    }
    if (cmd.action === 'noop') {
      continue;
    }
    if (cmd.action === 'help') {
      log(INTERACTIVE_HELP);
      continue;
    }
    if (cmd.action === 'error') {
      log(cmd.message);
      continue;
    }

    const target = results[cmd.index - 1];
    if (cmd.action === 'open') {
      try {
        open(target.url);
        log(`Opening #${cmd.index}: ${target.url}`);
      } catch (error) {
        log(`Error: could not open the browser: ${error.message}`);
      }
    } else if (cmd.action === 'copy') {
      try {
        copy(target.url);
        log(`Copied #${cmd.index}: ${target.url}`);
      } catch (error) {
        log(`Error: could not copy to the clipboard: ${error.message}`);
      }
    } else if (cmd.action === 'print') {
      log(formatResultDetail(cmd.index, target));
    }
  }
}

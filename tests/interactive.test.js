import {
  parseInteractiveCommand,
  formatResultDetail,
  runInteractive,
  INTERACTIVE_HELP
} from '../src/interactive.js';

describe('interactive/parseInteractiveCommand', () => {
  const COUNT = 5;

  test('empty or whitespace input is a no-op', () => {
    expect(parseInteractiveCommand('', COUNT)).toEqual({ action: 'noop' });
    expect(parseInteractiveCommand('   ', COUNT)).toEqual({ action: 'noop' });
    expect(parseInteractiveCommand(null, COUNT)).toEqual({ action: 'noop' });
    expect(parseInteractiveCommand(undefined, COUNT)).toEqual({ action: 'noop' });
  });

  test('a bare number opens that result (default action)', () => {
    expect(parseInteractiveCommand('3', COUNT)).toEqual({ action: 'open', index: 3 });
    expect(parseInteractiveCommand('  1 ', COUNT)).toEqual({ action: 'open', index: 1 });
  });

  test('a bare number out of range is an error, not a crash', () => {
    expect(parseInteractiveCommand('6', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('6', COUNT).message).toMatch(/only 5 results/);
    expect(parseInteractiveCommand('1', 1).action).toBe('open');
    expect(parseInteractiveCommand('2', 1).message).toMatch(/only 1 result\b/);
  });

  test('zero is an invalid result number', () => {
    expect(parseInteractiveCommand('0', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('0', COUNT).message).toMatch(/invalid result number/i);
  });

  test('open/copy/print verbs with an index', () => {
    expect(parseInteractiveCommand('o 2', COUNT)).toEqual({ action: 'open', index: 2 });
    expect(parseInteractiveCommand('open 2', COUNT)).toEqual({ action: 'open', index: 2 });
    expect(parseInteractiveCommand('c 4', COUNT)).toEqual({ action: 'copy', index: 4 });
    expect(parseInteractiveCommand('copy 4', COUNT)).toEqual({ action: 'copy', index: 4 });
    expect(parseInteractiveCommand('p 5', COUNT)).toEqual({ action: 'print', index: 5 });
    expect(parseInteractiveCommand('print 5', COUNT)).toEqual({ action: 'print', index: 5 });
  });

  test('a verb with no index defaults to result 1 (matches --open/--copy)', () => {
    expect(parseInteractiveCommand('o', COUNT)).toEqual({ action: 'open', index: 1 });
    expect(parseInteractiveCommand('c', COUNT)).toEqual({ action: 'copy', index: 1 });
    expect(parseInteractiveCommand('p', COUNT)).toEqual({ action: 'print', index: 1 });
  });

  test('whitespace between verb and number is optional', () => {
    expect(parseInteractiveCommand('o2', COUNT)).toEqual({ action: 'open', index: 2 });
    expect(parseInteractiveCommand('c3', COUNT)).toEqual({ action: 'copy', index: 3 });
  });

  test('verbs are case-insensitive', () => {
    expect(parseInteractiveCommand('O 2', COUNT)).toEqual({ action: 'open', index: 2 });
    expect(parseInteractiveCommand('COPY 1', COUNT)).toEqual({ action: 'copy', index: 1 });
  });

  test('an out-of-range verb index is an error', () => {
    expect(parseInteractiveCommand('o 99', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('o 99', COUNT).message).toMatch(/No result #99/);
  });

  test('quit aliases', () => {
    expect(parseInteractiveCommand('q', COUNT)).toEqual({ action: 'quit' });
    expect(parseInteractiveCommand('quit', COUNT)).toEqual({ action: 'quit' });
    expect(parseInteractiveCommand('exit', COUNT)).toEqual({ action: 'quit' });
  });

  test('help aliases', () => {
    expect(parseInteractiveCommand('h', COUNT)).toEqual({ action: 'help' });
    expect(parseInteractiveCommand('help', COUNT)).toEqual({ action: 'help' });
    expect(parseInteractiveCommand('?', COUNT)).toEqual({ action: 'help' });
  });

  test('quit/help with an argument is an error', () => {
    expect(parseInteractiveCommand('q1', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('h2', COUNT)).toMatchObject({ action: 'error' });
  });

  test('unknown or malformed commands are errors, never crashes', () => {
    expect(parseInteractiveCommand('x', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('-1', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('3 4', COUNT)).toMatchObject({ action: 'error' });
    expect(parseInteractiveCommand('open two', COUNT)).toMatchObject({ action: 'error' });
  });
});

describe('interactive/formatResultDetail', () => {
  test('renders index, title, URL, and description', () => {
    const out = formatResultDetail(2, {
      title: 'Node.js',
      url: 'https://nodejs.org/',
      description: 'A JavaScript runtime.'
    });
    expect(out).toBe('2. Node.js\n   https://nodejs.org/\n   A JavaScript runtime.');
  });

  test('omits an empty description line and falls back for a missing title', () => {
    const out = formatResultDetail(1, { title: '', url: 'https://x.test/', description: '' });
    expect(out).toBe('1. (no title)\n   https://x.test/');
  });
});

describe('interactive/runInteractive', () => {
  const RESULTS = [
    { title: 'First', url: 'https://one.test/', description: 'd1' },
    { title: 'Second', url: 'https://two.test/', description: 'd2' },
    { title: 'Third', url: 'https://three.test/', description: 'd3' }
  ];

  // Build a prompt() that yields queued lines, then null (EOF) forever after.
  function scriptedPrompt(lines) {
    let i = 0;
    return () => Promise.resolve(i < lines.length ? lines[i++] : null);
  }

  function makeDeps(lines) {
    const logs = [];
    const opened = [];
    const copied = [];
    return {
      deps: {
        prompt: scriptedPrompt(lines),
        log: (msg) => logs.push(msg),
        open: (url) => opened.push(url),
        copy: (url) => copied.push(url)
      },
      logs,
      opened,
      copied
    };
  }

  test('returns immediately for empty results without prompting', async () => {
    let prompted = false;
    await runInteractive([], {
      prompt: () => { prompted = true; return Promise.resolve(null); },
      log: () => {},
      open: () => {},
      copy: () => {}
    });
    expect(prompted).toBe(false);
  });

  test('a bare number opens the matching result', async () => {
    const { deps, opened } = makeDeps(['2', 'q']);
    await runInteractive(RESULTS, deps);
    expect(opened).toEqual(['https://two.test/']);
  });

  test('open/copy/print dispatch to the right result and log', async () => {
    const { deps, opened, copied, logs } = makeDeps(['o 1', 'c 2', 'p 3', 'q']);
    await runInteractive(RESULTS, deps);
    expect(opened).toEqual(['https://one.test/']);
    expect(copied).toEqual(['https://two.test/']);
    expect(logs.some((l) => l.includes('Opening #1: https://one.test/'))).toBe(true);
    expect(logs.some((l) => l.includes('Copied #2: https://two.test/'))).toBe(true);
    expect(logs.some((l) => l.includes('3. Third'))).toBe(true);
  });

  test('an empty line re-prompts (no-op) and does not act', async () => {
    const { deps, opened, copied } = makeDeps(['', '', 'q']);
    await runInteractive(RESULTS, deps);
    expect(opened).toEqual([]);
    expect(copied).toEqual([]);
  });

  test('help prints the help text and continues', async () => {
    const { deps, logs } = makeDeps(['h', 'q']);
    await runInteractive(RESULTS, deps);
    expect(logs).toContain(INTERACTIVE_HELP);
  });

  test('an invalid command is reported and the loop continues', async () => {
    const { deps, logs, opened } = makeDeps(['9', 'o 1', 'q']);
    await runInteractive(RESULTS, deps);
    expect(logs.some((l) => /only 3 results/.test(l))).toBe(true);
    expect(opened).toEqual(['https://one.test/']); // loop kept going after the error
  });

  test('EOF (null line) ends the loop', async () => {
    const { deps, opened } = makeDeps([]); // prompt returns null immediately
    await runInteractive(RESULTS, deps);
    expect(opened).toEqual([]);
  });

  test('an open failure is caught and reported, loop continues', async () => {
    const logs = [];
    const copied = [];
    await runInteractive(RESULTS, {
      prompt: scriptedPrompt(['o 1', 'c 1', 'q']),
      log: (msg) => logs.push(msg),
      open: () => { throw new Error('no browser'); },
      copy: (url) => copied.push(url)
    });
    expect(logs.some((l) => /could not open the browser: no browser/.test(l))).toBe(true);
    expect(copied).toEqual(['https://one.test/']); // still processed the next command
  });
});

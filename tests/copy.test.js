import { resolveCopyCommand, copyToClipboard, commandExists } from '../src/copy.js';

describe('copy/resolveCopyCommand', () => {
  test('macOS uses pbcopy', () => {
    expect(resolveCopyCommand('darwin')).toEqual({ cmd: 'pbcopy', args: [] });
  });

  test('Windows uses clip', () => {
    expect(resolveCopyCommand('win32')).toEqual({ cmd: 'clip', args: [] });
  });

  test('Linux picks the first available tool in order', () => {
    const onlyXclip = (cmd) => cmd === 'xclip';
    expect(resolveCopyCommand('linux', { has: onlyXclip }))
      .toEqual({ cmd: 'xclip', args: ['-selection', 'clipboard'] });

    const onlyWl = (cmd) => cmd === 'wl-copy';
    expect(resolveCopyCommand('linux', { has: onlyWl })).toEqual({ cmd: 'wl-copy', args: [] });

    const onlyXsel = (cmd) => cmd === 'xsel';
    expect(resolveCopyCommand('linux', { has: onlyXsel }))
      .toEqual({ cmd: 'xsel', args: ['--clipboard', '--input'] });
  });

  test('Linux throws a helpful error when no tool is installed', () => {
    expect(() => resolveCopyCommand('linux', { has: () => false }))
      .toThrow(/no clipboard tool found/);
  });
});

describe('copy/commandExists', () => {
  test('finds a command on the PATH', () => {
    const fakeFs = { existsSync: (p) => p === '/bin/pbcopy' };
    expect(commandExists('pbcopy', { PATH: '/usr/bin:/bin' }, fakeFs)).toBe(true);
    expect(commandExists('nope', { PATH: '/usr/bin:/bin' }, fakeFs)).toBe(false);
  });

  test('returns false with an empty PATH', () => {
    expect(commandExists('pbcopy', { PATH: '' }, { existsSync: () => false })).toBe(false);
  });
});

describe('copy/copyToClipboard', () => {
  function fakeSpawn() {
    const calls = [];
    const spawn = (cmd, args, opts) => {
      const writes = [];
      calls.push({ cmd, args, opts, writes });
      return {
        stdin: {
          write: (t) => writes.push(t),
          end: () => { calls[calls.length - 1].ended = true; }
        }
      };
    };
    return { spawn, calls };
  }

  test('writes the text to the tool stdin and ends it (no shell/argv exposure)', () => {
    const { spawn, calls } = fakeSpawn();
    copyToClipboard('https://example.com/?q=a b', { platform: 'darwin', spawn });
    expect(calls[0].cmd).toBe('pbcopy');
    expect(calls[0].args).toEqual([]);
    expect(calls[0].writes).toEqual(['https://example.com/?q=a b']);
    expect(calls[0].ended).toBe(true);
    expect(calls[0].opts).toEqual({ stdio: ['pipe', 'ignore', 'ignore'] });
  });
});

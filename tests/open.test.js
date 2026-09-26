import { resolveOpenCommand, openUrl } from '../src/open.js';

describe('open/resolveOpenCommand', () => {
  test('macOS uses open', () => {
    expect(resolveOpenCommand('darwin')).toEqual({ cmd: 'open', args: [] });
  });

  test('Windows uses cmd /c start with an empty title', () => {
    expect(resolveOpenCommand('win32')).toEqual({ cmd: 'cmd', args: ['/c', 'start', ''] });
  });

  test('Linux and other Unix-likes use xdg-open', () => {
    expect(resolveOpenCommand('linux')).toEqual({ cmd: 'xdg-open', args: [] });
    expect(resolveOpenCommand('freebsd')).toEqual({ cmd: 'xdg-open', args: [] });
  });
});

describe('open/openUrl', () => {
  function fakeSpawn() {
    const calls = [];
    const spawn = (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { unref: () => { calls[calls.length - 1].unrefed = true; } };
    };
    return { spawn, calls };
  }

  test('passes the URL as the final argv element (no shell interpolation)', () => {
    const { spawn, calls } = fakeSpawn();
    openUrl('https://example.com/?q=a b&x="y"', { platform: 'darwin', spawn });
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('open');
    expect(calls[0].args).toEqual(['https://example.com/?q=a b&x="y"']);
  });

  test('appends the URL after the platform args on Windows', () => {
    const { spawn, calls } = fakeSpawn();
    openUrl('https://example.com', { platform: 'win32', spawn });
    expect(calls[0].args).toEqual(['/c', 'start', '', 'https://example.com']);
  });

  test('spawns detached with ignored stdio and unrefs the child', () => {
    const { spawn, calls } = fakeSpawn();
    openUrl('https://example.com', { platform: 'linux', spawn });
    expect(calls[0].opts).toEqual({ stdio: 'ignore', detached: true });
    expect(calls[0].unrefed).toBe(true);
  });
});

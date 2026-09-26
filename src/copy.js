import { spawn as childSpawn } from 'node:child_process';
import nodeFs from 'node:fs';
import path from 'node:path';

/**
 * Best-effort check for whether an executable is on the PATH. Deterministic and
 * injectable (env + fs) so it can be unit-tested without touching the machine.
 *
 * @param {string} cmd
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {typeof nodeFs} [fs=nodeFs]
 * @returns {boolean}
 */
export function commandExists(cmd, env = process.env, fs = nodeFs) {
  const dirs = (env.PATH || '').split(path.delimiter).filter(Boolean);
  return dirs.some((dir) => {
    try {
      return fs.existsSync(path.join(dir, cmd));
    } catch {
      return false;
    }
  });
}

/**
 * Resolve the platform-specific command that reads stdin and sets the system
 * clipboard. macOS (`pbcopy`) and Windows (`clip`) ship one; Linux/BSD clipboard
 * support is fragmented, so we probe the common tools in order and fail with a
 * helpful message if none is installed.
 *
 * @param {NodeJS.Platform} [platform=process.platform]
 * @param {{ has?: (cmd: string) => boolean }} [opts]
 * @returns {{ cmd: string, args: string[] }}
 * @throws {Error} when no clipboard tool is available on this platform
 */
export function resolveCopyCommand(platform = process.platform, { has = commandExists } = {}) {
  if (platform === 'darwin') {
    return { cmd: 'pbcopy', args: [] };
  }
  if (platform === 'win32') {
    return { cmd: 'clip', args: [] };
  }
  const candidates = [
    { cmd: 'wl-copy', args: [] },
    { cmd: 'xclip', args: ['-selection', 'clipboard'] },
    { cmd: 'xsel', args: ['--clipboard', '--input'] }
  ];
  const found = candidates.find((c) => has(c.cmd));
  if (!found) {
    throw new Error('no clipboard tool found (install wl-clipboard, xclip, or xsel)');
  }
  return found;
}

/**
 * Copy text to the system clipboard by piping it to the platform tool's stdin.
 * Security: the text is written to stdin, never interpolated into a shell or an
 * argv element, so its contents can't be interpreted as arguments.
 *
 * @param {string} text
 * @param {{ platform?: NodeJS.Platform, spawn?: typeof childSpawn,
 *   has?: (cmd: string) => boolean }} [opts]
 * @returns {ReturnType<typeof childSpawn>}
 */
export function copyToClipboard(text, { platform = process.platform, spawn = childSpawn, has = commandExists } = {}) {
  const { cmd, args } = resolveCopyCommand(platform, { has });
  const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
  child.stdin.write(text);
  child.stdin.end();
  return child;
}

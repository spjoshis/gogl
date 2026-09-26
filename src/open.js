import { spawn as childSpawn } from 'node:child_process';

/**
 * Resolve the platform-specific command used to open a URL in the default
 * browser. Returns a command plus fixed leading args; the URL is appended by
 * the caller as a separate argv entry (never interpolated into a shell string).
 *
 * @param {NodeJS.Platform} [platform=process.platform]
 * @returns {{ cmd: string, args: string[] }}
 */
export function resolveOpenCommand(platform = process.platform) {
  if (platform === 'darwin') {
    return { cmd: 'open', args: [] };
  }
  if (platform === 'win32') {
    // `start` needs an empty title argument before the URL.
    return { cmd: 'cmd', args: ['/c', 'start', ''] };
  }
  // Linux, BSDs, and other Unix-likes ship xdg-open.
  return { cmd: 'xdg-open', args: [] };
}

/**
 * Open a URL in the default browser. The child is detached and its stdio is
 * ignored so it never blocks or pollutes the CLI's own output. Security: the
 * URL is passed as a single argv element to a real executable — no shell, no
 * string interpolation, so a crafted URL can't inject a command.
 *
 * @param {string} url
 * @param {{ platform?: NodeJS.Platform, spawn?: typeof childSpawn }} [opts]
 * @returns {ReturnType<typeof childSpawn>}
 */
export function openUrl(url, { platform = process.platform, spawn = childSpawn } = {}) {
  const { cmd, args } = resolveOpenCommand(platform);
  const child = spawn(cmd, [...args, url], { stdio: 'ignore', detached: true });
  if (child && typeof child.unref === 'function') {
    child.unref();
  }
  return child;
}

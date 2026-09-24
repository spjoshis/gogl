// A tiny, safe whitelist of ANSI SGR (Select Graphic Rendition) codes. Kept
// minimal on purpose — no dependency, no 256/truecolor, always paired with a
// reset so styled text never "leaks" into later output or a pipe.
export const SGR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m'
};

/**
 * Wrap text in one or more SGR codes, always resetting afterwards. With no
 * codes the text is returned unchanged.
 *
 * @param {string} text
 * @param {...string} codes
 * @returns {string}
 */
export function paint(text, ...codes) {
  if (codes.length === 0) {
    return text;
  }
  return `${codes.join('')}${text}${SGR.reset}`;
}

function isEnabled(value) {
  return value !== undefined && value !== '' && value !== '0' && value !== 'false';
}

/**
 * Decide whether to emit ANSI color for this run.
 *
 * Precedence (highest first):
 *   1. JSON output is never colorized (must stay machine-parseable).
 *   2. Explicit mode: 'always' -> true, 'never' -> false.
 *   3. 'auto': a non-empty NO_COLOR disables (https://no-color.org); otherwise
 *      a truthy FORCE_COLOR enables; otherwise color follows the TTY.
 *
 * @param {{ mode?: 'auto'|'always'|'never', json?: boolean,
 *   env?: NodeJS.ProcessEnv, isTTY?: boolean }} [opts]
 * @returns {boolean}
 */
export function resolveColor({ mode = 'auto', json = false, env = process.env, isTTY = false } = {}) {
  if (json) {
    return false;
  }
  if (mode === 'always') {
    return true;
  }
  if (mode === 'never') {
    return false;
  }
  const e = env || {};
  if (e.NO_COLOR !== undefined && e.NO_COLOR !== '') {
    return false;
  }
  if (isEnabled(e.FORCE_COLOR)) {
    return true;
  }
  return Boolean(isTTY);
}

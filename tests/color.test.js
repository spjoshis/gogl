import { SGR, paint, resolveColor } from '../src/color.js';

describe('color/paint', () => {
  test('wraps text in the given codes and resets', () => {
    expect(paint('hi', SGR.bold)).toBe(`${SGR.bold}hi${SGR.reset}`);
  });

  test('combines multiple codes with a single reset', () => {
    expect(paint('hi', SGR.bold, SGR.cyan)).toBe(`${SGR.bold}${SGR.cyan}hi${SGR.reset}`);
  });

  test('returns text unchanged with no codes', () => {
    expect(paint('hi')).toBe('hi');
  });
});

describe('color/resolveColor', () => {
  test('json output is never colorized, even with --color', () => {
    expect(resolveColor({ mode: 'always', json: true })).toBe(false);
  });

  test('mode "always" forces color on', () => {
    expect(resolveColor({ mode: 'always', isTTY: false, env: { NO_COLOR: '1' } })).toBe(true);
  });

  test('mode "never" forces color off', () => {
    expect(resolveColor({ mode: 'never', isTTY: true, env: { FORCE_COLOR: '1' } })).toBe(false);
  });

  describe('auto mode', () => {
    test('follows the TTY when no env overrides', () => {
      expect(resolveColor({ mode: 'auto', isTTY: true, env: {} })).toBe(true);
      expect(resolveColor({ mode: 'auto', isTTY: false, env: {} })).toBe(false);
    });

    test('a non-empty NO_COLOR disables color even on a TTY', () => {
      expect(resolveColor({ mode: 'auto', isTTY: true, env: { NO_COLOR: '1' } })).toBe(false);
    });

    test('an empty NO_COLOR does not disable color', () => {
      expect(resolveColor({ mode: 'auto', isTTY: true, env: { NO_COLOR: '' } })).toBe(true);
    });

    test('FORCE_COLOR enables color off a TTY', () => {
      expect(resolveColor({ mode: 'auto', isTTY: false, env: { FORCE_COLOR: '1' } })).toBe(true);
    });

    test('FORCE_COLOR=0 does not force color', () => {
      expect(resolveColor({ mode: 'auto', isTTY: false, env: { FORCE_COLOR: '0' } })).toBe(false);
    });

    test('NO_COLOR wins over FORCE_COLOR', () => {
      expect(resolveColor({ mode: 'auto', isTTY: true, env: { NO_COLOR: '1', FORCE_COLOR: '1' } })).toBe(false);
    });
  });
});

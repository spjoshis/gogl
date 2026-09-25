import { extract as extractGoogle, buildUrl as buildGoogleUrl } from '../src/engines/google.js';
import { extract as extractDuckDuckGo, buildUrl as buildDdgUrl } from '../src/engines/duckduckgo.js';
import { DEFAULT_ENGINE, ENGINES, ENGINE_NAMES, resolveEngine } from '../src/engines/index.js';

// Minimal fake DOM nodes/documents — enough to exercise the querySelector(All)
// calls the extractors make, without pulling in a browser or jsdom.
function fakeElement(selectors) {
  return {
    querySelector(selector) {
      return selectors[selector] ?? null;
    }
  };
}

function fakeDoc(elements) {
  return { querySelectorAll: () => elements };
}

describe('engines/index', () => {
  test('defaults to google', () => {
    expect(DEFAULT_ENGINE).toBe('google');
  });

  test('lists all registered engines', () => {
    expect(ENGINE_NAMES.sort()).toEqual(['duckduckgo', 'google']);
  });

  test('resolveEngine returns the matching module', () => {
    expect(resolveEngine('duckduckgo')).toBe(ENGINES.duckduckgo);
  });

  test('resolveEngine throws for an unknown engine', () => {
    expect(() => resolveEngine('bing')).toThrow(/Unknown engine: bing/);
  });
});

describe('engines/google', () => {
  test('buildUrl encodes the query and includes num', () => {
    const url = buildGoogleUrl('rust async', 5);
    expect(url).toBe('https://www.google.com/search?q=rust%20async&num=5');
  });

  test('buildUrl omits tbs when no dateRange is given', () => {
    const url = buildGoogleUrl('rust async', 5);
    expect(url).not.toContain('tbs=');
  });

  test('buildUrl appends tbs=qdr:<range> when a dateRange is given', () => {
    const url = buildGoogleUrl('rust async', 5, 'w');
    expect(url).toBe('https://www.google.com/search?q=rust%20async&num=5&tbs=qdr:w');
  });

  test('extract pulls title/url/description and skips ads', () => {
    const organic = fakeElement({
      'h3': { innerText: 'Node.js' },
      'a': { href: 'https://nodejs.org/' },
      '[data-content-feature]': { innerText: 'JS runtime' },
      '[data-sokoban-container]': null
    });
    const ad = fakeElement({ '[data-sokoban-container]': {} });
    const doc = fakeDoc([organic, ad]);

    const results = extractGoogle(10, doc);

    expect(results).toEqual([
      { title: 'Node.js', url: 'https://nodejs.org/', description: 'JS runtime' }
    ]);
  });

  test('extract respects the count limit', () => {
    const make = (n) => fakeElement({
      'h3': { innerText: `Result ${n}` },
      'a': { href: `https://example.com/${n}` },
      '[data-sokoban-container]': null
    });
    const doc = fakeDoc([make(1), make(2), make(3)]);

    expect(extractGoogle(2, doc)).toHaveLength(2);
  });
});

describe('engines/duckduckgo', () => {
  test('buildUrl encodes the query', () => {
    expect(buildDdgUrl('rust async', 10)).toBe('https://html.duckduckgo.com/html/?q=rust%20async');
  });

  test('buildUrl omits df when no dateRange is given', () => {
    expect(buildDdgUrl('rust async', 10)).not.toContain('df=');
  });

  test('buildUrl appends df=<range> when a dateRange is given', () => {
    const url = buildDdgUrl('rust async', 10, 'w');
    expect(url).toBe('https://html.duckduckgo.com/html/?q=rust%20async&df=w');
  });

  test('extract unwraps the /l/?uddg= redirect and reads the snippet', () => {
    const wrapped = 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fnodejs.org%2F&rut=abc';
    const node = fakeElement({
      '.result__title a.result__a': {
        textContent: 'Node.js',
        getAttribute: () => wrapped
      },
      '.result__snippet': { textContent: 'JS runtime' }
    });
    const doc = fakeDoc([node]);

    expect(extractDuckDuckGo(10, doc)).toEqual([
      { title: 'Node.js', url: 'https://nodejs.org/', description: 'JS runtime' }
    ]);
  });

  test('extract keeps a plain (non-redirect) href as-is', () => {
    const node = fakeElement({
      '.result__title a.result__a': {
        textContent: 'Example',
        getAttribute: () => 'https://example.com/page'
      },
      '.result__snippet': null
    });
    const doc = fakeDoc([node]);

    expect(extractDuckDuckGo(10, doc)).toEqual([
      { title: 'Example', url: 'https://example.com/page', description: '' }
    ]);
  });

  test('extract skips nodes without a title link', () => {
    const node = fakeElement({ '.result__title a.result__a': null });
    const doc = fakeDoc([node]);

    expect(extractDuckDuckGo(10, doc)).toEqual([]);
  });

  test('extract respects the count limit', () => {
    const make = (n) => fakeElement({
      '.result__title a.result__a': {
        textContent: `Result ${n}`,
        getAttribute: () => `https://example.com/${n}`
      },
      '.result__snippet': null
    });
    const doc = fakeDoc([make(1), make(2), make(3)]);

    expect(extractDuckDuckGo(2, doc)).toHaveLength(2);
  });
});

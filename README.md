# @spjoshis/gogl

> Ask anything to Google from your terminal. A fast, lightweight CLI tool for searching Google and getting results directly in your shell.

[![npm version](https://img.shields.io/npm/v/@spjoshis/gogl.svg)](https://www.npmjs.com/package/@spjoshis/gogl)
[![Node.js version](https://img.shields.io/badge/node-%3E%3D16-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **Fast & Lightweight** - Minimal overhead, quick searches
- 🌐 **Real Search Results** - Uses Playwright to automate actual searches against Google or DuckDuckGo
- 📋 **Clean Output** - Top 10 results with title, URL, and description
- 🔄 **Retry Logic** - Automatic retry on network failures
- 🛡️ **Error Handling** - Graceful error messages and recovery
- 📦 **Zero Dependencies** - Only Playwright (peer dependency)
- 🎯 **Headless Mode** - Runs without opening a visible browser

## 📋 Requirements

- **Node.js:** 16.0.0 or higher
- **npm:** 7.0.0 or higher
- **Internet Connection:** Required for Google searches
- **Playwright:** Automatically installed with dependencies

### System Requirements

- macOS, Linux, or Windows
- ~200 MB disk space for Playwright browsers
- Sufficient CPU for browser automation

## 🚀 Installation

### Global Installation (Recommended)

Install globally to use the `@google` command from anywhere:

```bash
npm install -g @spjoshis/gogl
```

### Local Installation

Install locally in a project:

```bash
npm install @spjoshis/gogl
```

Then use with `npx`:

```bash
npx @spjoshis/gogl "your query"
```

## 📖 Usage

### Basic Syntax

```bash
@google [options] <query>
```

### Options

| Option | Description |
|--------|-------------|
| `-n, --results <count>` | Number of results to return (1–20, default 10) |
| `--json` | Output results as JSON on stdout (ideal for scripting/piping) |
| `--engine <name>` | Search engine to use: `google`, `duckduckgo` (default: `google`) |
| `--color` | Force colorized output (even when piped) |
| `--no-color` | Disable colorized output |
| `--no-dedupe` | Keep duplicate-URL results (deduplicated by default) |
| `--cache` | Reuse a fresh cached result instead of searching again (see [Caching](#-caching)) |
| `--cache-ttl <seconds>` | How long a cached result stays fresh; implies `--cache` (default 3600) |
| `--no-cache` | Force a live search, overriding `--cache`/`--cache-ttl` |
| `--clear-cache` | Delete all cached results and exit |
| `-h, --help` | Show help and exit |
| `-v, --version` | Show the version and exit |
| `--` | Treat everything after it as the query (for queries starting with `-`) |

```bash
@google -n 5 nodejs streams        # limit to 5 results
@google --json "rust async"        # machine-readable JSON output
@google --engine duckduckgo nodejs # search DuckDuckGo instead of Google
@google --no-color nodejs          # plain output, no ANSI colors
@google --cache nodejs streams     # reuse a cached result if less than an hour old
@google --help                     # usage
```

### Colorized output

Results are colorized to make them easier to scan: the numbered title is bold,
the URL is cyan, and the description is dimmed. Color is applied **automatically
only when writing to a terminal**, so piping or redirecting stays plain.

- Force it on or off with `--color` / `--no-color`.
- In `auto` mode, `gogl` honors the [`NO_COLOR`](https://no-color.org) convention
  (any non-empty value disables color) and `FORCE_COLOR` (enables it off a TTY).
- `--json` output is **never** colorized, so it stays machine-parseable.

### Result deduplication

Search results sometimes repeat the same page under cosmetically different URLs
(a trailing slash, a `#fragment`, or a differently-cased host). By default
`gogl` removes these duplicates, **keeping the first (highest-ranked)** copy so
ordering is preserved. URLs are compared after normalizing scheme/host case,
dropping the fragment, and ignoring a trailing slash; the query string is kept,
so `?q=1` and `?q=2` stay distinct. Pass `--no-dedupe` to see the raw list.

> In `--json` mode, results are printed to **stdout** as a JSON array while the
> progress banner is sent to **stderr**, so `@google --json "q" | jq` stays clean.

### Examples

**Single word search:**
```bash
@google nodejs
```

**Multi-word search:**
```bash
@google what is javascript
```

**Search with special characters:**
```bash
@google "machine learning" algorithms
```

**Search with quoted phrases:**
```bash
@google "artificial intelligence" OR "machine learning"
```

**Complex search:**
```bash
@google how to build a web server with node
```

## 📤 Output Format

The command returns up to 10 Google search results in the following format:

```
Searching Google for: "nodejs"

1. Node.js
   URL: https://nodejs.org/
   Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine...

2. Node.js Documentation
   URL: https://nodejs.org/docs/
   Official documentation for Node.js with API reference, guides, and examples...

3. npm | Home
   URL: https://www.npmjs.com/
   npm is the world's largest software registry. Discover packages of reusable code...

...and up to 7 more results
```

### Output Components

- **Index Number:** Position of the result (1-10)
- **Title:** Result heading/title
- **URL:** Full URL to the resource
- **Description:** Snippet or meta description from the page

## 🔧 Development

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/spjoshis/gogl.git
cd gogl

# Install dependencies
npm install

# Install Playwright browsers (required for testing)
npx playwright install
```

### Project Structure

```
@spjoshis/gogl/
├── bin/
│   └── gogl.js              # CLI entry point
├── src/
│   ├── index.js             # Main exports
│   ├── search.js            # Playwright search orchestration (retry + engine dispatch)
│   ├── parser.js            # CLI argument parsing
│   ├── formatter.js         # Result formatting
│   ├── cache.js             # On-disk result cache (opt-in, see Caching)
│   └── engines/             # Per-engine URL building + DOM extraction
│       ├── index.js         # Engine registry (google, duckduckgo)
│       ├── google.js        # Google engine
│       └── duckduckgo.js    # DuckDuckGo engine
├── tests/
│   ├── parser.test.js       # Argument parser tests
│   ├── search.test.js       # Search function tests
│   ├── formatter.test.js    # Formatter tests
│   ├── engines.test.js      # Per-engine URL/extraction tests
│   └── edge-cases.test.js   # Edge case tests
├── jest.config.js           # Jest configuration
├── package.json             # Package metadata
└── README.md               # This file
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Suite

```bash
# Parser tests
npm test -- tests/parser.test.js

# Search tests
npm test -- tests/search.test.js

# Formatter tests
npm test -- tests/formatter.test.js

# Edge cases
npm test -- tests/edge-cases.test.js
```

### Run Integration Tests (Live Google Searches)

By default, live Google search tests are skipped. To run them:

```bash
LIVE_TESTS=1 npm test
```

**Note:** Integration tests may timeout if Google blocks the requests.

## 🏗️ Architecture

### How It Works

1. **Parse Arguments** - Extract the search query and options (including `--engine`) from command line arguments
2. **Launch Browser** - Start Chromium in headless mode using Playwright
3. **Navigate to Engine** - Go to the selected engine's search URL (Google or DuckDuckGo) with the query
4. **Wait for Load** - Wait for network idle to ensure results are loaded
5. **Extract Results** - Use the engine's own DOM queries to extract result titles, URLs, and descriptions
6. **Format Output** - Format results into readable, indexed output
7. **Display Results** - Print formatted results to stdout
8. **Cleanup** - Close browser and clean up resources

### Search Engines

`gogl` supports multiple search engines behind a common interface
(`src/engines/`). Each engine module provides a `buildUrl(query, count)` and
an `extract(count)` function; `search.js` handles browser lifecycle and retry
logic independent of which engine is selected.

| Engine | Flag value | Notes |
|--------|-----------|-------|
| Google (default) | `google` | Original behavior; unchanged with no flags. |
| DuckDuckGo | `duckduckgo` | Uses the `html.duckduckgo.com` lite endpoint; useful when Google blocks automated requests. |

```bash
@google --json --engine duckduckgo "rust async" | jq '.[0].url'
```

### Error Handling

The tool includes robust error handling:

- **Network Timeouts:** Automatic retry with exponential backoff (up to 2 retries)
- **Invalid Queries:** Graceful handling of empty or whitespace-only queries
- **Browser Errors:** Clear error messages if browser launch fails
- **Missing Results:** Returns empty result set if no results found

### Performance

- **Startup Time:** ~3-5 seconds (browser launch)
- **Search Time:** ~2-10 seconds (depends on network)
- **Memory Usage:** ~150-200 MB (Chromium process)

## 💾 Caching

Every search launches a real headless browser (~3-10 seconds), and both
engines apply anti-bot challenges to repeated automated traffic. Caching is an
opt-in way to reuse a recent result instead of paying that cost — and that
risk — again for the exact same search.

```bash
@google --cache nodejs streams              # cache miss: searches live, then saves the result
@google --cache nodejs streams              # cache hit: returns instantly, no browser launch
@google --cache-ttl 300 nodejs streams      # cache for 5 minutes instead of the 1 hour default
@google --cache --no-cache nodejs streams   # --no-cache always wins: forces a live search
@google --clear-cache                       # delete all cached results
```

- **Off by default** — a plain `@google <query>` always searches live; nothing
  is cached or read unless you pass `--cache`/`--cache-ttl` or set
  `GOGL_CACHE_DIR`/`GOGL_CACHE_TTL`.
- **Cache key** is derived from the engine, the normalized query text, and the
  result count, so `--engine duckduckgo` and a different `-n` never collide
  with (or return) another search's cached entry. The query itself is hashed,
  so it never appears in a cache filename.
- **Storage:** one JSON file per search in `$GOGL_CACHE_DIR`, or
  `$XDG_CACHE_HOME/gogl`, or `~/.cache/gogl` by default.
- **Failure is silent:** if the cache directory can't be read or written
  (permissions, full disk, corrupt file), `gogl` falls back to a live search
  rather than failing the command.
- Also usable as a library option: `search('nodejs', { cache: true, cacheTtlSeconds: 300 })`.

## 🐛 Troubleshooting

### "Command not found: @google"

**Solution:** Make sure the package is installed globally:
```bash
npm install -g @spjoshis/gogl
npm list -g @spjoshis/gogl
```

### "Playwright browsers not found"

**Solution:** Install Playwright browsers:
```bash
npx playwright install
```

### "No results found" for queries that should return results

**Possible causes:**
1. Google is blocking the automated requests
2. Network connectivity issue
3. Query is too restrictive or doesn't exist on Google

**Solutions:**
- Wait a few minutes and try again
- Check your internet connection
- Try a simpler query
- Try with the browser on your machine directly
- Try `--engine duckduckgo` as an alternative; both engines apply anti-bot
  challenges to automated traffic (especially from datacenter/cloud IPs), so
  neither is guaranteed to bypass the other, but it's worth a shot

### "Search timed out"

**Causes:** Network latency or Google blocking

**Solutions:**
1. Check internet connection
2. Try a simpler query
3. Use a different network
4. Try again in a few minutes

### Playwright installation fails

**Causes:** Missing system dependencies or permission issues

**Solutions:**
```bash
# Reinstall Playwright
npm install --no-save playwright
npx playwright install

# Or with sudo if permission denied
sudo npx playwright install
```

## 💡 Usage Tips

### Search Operators

Google search operators work with @google:

```bash
# Search exact phrase
@google "exact phrase here"

# Exclude words
@google nodejs -java

# OR operator
@google nodejs OR javascript

# Site search
@google site:github.com nodejs tutorial

# Wildcard search
@google "how to * in node"
```

### Complex Queries

```bash
# Multiple conditions
@google nodejs best practices 2024

# Specific type search
@google tutorial for beginners javascript

# Combination search
@google "machine learning" python open source
```

### Piping Results

Process results with other commands:

```bash
# Count results
@google nodejs | wc -l

# Save to file
@google "web development" > results.txt

# Search results
@google python | grep -i tutorial
```

## 📦 API Usage

You can also use @spjoshis/gogl as a library in your Node.js projects:

```javascript
import { search, formatResults, dedupeResults } from '@spjoshis/gogl';

// Perform search (options are optional and backward compatible)
const results = await search('nodejs');
const fewer = await search('nodejs', { results: 5 }); // limit result count
const viaDdg = await search('nodejs', { engine: 'duckduckgo' }); // alternate engine
const cached = await search('nodejs', { cache: true, cacheTtlSeconds: 300 }); // reuse a fresh cached result

// Optionally drop duplicate-URL results (keeps the first occurrence)
const unique = dedupeResults(results);

// Format results
const formatted = formatResults(unique);
const colored = formatResults(unique, { color: true }); // ANSI-colored string
const asJson = formatResults(unique, { json: true }); // JSON string

// Print results
console.log(formatted);

// Each result object has:
// {
//   title: string,
//   url: string,
//   description: string
// }
```

## 🚀 Advanced Configuration

### Environment Variables

Set these to change the built-in defaults without typing flags every time. A
CLI flag always overrides the matching environment variable.

| Variable | Purpose | Default / Example |
|----------|---------|---------|
| `GOGL_ENGINE` | Default `--engine` value | `export GOGL_ENGINE=duckduckgo` |
| `GOGL_RESULTS` | Default `--results` value | `export GOGL_RESULTS=5` |
| `GOGL_JSON` | Default `--json` value | `export GOGL_JSON=true` (also accepts `1`/`yes`, and `false`/`0`/`no`) |
| `NO_COLOR` | Any non-empty value disables colorized output (see [no-color.org](https://no-color.org)) | unset |
| `FORCE_COLOR` | Enables colorized output even when not writing to a terminal | unset |
| `GOGL_CACHE_DIR` | Directory used to store cached results | `$XDG_CACHE_HOME/gogl` or `~/.cache/gogl` |
| `GOGL_CACHE_TTL` | Default cache TTL in seconds (a `--cache-ttl` flag wins over this) | `3600` (1 hour) |

An unrecognized `GOGL_ENGINE`/`GOGL_RESULTS`/`GOGL_JSON` value is ignored with
a warning on stderr; it never crashes the command, and the built-in default
is used instead. See [Caching](#-caching) for how the cache env vars are used.

```bash
export GOGL_ENGINE=duckduckgo
export GOGL_RESULTS=5

@google nodejs streams        # uses duckduckgo, 5 results
@google --engine google nodejs streams  # flag overrides the env default
```

### CLI Options

See [Options](#options) above for the supported flags (`--results`, `--json`, `--color`,
`--cache`, `--engine`, `--help`, `--version`). Additional options may be added:

```bash
# Planned features:
# @google --filter "*.pdf" "query"   # Filter by file type
```

## 🤝 Contributing

Contributions are welcome! Here's how to contribute:

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/gogl.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes and add tests**
   ```bash
   npm test
   ```

4. **Commit with semantic messages**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**

### Code Style

- Use ESM (ES6 modules)
- Follow consistent naming conventions
- Add tests for new features
- Keep functions focused and single-responsibility
- Use meaningful variable names

### Testing Requirements

- All tests must pass: `npm test`
- Add tests for new features
- Maintain >80% code coverage
- Test edge cases and error scenarios

## 📝 Commit Message Format

Use semantic commit messages:

```
feat: add new feature
fix: fix a bug
docs: documentation changes
test: add tests
refactor: refactor code
perf: performance improvements
chore: maintenance tasks
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

This means you can:
- ✅ Use commercially
- ✅ Modify the code
- ✅ Distribute
- ✅ Use privately

But you must:
- ✅ Include a copy of the license

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for browser automation
- Inspired by command-line search tools
- Thanks to all contributors

## 📞 Support

### Getting Help

- **GitHub Issues:** [Report bugs](https://github.com/spjoshis/gogl/issues)
- **Discussions:** [Ask questions](https://github.com/spjoshis/gogl/discussions)
- **Documentation:** [Full docs](README.md)

### Reporting Issues

When reporting an issue, please include:

1. Your Node.js version: `node --version`
2. Your npm version: `npm --version`
3. The exact command you ran
4. The error message or unexpected behavior
5. Steps to reproduce the issue
6. Your operating system

Example issue:

```
**Node.js Version:** v18.0.0
**npm Version:** 8.0.0
**OS:** macOS 13.0

**Description:**
When I search for "nodejs", the command times out.

**Steps to Reproduce:**
1. Run: @google nodejs
2. Wait for response
3. See timeout error

**Expected:** Return top 10 results
**Actual:** Timeout after 30 seconds
```

## 🎯 Roadmap

Planned features and improvements:

- [x] JSON output format option
- [ ] Filter results by date
- [x] Custom number of results
- [ ] Result caching
- [x] Multiple search engine support (Google, DuckDuckGo)
- [x] Colorized terminal output
- [ ] Rich table/box formatting
- [x] Result deduplication
- [ ] Search history
- [ ] Configuration file support

## 📊 Stats

- **Package Size:** ~2.3 kB (minified)
- **Dependencies:** 1 (Playwright)
- **Test Coverage:** 80%+
- **Latest Version:** 1.4.0
- **Last Updated:** 2026-09-24

## 🔐 Security

The tool:
- ✅ Does NOT store your search queries
- ✅ Does NOT collect usage data
- ✅ Does NOT track users
- ✅ Uses secure HTTPS connections to Google
- ✅ Runs entirely locally

Your privacy is respected. No data is collected or transmitted.

## ⚖️ Disclaimer

@spjoshis/gogl is an unofficial tool. It is not affiliated with, endorsed by, or connected to Google Inc.

Users are responsible for complying with:
- [Google Terms of Service](https://www.google.com/policies/terms/)
- [Google's Robots.txt](https://www.google.com/robots.txt)
- All applicable local laws and regulations

## 🎓 Learn More

- [Playwright Documentation](https://playwright.dev/)
- [Google Search Help](https://support.google.com/websearch)
- [Google Search Operators](https://ahrefs.com/blog/google-search-operators/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)

---

**Made with ❤️ by [spjoshis](https://github.com/spjoshis)**

[⬆ back to top](#spjoshisgogl)

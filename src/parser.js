export function parseArgs(argv) {
  if (!argv || argv.length === 0) {
    return { query: '' };
  }

  const query = argv.join(' ').trim().replace(/\s+/g, ' ');
  return { query };
}

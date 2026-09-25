import { buildQuery } from '../src/query.js';

describe('query/buildQuery', () => {
  test('returns the base query unchanged with no operators', () => {
    expect(buildQuery('nodejs streams')).toBe('nodejs streams');
    expect(buildQuery('nodejs streams', {})).toBe('nodejs streams');
  });

  test('appends site:', () => {
    expect(buildQuery('streams', { site: 'nodejs.org' })).toBe('streams site:nodejs.org');
  });

  test('appends filetype:', () => {
    expect(buildQuery('report', { filetype: 'pdf' })).toBe('report filetype:pdf');
  });

  test('appends site: before filetype: deterministically', () => {
    expect(buildQuery('report', { site: 'x.com', filetype: 'pdf' }))
      .toBe('report site:x.com filetype:pdf');
  });

  test('drops an empty base query but keeps operators', () => {
    expect(buildQuery('', { site: 'x.com' })).toBe('site:x.com');
  });

  test('returns empty string for empty base and no operators', () => {
    expect(buildQuery('')).toBe('');
    expect(buildQuery('   ')).toBe('');
  });
});

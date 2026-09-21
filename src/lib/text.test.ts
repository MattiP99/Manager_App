import { truncateWords } from './text';

describe('truncateWords', () => {
  it('returns the text unchanged when within the word limit', () => {
    expect(truncateWords('due parole', 5)).toBe('due parole');
  });

  it('truncates and appends an ellipsis when over the limit', () => {
    expect(truncateWords('uno due tre quattro cinque sei', 3)).toBe('uno due tre…');
  });

  it('handles empty strings', () => {
    expect(truncateWords('', 3)).toBe('');
  });

  it('collapses extra whitespace before counting words', () => {
    expect(truncateWords('  uno   due  ', 5)).toBe('uno due');
  });
});

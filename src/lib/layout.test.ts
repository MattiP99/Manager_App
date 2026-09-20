import { isWideLayout, TABLET_BREAKPOINT } from './layout';

describe('isWideLayout', () => {
  it('is false just below the tablet breakpoint', () => {
    expect(isWideLayout(TABLET_BREAKPOINT - 1)).toBe(false);
  });

  it('is true exactly at the tablet breakpoint', () => {
    expect(isWideLayout(TABLET_BREAKPOINT)).toBe(true);
  });

  it('is true well above the tablet breakpoint', () => {
    expect(isWideLayout(1440)).toBe(true);
  });
});

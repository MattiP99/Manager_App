import { isNavItemActive } from './navigation';

describe('isNavItemActive', () => {
  it('is active on exact match at root', () => {
    expect(isNavItemActive('/', '/')).toBe(true);
  });

  it('is not active at root for a non-root path', () => {
    expect(isNavItemActive('/pagamenti', '/')).toBe(false);
  });

  it('is active on exact match for a non-root href', () => {
    expect(isNavItemActive('/note', '/note')).toBe(true);
  });

  it('is active for a nested path under a non-root href', () => {
    expect(isNavItemActive('/note/settings', '/note')).toBe(true);
  });

  it('is not active for a sibling route that merely shares a prefix', () => {
    expect(isNavItemActive('/note-something', '/note')).toBe(false);
  });
});

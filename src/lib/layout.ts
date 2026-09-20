export const TABLET_BREAKPOINT = 820;

export function isWideLayout(width: number): boolean {
  return width >= TABLET_BREAKPOINT;
}

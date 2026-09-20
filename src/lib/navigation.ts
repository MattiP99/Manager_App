import type { Feather } from '@expo/vector-icons';

export interface NavItem {
  key: string;
  href: '/' | '/pagamenti' | '/spese' | '/note' | '/impostazioni';
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'calendario', href: '/', label: 'Calendario', icon: 'calendar' },
  { key: 'pagamenti', href: '/pagamenti', label: 'Pagamenti', icon: 'credit-card' },
  { key: 'spese', href: '/spese', label: 'Spese', icon: 'shopping-bag' },
  { key: 'note', href: '/note', label: 'Note', icon: 'lock' },
  { key: 'impostazioni', href: '/impostazioni', label: 'Impostazioni', icon: 'settings' },
];

export function isNavItemActive(pathname: string, href: NavItem['href']): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

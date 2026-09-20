# Design System Foundation (Blocco A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Token di design (colori/tipografia/spaziatura/raggi), font Inter caricato correttamente, componenti UI condivisi (Button/Card/Badge/TextField/IconButton/PageHeader), e un layout responsivo (tab bar su mobile, sidebar da 820px in su) che sostituisce il navigatore `<Tabs>` di Expo Router — la base su cui i blocchi successivi (B: tab principali + auth; C: form/dettagli) ristilizzeranno il contenuto di ogni schermata.

**Architecture:** Token statici in `src/lib/theme.ts` (nessuna logica, solo dati) e una singola funzione pura testabile per la decisione di layout (`isWideLayout`, `src/lib/layout.ts`) — separata dal componente `.tsx` che la usa, perché questo progetto non ha un renderer nei test (`jest-expo/node`) e la logica dentro un `.tsx` non è verificabile. I componenti condivisi vivono in `src/components/` accanto a `CalendarView.tsx` già esistente. Il navigatore `<Tabs>` di `src/app/(tabs)/_layout.tsx` viene sostituito da un `AppShell` che sceglie tra `BottomTabBar` (mobile) e `Sidebar` (tablet/web) in base a `useWindowDimensions()` + `isWideLayout()`.

**Tech Stack:** Stesso stack dei blocchi precedenti (Expo Router, TypeScript, `StyleSheet` nativo, Jest `jest-expo/node`). Nuove dipendenze: `@expo-google-fonts/inter` (font) e `@expo/vector-icons` (icone — scoperto durante l'implementazione che non era già presente, installato come dipendenza diretta nel Task 3). `expo-splash-screen` era invece già presente in `package.json`/`node_modules` — nessuna installazione necessaria per questo.

**Spec:** `docs/superpowers/specs/2026-09-20-design-overhaul-design.md` (sezioni 3-8)

**Verifica documentazione live (obbligatoria da `AGENTS.md` per ogni API Expo usata):** il pattern `useFonts` + `expo-splash-screen` di questo piano è stato verificato contro `https://docs.expo.dev/versions/v57.0.0/sdk/font/`, `https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/` e `https://docs.expo.dev/develop/user-interface/fonts/` prima di scrivere il codice — `useFonts` si importa da `@expo-google-fonts/inter` stesso (non da `expo-font`), `SplashScreen.preventAutoHideAsync()` va chiamato a livello di modulo (mai dentro un componente/hook), `SplashScreen.hideAsync()` dentro un `useEffect` quando `loaded || error`.

## Global Constraints

- **Nessuna libreria UI** (no NativeWind/Tamagui/RN Paper) — solo `StyleSheet` nativo sopra i token di `src/lib/theme.ts`, come da vincolo di progetto già stabilito.
- **Palette (valori esatti dalla spec, mai hex inline nei componenti):** `canvas` `#F5F1EC`, `surface` `#FFFFFF`, `ink` `#3F2021`, `inkMuted` `#7A6659`, `hairline` `#E6DFCF`, `accent` `#A4C8E1`, `success` `#15803D`/`successBg` `#DCFCE7`, `warning` `#B45309`/`warningBg` `#FEF3C7`, `error` `#DC2626`/`errorBg` `#FBE4E4`.
- **Bottoni sempre bianchi con "rilievo"** (sfondo `surface`, bordo `hairline`, ombra morbida) — **mai** un bottone con sfondo `accent` o altro colore a pieno campo, in nessun contesto. Questo vale anche per i blocchi B/C futuri, non solo per questo piano.
- **Niente dark mode, niente i18n** — decisioni esplicitamente escluse dallo scope in brainstorming. Non aggiungere `Colors.dark`, non aggiungere un sistema di traduzioni, anche se il riferimento strutturale (`Grapes_Project_2`) le ha entrambe.
- **Breakpoint responsivo: 820px**, sotto = tab bar mobile, da 820px in su = sidebar. Il calcolo (`isWideLayout`) è una funzione pura testata in `src/lib/layout.ts`, mai una condizione inline dentro un componente `.tsx` — stesso principio già rinforzato più volte in questo progetto dopo bug reali causati da logica non testabile dentro `.tsx` (vedi `docs/LEARNING.md`).
- **Import relativi** (`../lib/theme`, non l'alias `@/` presente in `tsconfig.json` ma mai usato nel codice esistente) — coerenza con la convenzione già in uso in tutto il progetto.
- **Icone:** `@expo/vector-icons`, famiglia Feather, mappatura sezione→icona fissata dalla spec: Calendario→`calendar`, Pagamenti→`credit-card`, Spese→`shopping-bag`, Note→`lock`, Impostazioni→`settings`.
- **Questo piano non tocca il contenuto delle 24 schermate di dominio** — solo token, componenti condivisi, e il layout/navigatore. La ristilizzazione delle schermate è nei piani dei Blocchi B/C.
- **Verifica route (`.expo/types/router.d.ts`):** per ogni task che modifica un file sotto `src/app/`, usare la sequenza anti-stale-router-types (avvia `npx expo start --web --port <N>` in background → attendi `"Waiting on http://..."` nel suo log → `curl -s -o /dev/null http://localhost:<N>/` per forzare un bundle reale → attendi qualche secondo → `npx tsc --noEmit` → killa il server con `netstat -ano | grep :<N>` poi `taskkill //F //PID <pid>`). Per task che toccano solo file puri (`src/lib/`, `src/components/` non ancora referenziati da una route), un `npx tsc --noEmit` semplice basta.
- Questo ambiente di esecuzione non ha strumenti di browser headless/interattivo: la verifica finale del rilievo bottoni/palette/comportamento del breakpoint è manuale da parte dell'utente — le verifiche di questo piano confermano che l'app compila e naviga, non l'aspetto visivo.

---

### Task 1: Token di design e funzione pura del breakpoint

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/lib/layout.ts`
- Create: `src/lib/layout.test.ts`

**Interfaces:**
- Consumes: niente (primo task)
- Produces: `Colors`, `Typography`, `Spacing`, `Radii` da `theme.ts`; `TABLET_BREAKPOINT`, `isWideLayout(width: number): boolean` da `layout.ts` — usati da tutti i task successivi di questo piano

- [ ] **Step 1: Scrivi il test per `isWideLayout` (TDD)**

`src/lib/layout.test.ts`:

```typescript
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
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/lib/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'`

- [ ] **Step 3: Scrivi `src/lib/layout.ts`**

```typescript
export const TABLET_BREAKPOINT = 820;

export function isWideLayout(width: number): boolean {
  return width >= TABLET_BREAKPOINT;
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/lib/layout.test.ts`
Expected: PASS, 3 test.

- [ ] **Step 5: Scrivi `src/lib/theme.ts`**

```typescript
export const Colors = {
  canvas: '#F5F1EC',
  surface: '#FFFFFF',
  ink: '#3F2021',
  inkMuted: '#7A6659',
  hairline: '#E6DFCF',
  accent: '#A4C8E1',
  success: '#15803D',
  successBg: '#DCFCE7',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  error: '#DC2626',
  errorBg: '#FBE4E4',
} as const;

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
} as const;

export const Typography = {
  title: { fontFamily: Fonts.semiBold, fontSize: 22, lineHeight: 28 },
  subtitle: { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyBold: { fontFamily: Fonts.semiBold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  pill: 999,
} as const;
```

- [ ] **Step 6: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata, basta il comando semplice).
Expected: pulito.

- [ ] **Step 7: Commit**

```bash
git add src/lib/theme.ts src/lib/layout.ts src/lib/layout.test.ts
git commit -m "feat: add design tokens and pure breakpoint check"
```

---

### Task 2: Font Inter con gate di caricamento

**Files:**
- Modify: `src/app/_layout.tsx`
- Modify: `package.json` (nuova dipendenza `@expo-google-fonts/inter`)

**Interfaces:**
- Consumes: `Fonts` da `src/lib/theme.ts` (Task 1, solo per coerenza dei nomi — i literal string `'Inter_400Regular'` ecc. devono corrispondere esattamente alle chiavi passate a `useFonts`)
- Produces: font Inter (400/500/600) caricato prima che qualunque schermata monti — nessuna nuova interfaccia esportata, consumato implicitamente da ogni componente che userà `Typography.*` nei task successivi

- [ ] **Step 1: Installa la dipendenza**

```bash
npx expo install @expo-google-fonts/inter
```

(`expo-font` e `expo-splash-screen` sono già presenti in `package.json` — nessuna installazione aggiuntiva per questi due.)

- [ ] **Step 2: Modifica `src/app/_layout.tsx`**

Contenuto completo del file dopo la modifica:

```tsx
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useSession } from '../features/auth/useSession';
import { useHousehold } from '../features/household/useHousehold';
import { useSyncRecurringReminders } from '../features/family-calendar/useSyncRecurringReminders';

// Deve stare a livello di modulo, mai dentro un componente/hook — altrimenti
// può essere chiamato troppo tardi, a splash screen già nascosta (docs Expo).
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate() {
  const { session, isLoading: sessionLoading } = useSession();
  const { data: household, isLoading: householdLoading } = useHousehold();
  useSyncRecurringReminders();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
      return;
    }
    if (session && inAuthGroup) {
      router.replace('/');
      return;
    }
    if (session && household === null && segments[0] !== 'join-household') {
      router.replace('/join-household');
      return;
    }
    if (session && household && segments[0] === 'join-household') {
      router.replace('/');
    }
  }, [session, sessionLoading, household, householdLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
```

(L'unica modifica rispetto al file esistente: import di `useFonts`/font weights/`SplashScreen`, la chiamata a `preventAutoHideAsync()` a livello di modulo, e il gate `fontsLoaded`/`fontError` in `RootLayout`. `AuthGate` è invariato.)

- [ ] **Step 3: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/`)**

```bash
npx expo start --web --port 8098 &
# attendi "Waiting on http://..." nel log, poi:
curl -s -o /dev/null http://localhost:8098/
# attendi qualche secondo perché Metro completi il bundle, poi:
npx tsc --noEmit
# poi killa il server:
netstat -ano | grep :8098
taskkill //F //PID <pid-trovato>
```

Expected: `tsc` pulito, il server risponde 200 senza errori di bundling in log.

- [ ] **Step 4: Commit**

```bash
git add src/app/_layout.tsx package.json package-lock.json
git commit -m "feat: load Inter font with splash screen gate"
```

---

### Task 3: Componenti UI base (Button, Card, Badge, TextField, IconButton, PageHeader)

**Files:**
- Create: `src/components/Button.tsx`
- Create: `src/components/Card.tsx`
- Create: `src/components/Badge.tsx`
- Create: `src/components/TextField.tsx`
- Create: `src/components/IconButton.tsx`
- Create: `src/components/PageHeader.tsx`

**Interfaces:**
- Consumes: `Colors`, `Typography`, `Spacing`, `Radii` da `src/lib/theme.ts` (Task 1); `Feather` da `@expo/vector-icons` (già presente in `node_modules`)
- Produces: `Button`, `Card`, `Badge` (+ `BadgeTone`), `TextField`, `IconButton`, `PageHeader` — consumati dai piani dei Blocchi B/C (fuori da questo piano) e da `BottomTabBar`/`Sidebar` nel Task 4/5 di questo stesso piano (solo `Feather`/token, non i componenti stessi)

- [ ] **Step 1: Scrivi `src/components/Button.tsx`**

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radii, Typography } from '../lib/theme';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'default' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, disabled, loading, tone = 'default', style }: ButtonProps) {
  const textColor = tone === 'danger' ? Colors.error : Colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // "Rilievo": ombra morbida che stacca il bottone bianco dal canvas beige.
    // shadow* è ignorato su Android, dove il rilievo è dato da `elevation`.
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    ...Typography.bodyBold,
  },
});
```

- [ ] **Step 2: Scrivi `src/components/Card.tsx`**

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radii, Spacing } from '../lib/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.md,
    padding: Spacing.lg,
  },
});
```

- [ ] **Step 3: Scrivi `src/components/Badge.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

export type BadgeTone = 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const TONE_COLORS: Record<BadgeTone, { bg: string; text: string }> = {
  success: { bg: Colors.successBg, text: Colors.success },
  warning: { bg: Colors.warningBg, text: Colors.warning },
  error: { bg: Colors.errorBg, text: Colors.error },
  neutral: { bg: Colors.canvas, text: Colors.ink },
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { bg, text } = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radii.pill,
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
  },
  label: {
    ...Typography.caption,
  },
});
```

- [ ] **Step 4: Scrivi `src/components/TextField.tsx`**

```tsx
import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

export function TextField({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, style]}
      placeholderTextColor={Colors.inkMuted}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    color: Colors.ink,
    ...Typography.body,
  },
  inputFocused: {
    borderColor: Colors.accent,
  },
});
```

- [ ] **Step 5: Scrivi `src/components/IconButton.tsx`**

```tsx
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { Colors, Radii } from '../lib/theme';

interface IconButtonProps {
  name: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
}

export function IconButton({ name, onPress, size = 20, color = Colors.ink }: IconButtonProps) {
  return (
    <Pressable style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]} onPress={onPress}>
      <Feather name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 6: Scrivi `src/components/PageHeader.tsx`**

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing, Typography } from '../lib/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: Colors.ink }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: Colors.inkMuted }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title,
  },
  subtitle: {
    ...Typography.body,
  },
});
```

- [ ] **Step 7: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata in questo task).
Expected: pulito.

- [ ] **Step 8: Commit**

```bash
git add src/components/Button.tsx src/components/Card.tsx src/components/Badge.tsx src/components/TextField.tsx src/components/IconButton.tsx src/components/PageHeader.tsx
git commit -m "feat: add base design-system components (Button, Card, Badge, TextField, IconButton, PageHeader)"
```

---

### Task 4: Dati di navigazione + BottomTabBar + Sidebar

**Files:**
- Create: `src/lib/navigation.ts`
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `Colors`, `Spacing`, `Typography`, `Radii` da `src/lib/theme.ts` (Task 1); `Feather` da `@expo/vector-icons`
- Produces: `NavItem`, `NAV_ITEMS` da `navigation.ts`; componenti `BottomTabBar`, `Sidebar` (+ `SIDEBAR_WIDTH` esportato da `Sidebar.tsx`) — usati dal Task 5 (`AppShell`)

- [ ] **Step 1: Scrivi `src/lib/navigation.ts`**

```typescript
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
```

- [ ] **Step 2: Scrivi `src/components/BottomTabBar.tsx`**

```tsx
import { Feather } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_ITEMS } from '../lib/navigation';
import { Colors, Spacing, Typography } from '../lib/theme';

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const color = active ? Colors.accent : Colors.inkMuted;
        return (
          <Link key={item.key} href={item.href} asChild>
            <Pressable style={styles.tab}>
              <Feather name={item.icon} size={20} color={color} />
              <Text style={[styles.label, { color }]}>{item.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    paddingTop: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  label: {
    ...Typography.small,
    textAlign: 'center',
  },
});
```

- [ ] **Step 3: Scrivi `src/components/Sidebar.tsx`**

```tsx
import { Feather } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NAV_ITEMS } from '../lib/navigation';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

export const SIDEBAR_WIDTH = 220;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {NAV_ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const color = active ? Colors.accent : Colors.ink;
        return (
          <Link key={item.key} href={item.href} asChild>
            <Pressable style={[styles.item, active && styles.itemActive]}>
              <Feather name={item.icon} size={18} color={color} />
              <Text style={[styles.label, { color }]}>{item.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.hairline,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.sm,
  },
  itemActive: {
    backgroundColor: Colors.canvas,
  },
  label: {
    ...Typography.bodyBold,
  },
});
```

- [ ] **Step 4: Verifica**

Run: `npx tsc --noEmit` (nessuna rotta toccata — questi componenti non sono ancora referenziati da alcun file sotto `src/app/`).
Expected: pulito.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation.ts src/components/BottomTabBar.tsx src/components/Sidebar.tsx
git commit -m "feat: add navigation data, bottom tab bar, and sidebar components"
```

---

### Task 5: AppShell responsivo — sostituisce il navigatore `<Tabs>`

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `isWideLayout` da `src/lib/layout.ts` (Task 1); `Colors`, `Spacing` da `src/lib/theme.ts` (Task 1); `BottomTabBar`, `Sidebar` da `src/components/` (Task 4)
- Produces: `AppShell` — ultimo task del piano, nessuna interfaccia consumata da task successivi (i Blocchi B/C leggeranno solo i componenti dei Task 3/4)

- [ ] **Step 1: Scrivi `src/components/AppShell.tsx`**

```tsx
import { Slot } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar } from './BottomTabBar';
import { Sidebar } from './Sidebar';
import { isWideLayout } from '../lib/layout';
import { Colors, Spacing } from '../lib/theme';

const MAX_CONTENT_WIDTH = 1000;

export function AppShell() {
  const { width } = useWindowDimensions();

  if (isWideLayout(width)) {
    return (
      <View style={styles.row}>
        <Sidebar />
        <View style={styles.wideContent}>
          <View style={styles.wideContentInner}>
            <Slot />
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.column} edges={['top']}>
      <View style={styles.mobileContent}>
        <Slot />
      </View>
      <BottomTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: Colors.canvas },
  column: { flex: 1, backgroundColor: Colors.canvas },
  wideContent: { flex: 1, alignItems: 'center' },
  wideContentInner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, padding: Spacing.xl },
  mobileContent: { flex: 1, padding: Spacing.lg },
});
```

- [ ] **Step 2: Sostituisci `src/app/(tabs)/_layout.tsx`**

Contenuto completo del file dopo la modifica (sostituisce interamente l'uso di `<Tabs>`):

```tsx
import { AppShell } from '../../components/AppShell';

export default function TabsLayout() {
  return <AppShell />;
}
```

Nota esplicita per il reviewer: questa sostituzione rimuove l'header nativo che `<Tabs>` poteva mostrare per ciascuna schermata — non è una perdita di contenuto, perché ogni schermata delle 5 tab renderizza già il proprio titolo nel corpo (es. `<Text style={styles.title}>Spese</Text>` in `spese.tsx`), non tramite `Tabs.Screen options={{title}}`. Il testo dei titoli in-schermata resta invariato fino al Blocco B, che li sostituirà con `<PageHeader>`.

- [ ] **Step 3: Verifica (sequenza anti-stale-router-types — questo task tocca `src/app/(tabs)/_layout.tsx`)**

```bash
npx expo start --web --port 8099 &
# attendi "Waiting on http://..." nel log, poi:
curl -s -o /dev/null http://localhost:8099/
# attendi qualche secondo, poi:
npx tsc --noEmit
# poi killa il server:
netstat -ano | grep :8099
taskkill //F //PID <pid-trovato>
```

Expected: `tsc` pulito, nessun errore di bundling in log.

- [ ] **Step 4: Verifica manuale (lettura del codice, nessun browser disponibile in questo ambiente)**

Conferma che:
- I 5 `href` in `NAV_ITEMS` (`/`, `/pagamenti`, `/spese`, `/note`, `/impostazioni`) corrispondano esattamente ai 5 file esistenti in `src/app/(tabs)/` (`index.tsx`, `pagamenti.tsx`, `spese.tsx`, `note.tsx`, `impostazioni.tsx`).
- La logica "attivo" in `BottomTabBar`/`Sidebar` tratti `/` con uguaglianza esatta e le altre voci con `startsWith` (altrimenti `/` risulterebbe sempre "attivo" anche su `/pagamenti`, che inizia per `/`... in realtà non è un problema qui perché `/pagamenti` non inizia per la stringa `/` seguita da fine stringa, ma verificare comunque che nessun `href` sia prefisso di un altro: `/note` non è prefisso di `/pagamenti` ecc. — nessuna collisione con le 5 route attuali).
- `AppShell` non venga usato al di fuori del gruppo `(tabs)` — `login.tsx`/`signup.tsx`/`join-household.tsx` restano invariati, fuori da questo layout.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx "src/app/(tabs)/_layout.tsx"
git commit -m "feat: replace Tabs navigator with responsive AppShell (bottom tab bar / sidebar)"
```

---

## Al termine di questo piano

Deliverable funzionante e verificabile: l'app compila (`tsc --noEmit` pulito), tutte le route esistenti restano navigabili, e sotto 820px di larghezza mostra la tab bar in basso mentre da 820px in su mostra la sidebar laterale — entrambe con i token di palette/tipografia/icone della spec. Il contenuto interno delle 24 schermate resta quello preesistente (stile inline non ancora aggiornato): la ristilizzazione arriva nei piani dei Blocchi B (tab principali + auth) e C (form/dettagli), che consumeranno `Button`/`Card`/`Badge`/`TextField`/`IconButton`/`PageHeader` costruiti qui invece di reinventarli schermata per schermata.

## Self-Review (fatto durante la scrittura del piano)

- **Copertura spec:** §3 (palette) → Task 1. §4 (tipografia/Inter) → Task 1 + Task 2. §5 (bottoni con rilievo, Card/Badge/TextField/IconButton/PageHeader) → Task 3. §6 (layout responsivo, breakpoint, icone) → Task 1 (breakpoint) + Task 4 (nav data + componenti) + Task 5 (AppShell, sostituzione `<Tabs>`). §7 (struttura file) → rispettata in ogni task (`src/lib/`, `src/components/`). Nessun requisito delle sezioni 3-8 rimasto scoperto per lo scope del Blocco A (dark mode/i18n sono esplicitamente esclusi, non requisiti da coprire).
- **Niente placeholder:** ogni step ha codice completo, nessun TODO/TBD.
- **Coerenza dei tipi tra task:** `Colors`/`Typography`/`Spacing`/`Radii` (Task 1) → stessi nomi importati identici in Task 2/3/4/5. `isWideLayout`/`TABLET_BREAKPOINT` (Task 1) → usati in `AppShell.tsx` (Task 5) con lo stesso nome. `NavItem`/`NAV_ITEMS` (Task 4) → stessa forma consumata da `BottomTabBar.tsx` e `Sidebar.tsx` (entrambi nel Task 4 stesso). `Fonts.regular`/`Fonts.medium`/`Fonts.semiBold` (Task 1, valori `'Inter_400Regular'`/`'Inter_500Medium'`/`'Inter_600SemiBold'`) → stesse chiavi esatte passate a `useFonts` in Task 2. Verificato manualmente, nessuna discrepanza.

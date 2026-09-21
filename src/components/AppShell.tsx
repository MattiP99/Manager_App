import { Slot } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomTabBar } from './BottomTabBar';
import { Sidebar } from './Sidebar';
import { isWideLayout } from '../lib/layout';
import { Colors } from '../lib/theme';

const MAX_CONTENT_WIDTH = 1000;

const RequestFullWidthContext = createContext<((fullWidth: boolean) => void) | null>(null);

/** Lets the one screen that calls it opt out of AppShell's centered max-width column on wide/web layouts (e.g. a calendar that wants the full viewport), without affecting any other screen — mobile ignores it, the cap there never applies anyway. */
export function useFullWidthContent() {
  const setFullWidth = useContext(RequestFullWidthContext);
  useEffect(() => {
    setFullWidth?.(true);
    return () => setFullWidth?.(false);
  }, [setFullWidth]);
}

export function AppShell() {
  const { width } = useWindowDimensions();
  const [fullWidth, setFullWidth] = useState(false);

  if (isWideLayout(width)) {
    return (
      <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
        <SafeAreaView style={styles.row} edges={['top', 'left', 'right', 'bottom']}>
          <Sidebar />
          <View style={styles.wideContent}>
            <View style={[styles.wideContentInner, fullWidth && styles.wideContentInnerFull]}>
              <RequestFullWidthContext.Provider value={setFullWidth}>
                <Slot />
              </RequestFullWidthContext.Provider>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <SafeAreaView style={styles.column} edges={['top']}>
        <View style={styles.mobileContent}>
          <Slot />
        </View>
        <BottomTabBar />
      </SafeAreaView>
    </LinearGradient>
  );
}

// Sfondo condiviso da ogni schermata dell'app (qui e nelle 3 schermate
// fuori da AppShell che impostavano Colors.canvas da sole — vedi
// day/[date].tsx, family-day/[date].tsx, payment-detail.tsx): stesso
// gradiente ovunque, un'unica fonte di verità per i due colori. Il beige
// (canvas) è ripetuto come primo E secondo stop per restare "pieno" fino
// al 65% prima di sfumare verso l'azzurro — un gradiente 2-stop semplice
// darebbe già metà azzurro a metà altezza, più di quanto chiesto.
export const GRADIENT_COLORS = [Colors.canvas, Colors.canvas, Colors.accent] as const;
export const GRADIENT_LOCATIONS = [0, 0.65, 1] as const;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
  wideContent: { flex: 1, alignItems: 'center' },
  wideContentInner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  wideContentInnerFull: { maxWidth: undefined },
  mobileContent: { flex: 1 },
});

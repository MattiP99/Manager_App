import { Slot } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  wideContentInner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH },
  wideContentInnerFull: { maxWidth: undefined },
  mobileContent: { flex: 1 },
});

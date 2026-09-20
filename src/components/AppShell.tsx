import { Slot } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar } from './BottomTabBar';
import { Sidebar } from './Sidebar';
import { isWideLayout } from '../lib/layout';
import { Colors } from '../lib/theme';

const MAX_CONTENT_WIDTH = 1000;

export function AppShell() {
  const { width } = useWindowDimensions();

  if (isWideLayout(width)) {
    return (
      <SafeAreaView style={styles.row} edges={['top', 'left', 'right', 'bottom']}>
        <Sidebar />
        <View style={styles.wideContent}>
          <View style={styles.wideContentInner}>
            <Slot />
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
  mobileContent: { flex: 1 },
});

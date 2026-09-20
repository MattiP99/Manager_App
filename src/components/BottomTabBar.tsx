import { Feather } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isNavItemActive, NAV_ITEMS } from '../lib/navigation';
import { Colors, Spacing, Typography } from '../lib/theme';

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const iconColor = active ? Colors.accent : Colors.inkMuted;
        const labelColor = active ? Colors.ink : Colors.inkMuted;
        return (
          <Link key={item.key} href={item.href} asChild>
            <Pressable
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Feather name={item.icon} size={20} color={iconColor} />
              <Text style={[styles.label, { color: labelColor }]}>{item.label}</Text>
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

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

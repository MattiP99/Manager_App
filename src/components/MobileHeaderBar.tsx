import { View, StyleSheet } from 'react-native';
import { Logo } from './Logo';
import { Colors, Spacing } from '../lib/theme';

/** Barra superiore mobile con il logo — la sidebar (web ampio) e questa (mobile/web stretto) sono le due sole controparti che mostrano il logo, stesso principio della BottomTabBar/Sidebar già separate per piattaforma. */
export function MobileHeaderBar() {
  return (
    <View style={styles.container}>
      <Logo size={32} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
});

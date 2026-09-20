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

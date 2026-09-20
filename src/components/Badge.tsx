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

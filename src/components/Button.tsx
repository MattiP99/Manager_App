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

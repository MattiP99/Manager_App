import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { Colors, Radii } from '../lib/theme';

interface IconButtonProps {
  name: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

export function IconButton({
  name,
  onPress,
  size = 20,
  color = Colors.ink,
  accessibilityLabel,
}: IconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
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

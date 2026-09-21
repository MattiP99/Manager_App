import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Colors, Radii, Spacing } from '../lib/theme';

interface PressableCardProps {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Card a piena larghezza con bordo che diventa color accento su hover (web) o pressione (mobile) — generalizza il pattern dei toggle Giorno/Settimana/Mese del Calendario (Piano 2) in un guscio riusabile per qualunque riga interattiva. */
export function PressableCard({ onPress, children, style }: PressableCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.card, (hovered || pressed) && styles.cardHighlighted, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHighlighted: { borderColor: Colors.accent },
});

import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from './IconButton';
import { Colors, Radii, Spacing } from '../lib/theme';

interface DetailModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Override dello stile di default (larghezza max 420) — usato per finestre più grandi, es. il dettaglio di una sezione note. */
  contentStyle?: StyleProp<ViewStyle>;
}

export function DetailModal({ visible, onClose, children, contentStyle }: DetailModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, contentStyle]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.closeRow}>
            <IconButton name="x" onPress={onClose} accessibilityLabel="Chiudi" />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(50, 50, 50, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  closeRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.xs,
  },
});

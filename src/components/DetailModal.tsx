import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from './IconButton';
import { isWideLayout } from '../lib/layout';
import { Colors, Radii, Spacing } from '../lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SIDE_SLIDE_DURATION_MS = 320;

interface DetailModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Override dello stile di default (larghezza max 420) — usato per finestre più grandi, es. il dettaglio di una sezione note. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * 'center' (default): card centrata, dissolvenza.
   * 'sheet': foglio che sale dal bordo inferiore (animationType="slide"), fino
   * all'80% dell'altezza schermo — la pagina sottostante resta intravista
   * sopra, oltre lo sfondo scurito. Per form lunghi (aggiungi/modifica nota).
   * 'side': pannello laterale ancorato a destra (scorrimento orizzontale
   * animato con Animated — nessuna libreria di animazione in questo
   * progetto), metà altezza schermo su mobile/web stretto, piena altezza su
   * web ampio. Per azioni aperte da dentro un altro DetailModal già aperto
   * (es. aggiungi giornata/pagamento dal dettaglio di un cliente).
   */
  variant?: 'center' | 'sheet' | 'side';
}

export function DetailModal({ visible, onClose, children, contentStyle, variant = 'center' }: DetailModalProps) {
  const { height, width } = useWindowDimensions();
  // Su web ampio i pannelli non-centrati non si estendono più a bordo-bordo
  // del browser (comprensibile su un telefono, eccessivo su una finestra
  // larga) — restano pieno schermo solo su mobile/web stretto.
  const isWideWeb = variant !== 'center' && Platform.OS === 'web' && isWideLayout(width);

  // Il pannello laterale ha un vero scorrimento orizzontale (translateX),
  // non la semplice dissolvenza di Modal — quella da sola non mostra alcun
  // movimento percepibile. Modal smonta immediatamente quando `visible`
  // diventa false, senza aspettare un'animazione di uscita: si tiene il
  // contenuto montato un istante in più (`mounted`) per poter far scorrere
  // il pannello fuori dallo schermo prima di rimuoverlo davvero.
  const [mounted, setMounted] = useState(false);
  const slideX = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    if (variant !== 'side') return;
    if (visible) {
      setMounted(true);
      slideX.setValue(width);
      Animated.timing(slideX, { toValue: 0, duration: SIDE_SLIDE_DURATION_MS, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(slideX, { toValue: width, duration: SIDE_SLIDE_DURATION_MS, useNativeDriver: true }).start(() =>
        setMounted(false)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `mounted`/`slideX` intenzionalmente esclusi: rientrare per un loro cambiamento farebbe ripartire l'animazione da capo.
  }, [visible, variant, width]);

  const isOpen = variant === 'side' ? mounted : visible;

  return (
    <Modal visible={isOpen} transparent animationType={variant === 'sheet' ? 'slide' : 'fade'} onRequestClose={onClose}>
      <Pressable
        style={[
          styles.backdrop,
          variant === 'sheet' && styles.backdropSheet,
          variant === 'side' && styles.backdropSide,
        ]}
        onPress={onClose}
      >
        <AnimatedPressable
          style={[
            styles.card,
            variant === 'sheet' && [styles.cardSheet, { height: height * 0.8 }, isWideWeb && styles.cardSheetWideWeb],
            variant === 'side' && [
              styles.cardSide,
              !isWideWeb && styles.cardSideMobile,
              isWideWeb && styles.cardSideWideWeb,
              { transform: [{ translateX: slideX }] },
            ],
            contentStyle,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.closeRow}>
            <IconButton name="x" onPress={onClose} accessibilityLabel="Chiudi" />
          </View>
          {children}
        </AnimatedPressable>
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
  // Ancorato in basso invece che centrato, nessun padding attorno: il
  // foglio tocca i bordi laterali e il fondo dello schermo.
  backdropSheet: { justifyContent: 'flex-end', padding: 0 },
  // Ancorato a destra invece che centrato, nessun padding attorno.
  backdropSide: { alignItems: 'flex-end', padding: 0 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  // Angoli inferiori squadrati (il foglio tocca il fondo schermo) e nessun
  // limite di larghezza (pieno schermo in orizzontale) — solo quelli
  // superiori restano arrotondati.
  cardSheet: {
    maxWidth: undefined,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  // Doppio del modale standard (420 → 840), centrato — resta ancorato al
  // fondo schermo come su mobile, solo più stretto della finestra intera.
  cardSheetWideWeb: {
    maxWidth: 840,
  },
  // Pannello laterale: 80% larghezza (si intravede il bordo sinistro dello
  // sfondo scurito, stesso principio del foglio dal basso), angoli destri
  // squadrati (tocca il bordo destro dello schermo). L'altezza di default
  // (100%, web ampio) resta piena — dimezzata sotto per mobile/web stretto.
  cardSide: {
    width: '80%',
    maxWidth: undefined,
    height: '100%',
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  // Dimezzata su richiesta esplicita — resta centrata verticalmente
  // (justifyContent:'center' ereditato da backdrop).
  cardSideMobile: {
    height: '50%',
  },
  cardSideWideWeb: {
    maxWidth: 480,
  },
  closeRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.xs,
  },
});

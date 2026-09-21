import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Platform, useWindowDimensions } from 'react-native';
import { useNoteSections } from '../../features/notes/useNoteSections';
import { NoteSectionDetail } from '../../features/notes/NoteSectionDetail';
import { AddNoteSectionForm } from '../../features/notes/AddNoteSectionForm';
import { PressableCard } from '../../components/PressableCard';
import { DetailModal } from '../../components/DetailModal';
import { isWideLayout } from '../../lib/layout';
import { Colors, Fonts, Radii, Spacing, Typography } from '../../lib/theme';

export default function NoteScreen() {
  const { data: sections } = useNoteSections();
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === 'web' && isWideLayout(width);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Note</Text>

      <View style={styles.addRow}>
        <Pressable style={styles.addButton} onPress={() => setAddingSection(true)}>
          <Text style={styles.addButtonText}>+ Sezione</Text>
        </Pressable>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        data={sections ?? []}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <PressableCard onPress={() => setOpenSectionId(item.id)}>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {item.type === 'password' && <Text style={styles.lockIcon}>🔒</Text>}
            </View>
          </PressableCard>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nessuna sezione ancora.</Text>}
      />

      <DetailModal
        visible={!!openSectionId}
        onClose={() => setOpenSectionId(null)}
        contentStyle={{ width: isWideWeb ? '40%' : '80%', maxWidth: undefined }}
      >
        {openSectionId && <NoteSectionDetail sectionId={openSectionId} onClose={() => setOpenSectionId(null)} />}
      </DetailModal>

      <DetailModal visible={addingSection} onClose={() => setAddingSection(false)}>
        <AddNoteSectionForm onSaved={() => setAddingSection(false)} />
      </DetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  // Bianco, centrato, più grande, non grassetto — sopra il gradiente
  // canvas→accento di AppShell, stesso stile di Calendario/Pagamenti/Spese.
  title: { fontFamily: Fonts.regular, fontSize: 32, lineHeight: 38, color: Colors.surface, textAlign: 'center' },
  addRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  addButton: { backgroundColor: Colors.accent, borderRadius: Radii.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  addButtonText: { ...Typography.bodyBold, color: Colors.ink },
  list: { gap: Spacing.sm, paddingBottom: Spacing.xl },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Sottotitoli delle sezioni: chiaramente più grandi del corpo del testo
  // standard (Typography.body è 15) ma sotto il titolo di pagina (32).
  rowTitle: { fontFamily: Fonts.semiBold, fontSize: 20, lineHeight: 26, color: Colors.ink },
  lockIcon: { fontSize: 18 },
  empty: { ...Typography.body, color: Colors.inkMuted },
});

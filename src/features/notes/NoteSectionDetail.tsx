import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useNoteSections, useConfigurePasswordSection } from './useNoteSections';
import { useNotesBySection } from './useNotes';
import { setupPasswordSection, unlockPasswordSection, decryptText, loadVerifiedKey } from './crypto/aesNotes';
import { storeKey } from './crypto/secureKeyStore';
import { AddNoteForm } from './AddNoteForm';
import { EditNoteForm } from './EditNoteForm';
import { DetailModal } from '../../components/DetailModal';
import { formatDayLabel } from '../calendar/calendarGrid';
import { toLocalDateString } from '../../lib/dates';
import { truncateWords } from '../../lib/text';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

const CONTENT_PREVIEW_WORDS = 8;

interface NoteSectionDetailProps {
  sectionId: string;
  onClose: () => void;
}

/** Contenuto del modale "Sezione note" — guscio (DetailModal, chiamato da note.tsx) e contenuto separati, stesso principio già usato per AddExpenseForm/EditExpenseForm. Sostituisce l'ex pagina a tutto schermo note-section/[id].tsx. */
export function NoteSectionDetail({ sectionId, onClose }: NoteSectionDetailProps) {
  const { data: sections } = useNoteSections();
  const section = sections?.find((s) => s.id === sectionId);
  const { data: notes } = useNotesBySection(sectionId);
  const configurePasswordSection = useConfigurePasswordSection();
  const { height } = useWindowDimensions();

  const [key, setKey] = useState<Uint8Array | null>(null);
  const [checkedStoredKey, setCheckedStoredKey] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const [decryptErrorIds, setDecryptErrorIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const isPasswordSection = section?.type === 'password';

  useEffect(() => {
    if (!isPasswordSection || !section) return;
    loadVerifiedKey(section).then((verified) => {
      setKey(verified);
      setCheckedStoredKey(true);
    });
  }, [isPasswordSection, section?.id, section?.encryption_canary]);

  useEffect(() => {
    if (!key || !notes) return;
    let cancelled = false;
    Promise.all(
      notes.map(async (n) => {
        if (!n.content_encrypted) return [n.id, '', false] as const;
        try {
          const plain = await decryptText(n.content_encrypted, key);
          return [n.id, plain, false] as const;
        } catch {
          return [n.id, '(errore di decifratura)', true] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setDecryptedContent(Object.fromEntries(entries.map(([id, text]) => [id, text])));
      setDecryptErrorIds(new Set(entries.filter(([, , failed]) => failed).map(([id]) => id)));
    });
    return () => {
      cancelled = true;
    };
  }, [key, notes]);

  if (!sections) return <Text style={styles.padded}>Caricamento...</Text>;
  if (!section) return <Text style={styles.padded}>Sezione non trovata.</Text>;

  const handleSubmitPassphrase = async () => {
    setUnlockError(null);
    if (!passphrase.trim()) return;
    setIsSubmitting(true);
    try {
      if (!section.encryption_salt || !section.encryption_canary) {
        const setup = await setupPasswordSection(passphrase);
        await configurePasswordSection.mutateAsync({
          sectionId: section.id,
          saltHex: setup.saltHex,
          canaryBase64: setup.canaryBase64,
        });
        await storeKey(setup.keyBytes);
        setKey(setup.keyBytes);
        return;
      }

      const unlockedKey = await unlockPasswordSection(passphrase, section.encryption_salt, section.encryption_canary);
      if (!unlockedKey) {
        setUnlockError('Passphrase errata.');
        return;
      }
      await storeKey(unlockedKey);
      setKey(unlockedKey);
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Si è verificato un errore. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const locked = isPasswordSection && checkedStoredKey && !key;
  const editingNote = notes?.find((n) => n.id === editingNoteId) ?? null;

  return (
    <ScrollView style={{ maxHeight: height * 0.6 }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{section.title}</Text>

      {locked && (
        <View style={styles.unlockBox}>
          <Text style={styles.unlockLabel}>
            {section.encryption_salt
              ? 'Inserisci la passphrase per sbloccare questa sezione'
              : 'Imposta una passphrase per proteggere questa sezione (condivisa con tutta la famiglia — se si perde, le note non sono più recuperabili)'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Passphrase"
            secureTextEntry
            value={passphrase}
            onChangeText={setPassphrase}
            editable={!isSubmitting}
          />
          {unlockError && <Text style={styles.error}>{unlockError}</Text>}
          <Pressable style={styles.button} onPress={handleSubmitPassphrase} disabled={isSubmitting}>
            <Text style={styles.buttonText}>
              {isSubmitting ? 'Verifica in corso...' : section.encryption_salt ? 'Sblocca' : 'Imposta passphrase'}
            </Text>
          </Pressable>
        </View>
      )}

      {(!isPasswordSection || key) && (
        <>
          <Pressable style={styles.addButton} onPress={() => setAddingNote(true)}>
            <Text style={styles.addButtonText}>+ Nota</Text>
          </Pressable>

          {(notes ?? []).length === 0 && <Text style={styles.empty}>Nessuna nota ancora.</Text>}
          {(notes ?? []).map((item) => {
            const fullContent = isPasswordSection ? decryptedContent[item.id] ?? '...' : item.content ?? '';
            return (
              <Pressable key={item.id} style={styles.row} onPress={() => setEditingNoteId(item.id)}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowDate}>{formatDayLabel(toLocalDateString(new Date(item.created_at)))}</Text>
                </View>
                <Text style={styles.rowPreview} numberOfLines={1}>
                  {truncateWords(fullContent, CONTENT_PREVIEW_WORDS)}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}

      <DetailModal visible={addingNote} onClose={() => setAddingNote(false)} variant="sheet">
        <AddNoteForm section={section} encryptionKey={key} onSaved={() => setAddingNote(false)} />
      </DetailModal>

      <DetailModal visible={!!editingNote} onClose={() => setEditingNoteId(null)} variant="sheet">
        {editingNote && (
          <EditNoteForm
            section={section}
            note={editingNote}
            initialContent={isPasswordSection ? decryptedContent[editingNote.id] ?? '' : editingNote.content ?? ''}
            decryptError={decryptErrorIds.has(editingNote.id)}
            encryptionKey={key}
            onSaved={() => setEditingNoteId(null)}
          />
        )}
      </DetailModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  padded: { padding: Spacing.md, ...Typography.body, color: Colors.ink },
  title: { ...Typography.title, color: Colors.ink },
  unlockBox: { gap: Spacing.sm, backgroundColor: Colors.canvas, borderRadius: Radii.md, padding: Spacing.md },
  unlockLabel: { ...Typography.body, color: Colors.ink },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    ...Typography.body,
    color: Colors.ink,
  },
  error: { ...Typography.body, color: Colors.error },
  button: { backgroundColor: Colors.accent, borderRadius: Radii.sm, padding: Spacing.md, alignItems: 'center' },
  buttonText: { ...Typography.bodyBold, color: Colors.ink },
  addButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
  },
  addButtonText: { ...Typography.bodyBold, color: Colors.ink },
  row: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.hairline, gap: Spacing.xs / 2 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  rowTitle: { ...Typography.bodyBold, color: Colors.ink, flexShrink: 1 },
  rowDate: { ...Typography.caption, color: Colors.inkMuted },
  rowPreview: { ...Typography.small, color: Colors.inkMuted },
  empty: { ...Typography.body, color: Colors.inkMuted },
});

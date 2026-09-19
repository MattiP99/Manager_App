import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNoteSections, useConfigurePasswordSection } from '../../features/notes/useNoteSections';
import { useNotesBySection } from '../../features/notes/useNotes';
import { setupPasswordSection, unlockPasswordSection, decryptText, loadVerifiedKey } from '../../features/notes/crypto/aesNotes';
import { storeKey } from '../../features/notes/crypto/secureKeyStore';

export default function NoteSectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: sections } = useNoteSections();
  const section = sections?.find((s) => s.id === id);
  const { data: notes } = useNotesBySection(id);
  const configurePasswordSection = useConfigurePasswordSection();

  const [key, setKey] = useState<Uint8Array | null>(null);
  const [checkedStoredKey, setCheckedStoredKey] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordSection = section?.type === 'password';

  // Al montaggio, se è la sezione Password, prova a leggere una chiave già
  // cachata localmente (sblocco persistente tra riavvii) prima di chiedere
  // la passphrase.
  useEffect(() => {
    if (!isPasswordSection || !section) return;
    loadVerifiedKey(section).then((verified) => {
      setKey(verified);
      setCheckedStoredKey(true);
    });
  }, [isPasswordSection, section?.id, section?.encryption_canary]);

  // Quando la chiave è disponibile, decifra tutte le note della sezione
  // Password per mostrarle in chiaro.
  useEffect(() => {
    if (!key || !notes) return;
    let cancelled = false;
    Promise.all(
      notes.map(async (n) => {
        if (!n.content_encrypted) return [n.id, ''] as const;
        try {
          const plain = await decryptText(n.content_encrypted, key);
          return [n.id, plain] as const;
        } catch {
          return [n.id, '(errore di decifratura)'] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setDecryptedContent(Object.fromEntries(entries));
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

    // PBKDF2 (dentro setupPasswordSection/unlockPasswordSection) esegue
    // 210.000 iterazioni sincrone e blocca visibilmente la UI per 1-3s su
    // un Android di fascia media: lo stato "in corso" va committato PRIMA
    // dell'await, altrimenti l'utente vede uno schermo che sembra bloccato
    // senza alcun feedback durante il freeze.
    setIsSubmitting(true);
    try {
      if (!section.encryption_salt || !section.encryption_canary) {
        // Prima configurazione in assoluto per questo household.
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

  return (
    <View style={styles.container}>
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
          <Pressable
            style={styles.addButton}
            onPress={() => router.push({ pathname: '/add-note', params: { sectionId: section.id } })}
          >
            <Text style={styles.addButtonText}>+ Nota</Text>
          </Pressable>
          <FlatList
            style={{ flex: 1 }}
            data={notes ?? []}
            keyExtractor={(n) => n.id}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => router.push({ pathname: '/edit-note', params: { id: item.id, sectionId: section.id } })}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text numberOfLines={1}>{isPasswordSection ? decryptedContent[item.id] ?? '...' : item.content}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text>Nessuna nota ancora.</Text>}
          />
        </>
      )}

      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Indietro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  padded: { padding: 24 },
  title: { fontSize: 22, fontWeight: '600' },
  unlockBox: { gap: 8, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 16 },
  unlockLabel: { fontSize: 14 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, backgroundColor: 'white' },
  error: { color: '#dc2626' },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  addButton: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  addButtonText: { color: 'white', fontWeight: '600' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 2 },
  rowTitle: { fontWeight: '600' },
  cancel: { textAlign: 'center', marginTop: 8 },
});

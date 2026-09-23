import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useSession } from '../features/auth/useSession';
import { useNoteSections, useFetchRecoveryKey, useResetPassphraseWrap } from '../features/notes/useNoteSections';
import { wrapKeyWithPassphrase, unlockWithRecoveryKey } from '../features/notes/crypto/aesNotes';
import { storeKey } from '../features/notes/crypto/secureKeyStore';
import { extractSessionTokensFromUrl, isRecoveryToken } from '../features/notes/passwordRecoveryLink';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../components/AppShell';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { Logo } from '../components/Logo';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

type Phase = 'checking' | 'invalid' | 'unlocking' | 'ready' | 'submitting' | 'success' | 'error';

/** Route aperta dal link di recupero passphrase inviato via email (ForgotPassphrase.tsx → resetPasswordForEmail). Sul web la sessione è già stabilita da `detectSessionInUrl` (src/lib/supabase.ts) prima ancora che questo componente monti; su nativo serve estrarre i token dal fragment dell'URL che ha aperto l'app e chiamare setSession a mano (nessun `detectSessionInUrl` lì, vedi passwordRecoveryLink.ts). In entrambi i casi si verifica poi che la sessione risultante sia DAVVERO di recupero (claim amr contiene "otp", vedi migrazione 0014) prima di leggere la DEK dal deposito di recupero — mai fidarsi di essere arrivati su questa route come prova sufficiente. */
export default function RecuperoPasswordScreen() {
  const { session, isLoading: sessionLoading } = useSession();
  const linkingUrl = Linking.useLinkingURL();
  const { data: sections } = useNoteSections();
  const fetchRecoveryKey = useFetchRecoveryKey();
  const resetPassphraseWrap = useResetPassphraseWrap();

  const [phase, setPhase] = useState<Phase>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [dekBytes, setDekBytes] = useState<Uint8Array | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPassphraseConfirm, setShowPassphraseConfirm] = useState(false);

  const passwordSection = sections?.find((s) => s.type === 'password');

  // Solo su nativo: il web stabilisce già la sessione da solo via detectSessionInUrl.
  useEffect(() => {
    if (Platform.OS === 'web' || !linkingUrl) return;
    const tokens = extractSessionTokensFromUrl(linkingUrl);
    if (!tokens) return;
    supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  }, [linkingUrl]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setPhase('invalid');
      return;
    }
    if (!isRecoveryToken(session.access_token)) {
      setPhase('invalid');
      return;
    }
    if (!passwordSection) return; // in attesa che note-sections carichi
    if (!passwordSection.encryption_canary) {
      setErrorMessage('La sezione Password non è ancora stata configurata: non c\'è nulla da recuperare.');
      setPhase('invalid');
      return;
    }

    setPhase('unlocking');
    fetchRecoveryKey.mutateAsync({ sectionId: passwordSection.id }).then(async (recoveryKeyHex) => {
      if (!recoveryKeyHex) {
        setErrorMessage('Nessuna chiave di recupero trovata per questa sezione.');
        setPhase('invalid');
        return;
      }
      const dek = await unlockWithRecoveryKey(recoveryKeyHex, passwordSection.encryption_canary!);
      if (!dek) {
        setErrorMessage('La chiave di recupero non è valida.');
        setPhase('invalid');
        return;
      }
      setDekBytes(dek);
      setPhase('ready');
    }).catch(() => {
      setErrorMessage('Errore nel recupero della chiave. Riprova più tardi.');
      setPhase('invalid');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, session?.access_token, passwordSection?.id]);

  const handleSubmit = async () => {
    if (!dekBytes || !passwordSection) return;
    if (!passphrase.trim()) return;
    if (passphrase !== passphraseConfirm) {
      setErrorMessage('Le due passphrase non coincidono.');
      return;
    }
    setPhase('submitting');
    try {
      const { saltHex, wrappedKeyBase64 } = await wrapKeyWithPassphrase(passphrase, dekBytes);
      await resetPassphraseWrap.mutateAsync({ sectionId: passwordSection.id, saltHex, wrappedKeyBase64 });
      await storeKey(dekBytes);
      setPhase('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Si è verificato un errore. Riprova.');
      setPhase('ready');
    }
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Logo size={64} />
        <Card style={styles.card}>
          <Text style={styles.title}>Recupera passphrase</Text>

          {(phase === 'checking' || phase === 'unlocking') && (
            <Text style={styles.info}>Verifica del link in corso...</Text>
          )}

          {phase === 'invalid' && (
            <Text style={styles.error}>
              {errorMessage || 'Questo link di recupero non è valido o è scaduto. Richiedine uno nuovo dalla sezione Password.'}
            </Text>
          )}

          {(phase === 'ready' || phase === 'submitting') && (
            <>
              <Text style={styles.info}>
                Imposta una nuova passphrase per "{passwordSection?.title}". Le note già salvate restano leggibili.
              </Text>
              <View style={styles.fieldWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="Nuova passphrase"
                  secureTextEntry={!showPassphrase}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={passphrase}
                  onChangeText={setPassphrase}
                  editable={phase !== 'submitting'}
                />
                <View style={styles.eyeOverlay}>
                  <IconButton
                    name={showPassphrase ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassphrase((v) => !v)}
                    size={18}
                    color={Colors.accent}
                    accessibilityLabel={showPassphrase ? 'Nascondi passphrase' : 'Mostra passphrase'}
                  />
                </View>
              </View>
              <View style={styles.fieldWrapper}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder="Conferma nuova passphrase"
                  secureTextEntry={!showPassphraseConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={passphraseConfirm}
                  onChangeText={setPassphraseConfirm}
                  onSubmitEditing={handleSubmit}
                  editable={phase !== 'submitting'}
                />
                <View style={styles.eyeOverlay}>
                  <IconButton
                    name={showPassphraseConfirm ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassphraseConfirm((v) => !v)}
                    size={18}
                    color={Colors.accent}
                    accessibilityLabel={showPassphraseConfirm ? 'Nascondi conferma passphrase' : 'Mostra conferma passphrase'}
                  />
                </View>
              </View>
              {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
              <Button
                label={phase === 'submitting' ? 'Salvataggio...' : 'Imposta nuova passphrase'}
                onPress={handleSubmit}
                loading={phase === 'submitting'}
              />
            </>
          )}

          {phase === 'success' && (
            <>
              <Text style={styles.info}>Passphrase reimpostata. Le tue note sono di nuovo accessibili.</Text>
              <Button label="Torna all'app" onPress={() => router.replace('/')} />
            </>
          )}
        </Card>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.lg },
  card: { width: '100%', maxWidth: 420, gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink, textAlign: 'center', marginBottom: Spacing.xs },
  info: { ...Typography.body, color: Colors.ink },
  error: { ...Typography.body, color: Colors.error },
  fieldWrapper: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.surface,
    ...Typography.body,
    color: Colors.ink,
  },
  inputWithIcon: { paddingRight: 44 },
  eyeOverlay: { position: 'absolute', right: Spacing.xs, top: 0, bottom: 0, justifyContent: 'center' },
});

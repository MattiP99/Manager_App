import { useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../auth/useSession';
import { buildRecoveryRedirectUrl } from './passwordRecoveryLink';
import { Colors, Spacing, Typography } from '../../lib/theme';

/** Link "Password dimenticata?" nella sezione Password bloccata — invia l'email di recupero nativa di Supabase Auth (resetPasswordForEmail, nessuna infrastruttura nuova, stesso meccanismo usato per il login). Il link nell'email apre src/app/recupero-password.tsx, dove si imposta una nuova passphrase senza perdere le note già salvate (vedi migrazione 0014 per il deposito di recupero). */
export function ForgotPassphrase() {
  const { session } = useSession();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePress = async () => {
    if (!session?.user.email) return;
    setStatus('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: buildRecoveryRedirectUrl(),
    });
    if (error) {
      // Il mailer integrato di Supabase (nessun SMTP personalizzato
      // configurato) permette solo 2 email/ora — limite basso ma reale,
      // capita facilmente in test ravvicinati. Messaggio specifico invece
      // del generico "riprova", altrimenti sembra un errore permanente.
      setErrorMessage(
        error.code === 'over_email_send_rate_limit'
          ? 'Troppe richieste in poco tempo: il servizio email permette solo 2 invii all’ora. Riprova tra qualche minuto.'
          : 'Invio non riuscito. Riprova.'
      );
      setStatus('error');
      return;
    }
    setStatus('sent');
  };

  if (status === 'sent') {
    return (
      <Text style={styles.info}>
        Controlla la tua email: ti abbiamo mandato un link per reimpostare la passphrase.
      </Text>
    );
  }

  return (
    <>
      <Pressable onPress={handlePress} disabled={status === 'sending'}>
        <Text style={styles.link}>{status === 'sending' ? 'Invio in corso...' : 'Password dimenticata?'}</Text>
      </Pressable>
      {status === 'error' && <Text style={styles.error}>{errorMessage}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  link: { ...Typography.small, color: Colors.accent, textDecorationLine: 'underline', marginTop: Spacing.xs },
  info: { ...Typography.small, color: Colors.ink, marginTop: Spacing.xs },
  error: { ...Typography.small, color: Colors.error },
});

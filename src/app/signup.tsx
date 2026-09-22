import { useState } from 'react';
import { ScrollView, TextInput, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useSignUp } from '../features/auth/useAuth';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../components/AppShell';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const signUp = useSignUp();

  const handleSubmit = () => {
    signUp.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.session) {
            router.replace('/');
          } else {
            setConfirmationSent(true);
          }
        },
      }
    );
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Logo size={64} />
        <Card style={styles.card}>
          <Text style={styles.title}>Crea account</Text>
          {confirmationSent ? (
            <Text style={styles.body}>
              Ti abbiamo inviato un&apos;email di conferma. Apri il link per completare la
              registrazione, poi torna qui e accedi.
            </Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password (min. 6 caratteri)"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {signUp.isError && <Text style={styles.error}>{(signUp.error as Error).message}</Text>}
              <Button
                label={signUp.isPending ? 'Creazione...' : 'Registrati'}
                onPress={handleSubmit}
                disabled={signUp.isPending}
              />
            </>
          )}
          <Link href="/login" style={styles.link}>Hai già un account? Accedi</Link>
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
  body: { ...Typography.body, color: Colors.ink },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  error: { ...Typography.body, color: Colors.error },
  link: { ...Typography.body, color: Colors.ink, textAlign: 'center', marginTop: Spacing.xs, textDecorationLine: 'underline' },
});

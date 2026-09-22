import { useState } from 'react';
import { ScrollView, TextInput, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useSignIn } from '../features/auth/useAuth';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../components/AppShell';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Colors, Radii, Spacing, Typography } from '../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();

  const handleSubmit = () => {
    signIn.mutate(
      { email, password },
      { onSuccess: () => router.replace('/') }
    );
  };

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Logo size={64} />
        <Card style={styles.card}>
          <Text style={styles.title}>Accedi</Text>
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
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {signIn.isError && <Text style={styles.error}>{(signIn.error as Error).message}</Text>}
          <Button
            label={signIn.isPending ? 'Accesso...' : 'Accedi'}
            onPress={handleSubmit}
            disabled={signIn.isPending}
          />
          <Link href="/signup" style={styles.link}>Non hai un account? Registrati</Link>
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

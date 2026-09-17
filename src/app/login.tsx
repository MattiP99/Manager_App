import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useSignIn } from '../features/auth/useAuth';

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
    <View style={styles.container}>
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
      <Pressable style={styles.button} onPress={handleSubmit} disabled={signIn.isPending}>
        <Text style={styles.buttonText}>{signIn.isPending ? 'Accesso...' : 'Accedi'}</Text>
      </Pressable>
      <Link href="/signup">Non hai un account? Registrati</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
});

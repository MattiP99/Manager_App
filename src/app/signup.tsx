import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link, router } from 'expo-router';
import { useSignUp } from '../features/auth/useAuth';

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
    <View style={styles.container}>
      <Text style={styles.title}>Crea account</Text>
      {confirmationSent ? (
        <Text>
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
          <Pressable style={styles.button} onPress={handleSubmit} disabled={signUp.isPending}>
            <Text style={styles.buttonText}>{signUp.isPending ? 'Creazione...' : 'Registrati'}</Text>
          </Pressable>
        </>
      )}
      <Link href="/login">Hai già un account? Accedi</Link>
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

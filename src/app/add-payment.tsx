import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreatePayment } from '../features/payments/usePayments';
import { toLocalDateString } from '../lib/dates';

export default function AddPaymentScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const createPayment = useCreatePayment();

  const handleSubmit = () => {
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    createPayment.mutate(
      { clientId, date, amount: amountNum, note: note.trim() || undefined },
      { onSuccess: () => router.back() }
    );
  };

  if (!clientId) return <Text>Cliente non specificato.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registra pagamento</Text>
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Importo (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {createPayment.isError && <Text style={styles.error}>{(createPayment.error as Error).message}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={createPayment.isPending}>
        <Text style={styles.buttonText}>{createPayment.isPending ? 'Salvataggio...' : 'Salva'}</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.cancel}>Annulla</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: '#dc2626' },
  cancel: { textAlign: 'center', marginTop: 8 },
});

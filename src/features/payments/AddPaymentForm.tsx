import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useCreatePayment } from './usePayments';
import { toLocalDateString } from '../../lib/dates';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddPaymentFormProps {
  clientId: string;
  onSaved: () => void;
}

/** Contenuto del form "Registra pagamento" — guscio (DetailModal, pannello laterale dal dettaglio cliente) e contenuto separato, stesso principio di AddExpenseForm. Sostituisce l'ex pagina a tutto schermo add-payment.tsx (nessun altro chiamante). */
export function AddPaymentForm({ clientId, onSaved }: AddPaymentFormProps) {
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const createPayment = useCreatePayment();

  const handleSubmit = () => {
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;
    createPayment.mutate(
      { clientId, date, amount: amountNum, note: note.trim() || undefined },
      { onSuccess: onSaved }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registra pagamento</Text>
      <TextInput style={styles.input} placeholder="Data (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <TextInput style={styles.input} placeholder="Importo (€)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="Nota (opzionale)" value={note} onChangeText={setNote} />

      {createPayment.isError && <Text style={styles.error}>{(createPayment.error as Error).message}</Text>}
      <Button
        label={createPayment.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createPayment.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: { ...Typography.title, color: Colors.ink },
  input: {
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    ...Typography.body,
    color: Colors.ink,
  },
  error: { ...Typography.body, color: Colors.error },
});

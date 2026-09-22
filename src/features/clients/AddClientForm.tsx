import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useCreateClient } from './useClients';
import { Button } from '../../components/Button';
import { Colors, Radii, Spacing, Typography } from '../../lib/theme';

interface AddClientFormProps {
  onSaved: () => void;
}

/** Contenuto del modale "Nuovo cliente" — guscio (DetailModal, chiamato da impostazioni.tsx) e contenuto separati, stesso principio già usato per AddExpenseForm/AddNoteSectionForm. Sostituisce l'ex pagina a tutto schermo add-client.tsx. */
export function AddClientForm({ onSaved }: AddClientFormProps) {
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const createClient = useCreateClient();

  const handleSubmit = () => {
    const rate = parseFloat(hourlyRate.replace(',', '.'));
    if (!name.trim() || isNaN(rate) || rate <= 0) return;
    createClient.mutate({ name: name.trim(), hourlyRate: rate }, { onSuccess: onSaved });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuovo cliente</Text>
      <TextInput style={styles.input} placeholder="Nome" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Tariffa oraria (€)"
        keyboardType="decimal-pad"
        value={hourlyRate}
        onChangeText={setHourlyRate}
      />
      {createClient.isError && <Text style={styles.error}>{(createClient.error as Error).message}</Text>}
      <Button
        label={createClient.isPending ? 'Salvataggio...' : 'Salva'}
        onPress={handleSubmit}
        disabled={createClient.isPending}
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

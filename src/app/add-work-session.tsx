import { ScrollView, StyleSheet, Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { AddWorkSessionForm } from '../features/work-sessions/AddWorkSessionForm';
import { GRADIENT_COLORS, GRADIENT_LOCATIONS } from '../components/AppShell';
import { Colors, Spacing } from '../lib/theme';

/** Rotta a pagina intera — resta usata dal Calendario (day/[date].tsx, nessun cliente preselezionato). Dal dettaglio cliente in Pagamenti si usa invece AddWorkSessionForm direttamente dentro un pannello laterale, senza questa rotta. */
export default function AddWorkSessionScreen() {
  const { clientId: preselectedClientId, date: preselectedDate } = useLocalSearchParams<{ clientId?: string; date?: string }>();

  return (
    <LinearGradient colors={GRADIENT_COLORS} locations={GRADIENT_LOCATIONS} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.container}>
        <AddWorkSessionForm
          preselectedClientId={preselectedClientId}
          preselectedDate={preselectedDate}
          onSaved={() => router.back()}
        />
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancel}>Annulla</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
  cancel: { textAlign: 'center', marginTop: Spacing.sm, color: Colors.surface },
});

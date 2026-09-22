import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useHousehold } from '../../features/household/useHousehold';
import { useClients } from '../../features/clients/useClients';
import { AddClientForm } from '../../features/clients/AddClientForm';
import { useRecurringTemplates } from '../../features/family-calendar/useRecurringTemplates';
import { AddRecurringTemplateForm } from '../../features/family-calendar/AddRecurringTemplateForm';
import { WEEKDAY_OPTIONS } from '../../features/family-calendar/constants';
import { clearStoredKey } from '../../features/notes/crypto/secureKeyStore';
import { toShortTime } from '../../lib/dates';
import { Card } from '../../components/Card';
import { PressableCard } from '../../components/PressableCard';
import { DetailModal } from '../../components/DetailModal';
import { Button } from '../../components/Button';
import { Colors, Fonts, Radii, Spacing, Typography } from '../../lib/theme';

export default function ImpostazioniScreen() {
  const { data: household, isLoading } = useHousehold();
  const { data: clients } = useClients();
  const { data: recurringTemplates } = useRecurringTemplates();
  const [addingClient, setAddingClient] = useState(false);
  const [addingTemplate, setAddingTemplate] = useState(false);
  const weekdayLabel = (weekday: number) => WEEKDAY_OPTIONS.find((w) => w.value === weekday)?.label ?? '?';

  if (isLoading) return <Text style={styles.padded}>Caricamento...</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impostazioni</Text>

      <Card style={styles.householdCard}>
        <Text style={styles.householdName}>{household?.name}</Text>
        <Text style={styles.inviteLabel}>Codice invito per far entrare un altro membro:</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>{household?.invite_code}</Text>
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Clienti</Text>
        <Pressable style={styles.addButton} onPress={() => setAddingClient(true)}>
          <Text style={styles.addButtonText}>+ Cliente</Text>
        </Pressable>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          data={clients ?? []}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <PressableCard onPress={() => router.push({ pathname: '/edit-client', params: { id: item.id } })}>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{item.name}{!item.active ? ' (disattivo)' : ''}</Text>
                <Text style={styles.rowMeta}>€{item.hourly_rate}/h</Text>
              </View>
            </PressableCard>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nessun cliente ancora.</Text>}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Impegni ricorrenti</Text>
        <Pressable style={styles.addButton} onPress={() => setAddingTemplate(true)}>
          <Text style={styles.addButtonText}>+ Impegno</Text>
        </Pressable>
      </View>
      <View style={styles.listWrapper}>
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          data={recurringTemplates ?? []}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <PressableCard onPress={() => router.push({ pathname: '/edit-recurring-template', params: { id: item.id } })}>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{item.title} — {item.person}</Text>
                <Text style={styles.rowMeta}>
                  {weekdayLabel(item.weekday)}{item.start_time && item.end_time ? ` ${toShortTime(item.start_time)}–${toShortTime(item.end_time)}` : ''}
                </Text>
              </View>
            </PressableCard>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nessun impegno ricorrente ancora.</Text>}
        />
      </View>

      <Button
        label="Esci"
        tone="danger"
        style={styles.logoutButton}
        onPress={async () => {
          await clearStoredKey();
          await supabase.auth.signOut();
        }}
      />

      <DetailModal visible={addingClient} onClose={() => setAddingClient(false)}>
        <AddClientForm onSaved={() => setAddingClient(false)} />
      </DetailModal>

      <DetailModal
        visible={addingTemplate}
        onClose={() => setAddingTemplate(false)}
        contentStyle={styles.wideModal}
      >
        <AddRecurringTemplateForm onSaved={() => setAddingTemplate(false)} />
      </DetailModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md, gap: Spacing.md },
  padded: { padding: Spacing.md, ...Typography.body, color: Colors.ink },
  // Bianco, centrato, più grande, non grassetto — sopra il gradiente
  // canvas→accento di AppShell, stesso stile di Calendario/Pagamenti/Spese/Note.
  title: { fontFamily: Fonts.regular, fontSize: 32, lineHeight: 38, color: Colors.surface, textAlign: 'center' },
  householdCard: { gap: Spacing.xs },
  householdName: { ...Typography.title, color: Colors.ink },
  inviteLabel: { ...Typography.body, color: Colors.inkMuted, marginTop: Spacing.xs },
  codeBox: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  code: { fontFamily: Fonts.semiBold, fontSize: 28, letterSpacing: 4, color: Colors.ink },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.subtitle, color: Colors.surface },
  addButton: { backgroundColor: Colors.accent, borderRadius: Radii.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  addButtonText: { ...Typography.bodyBold, color: Colors.ink },
  listWrapper: { flex: 1 },
  list: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { ...Typography.bodyBold, color: Colors.ink },
  rowMeta: { ...Typography.body, color: Colors.inkMuted },
  empty: { ...Typography.body, color: Colors.inkMuted },
  // Metà larghezza / doppia altezza (paddingVertical raddoppiato rispetto ai
  // 10 di default in Button.tsx) / solo bordo rosso — su richiesta esplicita,
  // sostituisce il vecchio riempimento rosso pieno.
  logoutButton: {
    alignSelf: 'center',
    width: '50%',
    marginTop: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.error,
    paddingVertical: 20,
  },
  // Stesso pattern di note.tsx per il modale sezione: più largo del default
  // 420px, il form ha troppi campi per starci dentro comodamente.
  wideModal: { width: '90%', maxWidth: 560 },
});

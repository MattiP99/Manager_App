import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { FAMILY_CATEGORIES, FAMILY_CATEGORY_COLORS } from './constants';
import type { Occurrence } from './recurringOccurrences';
import { Colors, Spacing, Typography } from '../../lib/theme';

interface FamilyOccurrenceDetailProps {
  occurrence: Occurrence;
}

export function FamilyOccurrenceDetail({ occurrence }: FamilyOccurrenceDetailProps) {
  const categoryLabel = FAMILY_CATEGORIES.find((c) => c.value === occurrence.category)?.label ?? occurrence.category;
  const categoryColor = FAMILY_CATEGORY_COLORS[occurrence.category];

  const handleEdit = () => {
    router.push(
      occurrence.recurringTemplateId
        ? { pathname: '/edit-family-event', params: { recurringTemplateId: occurrence.recurringTemplateId, date: occurrence.date } }
        : { pathname: '/edit-family-event', params: { id: occurrence.id } }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.categoryRow}>
        <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
        <Text style={styles.categoryLabel}>{categoryLabel}</Text>
      </View>
      <Text style={styles.title}>{occurrence.title}</Text>
      <Text style={styles.meta}>{occurrence.person}</Text>
      {occurrence.start_time && occurrence.end_time && (
        <Text style={styles.meta}>{occurrence.start_time}–{occurrence.end_time}</Text>
      )}
      {occurrence.note && <Text style={styles.note}>{occurrence.note}</Text>}
      <Button label="Modifica" onPress={handleEdit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryLabel: { ...Typography.caption, color: Colors.inkMuted },
  title: { ...Typography.title, color: Colors.ink },
  meta: { ...Typography.body, color: Colors.inkMuted },
  note: { ...Typography.body, color: Colors.ink },
});

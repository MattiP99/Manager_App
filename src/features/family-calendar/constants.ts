import type { FamilyCategory } from './recurringOccurrences';
import { Colors } from '../../lib/theme';

export const FAMILY_CATEGORIES: { value: FamilyCategory; label: string }[] = [
  { value: 'mensa', label: 'Mensa' },
  { value: 'palestra', label: 'Palestra' },
  { value: 'cavallo', label: 'Cavallo' },
  { value: 'piscina', label: 'Piscina' },
  { value: 'teatro', label: 'Teatro' },
  { value: 'altro', label: 'Altro' },
];

// Bottoni mostrati in ordine Lun→Dom (coerente con il resto della UI del
// calendario) ma il valore memorizzato è la convenzione Date.getDay()
// nativa (0=Domenica..6=Sabato) usata da recurringOccurrences.ts — vedi
// il Global Constraint sulla convenzione weekday nel piano.
export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
];

export const FAMILY_CATEGORY_COLORS: Record<FamilyCategory, string> = {
  mensa: '#65b5ff',
  palestra: '#0bdf50',
  cavallo: '#ff2067',
  piscina: '#b3e01c',
  teatro: '#03b2cb',
  altro: Colors.inkMuted,
};

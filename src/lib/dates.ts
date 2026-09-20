export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDateString(dateStr);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

export function startOfMonth(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Sposta l'ancora di un mese, sempre al giorno 1 del mese di destinazione — a differenza di shiftAnchorDate (calendarGrid.ts) non serve preservare il giorno del mese: chi chiama questa funzione ne legge solo mese/anno tramite startOfMonth/endOfMonth/monthLabel. */
export function shiftMonth(dateStr: string, direction: 1 | -1): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + direction, 1));
}

export function isValidTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isEndAfterStart(start: string, end: string): boolean {
  return end > start;
}

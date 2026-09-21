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

/** Sposta l'ancora di un mese, sempre al giorno 1 del mese di destinazione — a differenza di shiftAnchorDate (calendarGrid.ts) non serve preservare il giorno del mese: chi chiama questa funzione ne legge solo mese/anno tramite startOfMonth/endOfMonth/periodLabel (computeClientSummary.ts). */
export function shiftMonth(dateStr: string, direction: 1 | -1): string {
  const d = parseLocalDateString(dateStr);
  return toLocalDateString(new Date(d.getFullYear(), d.getMonth() + direction, 1));
}

/** Lunedì della settimana che contiene dateStr — stessa convenzione Monday-first già usata da calendarGrid.ts (getWeekDays), duplicata qui apposta: dates.ts è un livello più basso di calendarGrid.ts e non deve dipenderne. */
export function startOfWeek(dateStr: string): string {
  const d = parseLocalDateString(dateStr);
  const mondayOffset = (d.getDay() + 6) % 7; // 0=Lun..6=Dom
  return addDays(dateStr, -mondayOffset);
}

export function endOfWeek(dateStr: string): string {
  return addDays(startOfWeek(dateStr), 6);
}

/** Sposta l'ancora di una settimana di 7 giorni — a differenza di shiftMonth non serve normalizzare al lunedì: chi chiama questa funzione ricava lunedì/domenica separatamente tramite startOfWeek/endOfWeek. */
export function shiftWeek(dateStr: string, direction: 1 | -1): string {
  return addDays(dateStr, direction * 7);
}

/** Postgres `time` columns round-trip through Supabase as "HH:MM:SS" (seconds included) even when only "HH:MM" was ever written — this strips the trailing seconds for display and for re-populating an HH:MM form field. */
export function toShortTime(value: string): string {
  return value.slice(0, 5);
}

/** Formato compatto per spazi stretti (chip del calendario mobile): niente zero iniziale sull'ora, niente minuti quando sono :00. Precondition: "HH:MM" (vedi toShortTime). */
export function formatCompactHour(time: string): string {
  const [hh, mm] = time.split(':');
  const hour = String(Number(hh));
  return mm === '00' ? hour : `${hour}:${mm}`;
}

export function isValidTimeFormat(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Precondition: both arguments are valid zero-padded HH:MM strings (see isValidTimeFormat) — this does a plain string comparison, not time-aware arithmetic. */
export function isEndAfterStart(start: string, end: string): boolean {
  return end > start;
}

export function isValidTimeRange(start: string, end: string): boolean {
  return isValidTimeFormat(start) && isValidTimeFormat(end) && isEndAfterStart(start, end);
}

export function isValidOptionalTimeRange(start: string, end: string): boolean {
  if (!start.trim() && !end.trim()) return true;
  return isValidTimeRange(start, end);
}

export function hoursBetweenTimes(start: string, end: string): number {
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  return (endHours * 60 + endMinutes - (startHours * 60 + startMinutes)) / 60;
}

export interface HalfDaySplit<T> {
  morning: T[];
  afternoon: T[];
}

const AFTERNOON_THRESHOLD = '13:00';

function compareByStartTime<T extends { start_time: string | null }>(a: T, b: T): number {
  const at = a.start_time ?? '';
  const bt = b.start_time ?? '';
  return at < bt ? -1 : at > bt ? 1 : 0;
}

/** Smista le voci di un giorno in due gruppi in base a start_time (voci senza orario finiscono in mattina come fallback), ordinando ciascun gruppo cronologicamente. */
export function splitByHalfDay<T extends { start_time: string | null }>(items: T[]): HalfDaySplit<T> {
  const morning: T[] = [];
  const afternoon: T[] = [];

  for (const item of items) {
    if (item.start_time !== null && item.start_time >= AFTERNOON_THRESHOLD) {
      afternoon.push(item);
    } else {
      morning.push(item);
    }
  }

  morning.sort(compareByStartTime);
  afternoon.sort(compareByStartTime);

  return { morning, afternoon };
}

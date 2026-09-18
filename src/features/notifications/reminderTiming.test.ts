import { reminderDateTime, isFutureReminder } from './reminderTiming';

describe('reminderDateTime', () => {
  it('returns 20:00 local time the day before the event date', () => {
    const when = reminderDateTime('2026-09-15', null);
    expect(when.getFullYear()).toBe(2026);
    expect(when.getMonth()).toBe(8); // settembre
    expect(when.getDate()).toBe(14);
    expect(when.getHours()).toBe(20);
    expect(when.getMinutes()).toBe(0);
  });

  it('rolls correctly across a month boundary', () => {
    const when = reminderDateTime('2026-10-01', null);
    expect(when.getMonth()).toBe(8); // settembre
    expect(when.getDate()).toBe(30);
  });

  it('rolls correctly across a year boundary', () => {
    const when = reminderDateTime('2027-01-01', null);
    expect(when.getFullYear()).toBe(2026);
    expect(when.getMonth()).toBe(11); // dicembre
    expect(when.getDate()).toBe(31);
  });

  it('ignores the event own time — the reminder is always fixed at 20:00 the day before', () => {
    const when = reminderDateTime('2026-09-15', '08:30');
    expect(when.getHours()).toBe(20);
  });
});

describe('isFutureReminder', () => {
  it('returns true when the reminder time is after now', () => {
    const now = new Date(2026, 8, 10, 12, 0);
    const reminder = new Date(2026, 8, 14, 20, 0);
    expect(isFutureReminder(reminder, now)).toBe(true);
  });

  it('returns false when the reminder time is in the past relative to now', () => {
    const now = new Date(2026, 8, 20, 12, 0);
    const reminder = new Date(2026, 8, 14, 20, 0);
    expect(isFutureReminder(reminder, now)).toBe(false);
  });

  it('returns false when the reminder time equals now exactly', () => {
    const now = new Date(2026, 8, 14, 20, 0);
    const reminder = new Date(2026, 8, 14, 20, 0);
    expect(isFutureReminder(reminder, now)).toBe(false);
  });
});

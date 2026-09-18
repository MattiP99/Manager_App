import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'reminder:';

export interface StoredReminder {
  notificationId: string;
  forDate: string;
}

export async function getStoredReminder(key: string): Promise<StoredReminder | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
  return raw ? (JSON.parse(raw) as StoredReminder) : null;
}

export async function setStoredReminder(key: string, reminder: StoredReminder): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(reminder));
}

export async function clearStoredReminder(key: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + key);
}

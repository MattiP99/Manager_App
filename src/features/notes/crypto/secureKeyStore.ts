import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const STORAGE_KEY = 'notes_encryption_key';

// expo-secure-store non funziona su web (solo Android/iOS/tvOS) — stesso
// pattern Platform.OS === 'web' già usato in src/lib/supabase.ts per la
// sessione Supabase, con lo stesso guard SSR (typeof window === 'undefined').
async function webGet(): Promise<string | null> {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
}
async function webSet(value: string): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, value);
}
async function webRemove(): Promise<void> {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}

/** Legge la chiave AES cachata localmente (se presente — null se la sezione Password non è mai stata sbloccata su questo dispositivo). */
export async function loadStoredKey(): Promise<Uint8Array | null> {
  const hex = Platform.OS === 'web' ? await webGet() : await SecureStore.getItemAsync(STORAGE_KEY);
  return hex ? hexToBytes(hex) : null;
}

/** Salva la chiave AES derivata (mai la passphrase) per sopravvivere ai riavvii dell'app. */
export async function storeKey(keyBytes: Uint8Array): Promise<void> {
  const hex = bytesToHex(keyBytes);
  if (Platform.OS === 'web') await webSet(hex);
  else await SecureStore.setItemAsync(STORAGE_KEY, hex);
}

/** Rimuove la chiave cachata (non usato dalla UI in questo blocco — nessun bottone "blocca" per scelta esplicita, vedi il piano — ma esposto per completezza/uso futuro). */
export async function clearStoredKey(): Promise<void> {
  if (Platform.OS === 'web') await webRemove();
  else await SecureStore.deleteItemAsync(STORAGE_KEY);
}

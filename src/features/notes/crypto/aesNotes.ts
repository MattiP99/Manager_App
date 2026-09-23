import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytesAsync } from 'expo-crypto';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { deriveKey } from './pbkdf2';
import { decodeUtf8, encodeUtf8 } from './textCodec';
import { loadStoredKey } from './secureKeyStore';

const CANARY_PLAINTEXT = 'note-app-verify';
const SALT_BYTES = 16;
const DEK_BYTES = 32;

/** Cifra bytes grezzi con AES-256-GCM, restituendo una stringa base64 (IV+ciphertext+tag combinati) pronta per il database. Base per encryptText (testo) e per l'avvolgimento (wrap) della DEK. */
export async function encryptBytes(plaintextBytes: Uint8Array, keyBytes: Uint8Array): Promise<string> {
  const key = await AESEncryptionKey.import(keyBytes);
  const sealed = await aesEncryptAsync(plaintextBytes, key);
  return sealed.combined('base64');
}

/** Decifra una stringa base64 (prodotta da encryptBytes) tornando ai bytes originali. Lancia un'eccezione se la chiave è sbagliata (il tag di autenticazione GCM non verifica). */
export async function decryptBytes(combinedBase64: string, keyBytes: Uint8Array): Promise<Uint8Array> {
  const key = await AESEncryptionKey.import(keyBytes);
  const sealed = AESSealedData.fromCombined(combinedBase64);
  return await aesDecryptAsync(sealed, key, { output: 'bytes' });
}

export async function encryptText(plaintext: string, keyBytes: Uint8Array): Promise<string> {
  return encryptBytes(encodeUtf8(plaintext), keyBytes);
}

export async function decryptText(combinedBase64: string, keyBytes: Uint8Array): Promise<string> {
  const bytes = await decryptBytes(combinedBase64, keyBytes);
  return decodeUtf8(bytes);
}

/** Avvolge (wrap) una DEK già esistente con una chiave derivata dalla passphrase — usata sia al primo setup (con una DEK nuova) sia dopo un recupero via email (stessa DEK, nuova passphrase: il contenuto già cifrato resta leggibile, cambia solo con quale passphrase si sblocca). */
export async function wrapKeyWithPassphrase(
  passphrase: string,
  dekBytes: Uint8Array
): Promise<{ saltHex: string; wrappedKeyBase64: string }> {
  const saltBytes = await getRandomBytesAsync(SALT_BYTES);
  const kek = deriveKey(passphrase, saltBytes);
  const wrappedKeyBase64 = await encryptBytes(dekBytes, kek);
  return { saltHex: bytesToHex(saltBytes), wrappedKeyBase64 };
}

/** Prima configurazione della sezione Password: genera una DEK casuale (la vera chiave di cifratura delle note, indipendente dalla passphrase) e la avvolge con la passphrase scelta. Cifra anche un canary con la DEK per poterla verificare in futuro. Il chiamante salva saltHex/wrappedKeyBase64/canaryBase64 su note_sections, dekBytes localmente (secureKeyStore.ts) E in chiaro nel deposito di recupero (note_section_recovery — leggibile solo durante una sessione di recupero via email, vedi migrazione 0014). */
export async function setupPasswordSection(
  passphrase: string
): Promise<{ saltHex: string; wrappedKeyBase64: string; canaryBase64: string; dekBytes: Uint8Array }> {
  const dekBytes = await getRandomBytesAsync(DEK_BYTES);
  const { saltHex, wrappedKeyBase64 } = await wrapKeyWithPassphrase(passphrase, dekBytes);
  const canaryBase64 = await encryptText(CANARY_PLAINTEXT, dekBytes);
  return { saltHex, wrappedKeyBase64, canaryBase64, dekBytes };
}

/** Sblocco della sezione Password (già configurata): deriva la KEK dalla passphrase inserita usando il salt salvato, sblocca (unwrap) la DEK, poi la verifica decifrando il canary. Restituisce la DEK se la passphrase è corretta, null altrimenti (mai lanciare un'eccezione per una passphrase sbagliata — è un caso atteso, non un errore). */
export async function unlockPasswordSection(
  passphrase: string,
  saltHex: string,
  wrappedKeyBase64: string,
  canaryBase64: string
): Promise<Uint8Array | null> {
  try {
    const saltBytes = hexToBytes(saltHex);
    const kek = deriveKey(passphrase, saltBytes);
    const dekBytes = await decryptBytes(wrappedKeyBase64, kek);
    const decoded = await decryptText(canaryBase64, dekBytes);
    return decoded === CANARY_PLAINTEXT ? dekBytes : null;
  } catch {
    return null;
  }
}

/** Sblocco via recupero email: la DEK arriva già in chiaro dal deposito di recupero (leggibile solo durante una sessione aperta dal link email — RLS in note_section_recovery, migrazione 0014), nessuna passphrase coinvolta qui. Verifica comunque contro il canary come difesa in profondità (corruzione/manomissione della riga di recupero). */
export async function unlockWithRecoveryKey(recoveryKeyHex: string, canaryBase64: string): Promise<Uint8Array | null> {
  try {
    const dekBytes = hexToBytes(recoveryKeyHex);
    const decoded = await decryptText(canaryBase64, dekBytes);
    return decoded === CANARY_PLAINTEXT ? dekBytes : null;
  } catch {
    return null;
  }
}

/** Legge la chiave cachata localmente e la verifica contro il canary della sezione PRIMA di considerarla valida — una chiave cachata da una sessione/household precedente (es. dopo un cambio utente) non deve mai essere trattata come "questa sezione è sbloccata". Restituisce null se la sezione non è ancora configurata (nessun canary), se non c'è alcuna chiave cachata, o se la chiave cachata non corrisponde al canary di QUESTA sezione. */
export async function loadVerifiedKey(section: { encryption_canary: string | null }): Promise<Uint8Array | null> {
  if (!section.encryption_canary) return null;
  const keyBytes = await loadStoredKey();
  if (!keyBytes) return null;
  try {
    const decoded = await decryptText(section.encryption_canary, keyBytes);
    return decoded === CANARY_PLAINTEXT ? keyBytes : null;
  } catch {
    return null;
  }
}

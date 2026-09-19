import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytesAsync } from 'expo-crypto';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { deriveKey } from './pbkdf2';
import { decodeUtf8, encodeUtf8 } from './textCodec';

const CANARY_PLAINTEXT = 'note-app-verify';
const SALT_BYTES = 16;

/** Cifra un testo con AES-256-GCM, restituendo una stringa base64 (IV+ciphertext+tag combinati) pronta per il database. */
export async function encryptText(plaintext: string, keyBytes: Uint8Array): Promise<string> {
  const key = await AESEncryptionKey.import(keyBytes);
  const sealed = await aesEncryptAsync(encodeUtf8(plaintext), key);
  const combined = await sealed.combined('base64');
  return combined as string;
}

/** Decifra una stringa base64 (prodotta da encryptText) tornando al testo in chiaro originale. Lancia un'eccezione se la chiave è sbagliata (il tag di autenticazione GCM non verifica). */
export async function decryptText(combinedBase64: string, keyBytes: Uint8Array): Promise<string> {
  const key = await AESEncryptionKey.import(keyBytes);
  const sealed = AESSealedData.fromCombined(combinedBase64);
  const bytes = await aesDecryptAsync(sealed, key, { output: 'bytes' });
  return decodeUtf8(bytes as Uint8Array);
}

/** Prima configurazione della sezione Password: genera un salt casuale, deriva la chiave dalla passphrase scelta dall'utente, e cifra un valore noto (canary) con quella chiave per poterla verificare in futuro. Il chiamante salva saltHex/canaryBase64 su note_sections e keyBytes localmente (vedi secureKeyStore.ts). */
export async function setupPasswordSection(
  passphrase: string
): Promise<{ saltHex: string; canaryBase64: string; keyBytes: Uint8Array }> {
  const saltBytes = await getRandomBytesAsync(SALT_BYTES);
  const keyBytes = deriveKey(passphrase, saltBytes);
  const canaryBase64 = await encryptText(CANARY_PLAINTEXT, keyBytes);
  return { saltHex: bytesToHex(saltBytes), canaryBase64, keyBytes };
}

/** Sblocco della sezione Password (già configurata): deriva la chiave dalla passphrase inserita usando il salt salvato, poi la verifica decifrando il canary. Restituisce la chiave se la passphrase è corretta, null altrimenti (mai lanciare un'eccezione per una passphrase sbagliata — è un caso atteso, non un errore). */
export async function unlockPasswordSection(
  passphrase: string,
  saltHex: string,
  canaryBase64: string
): Promise<Uint8Array | null> {
  const saltBytes = hexToBytes(saltHex);
  const keyBytes = deriveKey(passphrase, saltBytes);
  try {
    const decoded = await decryptText(canaryBase64, keyBytes);
    return decoded === CANARY_PLAINTEXT ? keyBytes : null;
  } catch {
    return null;
  }
}

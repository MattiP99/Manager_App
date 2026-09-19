import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

// 210.000 iterazioni: raccomandazione OWASP 2023 per PBKDF2-HMAC-SHA256.
const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH_BYTES = 32; // AES-256

/** Deriva una chiave AES-256 (32 byte) da una passphrase e un salt, via PBKDF2-HMAC-SHA256. Deterministica: stessa passphrase + stesso salt -> stessa chiave, sempre. */
export function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  const passphraseBytes = new TextEncoder().encode(passphrase);
  return pbkdf2(sha256, passphraseBytes, salt, { c: PBKDF2_ITERATIONS, dkLen: KEY_LENGTH_BYTES });
}

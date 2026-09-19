import { deriveKey } from './pbkdf2';

describe('deriveKey', () => {
  it('returns a 32-byte key', () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const key = deriveKey('correct horse battery staple', salt);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('is deterministic: same passphrase + same salt always produces the same key', () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const key1 = deriveKey('la mia passphrase', salt);
    const key2 = deriveKey('la mia passphrase', salt);
    expect(Array.from(key1)).toEqual(Array.from(key2));
  });

  it('produces a different key for a different passphrase with the same salt', () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const key1 = deriveKey('passphrase corretta', salt);
    const key2 = deriveKey('passphrase sbagliata', salt);
    expect(Array.from(key1)).not.toEqual(Array.from(key2));
  });

  it('produces a different key for the same passphrase with a different salt', () => {
    const saltA = new Uint8Array(16).fill(1);
    const saltB = new Uint8Array(16).fill(2);
    const keyA = deriveKey('stessa passphrase', saltA);
    const keyB = deriveKey('stessa passphrase', saltB);
    expect(Array.from(keyA)).not.toEqual(Array.from(keyB));
  });

  it('handles a passphrase containing Italian accented characters correctly and deterministically', () => {
    const salt = new Uint8Array(16).fill(7);
    const key1 = deriveKey('città è bellissima àèìòù', salt);
    const key2 = deriveKey('città è bellissima àèìòù', salt);
    expect(Array.from(key1)).toEqual(Array.from(key2));
    expect(key1.length).toBe(32);
  });
});

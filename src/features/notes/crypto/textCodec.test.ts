import { decodeUtf8, encodeUtf8 } from './textCodec';

describe('encodeUtf8 / decodeUtf8', () => {
  it('round-trips plain ASCII text', () => {
    const text = 'Hello, world!';
    expect(decodeUtf8(encodeUtf8(text))).toBe(text);
  });

  it('round-trips Italian accented characters (the exact case btoa/atob mishandle)', () => {
    const text = 'il wifi è ABC123, città è bellissima àèìòù';
    expect(decodeUtf8(encodeUtf8(text))).toBe(text);
  });

  it('round-trips an empty string', () => {
    expect(decodeUtf8(encodeUtf8(''))).toBe('');
  });

  it('encodeUtf8 returns a Uint8Array', () => {
    expect(encodeUtf8('test')).toBeInstanceOf(Uint8Array);
  });
});

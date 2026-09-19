/** Confine testo↔byte per la cifratura: TextEncoder/TextDecoder (API web standard, mai btoa/atob — btoa non gestisce correttamente testo Unicode arbitrario come caratteri accentati italiani). */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

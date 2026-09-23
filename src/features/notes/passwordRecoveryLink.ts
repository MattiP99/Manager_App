import * as Linking from 'expo-linking';

/** URL di redirect per il link di recupero passphrase, verso la route dedicata src/app/recupero-password.tsx. Su nativo diventa uno scheme link (managerappproject://recupero-password), sul web l'URL corrente dell'app (Linking.createURL, Expo SDK 57). */
export function buildRecoveryRedirectUrl(): string {
  return Linking.createURL('recupero-password');
}

/** Estrae access_token/refresh_token da un URL di redirect di Supabase Auth — in questo progetto il flusso è "implicit" (default di @supabase/supabase-js, mai cambiato in flowType), quindi i token sono nel FRAGMENT dopo '#', es. .../recupero-password#access_token=...&refresh_token=...&type=recovery. Serve solo su nativo: sul web `detectSessionInUrl` (src/lib/supabase.ts) stabilisce già la sessione da solo. */
export function extractSessionTokensFromUrl(url: string): { accessToken: string; refreshToken: string } | null {
  const fragment = url.split('#')[1];
  if (!fragment) return null;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

/** Decodifica il payload di un JWT (nessuna verifica della firma — qui serve solo leggere il claim `amr`; la verifica crittografica la fa comunque Supabase lato server a ogni richiesta autenticata). Fallisce silenziosamente (null) su un token malformato, mai un'eccezione non gestita. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** true se l'access token proviene da una sessione aperta cliccando il link di recupero email (claim amr contiene method "otp") — verificato empiricamente 2026-09-23 con admin.generateLink + verifyOtp contro il vero progetto Supabase (vedi migrazione 0014). Un login normale ha invece amr con method "password". Fail-closed: qualunque dubbio (token malformato, claim assente) restituisce false. */
export function isRecoveryToken(accessToken: string): boolean {
  const claims = decodeJwtPayload(accessToken);
  const amr = claims?.amr;
  return Array.isArray(amr) && amr.some((entry) => (entry as { method?: string })?.method === 'otp');
}

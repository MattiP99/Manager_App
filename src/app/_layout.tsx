import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useSession } from '../features/auth/useSession';
import { useHousehold } from '../features/household/useHousehold';
import { useSyncRecurringReminders } from '../features/family-calendar/useSyncRecurringReminders';

// Deve stare a livello di modulo, mai dentro un componente/hook — altrimenti
// può essere chiamato troppo tardi, a splash screen già nascosta (docs Expo).
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate() {
  const { session, isLoading: sessionLoading } = useSession();
  const { data: household, isLoading: householdLoading } = useHousehold();
  useSyncRecurringReminders();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;

    // Gestisce da sola la propria navigazione (verifica la sessione di
    // recupero, mostra un errore se non valida, naviga a "/" solo dopo un
    // reset riuscito) — esclusa da tutte le regole sotto, altrimenti
    // "session && inAuthGroup" la rimbalzerebbe via non appena setSession
    // stabilisce una sessione, prima ancora che l'utente veda lo schermo.
    if (segments[0] === 'recupero-password') return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
      return;
    }
    if (session && inAuthGroup) {
      router.replace('/');
      return;
    }
    if (session && household === null && segments[0] !== 'join-household') {
      router.replace('/join-household');
      return;
    }
    if (session && household && segments[0] === 'join-household') {
      router.replace('/');
    }
  }, [session, sessionLoading, household, householdLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

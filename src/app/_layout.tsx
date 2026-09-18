import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../features/auth/useSession';
import { useHousehold } from '../features/household/useHousehold';
import { useSyncRecurringReminders } from '../features/family-calendar/useSyncRecurringReminders';

const queryClient = new QueryClient();

function AuthGate() {
  const { session, isLoading: sessionLoading } = useSession();
  const { data: household, isLoading: householdLoading } = useHousehold();
  useSyncRecurringReminders();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading) return;

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
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}

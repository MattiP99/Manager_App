import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let permissionChecked = false;
let permissionGranted = false;

/** Richiede il permesso di notifica una sola volta per sessione app; se negato o non supportato, l'app resta pienamente funzionante senza promemoria. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Promemoria',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    permissionGranted = status === 'granted';
  } catch {
    permissionGranted = false;
  }
  return permissionGranted;
}

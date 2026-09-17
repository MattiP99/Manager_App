import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Calendario' }} />
      <Tabs.Screen name="pagamenti" options={{ title: 'Pagamenti' }} />
      <Tabs.Screen name="spese" options={{ title: 'Spese' }} />
      <Tabs.Screen name="note" options={{ title: 'Note' }} />
      <Tabs.Screen name="impostazioni" options={{ title: 'Impostazioni' }} />
    </Tabs>
  );
}

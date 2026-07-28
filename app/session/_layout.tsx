import { Stack } from 'expo-router';

import { color } from '../../src/theme/tokens';

/**
 * The sitting lives outside the tab bar on purpose. Navigation visible during
 * meditation is an invitation to leave.
 */
export default function SessionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.paper },
        animation: 'fade',
        gestureEnabled: false,
      }}>
      {/*
        The two screens before the bell get their gesture back. Neither is a
        sitting yet, and the teaching card carries no button to leave by — the
        swipe is its only way out, and a silent one is better than printing
        "not now" next to a paragraph asking for your attention.
      */}
      <Stack.Screen name="start" options={{ gestureEnabled: true }} />
      <Stack.Screen name="tip" options={{ gestureEnabled: true }} />
    </Stack>
  );
}

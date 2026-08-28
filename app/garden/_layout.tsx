import { Stack } from 'expo-router';

import { useColor } from '../../src/theme/useColor';

/**
 * What the garden asks when it is full.
 *
 * Outside the tab bar, like a sitting, but for the opposite reason. A sitting
 * hides the navigation because navigation during meditation is an invitation to
 * leave; this hides it because it is one thing at a time — a bed you have
 * filled and whether to keep going — and a bar offering two other places would
 * make it a stop rather than a screen.
 */
export default function GardenLayout() {
  const color = useColor();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.paper },
        animation: 'fade',
      }}
    />
  );
}

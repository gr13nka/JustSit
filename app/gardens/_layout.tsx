import { Stack } from 'expo-router';

import { useColor } from '../../src/theme/useColor';

/**
 * The gardens you have kept: the shelf, one garden opened off it, and the
 * question a full garden asks.
 *
 * Outside the tab bar, like a sitting, but for the opposite reason. A sitting
 * hides the navigation because navigation during meditation is an invitation to
 * leave; these hide it because they are one thing at a time — a shelf you came
 * to look at, a garden you opened, a size you are choosing — and a bar offering
 * two other places would make each of them a stop rather than a screen.
 */
export default function GardensLayout() {
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

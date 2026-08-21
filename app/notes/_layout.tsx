import { Stack } from 'expo-router';

import { useColor } from '../../src/theme/useColor';

/**
 * Everything caught, and one note opened out of it.
 *
 * Outside the tab bar for the shelf's reason rather than the sitting's: these
 * are one thing at a time — a pile you came to read, a note you are changing —
 * and a bar offering two other places would make each of them a stop rather
 * than a screen.
 */
export default function NotesLayout() {
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

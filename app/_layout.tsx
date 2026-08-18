import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  configureNotificationHandler,
  ensureChannels,
} from '../src/session/notifications';
import { fontAssets } from '../src/theme/fontAssets';
import { useColor } from '../src/theme/useColor';
import { useHydrated } from '../src/store';
import { WebInsets } from '../src/ui/webInsets';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hydrated = useHydrated();
  // Above the early return below: a hook cannot be called conditionally.
  const color = useColor();

  const ready = (fontsLoaded || fontError) && hydrated;

  // Deliberately in an effect rather than at module scope: touching
  // expo-notifications during module evaluation would take the whole route
  // tree down with it wherever the module is unavailable.
  useEffect(() => {
    configureNotificationHandler();
    void ensureChannels();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Holding the splash until fonts AND stored state are in avoids both a flash
  // of system font and a flash of an empty garden. It also lets every screen
  // below assume its data is present, rather than each guarding separately.
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/*
        Hidden everywhere, not just while sitting. The battery, the signal and
        above all the clock are three more things to check, and the whole app is
        an argument against checking things.

        `style` still matters: dragging the bar back down brings it up
        temporarily, and on paper it must come back in dark ink.
      */}
      <StatusBar hidden style="dark" />
      {/*
        Nothing on a phone. In the browser preview it supplies the notch and
        gesture-bar insets the platform cannot, so a screen shape judged there
        is the shape you get on the device.
      */}
      <WebInsets>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.paper },
            animation: 'fade',
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session" />
          <Stack.Screen name="onboarding" />
        </Stack>
      </WebInsets>
    </SafeAreaProvider>
  );
}

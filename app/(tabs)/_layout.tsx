import { Redirect, Tabs } from 'expo-router';

import { shouldGreet } from '../../src/domain/greeting';
import { useOpenedDay } from '../../src/session/useOpenedDay';
import { useSettings } from '../../src/store';
import { SliderNav } from '../../src/ui/SliderNav';

export default function TabsLayout() {
  const settings = useSettings();
  const openedDay = useOpenedDay();

  // Safe to read directly: the root layout holds the splash until stored state
  // has been read, so this is never a spurious redirect on a returning user.
  if (settings.onboardedAt === null) return <Redirect href="/onboarding" />;
  // Below the onboarding check, so somebody arriving for the first time meets
  // the app's own introduction before it starts greeting them back. It cannot
  // interrupt a sitting — `useOpenedDay` has that argument in full.
  if (shouldGreet(settings.lastGreetedAt, openedDay)) return <Redirect href="/welcome" />;

  return (
    <Tabs
      // The whole bar is ours, so the tint/height/border options this used to
      // carry would do nothing: what was configuration is now a component. It
      // positions itself absolutely, so it reserves no strip of the screen and
      // both tabs run the full height with their own clearance at the foot.
      tabBar={(props) => <SliderNav {...props} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Garden' }} />
      {/*
        There is no Sit tab. A sitting starts by touching the dot it will grow
        in, so the garden is the only way in and the app has nothing that
        resembles a stopwatch waiting to be opened.
      */}
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}

import { Redirect, Tabs } from 'expo-router';

import { color, hairline, radius, space } from '../../src/theme/tokens';
import { font } from '../../src/theme/typography';
import { useSettings } from '../../src/store';
import { GardenIcon, YouIcon } from '../../src/ui/icons';

export default function TabsLayout() {
  const settings = useSettings();

  // Safe to read directly: the root layout holds the splash until stored state
  // has been read, so this is never a spurious redirect on a returning user.
  if (settings.onboardedAt === null) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.terracotta,
        tabBarInactiveTintColor: color.inkSoft,
        tabBarStyle: {
          backgroundColor: color.paperDeep,
          borderTopWidth: hairline,
          borderTopColor: color.line,
          height: 88,
          paddingTop: space.sm,
        },
        tabBarLabelStyle: {
          fontFamily: font.mono,
          fontSize: 10,
          letterSpacing: 1,
          marginTop: space.xs,
        },
        tabBarItemStyle: {
          borderRadius: radius.card,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Garden',
          tabBarIcon: ({ color: c }) => <GardenIcon color={c} />,
        }}
      />
      {/*
        There is no Sit tab. A sitting starts by touching the dot it will grow
        in, so the garden is the only way in and the app has nothing that
        resembles a stopwatch waiting to be opened.
      */}
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color: c }) => <YouIcon color={c} />,
        }}
      />
    </Tabs>
  );
}

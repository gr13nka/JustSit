import { Redirect, Tabs } from 'expo-router';
import { ColorValue, StyleSheet, View } from 'react-native';

import { color, hairline, radius, space } from '../../src/theme/tokens';
import { useSettings } from '../../src/store';
import { GardenIcon, YouIcon } from '../../src/ui/icons';
import { TabScribble } from '../../src/ui/TabScribble';
import { Text } from '../../src/ui/Text';

/**
 * A tab label with the scribble underneath it when it is the one you are on.
 * The underline does the work an accent colour used to do.
 */
function TabLabel({
  focused,
  color: tint,
  children,
}: {
  focused: boolean;
  color: ColorValue;
  children: string;
}) {
  return (
    <View style={styles.label}>
      <Text variant="caption" style={[styles.labelText, { color: tint }]}>
        {children}
      </Text>
      <TabScribble tint={tint} focused={focused} />
    </View>
  );
}

export default function TabsLayout() {
  const settings = useSettings();

  // Safe to read directly: the root layout holds the splash until stored state
  // has been read, so this is never a spurious redirect on a returning user.
  if (settings.onboardedAt === null) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.inkSoft,
        tabBarStyle: {
          backgroundColor: color.paperDeep,
          borderTopWidth: hairline,
          borderTopColor: color.inkFaint,
          // Eight points taller than the bar used to be: the label now carries
          // its underline, and the two need to sit above the home indicator.
          height: 96,
          paddingTop: space.sm,
        },
        tabBarItemStyle: {
          borderRadius: radius.card,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Garden',
          tabBarIcon: ({ color: tint }) => <GardenIcon color={tint} />,
          tabBarLabel: (props) => <TabLabel {...props}>Garden</TabLabel>,
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
          tabBarIcon: ({ color: tint }) => <YouIcon color={tint} />,
          tabBarLabel: (props) => <TabLabel {...props}>You</TabLabel>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: {
    alignItems: 'center',
    marginTop: space.xs,
    /** Off the word, but not so far that it stops belonging to it. */
    gap: 2,
  },
  labelText: {
    letterSpacing: 0.5,
  },
});

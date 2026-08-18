import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { GardenIcon, YouIcon } from './icons';
import { Slider } from './Slider';
import { useOrganicCorners } from './useOrganicCorners';

/**
 * The screen switcher: a small bar floating over the page, with one accent
 * marker that travels between the two screens.
 *
 * It replaces a labelled tab bar, and with it the scribble underline that used
 * to mark the active tab — the two are both ways of saying "you are here" and
 * an interface only needs one. What is lost is the words: the doodles carry the
 * screens now, and the names live in `accessibilityLabel`.
 *
 * It is silent. The kit makes this the one navigation allowed a sound, on the
 * grounds that the marker's travel *is* the state change — but this app rings
 * one bell in and one bell out and nothing in between, and a chime for changing
 * screens would be the third sound it has ever made.
 */

const ICON = 26;
const ITEM_WIDTH = 52;
/** Slightly wider than tall: nothing in this component is a pill or an ellipse. */
const ITEM_HEIGHT = 42;
const GAP = 2;
const PAD = 6;

/**
 * What expo-router hands a custom tab bar. Read off the navigator's own props
 * rather than imported: the type lives in a package expo-router vendors, and
 * reaching into its build output would tie this file to a path that is not
 * anybody's public API.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const SCREENS = [
  { name: 'index', label: 'Garden', Icon: GardenIcon },
  { name: 'you', label: 'You', Icon: YouIcon },
];

export function SliderNav({ state, navigation }: TabBarProps) {
  const color = useColor();
  const insets = useSafeAreaInsets();
  const corners = useOrganicCorners(13);

  const index = Math.max(
    0,
    SCREENS.findIndex((screen) => screen.name === state.routes[state.index]?.name)
  );

  const select = (next: number) => {
    if (next === index) return;
    navigation.navigate(SCREENS[next].name);
  };

  return (
    <View
      pointerEvents="box-none"
      // Floating clear of the home indicator rather than sitting on a bar that
      // spans the screen: the garden runs underneath it, which is what buys the
      // plot the whole height of the page.
      style={[styles.dock, { paddingBottom: insets.bottom + space.sm }]}>
      <View style={[styles.bar, corners, { backgroundColor: color.paperDeep }]}>
        <Slider
          count={SCREENS.length}
          index={index}
          onSelect={select}
          itemWidth={ITEM_WIDTH}
          itemHeight={ITEM_HEIGHT}
          gap={GAP}
          role="tab"
          labelFor={(i) => SCREENS[i].label}
          renderItem={(i, active) => {
            const { Icon } = SCREENS[i];
            // The doodle flips to paper as the marker arrives under it.
            return <Icon color={active ? color.paper : color.inkSoft} size={ICON} />;
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    padding: PAD,
  },
});

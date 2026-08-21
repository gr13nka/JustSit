import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { plotAt, plotCount } from '../../src/domain/plots';
import { space } from '../../src/theme/tokens';
import { useProgress, useSessions } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { gardenMeta } from '../../src/ui/GardenCard';
import { useBurst, useSway } from '../../src/ui/motion';
import { PlantGrid } from '../../src/ui/PlantGrid';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/**
 * One garden, opened off the shelf and drawn at full size.
 *
 * Nothing here answers a touch. The garden being filled has one dot that does —
 * on the Garden tab, where carrying on belongs — and a garden you finished last
 * spring has none at all, so `PlantGrid` is given no way to begin and drops the
 * next-dot ring with it. What is left is the drawing, which is the whole reason
 * anybody opened it.
 */
export default function GardenScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const sessions = useSessions();
  const { gardens } = useProgress();

  // Clamped rather than trusted. The index arrives as a string off a URL, and
  // a garden that does not exist would draw as a bed of nothing with "Garden
  // NaN" over it.
  const last = plotCount(gardens) - 1;
  const at = Math.min(Math.max(0, Math.floor(Number(index)) || 0), last);
  const current = at === last;
  const plot = plotAt(sessions, gardens, at);

  /**
   * It bursts once, on arrival. This is a stack screen rather than a tab, so
   * unlike the Garden tab a mount really is an arrival and there is nothing to
   * restart on.
   */
  const { progress, restart } = useBurst();
  useEffect(restart, [restart]);

  /**
   * Whether this screen is the one being looked at.
   *
   * The sway is a loop, and unmounting is not the only way to stop looking at a
   * garden: the grow ask is pushed on top of this screen and leaves it mounted
   * underneath. So it is told when to give up, exactly as the Garden tab tells
   * the tab behind it.
   */
  const [shown, setShown] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setShown(true);
      return () => setShown(false);
    }, [])
  );

  const sway = useSway(shown);

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title={`Garden ${at + 1}`} onBack={() => router.back()} />

      <View style={styles.head}>
        <Text variant="caption">{gardenMeta(plot, current)}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PlantGrid plot={plot} burst={progress} sway={sway} />
      </ScrollView>

      {/*
        Only the garden still being filled can change, and the only change on
        offer is more of it. Quiet type marked by nothing, the run screen's End:
        a second way on, never a second button.
      */}
      {current && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/gardens/ask', params: { mode: 'grow' } })}
          style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
          <Text variant="caption" color="inkSoft">
            grow this garden
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: 'center',
    paddingBottom: space.md,
  },
  scroll: {
    paddingBottom: space.md,
  },
  grow: {
    alignSelf: 'center',
    paddingVertical: space.md,
  },
  /** Ink settling, the same as everywhere else. */
  pressed: {
    opacity: 0.6,
  },
});

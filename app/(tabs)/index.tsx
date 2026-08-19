import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { currentPlot, PLOT_SIZE } from '../../src/domain/plots';
import { currentStreak } from '../../src/domain/stats';
import { space } from '../../src/theme/tokens';
import { useSessions } from '../../src/store';
import { Baton } from '../../src/ui/Baton';
import { LeafIcon, SunIcon } from '../../src/ui/icons';
import { Indicator } from '../../src/ui/Indicator';
import { useBurst, usePullToReplay, useSway } from '../../src/ui/motion';
import { PlantGrid } from '../../src/ui/PlantGrid';
import { Screen } from '../../src/ui/Screen';
import { Text } from '../../src/ui/Text';

/** Small enough to read as a mark on the page, not as an illustration. */
const BATON_SIZE = 110;

export default function GardenScreen() {
  const sessions = useSessions();
  const plot = currentPlot(sessions);
  const streak = currentStreak(sessions);

  const { progress, restart } = useBurst();

  /**
   * Pulling down at the top plays it again. The garden is the one screen in
   * this app worth looking at rather than using, and the burst was previously
   * only available by leaving and coming back.
   */
  const pull = usePullToReplay(restart);

  /**
   * The garden bursts every time you arrive at it, not once per launch. The tab
   * stays mounted while you are on the other one, so a mount effect would play
   * this exactly once in the life of the app.
   */
  /**
   * Whether the garden is the tab you are looking at. The sway is a loop, and
   * the tab stays mounted behind the other one — so unlike the burst, which
   * simply plays and stops, this has to be told when to give up.
   */
  const [shown, setShown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      restart();
      setShown(true);
      return () => setShown(false);
    }, [restart])
  );

  /** The idle sway, one clock for all 108. Still while you are elsewhere. */
  const sway = useSway(shown);

  /**
   * The dot travels with the sitting rather than being written down here.
   * Nothing is promised to it until a sitting actually finishes, which is what
   * keeps backing out of the flow free of consequences.
   */
  const sitIn = (slot: number) =>
    router.push({ pathname: '/session/start', params: { slot: String(slot) } });

  return (
    <Screen edges={['top']}>
      {/*
        The two figures, pinned to the corners. They used to be a pair of cards
        below the plot, which made the smallest fact on the screen the biggest
        thing on it.
      */}
      <View style={styles.figures}>
        <Indicator icon={SunIcon} value={streak} label="Current streak, in days" />
        <Indicator icon={LeafIcon} value={sessions.length} label="Sittings so far" grew />
      </View>

      <View style={styles.header}>
        <Text variant="title">Your garden</Text>
        <Text variant="caption" style={styles.plotLabel}>
          Plot {plot.index + 1} · {plot.sessions.length} of {PLOT_SIZE}
        </Text>
      </View>

      {/*
        Nine rows fit any phone, so a full plot no longer scrolls. It stays a
        ScrollView for the empty state, which puts Батон above the field, and
        for the short phones where the two together do not fit. The nav floats
        over the foot of it, so the last rows are padded clear of it.
      */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        {...pull}>
        {/*
          Nothing has grown yet, so the cat has the page. He is here instead of
          copy: a garden of empty dots needs no explaining, and an apology for
          it would be the first thing this app said to anyone.
        */}
        {sessions.length === 0 && (
          <View style={styles.empty}>
            <Baton size={BATON_SIZE} />
          </View>
        )}
        <PlantGrid plot={plot} onPressEmpty={sitIn} burst={progress} sway={sway} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.xs,
  },
  header: {
    alignItems: 'center',
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  plotLabel: {
    letterSpacing: 0.5,
  },
  scroll: {
    // Clears the floating nav, which the plot now runs underneath.
    paddingBottom: space.xxxl + space.lg,
  },
  empty: {
    alignItems: 'center',
    paddingBottom: space.md,
  },
});

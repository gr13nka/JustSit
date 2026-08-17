import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { currentPlot, PLOT_SIZE } from '../../src/domain/plots';
import { currentStreak } from '../../src/domain/stats';
import { space } from '../../src/theme/tokens';
import { useSessions } from '../../src/store';
import { Baton } from '../../src/ui/Baton';
import { PlantGrid } from '../../src/ui/PlantGrid';
import { Screen } from '../../src/ui/Screen';
import { StatCard } from '../../src/ui/StatCard';
import { Text } from '../../src/ui/Text';

/** Small enough to read as a mark on the page, not as an illustration. */
const BATON_SIZE = 110;

export default function GardenScreen() {
  const sessions = useSessions();
  const plot = currentPlot(sessions);
  const streak = currentStreak(sessions);

  /**
   * The dot travels with the sitting rather than being written down here.
   * Nothing is promised to it until a sitting actually finishes, which is what
   * keeps backing out of the flow free of consequences.
   */
  const sitIn = (slot: number) =>
    router.push({ pathname: '/session/start', params: { slot: String(slot) } });

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="title">Your garden</Text>
        <Text variant="caption" style={styles.plotLabel}>
          Plot {plot.index + 1} · {plot.sessions.length} of {PLOT_SIZE}
        </Text>
      </View>

      {/*
        Eighteen rows are taller than any phone, so the plot scrolls and the
        figures below it stay put. They are a footnote to the garden; having to
        scroll past 108 dots to reach them would make them feel like the point.
      */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
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
        <PlantGrid plot={plot} onPressEmpty={sitIn} />
      </ScrollView>

      <View style={styles.stats}>
        <StatCard
          label="Current streak"
          value={streak}
          unit={streak === 1 ? 'day' : 'days'}
          accent
        />
        <StatCard
          label="Total sessions"
          value={sessions.length}
          unit={sessions.length === 1 ? 'session' : 'sessions'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.xs,
  },
  plotLabel: {
    letterSpacing: 0.5,
  },
  scroll: {
    paddingBottom: space.lg,
  },
  empty: {
    alignItems: 'center',
    paddingBottom: space.md,
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
    paddingTop: space.md,
  },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';

import { allPlots } from '../../src/domain/plots';
import { space } from '../../src/theme/tokens';
import { useProgress, useSessions } from '../../src/store';
import { BackHeader } from '../../src/ui/BackHeader';
import { Baton } from '../../src/ui/Baton';
import { GardenCard, gardenMeta } from '../../src/ui/GardenCard';
import { Screen } from '../../src/ui/Screen';
import { isGarden, sharesRow, shelfMark, shelfRows } from '../../src/ui/shelf';

/**
 * The shelf: every garden you have kept, oldest first, the one you are filling
 * last.
 *
 * This is the app's whole progress figure. There is no percentage on it, no
 * total, no pace and no projection — just the gardens, at one mark size, so
 * that a mala can be seen to be twelve times a row of nine. What a garden says
 * about itself is its shape and when it ran.
 */

/**
 * The largest a thumbnail mark is drawn.
 *
 * A cap rather than a size, the `offerRow` arrangement: the shelf fits itself
 * to the phone it is on, and on a wide one the marks would otherwise keep
 * growing until a nine-dot garden looked like a real field. Past this a tally
 * stops reading as a tally.
 */
const MARK_MAX = 12.5;

/**
 * How tall a card's field may be before it starts eating the screen.
 *
 * A mala at the cap comes in comfortably under this; what it is really for is a
 * garden grown well past one by the quiet path, which has no upper bound.
 */
const FIELD_MAX_HEIGHT = 220;

/** Small enough to read as a mark on the page, as he is in the empty garden. */
const BATON_SIZE = 104;

export default function GardensScreen() {
  const sessions = useSessions();
  const { gardens } = useProgress();

  const plots = allPlots(sessions, gardens);
  const currentIndex = plots.length - 1;

  // Measured rather than assumed: the mark every card shares is set by the
  // narrowest room any of them has, and that is a fact about this phone.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const half = (width - space.md) / 2;

  /**
   * Which cards need a row to themselves: a mala, because it is twelve wide,
   * and the garden being filled, because its line is the only one on the shelf
   * still moving and it should not have to share.
   */
  const wide = plots.map((plot, i) => !sharesRow(plot.size) || i === currentIndex);

  const mark = shelfMark(
    plots.map((plot, i) => ({
      size: plot.size,
      room: {
        width: (wide[i] ? width : half) - 2 * space.md,
        height: FIELD_MAX_HEIGHT,
      },
    })),
    MARK_MAX
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <BackHeader title="Your gardens" onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View onLayout={onLayout}>
          {mark > 0 &&
            shelfRows(wide).map((row, r) => (
              <View key={r} style={styles.row}>
                {row.map((cell, c) =>
                  isGarden(cell) ? (
                    <View key={c} style={{ width: wide[cell.garden] ? width : half }}>
                      <GardenCard
                        size={plots[cell.garden].size}
                        cells={plots[cell.garden].cells}
                        start={plots[cell.garden].start}
                        meta={gardenMeta(plots[cell.garden], cell.garden === currentIndex)}
                        mark={mark}
                        cornerSeed={cell.garden}
                        onPress={() =>
                          router.push({
                            pathname: '/gardens/[index]',
                            params: { index: String(cell.garden) },
                          })
                        }
                      />
                    </View>
                  ) : (
                    /*
                      Батон, awake, keeping the shelf. He is where the layout
                      leaves a gap and nowhere else — not a reward for having
                      finished something, and identical whether you sat today or
                      not.
                    */
                    <View key={c} style={[{ width: half }, styles.keeper]}>
                      <Baton pose="idle" size={Math.min(BATON_SIZE, half)} />
                    </View>
                  )
                )}
              </View>
            ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // Nothing floats over this screen, but the last row still wants air under
    // it — a card flush with the bottom edge reads as cut off.
    paddingBottom: space.xl,
  },
  row: {
    flexDirection: 'row',
    // Cards hang from the top of their row; the cat stands on its floor.
    alignItems: 'flex-start',
    gap: space.md,
    marginBottom: space.lg,
  },
  keeper: {
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
});

import { useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { hash32 } from '../domain/hash';
import { ART_SHARE, Plot, PLOT_SIZE, slotOffset } from '../domain/plots';
import { BURST_SPREAD_MS, Sprout } from './motion';
import { EmptySlot, Plant } from './Plant';

/** Six across, so 108 lands on eighteen rows exactly and a plant reads as art. */
const COLUMNS = 6;

/**
 * A plot: what has grown, then the empty slots still ahead.
 *
 * Showing the unfilled dots is the point, not a placeholder — the garden is a
 * promise as much as a record, and a grid that only showed what you had already
 * done would lose half of what makes it worth opening.
 */
/**
 * Where in the burst one slot's plant starts growing.
 *
 * Seeded rather than random, for the same reason the dot's offset is: this
 * garden should scatter the same way every time it is shown. A field that
 * re-rolled its timings on every visit would be a different drawing each time,
 * and nothing in this app is generated at runtime.
 */
function burstDelay(slot: number): number {
  return hash32(`burst-${slot}`) % BURST_SPREAD_MS;
}

export function PlantGrid({
  plot,
  onPressEmpty,
  burst,
}: {
  plot: Plot;
  /** Given the absolute slot of the dot touched. */
  onPressEmpty: (slot: number) => void;
  /**
   * The shared 0..1 clock from `useBurst`, if this plot should sprout when it
   * is shown. Only what has grown takes part: the empty dots are the ground the
   * garden is drawn on, and a hundred of them animating would be static rather
   * than a burst.
   */
  burst?: Animated.Value;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const cell = width > 0 ? width / COLUMNS : 0;
  const art = cell * ART_SHARE;

  return (
    <View style={styles.grid} onLayout={onLayout}>
      {cell > 0 &&
        Array.from({ length: PLOT_SIZE }, (_, i) => {
          const slot = plot.index * PLOT_SIZE + i;
          const session = plot.cells[i];
          const { dx, dy } = slotOffset(slot);

          const style = [
            styles.cell,
            {
              width: cell,
              height: cell,
              transform: [{ translateX: dx * cell }, { translateY: dy * cell }],
            },
          ];

          // A plant is a record of something that happened; there is nothing to
          // do to it. Only the empty dots ahead of you are worth touching.
          if (session) {
            // The scatter and the sprout both want `transform`, so they get a
            // view each: the cell holds its offset and never animates, and the
            // animation never has to carry the offset.
            return (
              <View key={i} style={style}>
                {burst ? (
                  <Sprout progress={burst} delayMs={burstDelay(slot)}>
                    <Plant plant={session.plant} size={art} />
                  </Sprout>
                ) : (
                  <Plant plant={session.plant} size={art} />
                )}
              </View>
            );
          }

          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel="Empty plot. Begin a sitting here."
              onPress={() => onPressEmpty(slot)}
              style={({ pressed }) => [style, pressed && styles.pressed]}>
              <EmptySlot size={art} />
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Ink settling, the same as everywhere else — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
});

import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { ART_SHARE, Plot, PLOT_SIZE, slotOffset } from '../domain/plots';
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
export function PlantGrid({
  plot,
  onPressEmpty,
}: {
  plot: Plot;
  /** Given the absolute slot of the dot touched. */
  onPressEmpty: (slot: number) => void;
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
            return (
              <View key={i} style={style}>
                <Plant plant={session.plant} size={art} />
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

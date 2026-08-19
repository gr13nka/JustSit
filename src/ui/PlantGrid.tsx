import { useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { hash32 } from '../domain/hash';
import { nextDot, Plot, PLOT_SIZE, slotOffset } from '../domain/plots';
import { COLUMNS, field } from './field';
import { BURST_SPREAD_MS, Pulse, Sprout, SPROUT_PEAK } from './motion';
import { EmptySlot, Plant } from './Plant';

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

  // Sizes, the ground line, and what the overhang costs the grid in padding —
  // all of it derived in one pure place so a dot and a plant cannot end up
  // standing on different lines.
  const { cell, dot, plant, lift, drop, above, below } = field(width, SPROUT_PEAK);

  // Which dot to circle. Slots are absolute, so this compares against the same
  // number the grid is laying out.
  const next = nextDot(plot);

  // Measured on the wrapper rather than on the grid, so the width the grid is
  // given never feeds back into the width it is measured at.
  return (
    <View onLayout={onLayout}>
      <View
        style={[
          styles.grid,
          { width: cell * COLUMNS, paddingTop: above, paddingBottom: below },
        ]}>
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
              // The scatter, the lift and the sprout all want `transform`, so
              // they get a view each: the cell holds its offset and never
              // animates, the lift is static and belongs to the drawing, and
              // the animation never has to carry either.
              const drawn = <Plant plant={session.plant} size={plant} />;

              return (
                <View key={i} style={style}>
                  <View style={{ transform: [{ translateY: -lift }] }}>
                    {burst ? (
                      <Sprout progress={burst} delayMs={burstDelay(slot)}>
                        {drawn}
                      </Sprout>
                    ) : (
                      drawn
                    )}
                  </View>
                </View>
              );
            }

            // The dot moves down to the same ground line the plants stand on.
            // Only the drawing moves — the cell stays where the lattice put it,
            // so what you tap is still the square you are looking at.
            const mark = <EmptySlot size={dot} next={slot === next} />;

            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel="Empty plot. Begin a sitting here."
                onPress={() => onPressEmpty(slot)}
                style={({ pressed }) => [style, styles.above, pressed && styles.pressed]}>
                <View style={{ transform: [{ translateY: drop }] }}>
                  {slot === next ? <Pulse>{mark}</Pulse> : mark}
                </View>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    // The top row's plants stand above the grid's own edge, for the same reason
    // the cells let theirs out.
    overflow: 'visible',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    // A plant is drawn larger than the cell it is centred in (`PLANT_ZOOM`), so
    // the cell has to say it will not cut it. Native leaves a view unclipped by
    // default and react-native-web does not, which is why this is written down
    // rather than assumed — without it every flower loses its head.
    overflow: 'visible',
  },
  /**
   * Dots draw over plants, which they did not have to before the two were put
   * on one ground line.
   *
   * A plant stands about a cell and a quarter tall from its root, so once its
   * root is on the same line as the dots, its head necessarily reaches past the
   * ground line of the row above — and its shapes are filled with paper, so it
   * paints over whatever is behind. That is right for a plant behind a plant
   * and wrong for a dot: a hole left in a planted field would have its dot,
   * and the ring marking where to sit next, quietly covered by the plant below.
   *
   * A dot showing over a leaf reads as ground behind the garden, which is what
   * it is. A target you cannot see does not read as anything.
   */
  above: {
    zIndex: 1,
  },
  /** Ink settling, the same as everywhere else — no scale, no shadow. */
  pressed: {
    opacity: 0.6,
  },
});

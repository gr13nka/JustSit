import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { PlantKey } from '../domain/plants';
import { space } from '../theme/tokens';
import { useColor } from '../theme/useColor';
import { OfferLayout } from './offerRow';
import { Plant } from './Plant';
import { useOrganicCorners } from './useOrganicCorners';

/**
 * One of the three things a finished sitting may be exchanged for, drawn.
 *
 * A bundle is always one species, so what this has to show at a glance is *how
 * many* — which is why the plants overlap rather than sitting apart, and why
 * they share a ground line rather than each being centred in a box of its own.
 * Two ferns leaning together are a patch of fern; two ferns in two boxes are a
 * list, and a list invites comparison between things that are the same thing.
 *
 * Everything about where the plants go is `offerRow.ts`'s. This draws them,
 * and owns exactly one thing the geometry cannot: what being chosen looks like.
 */

/**
 * The marker's corner, and the character of it.
 *
 * Fixed and unseeded, like the timer ring's wobble and the wobbly button's:
 * one marker is on screen at a time — the unchosen offers' are drawn at nothing
 * — so it wants one character rather than a family of them. The radius is not
 * the duration dial's nine: a corner is an absolute distance, and nine on a box
 * three times the size reads as a sharper corner rather than as the same hand.
 */
const MARKER_RADIUS = 12;
const MARKER_SEED = 4;

/**
 * How far the chosen offer's plants stand up out of the row.
 *
 * The marker is the quiet half of saying which one is chosen and this is the
 * other, exactly as the dial's number darkens under its marker. Small on
 * purpose: it must read as the plant having been picked up, not as the app
 * recommending it — every offer here is available, which is also why the
 * unchosen ones never fade.
 */
const CHOSEN_SCALE = 1.06;

/** Long enough to be a movement rather than a switch, short enough to feel direct. */
const CHOOSE_MS = 200;

export function OfferMark({
  plants,
  layout,
  chosen,
  onPress,
}: {
  /** The species, one per plant. A bundle repeats the same key. */
  plants: readonly PlantKey[];
  /** The box, drawn to this offer's own ink by `offerRow`. */
  layout: OfferLayout;
  chosen: boolean;
  onPress: () => void;
}) {
  const color = useColor();
  // Held under `organicCorners`' ceiling. A box drawn to a reed's ink is barely
  // thirty points across, and a corner pair that together outruns the side they
  // share makes the platform silently scale every radius down — the box is then
  // drawn to numbers the seed never produced, which is a wobble nobody chose.
  const corners = useOrganicCorners(
    Math.min(MARKER_RADIUS, layout.width * 0.4),
    MARKER_SEED
  );

  const pick = useRef(new Animated.Value(chosen ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(pick, {
      toValue: chosen ? 1 : 0,
      duration: CHOOSE_MS,
      easing: Easing.out(Easing.ease),
      // Opacity and a scale, so this stays on the native driver like everything
      // else that moves here.
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [chosen, pick]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={describe(plants)}
      onPress={onPress}
      // A box drawn to a narrow species' ink is barely thirty points across, so
      // the target reaches past the mark without moving it — the garden's next
      // dot makes the same trade. Held to half the gap, so two offers never
      // compete for the same touch.
      hitSlop={space.sm}
      style={{ width: layout.width, height: layout.height }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          corners,
          { backgroundColor: color.paperDeep, opacity: pick },
        ]}
      />

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            // The roots, in points. An array and never a string: React Native's
            // string parser reads integer digits only, and a fractional
            // percentage silently pivots the view somewhere past the horizon.
            // `field.ts`'s ROOT_ORIGIN carries the whole story.
            transformOrigin: [layout.width / 2, layout.ground, 0],
            transform: [
              {
                scale: pick.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, CHOSEN_SCALE],
                }),
              },
            ],
          },
        ]}>
        {layout.marks.map((mark, i) => (
          <View key={i} style={[styles.mark, { left: mark.x, top: mark.y }]}>
            {/*
              A plant's closed shapes are filled with the ground it stands on,
              and the chosen one is standing on the marker rather than on the
              page. Snapped rather than crossfaded: paper and paperDeep are a
              few percent apart, and the marker arriving is what the eye is on.
            */}
            <Plant
              plant={plants[i]}
              size={mark.size}
              ground={chosen ? 'paperDeep' : 'paper'}
            />
          </View>
        ))}
      </Animated.View>
    </Pressable>
  );
}

/**
 * What a screen reader is told. The count is the whole of what the drawing says
 * that the species does not, so it is said in words rather than left to a
 * numeral beside a noun.
 */
function describe(plants: readonly PlantKey[]): string {
  const count = plants.length;
  if (count === 1) return plants[0];
  return `${count === 2 ? 'Two' : count === 3 ? 'Three' : count} ${plural(plants[0])}`;
}

/** Enough English for twelve species: daisies and berries, grasses, ferns. */
function plural(key: string): string {
  if (/[^aeiou]y$/.test(key)) return `${key.slice(0, -1)}ies`;
  if (/(s|sh|ch|x|z)$/.test(key)) return `${key}es`;
  return `${key}s`;
}

const styles = StyleSheet.create({
  mark: {
    // Placed against the box's own corner. A plant's canvas margin hangs out of
    // a box that hugs its ink, and nothing clips it — the same arrangement that
    // lets a plant lean out of its cell in the garden.
    position: 'absolute',
  },
});

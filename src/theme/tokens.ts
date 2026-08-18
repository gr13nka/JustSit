/**
 * The single source of spacing and shape for the whole app.
 *
 * Colour used to live here too, and moved to `themes.ts` when the app grew
 * three of them: everything below is identical in every theme and can stay a
 * plain import, while colour has to be read through `useColor()` because a
 * value frozen at import cannot repaint. No hex literal should appear anywhere
 * outside `themes.ts`.
 *
 * The structure colour serves has not changed, whichever theme is on. Nothing
 * in the interface is coloured to say "touch me" — touchability is carried by
 * shape: fills, 1.5px borders, organic corners. That leaves colour free to mean
 * one thing only, and the only place it means it is the garden. Chrome is paper,
 * ink and the one accent; a plant that grew is pen-green; a bloom may take one
 * pen bright. If a screen looks flat, the fix is shape or space, not hue.
 */

/** 4pt base. Prefer whitespace over dividers — this app should breathe. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/**
 * The kit's shape scale. `sm` and `pill` are unspent today — vocabulary, kept
 * so that a new shape reaches for a named step instead of inventing a number.
 */
export const radius = {
  /** Chips and small marks — anything smaller than a card. */
  sm: 8,
  /** Buttons and small panels. */
  card: 12,
  /** Cards: the generous corner that makes a filled box read as a page, not a frame. */
  lg: 20,
  /** Fully round, whatever the height. */
  pill: 999,
} as const;

/**
 * One border weight for everything, thick enough to read as a drawn line rather
 * than a rendering artefact. Structural borders (the wobbly button, selected
 * dial options) are ink; decorative ones (dividers, the elapsed arc) are
 * `inkFaint`. Cards carry no border at all — fill and outline never combine,
 * or the card turns into a comic panel.
 *
 * The name is the design system's, not React Native's: this is deliberately
 * heavier than `StyleSheet.hairlineWidth`, which resolves to a single device
 * pixel and disappears into the paper.
 */
export const hairline = 1.5;

/**
 * mulberry32 — a tiny seeded PRNG. Deterministic by design: `organicCorners`
 * runs on every render, and a corner that changed between frames would read as
 * a glitch rather than as a hand.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The four corner radii of one drawn box, as React Native style props. */
export type OrganicCorners = {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;
};

/**
 * Four deliberately-unequal corner radii, each within ±20% of `baseRadius`.
 *
 * A drawn box never closes with four identical corners, and that unevenness is
 * most of why hand-made work looks hand-made. React Native has no two-axis
 * elliptical radius, so four unequal corners is the available reading of it.
 *
 * `baseRadius` must stay under about 40% of the box's shorter side. What comes
 * back reaches 20% over it, and a corner pair may not together exceed the side
 * they share: past that, the platform silently scales every radius down to fit
 * and the box is drawn to numbers this function never returned. Half the side —
 * the obvious choice for a round box — is already past it.
 *
 * `seed` must be stable per instance, so the same box keeps the same corners for
 * as long as it is on screen. `useOrganicCorners` supplies one; prefer it.
 */
export function organicCorners(baseRadius: number, seed: number): OrganicCorners {
  const random = mulberry32(seed);
  const corner = () => Math.round(baseRadius * (0.8 + random() * 0.4) * 10) / 10;
  return {
    borderTopLeftRadius: corner(),
    borderTopRightRadius: corner(),
    borderBottomRightRadius: corner(),
    borderBottomLeftRadius: corner(),
  };
}

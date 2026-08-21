/**
 * Where the plants of an offer stand — the arithmetic behind the row of three
 * things a finished sitting may be exchanged for.
 *
 * Kept free of react, react-native and svg imports — the `ring.ts` and
 * `field.ts` precedent — because what this module exists to guarantee is that
 * three offers of one, two and three plants fit a phone's width and stand on
 * one ground line, and neither of those is worth a renderer to check.
 *
 * It is the garden's problem restated at another size: `field.ts` fits a
 * twelve-column lattice into a measured width and stands every drawing on one
 * line; this fits three groups into one and does the same. Where the two part
 * company is in what they may know about a drawing. The garden lays out its
 * lattice before it knows which species will land in it, so it works from
 * bounds over all twelve; a row of offers is three named species, and using the
 * bound there spaces a pair of reeds a plant's width apart. So `Ink` is asked
 * for rather than assumed — the same arrangement as `field`'s `sproutPeak`,
 * which is a fact about the motion rather than about the field.
 */

import { space } from '../theme/tokens';
import { Ink, ROOT_SHARE } from './field';

/**
 * The largest a single plant is drawn here.
 *
 * A cap rather than a size: the row is fitted to the width it is given, and a
 * narrow enough phone lands below this. On every current handset the cap binds,
 * which is the point — a plant is then drawn the same size whatever it is and
 * whatever it is beside, instead of quietly growing with the handset or with
 * how narrow this sitting's species happen to be.
 *
 * The value is the approved mockup's, and what it buys is air: fitted rather
 * than capped, a long sitting's three offers come within twenty-seven points of
 * the screen's own margins on an iPhone SE, which reads as a packed strip. A
 * test pins the air rather than the number.
 */
const SIZE_MAX = 82;

/** Air between the three offers, so they read as three rather than as a strip. */
const GAP = space.md;

/**
 * Room between the ink and the edge of the box the chosen marker fills.
 *
 * The box hugs the ink on all four sides rather than being a fixed rectangle
 * every offer is dropped into. Species differ enormously in reach — a poppy's
 * ink stands nearly twice as high above its root as a grass's — so one box for
 * all three would be drawn to the tallest of them, and the marker on a short
 * offer would be a slab with a plant lying along the bottom of it.
 */
const PAD = space.sm;

/**
 * How much of their ink two neighbours in a bundle share.
 *
 * Zero has them touch exactly, which reads as a row of separate plants — a
 * shopping list, which is the one thing a bundle must not look like, since a
 * bundle is always one species. Much past this and a clover's leaves start
 * hiding each other and the count stops being readable at a glance, which is
 * the whole information the drawing carries that the species does not.
 */
const OVERLAP = 0.18;

/**
 * The hand variation inside a bundle: no two of one species are drawn the same
 * size, because three identical drawings in a row read as a stamp rather than
 * as a patch of something.
 *
 * A fixed table and not a seed, on the `box.ts` argument: one bundle is on
 * screen per offer, so the app wants one bundle character rather than a family
 * of them. It is normalised in RMS below, which is what stops the variation
 * from quietly changing the ink area the shrink is chosen to hold — the table
 * is a look, and the area is the rule.
 */
const VARY = [1.06, 0.93, 1.01];

/** One offer, as something to lay out: how many plants, and how far one reaches. */
export type OfferShape = {
  count: number;
  /** The species' own reach. Every plant in a bundle is the same species. */
  ink: Ink;
};

/** One plant's canvas, placed in an offer's box. */
export type PlantMark = {
  /** The canvas side, in points — what `<Plant size>` is given. */
  size: number;
  /**
   * The canvas's left and top edges, from the box's own corner. Both are
   * usually negative, because a plant's ink is a fraction of its canvas and the
   * margin around it hangs out of a box drawn to the ink. Nothing clips it,
   * exactly as nothing clips a plant leaning out of its cell in the garden.
   */
  x: number;
  y: number;
};

/** One of the three things on offer, drawn to its own ink. */
export type OfferLayout = {
  /** The box: what the chosen marker fills, and what answers a touch. */
  width: number;
  height: number;
  /**
   * The line every plant in this offer roots on, from the box's top. It is
   * always `height - PAD`, which is what lets a row of boxes share one ground
   * line by simply sitting on one bottom edge.
   */
  ground: number;
  /** The plants, in reading order. */
  marks: PlantMark[];
};

/** The three offers, laid out together. */
export type OfferRow = {
  /** The air between boxes, so the screen does not restate it. */
  gap: number;
  offers: OfferLayout[];
};

/**
 * The canvas sizes of a bundle of `count`, at a nominal single-plant size.
 *
 * The shrink is `1/√count`, which is the app's own rule about doodles applied
 * to a group: scaling by that keeps the total ink *area* of two or three plants
 * equal to one plant's, so a bundle is the same amount of drawing rearranged
 * rather than two or three times as much of it. Holding the width instead would
 * make a trio of clovers too small to count, and holding the size would make a
 * long sitting's third offer three times the mark of its first — an offer drawn
 * bigger is an offer being recommended, and every one of these is available.
 */
function sizes(count: number, nominal: number): number[] {
  const vary = Array.from({ length: count }, (_, i) => VARY[i % VARY.length]);
  const rms = Math.sqrt(vary.reduce((sum, v) => sum + v * v, 0) / count);

  return vary.map((v) => (nominal / Math.sqrt(count)) * (v / rms));
}

/** One offer's plant sizes and where each one's ink centre falls along the row. */
function place(shape: OfferShape, nominal: number) {
  const plants = sizes(shape.count, nominal);
  const inks = plants.map((size) => 2 * shape.ink.half * size);

  // Ink centres, walking left to right. The step between two neighbours is
  // measured against their own two half-widths rather than against the nominal
  // size, so the small one in a bundle tucks in closer than the large one does
  // and the group keeps an even density.
  const centres = [inks[0] / 2];
  for (let i = 1; i < shape.count; i++) {
    centres.push(centres[i - 1] + (1 - OVERLAP) * ((inks[i - 1] + inks[i]) / 2));
  }

  return {
    plants,
    centres,
    span: centres[shape.count - 1] + inks[shape.count - 1] / 2,
    // The tallest plant decides how high the box has to reach. Every plant in
    // it roots on the same line, so nothing reaches below.
    rise: shape.ink.rise * Math.max(...plants),
  };
}

/**
 * The three offers, fitted to a measured width.
 *
 * The nominal size is solved rather than searched: every box's width is
 * proportional to it, so the padding and the gaps come off the budget once and
 * the rest divides.
 *
 * A width of zero — the frame before anything has been measured — comes back
 * with no offers rather than with negative ones, which is the caller's cue that
 * there is nothing to draw yet.
 */
export function offerRow(shapes: readonly OfferShape[], width: number): OfferRow {
  const empty: OfferRow = { gap: GAP, offers: [] };
  if (shapes.length === 0 || shapes.some((shape) => shape.count < 1)) return empty;

  const budget = width - shapes.length * 2 * PAD - GAP * (shapes.length - 1);
  const unit = shapes.reduce((sum, shape) => sum + place(shape, 1).span, 0);
  if (budget <= 0 || unit <= 0) return empty;

  const nominal = Math.min(SIZE_MAX, budget / unit);

  return {
    gap: GAP,
    offers: shapes.map((shape) => {
      const { plants, centres, span, rise } = place(shape, nominal);
      const ground = PAD + rise;

      return {
        width: span + 2 * PAD,
        height: ground + PAD,
        ground,
        marks: plants.map((size, i) => ({
          x: PAD + centres[i] - size / 2,
          // Every root on the offer's one line, and every offer's line on the
          // row's, since each box ends exactly `PAD` below it. A plant's root is
          // `ROOT_SHARE` down its own canvas, so each mark is offset by its own
          // distance from the line — the same correction `field.ts` makes for
          // the same reason, and the reason neither module lets a drawing own
          // where the ground is.
          y: ground - ROOT_SHARE * size,
          size,
        })),
      };
    }),
  };
}

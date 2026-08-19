/**
 * Where things sit in the garden: the arithmetic that stands a dot and a plant
 * on the same ground, and works out what that costs the grid in padding.
 *
 * Kept free of react, react-native and svg imports — the src/ui/ring.ts
 * precedent — because the guarantee this module exists to make is one you want
 * checked without a renderer standing by.
 */

import { ART_SHARE, SCATTER } from '../domain/plots';
import { SWAY_LEAN_DEG } from './sway';

/**
 * Twelve across, so 108 lands on nine rows exactly and the whole plot sits on
 * one screen. A dot is then a small mark in a dense field rather than a button
 * with an inch of paper around it, which is what makes the garden read as one
 * drawing instead of as a list of what you have done.
 */
export const COLUMNS = 12;

/** The page every plant is drawn on. */
export const CANVAS = 48;

/**
 * The line every species is drawn to stand on, on that page.
 *
 * It is a contract rather than an observation: the drawings in `Plant.tsx` all
 * end here on purpose, so that a plot of plants shares a baseline. This module
 * is what that baseline is *for*, which is why the number lives here and the
 * drawings import it.
 */
export const ROOT_Y = 43;

/**
 * Where a plant's root falls on its own canvas — and so where `Sprout` has to
 * pivot, because a plant grows from its root rather than from near it.
 */
export const ROOT_SHARE = ROOT_Y / CANVAS;

/**
 * How far a plant is drawn past the share of the cell `ART_SHARE` allows.
 *
 * A plant does not fill its canvas the way the containment share assumes. The
 * doodles keep a margin for the nib and root low on the page, so the ink covers
 * about two thirds of what is measured out for it — at cell size the drawing
 * came out small and the field read as sparse. Drawn getting on for twice as
 * large, the *ink* fills the cell and the canvas margin is what hangs over.
 *
 * So the guarantee is spent knowingly, and only here: the empty dot still takes
 * `ART_SHARE` neat, which is what keeps the unplanted field on its lattice.
 * Plants may touch at the edges, and a garden where they do is a garden.
 */
export const PLANT_ZOOM = 1.85;

/**
 * Where the ground is, as a fraction of a cell measured from its top.
 *
 * Both drawings are placed against this and neither owns it, which is the whole
 * point. They used to be centred instead, and centring means two different
 * things to them: a dot's ink *is* the middle of its canvas, while a plant's
 * root sits `ROOT_SHARE` down its own. At `PLANT_ZOOM` the difference came to
 * about two thirds of a cell, so a plant grew from well below the dot that
 * started it — visibly wrong in any row holding some of each, and a quiet
 * contradiction of the rule that a sitting grows where you touched.
 *
 * The value is a look, not a derivation. Every value puts the two marks on one
 * line; what it picks is which of them pays for it, and so whether the planted
 * field moves or the tap targets do. At 0.8 they split it about evenly and the
 * dot keeps most of a cell under it to be tapped in. An empty garden is
 * identical at any value — a uniform lattice has nothing to compare itself
 * against — so this only ever shows itself in a half-planted row.
 */
export const GROUND = 0.8;

/**
 * The dot blob's reach past its own centre, as a fraction of its canvas. Read
 * off `Plant.tsx`'s `DOT` against `DOT_CANVAS`, and only ever used to ask how
 * far the lowest row hangs.
 */
const BLOB_SHARE = 2.7 / 28;

/**
 * A plant's ink across its own page, as a fraction of it. The doodles span
 * x=8.6..39.4 of the 48, so a plant is a good deal narrower than the canvas
 * measured out for it — which is the slack `PLANT_ZOOM` spends.
 */
const INK_HALF = 15.4 / CANVAS;

/**
 * How far the topmost ink stands above the root it pivots on. Measured from
 * `ROOT_Y` and not from the foot of the canvas, because the root is what the
 * sway turns about and a lean's reach is the tip's arc around that point.
 */
const INK_RISE = (ROOT_Y - 5) / CANVAS;

/**
 * How far a plant reaches past its own cell, per side, as a share of a cell.
 *
 * Sideways is the one direction with nowhere to put an overhang. Above and
 * below it becomes padding on the grid, but the grid is *centred*, so widening
 * it moves nothing at all — the leftmost cell stays exactly where it was. The
 * only thing that can pay is the cell itself.
 *
 * Every term is proportional to the cell, which is what stops "how wide is a
 * cell when its own margin depends on the cell" from needing to iterate: the
 * whole margin is a fixed share, and `field` divides by it once.
 */
export const SWAY_REACH = Math.max(
  0,
  ART_SHARE *
    PLANT_ZOOM *
    (INK_HALF + INK_RISE * Math.tan((SWAY_LEAN_DEG * Math.PI) / 180)) +
    SCATTER -
    0.5
);

/** Everything the grid needs to draw one plot, in points. */
export type Field = {
  /** The side of one cell, and so the pitch of the lattice. */
  cell: number;
  /** The side of an empty dot's canvas. */
  dot: number;
  /** The side of a plant's canvas. */
  plant: number;
  /** How far *up* a plant moves to stand its root on the ground line. */
  lift: number;
  /** How far *down* a dot moves to sit on it. */
  drop: number;
  /** Room the grid must reserve outside itself, above and below. */
  above: number;
  below: number;
};

/**
 * The garden's geometry at a measured width.
 *
 * `sproutPeak` is how far past full height the burst throws a plant, which is
 * a fact about the motion rather than about the field — but it decides how much
 * room the top row needs, so it is asked for rather than assumed.
 */
export function field(width: number, sproutPeak: number): Field {
  // Twelve cells plus the room a leaning plant needs either side of the field,
  // then floored to a half point, and the grid is drawn at exactly what twelve
  // of them come to. Twelve fractional widths can total a hair over a fractional
  // container, which throws the twelfth cell onto a row of its own — a rounding
  // error that looks like a bug in the garden. Six columns were too coarse to
  // reach it. The leftover, `SWAY_REACH` either side and the odd half-point,
  // sits outside the grid, which is precisely where the outermost plants lean.
  const cell = width > 0 ? Math.floor((width / (COLUMNS + 2 * SWAY_REACH)) * 2) / 2 : 0;
  const dot = cell * ART_SHARE;
  const plant = dot * PLANT_ZOOM;

  const ground = cell * GROUND;

  // Both canvases start centred in the cell. A dot's ink is that centre; a
  // plant's root is `ROOT_SHARE` down its own canvas. Each moves by its own
  // distance from the ground line, which is what lands them on the same one —
  // and taking both from `ground` is what stops them drifting apart again.
  const plantTop = (cell - plant) / 2;
  const lift = plantTop + ROOT_SHARE * plant - ground;
  const drop = ground - cell / 2;

  // What the drawings need outside their own cells. It is reserved as padding
  // on the grid because the first and last rows have nowhere else to put it: a
  // scroll container clips at its own edge whatever its children say about
  // `overflow`, and the top row was losing its flowers' heads.
  const wander = cell * SCATTER;

  // A sprout scales about the ground line, so both ends of the canvas swing out
  // from there — the top is not the resting top plus a little, it is the whole
  // distance to the ground stretched by the peak.
  const top = ground - (ground - (plantTop - lift)) * sproutPeak;
  const foot = ground + (plantTop + plant - lift - ground) * sproutPeak;

  const above = Math.max(0, -top) + wander;
  // A lifted plant usually tucks its canvas back inside the cell, leaving the
  // dot as the deeper mark — but that flips if the ground is set low, so the
  // lower of the two is asked for rather than assumed.
  const below = Math.max(0, foot - cell, ground + BLOB_SHARE * dot - cell) + wander;

  return { cell, dot, plant, lift, drop, above, below };
}

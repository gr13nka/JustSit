/**
 * Where a garden's tally marks sit: the arithmetic behind `MiniField`.
 *
 * Kept free of react, react-native and svg imports — the `ring.ts`, `field.ts`
 * and `offerRow.ts` precedent — because what this module exists to guarantee is
 * that a garden's shape is legible at a fifth of an inch, and that does not
 * want a renderer to check. `MiniField.tsx` draws what this measures out, the
 * way `PlantGrid` draws `field.ts` — the pure half keeps its own name so the
 * two can be told apart at an import.
 *
 * It is the garden's problem at another size, and the difference from
 * `field.ts` is which way the fitting runs. The garden is given a width and
 * works out a pitch; a thumbnail is given a box and works out the largest mark
 * that fits its own shape into it.
 */

import { shapeFor } from './field';

/**
 * The page every thumbnail mark is drawn on: ten wide, fourteen tall, a stroke
 * standing on a ground line at the foot of it.
 *
 * It is not the plant canvas. A plant is a drawing; a thumbnail mark is a
 * *tally* — one stroke that says a sitting happened here, in the green that
 * means something grew, with a fleck of the species' own bloom pen where the
 * species blooms. At this size an actual plant is a smudge, and a hundred and
 * eight of them is a page the phone cannot afford.
 */
export const MARK_PAGE = { width: 10, height: 14 } as const;

/** Air between marks, as a share of a mark's own width and of its own height. */
const GAP_X = 0.24;
const GAP_Y = 0.26;

/** How tall a mark is against its own width. */
const RATIO = MARK_PAGE.height / MARK_PAGE.width;

/** One garden's thumbnail, in points. */
export type MiniGrid = {
  cols: number;
  rows: number;
  /** One mark's drawn width. */
  mark: number;
  markHeight: number;
  gapX: number;
  gapY: number;
  /** The whole thumbnail. */
  width: number;
  height: number;
};

/** A garden of `size` dots, drawn at a mark of `mark` points wide. */
export function miniGrid(size: number, mark: number): MiniGrid {
  const { cols, rows } = shapeFor(size);
  const markHeight = mark * RATIO;
  const gapX = mark * GAP_X;
  const gapY = markHeight * GAP_Y;

  return {
    cols,
    rows,
    mark,
    markHeight,
    gapX,
    gapY,
    width: cols * mark + Math.max(0, cols - 1) * gapX,
    height: rows * markHeight + Math.max(0, rows - 1) * gapY,
  };
}

/**
 * The largest mark, no bigger than `max`, at which a garden of `size` fits a
 * box. Zero when there is no room at all, which is a caller's cue that there is
 * nothing to draw yet rather than an instruction to draw something negative.
 */
export function markToFit(
  size: number,
  box: { width: number; height: number },
  max: number
): number {
  const { cols, rows } = shapeFor(size);

  // Both are linear in the mark, so each is one division rather than a search:
  // every gap is a share of the mark it sits beside.
  const across = box.width / (cols + Math.max(0, cols - 1) * GAP_X);
  const down = box.height / (RATIO * (rows + Math.max(0, rows - 1) * GAP_Y));

  return Math.max(0, Math.min(max, across, down));
}

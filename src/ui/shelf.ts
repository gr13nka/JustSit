/**
 * Where a garden's thumbnail marks sit, and how a shelf of them packs.
 *
 * Kept free of react, react-native and svg imports — the `ring.ts`, `field.ts`
 * and `offerRow.ts` precedent — because what this module exists to guarantee is
 * that a garden's shape is legible at a fifth of an inch and that a whole shelf
 * of them fits a phone, and neither wants a renderer to check.
 *
 * It is the garden's problem at another size, and the difference from
 * `field.ts` is which way the fitting runs. The garden is given a width and
 * works out a pitch; a shelf is given a set of gardens and works out the one
 * pitch that draws all of them. The mark is deliberately the *same size across
 * a shelf* — that is what lets a 108 be seen to be twelve times a 9, which is
 * the only claim the shelf makes and the whole reason it is not a list of
 * numbers.
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
 * eight of them per card is a page the phone cannot afford.
 */
export const MARK_PAGE = { width: 10, height: 14 } as const;

/**
 * A window on that page, and how densely marks cut to it are set.
 *
 * Two exist and they differ in one real way: whether the mark is a stroke that
 * stands up, or only the blob at its foot. A grown garden needs the whole page
 * and reads as rows of tallies; a *shape preview* — the bed a size would lay
 * out, before anything has grown in it — needs the blob alone, because a field
 * of empty dots set on a tall page comes out as stripes with air between them
 * rather than as a shape you can compare with another shape.
 */
export type MiniPage = {
  /** The window on `MARK_PAGE`, in its own units. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Air between marks, as a share of a mark's own width and of its own height. */
  gapX: number;
  gapY: number;
};

/** A garden that has been grown in: the whole page, marks standing on a ground. */
export const GROWN_PAGE: MiniPage = {
  x: 0,
  y: 0,
  width: MARK_PAGE.width,
  height: MARK_PAGE.height,
  gapX: 0.24,
  gapY: 0.26,
};

/**
 * A bed nobody has planted yet: the blob alone, on a square pitch.
 *
 * Square because the question a preview answers is "what shape is 27", and a
 * lattice whose rows are half again as far apart as its columns answers a
 * different one.
 */
export const SHAPE_PAGE: MiniPage = {
  x: 3.4,
  y: 7.9,
  width: 3.1,
  height: 3.1,
  gapX: 0.38,
  gapY: 0.38,
};

/** One garden's thumbnail, in points. */
export type MiniGrid = {
  cols: number;
  rows: number;
  /** One mark's drawn width — the same number for every card on a shelf. */
  mark: number;
  markHeight: number;
  gapX: number;
  gapY: number;
  /** The whole thumbnail. */
  width: number;
  height: number;
};

/** How tall a mark is against its own width, on a given page. */
function ratio(page: MiniPage): number {
  return page.height / page.width;
}

/** A garden of `size` dots, drawn at a mark of `mark` points wide. */
export function miniGrid(size: number, mark: number, page: MiniPage = GROWN_PAGE): MiniGrid {
  const { cols, rows } = shapeFor(size);
  const markHeight = mark * ratio(page);
  const gapX = mark * page.gapX;
  const gapY = markHeight * page.gapY;

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
  max: number,
  page: MiniPage = GROWN_PAGE
): number {
  const { cols, rows } = shapeFor(size);

  // Both are linear in the mark, so each is one division rather than a search:
  // every gap is a share of the mark it sits beside.
  const across = box.width / (cols + Math.max(0, cols - 1) * page.gapX);
  const down = box.height / (ratio(page) * (rows + Math.max(0, rows - 1) * page.gapY));

  return Math.max(0, Math.min(max, across, down));
}

/**
 * The mark a whole shelf shares: the largest, no bigger than `max`, at which
 * every garden still fits the card it was given.
 *
 * `room` is what that garden's own card has inside its padding — a wide card
 * for a mala, half a row for anything narrower. It is asked for per garden
 * rather than worked out here because which cards are wide is a fact about the
 * shelf's layout, and `shelfRows` below is where that lives.
 */
export function shelfMark(
  gardens: readonly { size: number; room: { width: number; height: number } }[],
  max: number,
  page: MiniPage = GROWN_PAGE
): number {
  return gardens.reduce(
    (mark, garden) => Math.min(mark, markToFit(garden.size, garden.room, max, page)),
    max
  );
}

// ---------------------------------------------------------------------------
// The shelf's masonry
// ---------------------------------------------------------------------------

/**
 * The widest garden that will share a row.
 *
 * A card is cut to the shape of its own field, so two of them fit side by side
 * exactly when two of those fields do. Nine is the ladder's width and twelve is
 * a mala's, so this is the line between "a bed" and "the whole lattice" without
 * having to name either.
 */
const SHARED_ROW_COLUMNS = 9;

/** Whether a garden of this size is narrow enough to share a row. */
export function sharesRow(size: number): boolean {
  return shapeFor(size).cols <= SHARED_ROW_COLUMNS;
}

/** One place on the shelf: a garden's card, or the cat who keeps them. */
export type ShelfCell = { garden: number } | { keeper: true };

/** A cell that is a garden, narrowed for the caller. */
export function isGarden(cell: ShelfCell): cell is { garden: number } {
  return 'garden' in cell;
}

/**
 * The shelf, packed into rows of at most two.
 *
 * Oldest first and never reordered: the shelf is the app's whole progress
 * figure, and a shelf that sorted itself by size would stop being a record of
 * anything. So a mala simply takes the row it is standing on, and the gardens
 * after it start a new one — which is what leaves the half-rows the shelf is
 * read by, a bed of three sitting beside a row of nine.
 *
 * Батон takes the first half-row nobody is using. He is placed rather than
 * earned: he keeps this screen the way he keeps the empty garden, and tying him
 * to a deed — finishing something, sitting today — would make him the
 * congratulation this app does not do. If every row is full he gets one of his
 * own rather than being dropped, because a screen he is missing from is a screen
 * that looks like it is judging you.
 */
export function shelfRows(wide: readonly boolean[]): ShelfCell[][] {
  const rows: ShelfCell[][] = [];
  // The row still waiting for a second card, if there is one.
  let open = -1;

  for (let i = 0; i < wide.length; i++) {
    if (open >= 0 && !wide[i]) {
      rows[open].push({ garden: i });
      open = -1;
      continue;
    }

    rows.push([{ garden: i }]);
    open = wide[i] ? -1 : rows.length - 1;
  }

  const half = rows.findIndex((row) => {
    const cell = row[0];
    return row.length === 1 && isGarden(cell) && !wide[cell.garden];
  });

  if (half === -1) rows.push([{ keeper: true }]);
  else rows[half].push({ keeper: true });

  return rows;
}

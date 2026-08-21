import {
  GROWN_PAGE,
  isGarden,
  markToFit,
  miniGrid,
  SHAPE_PAGE,
  sharesRow,
  shelfMark,
  shelfRows,
  ShelfCell,
} from '../shelf';

/** What the shelf's card padding leaves a half-width and a full-width card. */
const HALF = { width: 130, height: 400 };
const FULL = { width: 300, height: 400 };

describe('miniGrid', () => {
  it('lays a thumbnail out on the garden its own shape', () => {
    // A thumbnail is the same shape as the field it stands for, or it is not a
    // thumbnail of it. `shapeFor` is the one answer to that, here as well as in
    // the garden itself.
    expect(miniGrid(108, 10)).toMatchObject({ cols: 12, rows: 9 });
    expect(miniGrid(27, 10)).toMatchObject({ cols: 9, rows: 3 });
    expect(miniGrid(3, 10)).toMatchObject({ cols: 3, rows: 1 });
  });

  it('measures itself including the air between marks, but not around them', () => {
    const grid = miniGrid(27, 10);
    expect(grid.width).toBeCloseTo(9 * 10 + 8 * grid.gapX, 9);
    expect(grid.height).toBeCloseTo(3 * grid.markHeight + 2 * grid.gapY, 9);
  });

  it('gives a single mark no gaps at all', () => {
    // A one-dot garden is reachable by shrinking. Eight gaps around one mark
    // would draw a card with a hole in the middle of it.
    const grid = miniGrid(1, 10);
    expect(grid.width).toBe(10);
    expect(grid.height).toBeCloseTo(grid.markHeight, 9);
  });

  it('sets a shape preview on a square pitch and a grown garden on a tall one', () => {
    // The difference is the mark, not the taste: a tally is a stroke standing
    // up, and a preview is only the blob at its foot.
    const preview = miniGrid(27, 10, SHAPE_PAGE);
    expect(preview.markHeight).toBeCloseTo(preview.mark, 9);
    expect(preview.gapY).toBeCloseTo(preview.gapX, 9);

    const grown = miniGrid(27, 10, GROWN_PAGE);
    expect(grown.markHeight).toBeGreaterThan(grown.mark);
  });
});

describe('markToFit', () => {
  it('fills the box it was given, to the point but no further', () => {
    for (const size of [3, 9, 27, 54, 108]) {
      const box = { width: 137, height: 96 };
      const grid = miniGrid(size, markToFit(size, box, 999));

      expect(grid.width).toBeLessThanOrEqual(box.width + 1e-9);
      expect(grid.height).toBeLessThanOrEqual(box.height + 1e-9);
      // One of the two is the binding constraint, or the mark was left small
      // for no reason.
      expect(
        Math.abs(grid.width - box.width) < 1e-9 || Math.abs(grid.height - box.height) < 1e-9
      ).toBe(true);
    }
  });

  it('never grows past the cap, however much room there is', () => {
    expect(markToFit(9, { width: 4000, height: 4000 }, 12.5)).toBe(12.5);
  });

  it('has no mark at all before anything has been measured', () => {
    // `onLayout` has not fired on the first render, and a card drawn at a
    // negative mark is worse than one not drawn.
    expect(markToFit(9, { width: 0, height: 0 }, 12.5)).toBe(0);
    expect(markToFit(9, { width: -20, height: 100 }, 12.5)).toBe(0);
  });
});

describe('shelfMark', () => {
  it('gives every garden on a shelf the same mark', () => {
    // The one claim the shelf makes is that a 108 is twelve times a 9. It makes
    // it by drawing the same mark twelve times as often, and a shelf that sized
    // each card to its own room would make every garden look the same size.
    const sizes = [3, 9, 27, 108, 54];
    const mark = shelfMark(
      sizes.map((size) => ({ size, room: sharesRow(size) ? HALF : FULL })),
      12.5
    );

    for (const size of sizes) {
      const room = sharesRow(size) ? HALF : FULL;
      const grid = miniGrid(size, mark);
      expect(grid.width).toBeLessThanOrEqual(room.width + 1e-9);
      expect(grid.height).toBeLessThanOrEqual(room.height + 1e-9);
    }
  });

  it('is set by the garden with the least room for its shape', () => {
    const wide = shelfMark([{ size: 108, room: FULL }], 12.5);
    const cramped = shelfMark(
      [
        { size: 108, room: FULL },
        { size: 54, room: { width: 60, height: 400 } },
      ],
      12.5
    );
    expect(cramped).toBeLessThan(wide);
  });

  it('is the cap when nothing on the shelf is cramped', () => {
    expect(shelfMark([{ size: 3, room: FULL }], 12.5)).toBe(12.5);
  });
});

describe('sharesRow', () => {
  it('keeps a mala to a row of its own and lets the ladder pair up', () => {
    expect(sharesRow(3)).toBe(true);
    expect(sharesRow(9)).toBe(true);
    expect(sharesRow(54)).toBe(true);
    expect(sharesRow(108)).toBe(false);
  });
});

/** The gardens in one row, as sizes, with the keeper written as null. */
function read(rows: ShelfCell[][], sizes: readonly number[]): (number | null)[][] {
  return rows.map((row) => row.map((cell) => (isGarden(cell) ? sizes[cell.garden] : null)));
}

describe('shelfRows', () => {
  it('packs half-width gardens two to a row, oldest first', () => {
    const sizes = [3, 9, 27, 108, 54];
    // The mockup's shelf: [3][9] / [27][Батон] / [108] / [54, the current one].
    const wide = [false, false, false, true, true];

    expect(read(shelfRows(wide), sizes)).toEqual([
      [3, 9],
      [27, null],
      [108],
      [54],
    ]);
  });

  it('never reorders, so a mala simply ends the row it lands on', () => {
    // The shelf is the app's whole progress figure. Sorting it by size to close
    // the gaps would stop it being a record of anything.
    const sizes = [9, 108, 9, 9];
    const rows = read(shelfRows([false, true, false, false]), sizes);
    expect(rows[0]).toEqual([9, null]);
    expect(rows[1]).toEqual([108]);
    expect(rows[2]).toEqual([9, 9]);
  });

  it('draws every garden exactly once', () => {
    for (const wide of [
      [false],
      [true],
      [false, false, false],
      [true, false, true, false, false, true],
    ]) {
      const drawn = shelfRows(wide)
        .flat()
        .filter(isGarden)
        .map((cell) => cell.garden);
      expect(drawn.sort((a, b) => a - b)).toEqual(wide.map((_, i) => i));
    }
  });

  it('seats the keeper in the first half-row nobody is using', () => {
    const rows = shelfRows([false, false, false, true]);
    expect(rows[1]).toEqual([{ garden: 2 }, { keeper: true }]);
  });

  it('gives the keeper a row of his own rather than dropping him', () => {
    // He is placed, not earned. A screen he is missing from is a screen that
    // looks like it is judging you.
    for (const wide of [[true], [false, false], [true, true, true]]) {
      const keepers = shelfRows(wide)
        .flat()
        .filter((cell) => !isGarden(cell));
      expect(keepers).toHaveLength(1);
    }
  });

  it('puts him on the shelf even when there is nothing on it yet', () => {
    expect(shelfRows([])).toEqual([[{ keeper: true }]]);
  });
});

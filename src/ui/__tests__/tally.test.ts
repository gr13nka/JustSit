import { markToFit, miniGrid } from '../tally';

describe('miniGrid', () => {
  it('lays a thumbnail out on the garden its own shape', () => {
    // A thumbnail is the same shape as the field it stands for, or it is not a
    // thumbnail of it. `shapeFor` is the one answer to that, here as well as in
    // the garden itself.
    expect(miniGrid(108, 10)).toMatchObject({ cols: 12, rows: 9 });
    expect(miniGrid(24, 10)).toMatchObject({ cols: 12, rows: 2 });
    expect(miniGrid(3, 10)).toMatchObject({ cols: 3, rows: 1 });
  });

  it('measures itself including the air between marks, but not around them', () => {
    const grid = miniGrid(24, 10);
    expect(grid.width).toBeCloseTo(12 * 10 + 11 * grid.gapX, 9);
    expect(grid.height).toBeCloseTo(2 * grid.markHeight + grid.gapY, 9);
  });

  it('gives a single mark no gaps at all', () => {
    // Eight gaps around one mark would draw a card with a hole in the middle.
    const grid = miniGrid(1, 10);
    expect(grid.width).toBe(10);
    expect(grid.height).toBeCloseTo(grid.markHeight, 9);
  });

  it('draws a tally standing up rather than square', () => {
    // The mark is a stroke on a ground line, not a dot: taller than it is wide,
    // which is what makes a row of them read as a tally.
    const grid = miniGrid(24, 10);
    expect(grid.markHeight).toBeGreaterThan(grid.mark);
  });
});

describe('markToFit', () => {
  it('fills the box it was given, to the point but no further', () => {
    for (const size of [3, 6, 12, 24, 108]) {
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
    expect(markToFit(12, { width: 4000, height: 4000 }, 12.5)).toBe(12.5);
  });

  it('has no mark at all before anything has been measured', () => {
    // `onLayout` has not fired on the first render, and a card drawn at a
    // negative mark is worse than one not drawn.
    expect(markToFit(12, { width: 0, height: 0 }, 12.5)).toBe(0);
    expect(markToFit(12, { width: -20, height: 100 }, 12.5)).toBe(0);
  });
});

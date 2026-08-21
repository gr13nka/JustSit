import { ART_SHARE, SCATTER } from '../../domain/plots';
import {
  CANVAS,
  COLUMNS,
  field,
  GROUND,
  PLANT_ZOOM,
  ROOT_SHARE,
  ROOT_Y,
  shapeFor,
} from '../field';

/** Real screens, roughly: an iPhone SE, a CMF Phone 1, and an awkward one. */
const WIDTHS = [335, 371, 412, 500.75];

/** What the burst overshoots by. The shipped table's peak, and a wilder one. */
const PEAKS = [1.63, 2.4];

/**
 * Where the dot's ink lands in its cell, measured from the cell's top.
 *
 * The drawing is centred in a box of side `dot`, which is itself centred in the
 * cell, and the blob is the middle of that box — so before the drop it is
 * simply the middle of the cell.
 */
const dotInk = (f: ReturnType<typeof field>) => f.cell / 2 + f.drop;

/**
 * Where a plant's root ink lands, the same way. Its box is centred too, but the
 * root is `ROOT_SHARE` down it rather than halfway, which is the whole of what
 * this module exists to correct for.
 */
const rootInk = (f: ReturnType<typeof field>) =>
  (f.cell - f.plant) / 2 + ROOT_SHARE * f.plant - f.lift;

describe('field', () => {
  // Points, not fractions: a hundredth of a point is invisible and a tenth is
  // not, so this is tight enough to catch a real drift and loose enough to
  // ignore floating point.
  const HAIR = 1e-9;

  it('stands the dot and the plant on the same line', () => {
    // The reason this module exists. Both drawings used to be centred in their
    // cell, which put a plant's root two thirds of a cell below the dot that
    // started it — visible in any row holding some of each, and a contradiction
    // of the rule that a sitting grows where you touched.
    for (const width of WIDTHS) {
      for (const peak of PEAKS) {
        const f = field(width, peak);
        expect(Math.abs(dotInk(f) - rootInk(f))).toBeLessThan(HAIR);
      }
    }
  });

  it('puts that line where `GROUND` says, and not where the drawings prefer', () => {
    const f = field(371, 1.63);
    expect(rootInk(f)).toBeCloseTo(f.cell * GROUND, 9);
  });

  it('keeps them together however far a plant is zoomed', () => {
    // The old arrangement did not: the gap was `(ROOT_Y - CANVAS / 2) / CANVAS`
    // of the plant's size, so every increase in `PLANT_ZOOM` widened it and the
    // bug arrived by degrees rather than all at once.
    const f = field(371, 1.63);
    const drifted = ((ROOT_Y - CANVAS / 2) / CANVAS) * f.plant;
    expect(drifted).toBeGreaterThan(f.cell / 2);
    expect(Math.abs(dotInk(f) - rootInk(f))).toBeLessThan(HAIR);
  });

  it('leaves the dot inside its own cell, so what you tap is what you see', () => {
    // The dot is drawn where the plant will root, but the square that answers a
    // touch stays on the lattice. Push the ground much lower and the mark would
    // hang into the row below, where a tap on it starts a sitting elsewhere.
    const f = field(371, 1.63);
    const blob = (2.7 / 28) * f.dot;
    expect(dotInk(f) - blob).toBeGreaterThan(0);
    expect(dotInk(f) + blob).toBeLessThan(f.cell);
  });

  it('reserves enough room above for a sprout at its peak', () => {
    // A scroll container clips at its own edge whatever its children say about
    // overflow, and a flower with its head sheared flat reads as a drawing
    // style rather than as a bug. That is what makes this worth asserting.
    for (const width of WIDTHS) {
      for (const peak of PEAKS) {
        const f = field(width, peak);
        const ground = f.cell * GROUND;
        const top = (f.cell - f.plant) / 2 - f.lift;
        const stretched = ground - (ground - top) * peak;
        expect(f.above).toBeGreaterThanOrEqual(-stretched);
      }
    }
  });

  it('reserves enough room below for whichever mark hangs lowest', () => {
    for (const width of WIDTHS) {
      for (const peak of PEAKS) {
        const f = field(width, peak);
        const ground = f.cell * GROUND;
        const foot = ground + ((f.cell + f.plant) / 2 - f.lift - ground) * peak;
        expect(f.below).toBeGreaterThanOrEqual(foot - f.cell);
        expect(f.below).toBeGreaterThanOrEqual(dotInk(f) + (2.7 / 28) * f.dot - f.cell);
      }
    }
  });

  it('carries a full scatter in each margin on top of that', () => {
    // A cell's contents wander off centre by up to `SCATTER`, and the outermost
    // rows wander outward like every other one.
    const f = field(371, 1.63);
    const ground = f.cell * GROUND;
    const top = (f.cell - f.plant) / 2 - f.lift;
    const stretched = ground - (ground - top) * 1.63;
    expect(f.above - -stretched).toBeCloseTo(f.cell * SCATTER, 9);
  });

  it('floors the cell to a half point, so twelve of them still fit', () => {
    // Twelve fractional widths can total a hair over a fractional container,
    // which throws the twelfth cell onto a row of its own — a rounding error
    // that looks like a bug in the garden.
    for (const width of WIDTHS) {
      const { cell } = field(width, 1.63);
      expect(cell * 2).toBe(Math.floor(cell * 2));
      expect(cell * COLUMNS).toBeLessThanOrEqual(width);
    }
  });

  it('has no field at all before anything has been measured', () => {
    // `onLayout` has not fired yet on the first render, and a grid drawn at a
    // negative size is worse than one not drawn.
    const f = field(0, 1.63);
    expect(f.cell).toBe(0);
    expect(f.dot).toBe(0);
    expect(f.plant).toBe(0);
    expect(f.above).toBe(0);
    expect(f.below).toBe(0);
  });

  it('sizes the two drawings the way the garden claims to', () => {
    const f = field(371, 1.63);
    expect(f.dot).toBeCloseTo(f.cell * ART_SHARE, 9);
    expect(f.plant).toBeCloseTo(f.dot * PLANT_ZOOM, 9);
  });

  it('draws the same field every time — nothing here is rolled at runtime', () => {
    expect(field(371, 1.63)).toEqual(field(371, 1.63));
  });
});

describe('shapeFor', () => {
  it('keeps a mala twelve across and nine deep', () => {
    // Every garden on a phone today is a 108 laid out twelve wide. Cutting it
    // any other way would re-flow gardens people have been keeping for months,
    // since a plant's cell is its index within its own garden.
    expect(shapeFor(108)).toEqual({ cols: 12, rows: 9 });
  });

  it('lays the ladder below a mala out as full rectangles', () => {
    // Nine divides all three, which is the whole reason it is the width: a rung
    // with a ragged last row would read as an accident rather than as a bed.
    expect(shapeFor(9)).toEqual({ cols: 9, rows: 1 });
    expect(shapeFor(27)).toEqual({ cols: 9, rows: 3 });
    expect(shapeFor(54)).toEqual({ cols: 9, rows: 6 });
  });

  it('makes the starter bed a strip, however few dots it holds', () => {
    // Three in a row is a bed. Three in a square is a mistake, and one dot
    // alone in a second row is worse.
    expect(shapeFor(3)).toEqual({ cols: 3, rows: 1 });
    expect(shapeFor(2)).toEqual({ cols: 2, rows: 1 });
    expect(shapeFor(1)).toEqual({ cols: 1, rows: 1 });
  });

  it('holds every dot it was asked for, ragged last row and all', () => {
    // Only the quiet "grow this garden" path can ask for a size off the ladder,
    // and a garden of 40 is still a garden of 40.
    for (const size of [4, 5, 12, 40, 53, 99, 100, 107, 150, 216]) {
      const { cols, rows } = shapeFor(size);
      expect(cols * rows).toBeGreaterThanOrEqual(size);
      expect(cols * (rows - 1)).toBeLessThan(size);
    }
  });

  it('never narrows a garden grown past a mala', () => {
    expect(shapeFor(117).cols).toBe(COLUMNS);
    expect(shapeFor(216).cols).toBe(COLUMNS);
  });
});

describe("field, at a garden's own width", () => {
  it('draws a narrower bed at exactly the same pitch', () => {
    // The pitch is what lets a 9 be seen to be a ninth of a 108. A bed that
    // sized its own cells would spread three dots across a phone and the two
    // gardens would stop being comparable at all.
    const wide = field(371, 1.63, 12);
    const bed = field(371, 1.63, 3);

    expect(bed.cell).toBe(wide.cell);
    expect(bed.dot).toBe(wide.dot);
    expect(bed.plant).toBe(wide.plant);
    expect(bed.lift).toBe(wide.lift);
  });

  it('draws the lattice at its own width, leaving the rest for centring', () => {
    const bed = field(371, 1.63, 3);
    expect(bed.span).toBe(bed.cell * 3);
    expect(bed.span).toBeLessThan(371);

    const mala = field(371, 1.63);
    expect(mala.cols).toBe(COLUMNS);
    expect(mala.span).toBe(mala.cell * COLUMNS);
  });
});

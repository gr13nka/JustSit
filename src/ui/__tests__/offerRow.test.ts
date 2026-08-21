import { space } from '../../theme/tokens';
import { Ink, ROOT_SHARE } from '../field';
import { offerRow, OfferShape } from '../offerRow';

/**
 * The completion screen's body width on real phones: the screen's own margins
 * (`space.lg` each side) off an iPhone SE, an iPhone 15 and a CMF Phone 1.
 * The first is the one that has to fit; the rest are here so a fix for it
 * cannot be a number that only works there.
 */
const WIDTHS = [375, 393, 411].map((screen) => screen - 2 * space.lg);

/**
 * Two real species, at the ends of the range. Read off `Plant.tsx`'s drawings,
 * and written out here rather than imported so the geometry is checked against
 * numbers the test names — the module's whole contract is that it works from
 * whatever reach it is handed.
 *
 * The spread between them is the reason `Ink` is a parameter at all: a reed's
 * ink is a third the width of a grass's, so a pair of reeds spaced by the
 * garden's all-species bound would stand a plant's width apart.
 */
const GRASS: Ink = { half: 0.3208, rise: 0.4625 };
const REED: Ink = { half: 0.1083, rise: 0.7833 };

/** The three shapes a long sitting is worth: one rare, two mids, or three commons. */
const long = (ink: Ink): OfferShape[] => [1, 2, 3].map((count) => ({ count, ink }));
/** What a short sitting is worth — three singles, and the tightest bundle case gone. */
const short = (ink: Ink): OfferShape[] => [1, 1, 1].map((count) => ({ count, ink }));

/** Where one mark's ink starts and ends inside its box. */
const ink = (mark: { size: number; x: number }, of: Ink) => ({
  from: mark.x + (0.5 - of.half) * mark.size,
  to: mark.x + (0.5 + of.half) * mark.size,
});

const rowWidth = (row: ReturnType<typeof offerRow>) =>
  row.offers.reduce((sum, offer) => sum + offer.width, 0) +
  row.gap * (row.offers.length - 1);

describe('offerRow', () => {
  const HAIR = 1e-9;

  it('stands every plant of every offer on one ground line', () => {
    // The reason this module exists, and the same guarantee `field.ts` makes for
    // the garden. A bundle whose plants were each centred in a box would have
    // the small one floating, since a plant's root is `ROOT_SHARE` down its own
    // canvas rather than at the foot of it.
    for (const width of WIDTHS) {
      for (const shapes of [long(GRASS), long(REED)]) {
        const row = offerRow(shapes, width);
        for (const offer of row.offers) {
          for (const mark of offer.marks) {
            expect(Math.abs(mark.y + ROOT_SHARE * mark.size - offer.ground)).toBeLessThan(
              HAIR
            );
          }
        }
      }
    }
  });

  it('ends every box the same distance below its own ground line', () => {
    // What lets the screen put three boxes of different heights on one ground
    // line by simply sitting them on one bottom edge. Without it the row would
    // have to be told where the line is, and could disagree.
    const row = offerRow(
      [
        { count: 1, ink: GRASS },
        { count: 2, ink: REED },
        { count: 3, ink: GRASS },
      ],
      WIDTHS[1]
    );

    const below = row.offers.map((offer) => offer.height - offer.ground);
    for (const gap of below) expect(gap).toBeCloseTo(below[0], 9);
  });

  it('fits the width it is given, at an iPhone SE and wider', () => {
    for (const width of WIDTHS) {
      for (const shapes of [long(GRASS), short(GRASS), long(REED)]) {
        expect(rowWidth(offerRow(shapes, width))).toBeLessThanOrEqual(width + HAIR);
      }
    }
  });

  it('leaves air at the tightest real width rather than only just fitting', () => {
    // A row that fits to the point reads as a packed strip, and these three are
    // meant to sit on bare paper. Fitting the width rather than capping the size
    // leaves twenty-seven points here, which is what `SIZE_MAX` exists to stop.
    // If a future drawing makes this fail, the answer is a smaller cap or a
    // tighter overlap, never a narrower gap.
    const width = WIDTHS[0];
    expect(width - rowWidth(offerRow(long(GRASS), width))).toBeGreaterThan(space.xl);
  });

  it('draws a plant the same size whatever species it is', () => {
    // The cap binds on every real handset, and it has to: a row of reeds fitted
    // to the width would come out half again as large as a row of grasses,
    // which reads as the app making something of the species.
    const grass = offerRow(long(GRASS), WIDTHS[0]);
    const reed = offerRow(long(REED), WIDTHS[0]);

    expect(reed.offers[0].marks[0].size).toBeCloseTo(grass.offers[0].marks[0].size, 9);
  });

  it('gives a bundle the ink area of a single plant', () => {
    // The shrink is 1/√count for exactly this reason: two or three plants are
    // the same amount of drawing rearranged, not two or three times as much of
    // it. An offer drawn bigger is an offer being recommended, and all three
    // here are available. The hand variation inside a bundle is normalised so
    // it cannot quietly break this.
    const row = offerRow(long(GRASS), WIDTHS[2]);
    const area = (offer: (typeof row.offers)[number]) =>
      offer.marks.reduce((sum, mark) => sum + mark.size * mark.size, 0);

    for (const offer of row.offers) expect(area(offer)).toBeCloseTo(area(row.offers[0]), 6);
  });

  it('draws a single at the full nominal size, and no bundle larger', () => {
    const row = offerRow(long(GRASS), WIDTHS[2]);
    const biggest = Math.max(...row.offers.flatMap((o) => o.marks.map((m) => m.size)));
    expect(row.offers[0].marks[0].size).toBeCloseTo(biggest, 9);
  });

  it('overlaps the plants of a bundle whether the species is wide or narrow', () => {
    // The bug this parameter exists to fix. Spacing a bundle by a bound over all
    // twelve species left a pair of reeds a plant's width apart — three separate
    // drawings rather than a patch of something, which is the one thing a bundle
    // must not look like.
    for (const species of [GRASS, REED]) {
      const row = offerRow(long(species), WIDTHS[2]);

      for (const offer of row.offers.slice(1)) {
        for (let i = 1; i < offer.marks.length; i++) {
          const left = ink(offer.marks[i - 1], species);
          const right = ink(offer.marks[i], species);

          // In reading order, and genuinely overlapping.
          expect(right.from).toBeGreaterThan(left.from);
          expect(right.from).toBeLessThan(left.to);

          // But never by half, or the count stops being readable, which is the
          // whole of what the drawing says that the species does not.
          const shared = left.to - right.from;
          const narrower = Math.min(left.to - left.from, right.to - right.from);
          expect(shared).toBeLessThan(narrower / 2);
        }
      }
    }
  });

  it('keeps each offer’s ink inside its own box', () => {
    // The canvas margin hangs out either side and nothing clips it, but the ink
    // must not: the box is what the chosen marker fills, and a leaf outside it
    // would sit on the page while the rest of the plant sat on the marker.
    for (const species of [GRASS, REED]) {
      for (const offer of offerRow(long(species), WIDTHS[0]).offers) {
        for (const mark of offer.marks) {
          expect(ink(mark, species).from).toBeGreaterThanOrEqual(-HAIR);
          expect(ink(mark, species).to).toBeLessThanOrEqual(offer.width + HAIR);
          // And the same vertically, where a tall species is what would spill.
          expect(offer.ground - species.rise * mark.size).toBeGreaterThanOrEqual(-HAIR);
        }
      }
    }
  });

  it('has nothing to draw before anything has been measured', () => {
    // The first frame, and the frame after a screen with no session on it.
    expect(offerRow(long(GRASS), 0).offers).toHaveLength(0);
    expect(offerRow([], WIDTHS[0]).offers).toHaveLength(0);
    expect(offerRow([{ count: 0, ink: GRASS }], WIDTHS[0]).offers).toHaveLength(0);
  });
});

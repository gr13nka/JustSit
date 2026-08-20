/**
 * The geometry of a drawn box: a rounded rectangle closed the way a hand closes
 * one, as a single closed path.
 *
 * Kept free of react, react-native and svg imports — the `src/ui/ring.ts` and
 * `src/ui/time.ts` precedent — so the arithmetic can be checked without a
 * renderer standing by.
 *
 * This exists because `borderRadius` cannot draw. Four unequal CSS radii give a
 * box four corners that disagree, which is most of what makes hand-made work
 * look hand-made — but the four sides between them stay ruler-straight, and a
 * ruler-straight line is the one thing this app's pen never draws. A path can
 * belly each side a percent or two off true, which is the difference between a
 * box with soft corners and a box someone drew.
 */

/**
 * Each corner's radius, as a multiple of the nominal one, clockwise from the
 * top left. Fixed rather than seeded, and it stays fixed now that more than one
 * control is drawn this way: never two at once. Meditate and onboarding's Begin
 * are on different screens, and each side's bow is a fraction of its own length
 * so the two come out at different widths anyway — one hand, two sizes, rather
 * than a family of characters. A shape that re-rolled itself between frames
 * would read as a glitch instead of a hand. (`organicCorners` seeds because
 * many boxes are on screen at once and have to differ from each other. These
 * have nothing to differ from.)
 */
const CORNER = [1.2, 0.82, 1.12, 0.88];

/**
 * How far each side bows off true, as a fraction of *its own* length, clockwise
 * from the top. Positive bellies outward.
 *
 * Its own length rather than the box's shorter side, because a hand wanders in
 * proportion to how far it is travelling: measured against the short side, the
 * long edges of a wide button bow by well under a point and the box comes back
 * looking machined.
 *
 * Opposite sides disagree in sign on purpose. Bowing every side outward inflates
 * a box; bowing one out and its opposite in leans it, which is what a box drawn
 * in one pass actually does.
 */
const BELLY = [0.015, 0.02, 0.009, -0.016];

/** The cubic handle length that turns a quarter turn into an arc, times r. */
const ARC_HANDLE = 0.5523;


type Point = { x: number; y: number };

const at = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;

const shift = (p: Point, dx: number, dy: number): Point => ({
  x: p.x + dx,
  y: p.y + dy,
});

/**
 * The box as an SVG path, drawn to fit inside `width` × `height` — every point
 * of it, the bellies included. Fitting is this module's business rather than a
 * caller's: a caller knows the room it has, and the box's job is to stay in it.
 *
 * The path is meant to be filled, not stroked. An outline in a second colour
 * turned out to be a statement only two of the three themes could make — in Ink
 * the accent *is* the ink, so there was nothing for an edge to contrast with —
 * and a shape that is drawn in one theme and outlined in another is two shapes.
 * The silhouette carries it in all three.
 *
 * `radius` is nominal; the corners land within about 15% either side of it.
 */
export function boxPath(width: number, height: number, radius: number): string {
  // A side's bow is a fraction of that side, so top and bottom are measured
  // against the width and the two flanks against the height.
  const [bTop, bRight, bBottom, bLeft] = [
    BELLY[0] * width,
    BELLY[1] * height,
    BELLY[2] * width,
    BELLY[3] * height,
  ];

  // Each edge is held in by its own bow: only a side that bellies *outward*
  // needs room at all, and the four rarely need the same amount.
  const room = (bow: number) => Math.max(0, bow);

  const x0 = room(bLeft);
  const y0 = room(bTop);
  const x1 = width - room(bRight);
  const y1 = height - room(bBottom);

  // A corner pair may not together exceed the side they share, or the box is
  // drawn to numbers this function never returned — the same limit
  // `organicCorners` documents, enforced here rather than trusted.
  const limit = Math.min(x1 - x0, y1 - y0) / 2;
  const r = CORNER.map((factor) => Math.max(0, Math.min(radius * factor, limit)));
  const [rTL, rTR, rBR, rBL] = r;

  // Clockwise from the top-left corner's end, which is where the pen starts.
  const start: Point = { x: x0 + rTL, y: y0 };
  const topEnd: Point = { x: x1 - rTR, y: y0 };
  const rightStart: Point = { x: x1, y: y0 + rTR };
  const rightEnd: Point = { x: x1, y: y1 - rBR };
  const bottomStart: Point = { x: x1 - rBR, y: y1 };
  const bottomEnd: Point = { x: x0 + rBL, y: y1 };
  const leftStart: Point = { x: x0, y: y1 - rBL };
  const leftEnd: Point = { x: x0, y: y0 + rTL };

  /** A side, bowed off true by `bow` along its outward normal. */
  const side = (from: Point, to: Point, nx: number, ny: number, bow: number) => {
    const c1 = shift(
      { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 },
      nx * bow,
      ny * bow
    );
    const c2 = shift(
      { x: from.x + ((to.x - from.x) * 2) / 3, y: from.y + ((to.y - from.y) * 2) / 3 },
      nx * bow,
      ny * bow
    );
    return `C${at(c1)} ${at(c2)} ${at(to)}`;
  };

  /**
   * A corner, as a quarter turn from travelling `in` to travelling `out`. Both
   * directions are unit vectors, which is what keeps this readable at the four
   * call sites where the signs are otherwise easy to get subtly wrong.
   */
  const corner = (
    from: Point,
    to: Point,
    inX: number,
    inY: number,
    outX: number,
    outY: number,
    cornerRadius: number
  ) => {
    const h = ARC_HANDLE * cornerRadius;
    const c1 = shift(from, inX * h, inY * h);
    const c2 = shift(to, -outX * h, -outY * h);
    return `C${at(c1)} ${at(c2)} ${at(to)}`;
  };

  return [
    `M${at(start)}`,
    side(start, topEnd, 0, -1, bTop),
    corner(topEnd, rightStart, 1, 0, 0, 1, rTR),
    side(rightStart, rightEnd, 1, 0, bRight),
    corner(rightEnd, bottomStart, 0, 1, -1, 0, rBR),
    side(bottomStart, bottomEnd, 0, 1, bBottom),
    corner(bottomEnd, leftStart, -1, 0, 0, -1, rBL),
    side(leftStart, leftEnd, -1, 0, bLeft),
    corner(leftEnd, start, 0, -1, 1, 0, rTL),
    // Closed rather than left to the fill rule to shut, so the last corner
    // meets the first knot deliberately. A hand's overshoot would be in
    // character, but on a filled path an overshoot is a tab, not a flourish.
    'Z',
  ].join(' ');
}

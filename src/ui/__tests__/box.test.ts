import { boxPath } from '../box';

/** Arbitrary, and deliberately not the wobbly button's own numbers. */
const WIDTH = 220;
const HEIGHT = 56;
const RADIUS = 14;

type Point = { x: number; y: number };

/**
 * Reads back the one path shape `boxPath` emits — a move, cubics, a close — and
 * walks it.
 *
 * Walking the whole path rather than checking the eight knots is the point:
 * what has to stay inside the box is every point the pen passes through, and
 * the bellies bow furthest between the knots, which is exactly where knot
 * checks would not be looking.
 */
function samplePath(d: string, perSegment = 64): Point[] {
  const parse = (chunk: string): Point[] =>
    chunk
      .replace('Z', '')
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x, y };
      });

  const [move, ...segments] = d.split('C');
  let from = parse(move.replace('M', ''))[0];
  const points: Point[] = [from];

  for (const segment of segments) {
    const [c1, c2, end] = parse(segment);
    for (let s = 1; s <= perSegment; s++) {
      const t = s / perSegment;
      const u = 1 - t;
      const [a, b, c, cubed] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      points.push({
        x: a * from.x + b * c1.x + c * c2.x + cubed * end.x,
        y: a * from.y + b * c1.y + c * c2.y + cubed * end.y,
      });
    }
    from = end;
  }

  return points;
}

describe('boxPath', () => {
  it('stays inside the room it was given', () => {
    const points = samplePath(boxPath(WIDTH, HEIGHT, RADIUS));

    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(-0.01);
      expect(x).toBeLessThanOrEqual(WIDTH + 0.01);
      expect(y).toBeGreaterThanOrEqual(-0.01);
      expect(y).toBeLessThanOrEqual(HEIGHT + 0.01);
    }
  });

  it('closes where it started', () => {
    const points = samplePath(boxPath(WIDTH, HEIGHT, RADIUS));
    const first = points[0];
    const last = points[points.length - 1];

    expect(last.x).toBeCloseTo(first.x, 1);
    expect(last.y).toBeCloseTo(first.y, 1);
    expect(boxPath(WIDTH, HEIGHT, RADIUS).endsWith('Z')).toBe(true);
  });

  it('draws the same box every time — nothing here is rolled at runtime', () => {
    expect(boxPath(WIDTH, HEIGHT, RADIUS)).toBe(
      boxPath(WIDTH, HEIGHT, RADIUS)
    );
  });

  it('closes on four corners that disagree', () => {
    // The four corner radii reach the path as the distance from each corner of
    // the rectangle to where the straight run ends, so unequal corners show up
    // as unequal first and last knots along the top edge.
    const d = boxPath(WIDTH, HEIGHT, RADIUS);
    const [move, ...segments] = d.split('C');
    const startX = Number(move.replace('M', '').trim().split(',')[0]);
    const topEndX = Number(
      segments[0].trim().split(/\s+/)[2].split(',')[0]
    );

    const leftCorner = startX;
    const rightCorner = WIDTH - topEndX;
    expect(leftCorner).not.toBeCloseTo(rightCorner, 1);
  });

  it('never lets a corner pair outgrow the side they share', () => {
    // A radius past half the shorter side is what makes a platform silently
    // rescale a box; here it has to be clamped instead.
    const points = samplePath(boxPath(80, 40, 999));

    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(80);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(40);
    }
  });
});

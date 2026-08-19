import { arcLength, ringPath } from '../ring';

/**
 * Arbitrary, and deliberately not the TimerRing's own numbers — and deliberately
 * two *different* numbers. A ring is centred on a point, not on a scalar, and
 * the app's only square-framed caller passes the same value twice. Given one
 * number here, a path that had transposed its two coordinates would satisfy
 * every assertion in this file.
 */
const CX = 105;
const CY = 61;
const RADIUS = 100;

type Point = { x: number; y: number };

/**
 * Reads back the one path shape `ringPath` emits — a move, then cubics — and
 * walks it.
 *
 * The module hands out geometry as a string, so a test of the geometry has to
 * parse it. Walking the whole path rather than checking the seven knots is the
 * point: what has to stay inside the box is every point the pen passes through,
 * and the knots are merely where we happen to know the radius already.
 */
function samplePath(d: string, perSegment = 64): Point[] {
  const parse = (chunk: string): Point[] =>
    chunk
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
      const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      points.push({
        x: a * from.x + b * c1.x + c * c2.x + d * end.x,
        y: a * from.y + b * c1.y + c * c2.y + d * end.y,
      });
    }
    from = end;
  }

  return points;
}

const distanceFromCentre = (p: Point) => Math.hypot(p.x - CX, p.y - CY);

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

const SAMPLES = samplePath(ringPath(CX, CY, RADIUS));

describe('ringPath', () => {
  // Coordinates are written to two decimals, so a hair of slack is rounding.
  const ROUNDING = 0.02;

  it('keeps every point of the ring inside the radius it is given', () => {
    const reach = Math.max(...SAMPLES.map(distanceFromCentre));
    expect(reach).toBeLessThanOrEqual(RADIUS + ROUNDING);
  });

  it('still fills the radius it is given', () => {
    // The other half of the same claim: fitting the bulge inside the box must
    // not be done by drawing a visibly smaller ring.
    const reach = Math.max(...SAMPLES.map(distanceFromCentre));
    expect(reach).toBeGreaterThan(RADIUS * 0.99);
  });

  it('closes: the last point lands back on the first', () => {
    const start = SAMPLES[0];
    const end = SAMPLES[SAMPLES.length - 1];
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThan(ROUNDING);
  });

  it('starts at twelve o’clock and runs clockwise', () => {
    const start = SAMPLES[0];
    expect(Math.abs(start.x - CX)).toBeLessThan(1);
    expect(start.y).toBeLessThan(CY - RADIUS * 0.95);

    // Straight away it travels to the right, and a quarter of the way round it
    // is at three o'clock — this is what lets the elapsed arc be a plain dash
    // offset rather than a rotation.
    expect(SAMPLES[1].x).toBeGreaterThan(start.x);
    const quarter = SAMPLES[Math.round((SAMPLES.length - 1) / 4)];
    expect(quarter.x).toBeGreaterThan(CX + RADIUS * 0.9);
  });
});

describe('arcLength', () => {
  it('measures the path that ringPath actually draws', () => {
    // The elapsed arc is a dash this long, pushed back by what is left. If the
    // number and the path disagreed, a finished sitting would show a gap.
    const measured = polylineLength(SAMPLES);
    expect(Math.abs(measured - arcLength(RADIUS)) / measured).toBeLessThan(0.01);
  });

  it('is a circle’s circumference, not some other closed shape’s', () => {
    const mean =
      SAMPLES.reduce((sum, p) => sum + distanceFromCentre(p), 0) / SAMPLES.length;
    const circumference = 2 * Math.PI * mean;
    expect(Math.abs(arcLength(RADIUS) - circumference) / circumference).toBeLessThan(
      0.01
    );
  });

  it('scales with the radius', () => {
    expect(arcLength(2 * RADIUS)).toBeCloseTo(2 * arcLength(RADIUS), 10);
    expect(arcLength(0)).toBe(0);
  });
});

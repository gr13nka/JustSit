/**
 * The geometry of the drawn ring: a circle closed the way a hand closes one.
 *
 * Kept free of react, react-native and svg imports — the src/ui/time.ts
 * precedent — so the arithmetic can be checked without a renderer standing by.
 */

/**
 * The ring is a drawn circle, not a geometric one: seven knots whose radius and
 * spacing are nudged a couple of percent off perfect.
 *
 * The nudges are a fixed table rather than random numbers because this ring is
 * on screen, unchanged, for twenty minutes at a time — a wobble that differed
 * between frames would read as a glitch instead of as a hand.
 */
const KNOT_RADIUS = [1.008, 0.978, 1.021, 0.984, 1.026, 0.974, 1.014];
const KNOT_ANGLE = [0, 0.036, -0.028, 0.02, -0.034, 0.026, -0.018];

type Point = { x: number; y: number };

/** One cubic of the ring, in unit space: a circle of radius 1 about the origin. */
type Cubic = { c1: Point; c2: Point; end: Point };

type Ring = { start: Point; cubics: Cubic[] };

function buildUnitRing(): Ring {
  const n = KNOT_RADIUS.length;
  const step = (2 * Math.PI) / n;
  // Twelve o'clock is -pi/2, and with y pointing down an increasing angle runs
  // clockwise — so the elapsed arc closes the way a clock is read, without the
  // rotation transform this used to need.
  const angle = (i: number) => -Math.PI / 2 + i * step + KNOT_ANGLE[i % n];
  const radius = (i: number) => KNOT_RADIUS[i % n];
  const point = (i: number): Point => ({
    x: Math.cos(angle(i)) * radius(i),
    y: Math.sin(angle(i)) * radius(i),
  });
  /** The circle's tangent at knot i, pointing the way the pen is travelling. */
  const tangent = (i: number): Point => ({
    x: -Math.sin(angle(i)) * radius(i),
    y: Math.cos(angle(i)) * radius(i),
  });

  const cubics: Cubic[] = [];
  for (let i = 0; i < n; i++) {
    // The standard cubic approximation of a circular arc, taken per segment so
    // that unevenly spaced knots still curve evenly between themselves.
    const handle = (4 / 3) * Math.tan((angle(i + 1) - angle(i)) / 4);
    const from = point(i);
    const to = point(i + 1);
    const tFrom = tangent(i);
    const tTo = tangent(i + 1);
    cubics.push({
      c1: { x: from.x + handle * tFrom.x, y: from.y + handle * tFrom.y },
      c2: { x: to.x - handle * tTo.x, y: to.y - handle * tTo.y },
      end: to,
    });
  }

  // Knot n is knot 0 one turn on, so the loop lands exactly back on the start.
  // Leaving a hand's overshoot there would be in character, but this same path
  // carries the elapsed arc, and the overshoot would show up as a hook at twelve.
  return { start: point(0), cubics };
}

function cubicAt(from: Point, cubic: Cubic, t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return {
    x: a * from.x + b * cubic.c1.x + c * cubic.c2.x + d * cubic.end.x,
    y: a * from.y + b * cubic.c1.y + c * cubic.c2.y + d * cubic.end.y,
  };
}

/**
 * Length, sampled rather than solved — a cubic has none in closed form. Uniform
 * scaling scales length with it, so measuring the unit ring once is enough for
 * any size.
 */
function ringLength(ring: Ring): number {
  const STEPS = 32;
  let total = 0;
  let from = ring.start;
  for (const c of ring.cubics) {
    let previous = from;
    for (let s = 1; s <= STEPS; s++) {
      const p = cubicAt(from, c, s / STEPS);
      total += Math.hypot(p.x - previous.x, p.y - previous.y);
      previous = p;
    }
    from = c.end;
  }
  return total;
}

const UNIT_RING = buildUnitRing();
const UNIT_LENGTH = ringLength(UNIT_RING);

/**
 * The ring's widest reach, as a multiple of its nominal radius. The wobble
 * bulges past a perfect circle, and a ring drawn at face value has its bulge a
 * couple of points outside the SVG, where it is silently clipped.
 *
 * Dividing it out is this module's business, not a caller's: `fitRadius` below
 * is the room the ring has, and the ring's job is to stay inside it.
 */
const RING_EXTENT = Math.max(...KNOT_RADIUS);

/** The nominal radius of a ring that has `fitRadius` of room, bulge included. */
function nominal(fitRadius: number): number {
  return fitRadius / RING_EXTENT;
}

/**
 * The ring as an SVG path, centred on (`centre`, `centre`) and fitting inside
 * `fitRadius` of it — every point of it, including the bulge.
 */
export function ringPath(centre: number, fitRadius: number): string {
  const r = nominal(fitRadius);
  const at = (p: Point) =>
    `${(centre + p.x * r).toFixed(2)},${(centre + p.y * r).toFixed(2)}`;
  return `M${at(UNIT_RING.start)} ${UNIT_RING.cubics
    .map((c) => `C${at(c.c1)} ${at(c.c2)} ${at(c.end)}`)
    .join(' ')}`;
}

/**
 * How long that path is, for the dash the elapsed arc is drawn as: a fraction
 * of the whole ring has to be measured against something.
 */
export function arcLength(fitRadius: number): number {
  return UNIT_LENGTH * nominal(fitRadius);
}

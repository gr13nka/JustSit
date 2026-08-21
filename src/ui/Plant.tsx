import Svg, { Path } from 'react-native-svg';

import { isKnownPlant, PlantKey } from '../domain/plants';
import { ColorName } from '../theme/themes';
import { useColor } from '../theme/useColor';
import { CANVAS, Ink, ROOT_Y } from './field';
import { PEN_DOODLE } from './pen';
import { ringPath } from './ring';

/**
 * How a plant is drawn.
 *
 * Plant *identity* (src/domain/plants.ts) is kept separate from plant
 * *rendering* (here), so a species can be redrawn — or swapped for a PNG —
 * without touching a single stored session. Note a PNG would not be tintable
 * the way these are: it carries whatever colours it was drawn in.
 */

/**
 * The three pens a bloom may be drawn in, held as token names rather than
 * values so the drawings stay inside the palette. Green is not among them:
 * green is the base every plant is drawn in, and a bright is the exception on
 * top of it.
 */
type BloomPen = Extract<ColorName, 'penPink' | 'penOrange' | 'penBlue'>;

type Species = {
  /** Stems, leaves, caps, husks — everything that is simply growth. */
  growth: readonly string[];
  /**
   * The one bright this species blooms in, and the paths drawn in it. Fixed per
   * species, never picked per session: the garden is the app's only colour, and
   * it should read as a garden — mostly green, with a bloom here and there —
   * rather than as a palette.
   */
  bloom?: { pen: BloomPen; paths: readonly string[] };
};

/**
 * All twelve species. Everything is rooted around y=43 so that a plot of plants
 * shares a baseline, and nothing reaches past the 3-unit margin the round nib
 * needs.
 */
const SPECIES: Record<PlantKey, Species> = {
  grass: {
    // Blades planted apart, each with its own curl. Sprung from one point they
    // read as an arrowhead at garden size, not as grass.
    growth: [
      'M17,43 C15.8,36.6 12.8,30.8 8.6,26.8',
      'M24,43 C25,36 23.4,28.6 24.6,20.8',
      'M31,43 C32.6,37.4 35.6,32.2 39.4,28.6',
    ],
  },
  sprout: {
    growth: [
      'M24,43 C22.8,38 24.4,32.6 24,26.4',
      'M24,26.4 C19.8,26.7 17.7,24.6 18,20.4 C22.2,20.1 24.3,22.2 24,26.4',
      'M24,26.4 C28.2,26.7 30.3,24.6 30,20.4 C25.8,20.1 23.7,22.2 24,26.4',
    ],
  },
  clover: {
    growth: [
      'M24,43 C23,38 24.6,33 24,28',
      'M24,28 C20.6,24.4 20,19.6 24,16.4 C28.2,19.4 27.6,24.4 24,28',
      'M24,28 C19.4,28.6 15,27 14.6,22.6 C18.4,20.4 22.4,23.6 24,28',
      'M24,28 C28.6,28.6 33,27 33.4,22.6 C29.6,20.4 25.6,23.6 24,28',
    ],
  },
  fern: {
    growth: [
      'M24,43 C22.8,34 25.2,20 23.6,8.6',
      'M24.2,35.4 C21,34.6 18.4,32.8 16.6,29.6',
      'M24.2,35.4 C27.4,34.8 30,33 31.8,29.8',
      'M24.4,27.8 C21.8,27.2 19.6,25.6 18.2,22.8',
      'M24.4,27.8 C27,27.2 29.2,25.6 30.6,22.8',
      'M24,20.4 C22,19.8 20.4,18.6 19.4,16.4',
      'M24,20.4 C26,19.8 27.6,18.6 28.6,16.4',
    ],
  },
  tulip: {
    growth: [
      'M24,24 C22,30.4 26,35.6 23.2,42.6',
      'M21,39.4 C15,36.4 10,28.4 12,18.4 C16,24.4 20,30.4 21,39.4',
      'M25,38.4 C31,35.4 36,27.4 35,19.4 C31,25.4 26,31.4 25,38.4',
    ],
    bloom: {
      pen: 'penPink',
      paths: [
        'M18,24 C16,18 15,12 17,10 C19,13 20,15 21,16 C22,12 23,9 24,8 C25,9 26,12 27,16 C28,15 29,13 31,10 C33,12 32,18 30,24 C27,26 21,26 18.5,23',
      ],
    },
  },
  daisy: {
    growth: [
      'M24,18.5 C23,26 25,34 23.2,42.6',
      'M23,31 C18,29 16,32 19,35 C21,34 23,33 23,31',
    ],
    bloom: {
      pen: 'penOrange',
      paths: [
        'M24,13 C25.3,10.7 24.9,8.5 23,6.5 C21.7,8.8 22.1,11 24,13 M26,14 C29,13.6 31,11.9 32,9 C29,9.4 27,11.1 26,14 M26.5,17 C28.2,19.2 30.4,19.9 33,19 C31.3,16.8 29.1,16.1 26.5,17 M25,18.5 C24.5,21.3 25.6,23.5 28,25 C28.5,22.2 27.4,20 25,18.5 M22,18 C19.1,19 17.4,21 17,24 C19.9,23 21.6,21 22,18 M21,16 C18.9,14.1 16.5,13.8 14,15 C16.1,16.9 18.5,17.3 21,16',
        'M22,15 C22,13 26,13 26,15 C26,17.5 22,17.5 22,15',
      ],
    },
  },
  mushroom: {
    growth: [
      'M9.6,25.6 C9,15.6 15.6,10 24,10 C32.4,10 39,15.6 38.4,25.6 C31,27.6 17,27.6 9.6,25.6',
      'M19.4,26.6 C19.6,32.6 19.2,38 19,42.6',
      'M28.6,26.6 C28.4,32.6 28.8,38 29,42.6',
      'M19,42.6 C21.8,41.4 26.2,41.4 29,42.6',
    ],
  },
  thistle: {
    growth: [
      'M24,43 C23,38 24.6,32 24,26',
      'M24,34.8 C20.4,34.8 18,32 17.2,28.8 C20.8,29.2 23.2,31.6 24,34.8',
    ],
    bloom: {
      pen: 'penPink',
      paths: [
        // an egg of a head with the bristles standing out of it — a cup with a
        // dipped rim would read as another tulip, which is what it wants to do
        'M20,26 C19,23.4 19.6,21 21.4,19.6 C23.4,18.6 25.4,18.8 27,20 C28.6,21.4 29,23.6 28,26 C26,27 22,27 20,26',
        'M21,20 C19.6,17 18.6,14.6 18,12',
        'M22.6,19.2 C21.8,16.2 21.4,13.4 21.2,10.6',
        'M24,19 C24,16 24,13.2 24.2,10',
        'M25.4,19.2 C26.2,16.2 26.6,13.4 26.8,10.6',
        'M27,20 C28.4,17 29.4,14.6 30,12',
      ],
    },
  },
  poppy: {
    growth: [
      'M24,43 C24.6,36 22.4,30 24,24.4',
      'M24,34 C20.4,33.4 18.4,31.4 17.6,28.4 C21,29 23.2,30.8 24,34',
    ],
    bloom: {
      pen: 'penOrange',
      paths: [
        // four fat petals as one outline, each a single outward bump between two
        // valleys — the same way the kit draws a cloud or a tree
        'M19.4,9.4 C19.6,3.4 28.4,3.8 28.8,9.6 C34.8,10 34.2,18.4 28.4,18.8 C28,24.6 19.6,24 19.2,18.4 C13.4,18 13.8,9.6 19.4,9.4',
        'M24,12 C25.8,12.2 26.6,13.8 25.8,15.2 C24.6,16.2 22.4,15.8 21.9,14.4 C21.6,13.2 22.6,12 24,12',
      ],
    },
  },
  reed: {
    growth: [
      'M24,43 C23.2,34 24.8,25 24,18',
      // a cattail: a capsule, not a point. A leaf shape here reads as one more
      // stem with a leaf on it, and the garden already has several of those.
      'M24,18 C20.8,17.6 19.6,13.6 20,10.4 C20.4,7 22,5.4 24,5.4 C26,5.4 27.6,7 28,10.4 C28.4,13.6 27.2,17.6 24,18',
      'M24,32 C20.8,30.8 18.8,28 18,24.8 C21.6,25.6 23.6,28.4 24,32',
    ],
  },
  berry: {
    growth: [
      'M24,43 C23,36 24.8,28 24,20.4',
      'M24,30 C20.6,29.4 18.4,27.4 17.6,24.2 C21,24.8 23.4,26.8 24,30',
    ],
    bloom: {
      pen: 'penBlue',
      paths: [
        'M18.4,13.2 C21,13.4 22.2,15.4 21.8,17.4 C21.2,19.6 18.4,20.6 16.4,19.6 C14.8,18.6 14.4,15.8 15.6,14.4 C16.4,13.4 17.4,13.2 18.4,13.2',
        'M29.6,13 C32.4,13.2 33.8,15.6 33,17.8 C32,19.8 29.2,20.4 27.4,19 C25.8,17.8 25.8,15 27.4,13.8 C28.2,13.2 29,13 29.6,13',
        'M24,5.8 C26.6,6 28,8.2 27.2,10.4 C26.4,12.4 23.6,13.2 21.8,11.8 C20.2,10.6 20.2,7.6 21.8,6.4 C22.4,5.9 23.2,5.8 24,5.8',
      ],
    },
  },
  sapling: {
    growth: [
      'M24,43 C23.2,34 24.6,24 24,15.6',
      'M24,28 C21.4,26 18.8,23.6 16.4,21',
      'M24,23 C26.6,21 29.2,18.4 31.6,16',
      'M16.4,21 C14,18.4 13.6,15 15,12 C17.8,13.4 19.2,16.4 18.6,19.4',
      'M31.6,16 C34,13.4 34.4,10 33,7 C30.2,8.4 28.8,11.4 29.4,14.4',
    ],
  },
};

/** A session recorded before a species was renamed still has to draw something. */
const FALLBACK: PlantKey = 'grass';

/**
 * How near a path's two ends must come for it to count as closed. Two units on
 * the 48-unit page — the same order as the wobble baked into the drawings,
 * because a hand that closed a shape to the decimal would not read as a hand.
 */
const CLOSE_ENOUGH = 2;

const COORDINATE = /-?\d*\.?\d+/g;

/**
 * Whether one `M`-started run of curves comes back to where it began. Every
 * path here is an `M` followed by cubics, so the first pair of numbers is where
 * the nib went down and the last pair is where it came up.
 */
function closes(subpath: string): boolean {
  const n = subpath.match(COORDINATE)?.map(Number) ?? [];
  if (n.length < 4) return false;
  return Math.hypot(n[0] - n[n.length - 2], n[1] - n[n.length - 1]) <= CLOSE_ENOUGH;
}

/**
 * A *shape* is a path that closes; anything else is a *stroke*. That single
 * distinction decides which marks take a fill, and it is read off the drawing
 * rather than recorded beside it — so a redrawn plant, or a species added
 * later, comes out right without anyone having to remember this exists.
 *
 * A leaf, a cap, a berry and a bloom all come back to where they started and
 * enclose something. A stem, a blade, a frond and a bristle do not, and filling
 * one would lay a slab across the gap between its ends.
 */
function isShape(d: string): boolean {
  const subpaths = d.split('M').filter((run) => run.trim());
  return subpaths.length > 0 && subpaths.every(closes);
}

type Mark = { d: string; pen: ColorName; shape: boolean };

/**
 * The species flattened into the marks that draw them, once, at load. Whether a
 * path encloses anything is a property of the drawing and cannot change while
 * the app is running, so it is not worth deciding again for every plant in a
 * hundred-cell garden.
 */
/** The plant canvas as a viewBox — the page `field.ts` measures everything against. */
const PAGE = `0 0 ${CANVAS} ${CANVAS}`;

const MARKS = Object.fromEntries(
  (Object.keys(SPECIES) as PlantKey[]).map((key) => {
    const { growth, bloom } = SPECIES[key];
    const marks: Mark[] = growth.map((d) => ({ d, pen: 'penGreen', shape: isShape(d) }));
    if (bloom) {
      for (const d of bloom.paths) marks.push({ d, pen: bloom.pen, shape: isShape(d) });
    }
    return [key, marks];
  })
) as Record<PlantKey, Mark[]>;

/**
 * How far each species' ink reaches on its own page, read off the drawing.
 *
 * Measured rather than written down beside the paths, the same way `isShape`
 * decides which marks take a fill: a species added later, or a plant redrawn,
 * comes out right without anyone having to remember this exists. It runs once
 * at load, because where a drawing's ink ends cannot change while the app runs.
 *
 * These are the *species'* numbers, not the garden's. `field.ts` holds bounds
 * over all twelve, because any plant may land in any cell and the lattice is
 * laid out before anyone knows which. Standing two named plants beside each
 * other is the other question, and the difference between the two is not small:
 * a reed's ink is a third the width of a grass's, so spacing a pair of reeds by
 * the bound leaves them a plant's width apart — three separate drawings rather
 * than a patch of something, which is the one thing a bundle must not look like.
 *
 * Control points are counted along with the ends, so a curve that bulges toward
 * one is measured as if it reached it. That errs wide, which is the safe way to
 * be wrong here: plants come out a shade airier than they need to be rather
 * than overlapping more than they were meant to.
 */
const INK = Object.fromEntries(
  (Object.keys(SPECIES) as PlantKey[]).map((key) => {
    const numbers = MARKS[key].flatMap(
      (mark) => mark.d.match(COORDINATE)?.map(Number) ?? []
    );
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);

    return [
      key,
      {
        // From the centre of the page, which is where the drawings are placed.
        half: Math.max(CANVAS / 2 - Math.min(...xs), Math.max(...xs) - CANVAS / 2) / CANVAS,
        // From the root, which is what a plant is pivoted and stood on.
        rise: (ROOT_Y - Math.min(...ys)) / CANVAS,
      },
    ];
  })
) as Record<PlantKey, Ink>;

/** One species' reach, falling back with the drawing when a key is unknown. */
export function inkOf(plant: string): Ink {
  return INK[isKnownPlant(plant) ? plant : FALLBACK];
}

/**
 * The bright a species blooms in, or null where it only grows.
 *
 * Read off the drawing like everything else about a species, so a plant that is
 * redrawn — or one added later — is described correctly by anything asking, and
 * nobody has to remember a second list. The thumbnail marks on the shelf are
 * what ask: a tally is drawn in green because green means something grew, and a
 * fleck of the species' own pen is the whole of what distinguishes a daisy's
 * row from a fern's at a fifth of an inch.
 */
export function bloomOf(plant: string): ColorName | null {
  const key = isKnownPlant(plant) ? plant : FALLBACK;
  return SPECIES[key].bloom?.pen ?? null;
}

/**
 * Renders one plant, in the doodle pen: cubic béziers on a 48-unit canvas. The
 * wobble is in the path data, not in a runtime effect — a plant that shimmered
 * would be a second thing moving on a screen whose whole job is to hold still.
 *
 * Its shapes are filled with paper. Plants are drawn well past their cells now
 * and land on top of one another, and a cap you can read the next plant's stem
 * through is a tangle rather than a garden. An ink drawing stops being
 * see-through by sitting on paper, not by being coloured in — so the fill is
 * the ground, and colour stays an edge.
 *
 * Which is why `ground` is a prop rather than a constant. The fill is not a
 * property of the drawing; it is whatever the drawing happens to be standing
 * on, and the completion screen's chosen offer stands on the marker rather than
 * on the page. It stays a departure about *opacity* and not about colour — the
 * two grounds are the only values it will take, so a plant can never be filled
 * with a pen.
 *
 * `plant` is whatever a stored session says it is, so a key this version does
 * not know draws the grass fallback rather than throwing. A garden is not worth
 * losing to a renamed species.
 */
export function Plant({
  plant,
  size = 24,
  ground = 'paper',
}: {
  plant: string;
  size?: number;
  ground?: Extract<ColorName, 'paper' | 'paperDeep'>;
}) {
  const color = useColor();
  const key = isKnownPlant(plant) ? plant : FALLBACK;

  return (
    <Svg width={size} height={size} viewBox={PAGE}>
      {MARKS[key].map((mark, i) => (
        <Path
          key={i}
          d={mark.d}
          {...PEN_DOODLE}
          stroke={color[mark.pen]}
          fill={mark.shape ? color[ground] : 'none'}
        />
      ))}
    </Svg>
  );
}

/**
 * The only place in the drawing set where a mark is made without the pen being
 * dragged — a plant's fills are paper, the ground showing through its own
 * outline, while this one is ink and is the whole mark.
 *
 * It is a blob rather than a circle for the same reason nothing else here is
 * geometric: a true circle beside this art reads as a different hand.
 */
const DOT =
  'M24,21.4 C25.5,21.5 26.7,22.7 26.6,24.2 C26.5,25.6 25.3,26.7 23.8,26.6 C22.4,26.5 21.3,25.2 21.4,23.7 C21.5,22.3 22.6,21.3 24,21.4';

/**
 * The blob's own canvas, tighter than the 48 units a plant is drawn on — which
 * is the whole of how the dot is 1.7× the mark it would otherwise be at the
 * same `size`.
 *
 * It needs one because a plant and a dot are not the same kind of drawing. A
 * plant fills its canvas; the dot occupies a tenth of the middle of one, so
 * shrinking the cell from 60pt to 30pt took the plants from clear to small and
 * the dot from small to invisible. A field you cannot see is not a promise.
 */
const DOT_CANVAS = '10 10 28 28';

/** The blob's centre, and so the ring's — the middle of that canvas. */
const DOT_CENTRE = 24;

/**
 * The circle drawn round the dot a sitting would fill next.
 *
 * It answers one question and no other: where does the garden carry on. A field
 * of a hundred alike marks is the point of the garden and also what makes any
 * one of them impossible to pick out, so the ring is a locator — drawn in ink
 * rather than in colour, saying nothing about you, and gone the moment that dot
 * is filled.
 *
 * It circles an empty dot rather than the newest plant on purpose. Marking what
 * you grew is a record, and the garden is already that; marking where you would
 * go next is the only thing on the screen that is about carrying on.
 *
 * The geometry is the timer's ring (`ring.ts`) at another size — seven cubics
 * off a fixed knot table. A geometric circle beside this art would read as a
 * different hand, which is why the dot inside it is a blob and not one either.
 *
 * Concentric with the blob, so both marks come out of `DOT_CANVAS` and the ring
 * cannot drift off its own dot when the cell size changes.
 */
const RING_RADIUS = 7;
const RING_WIDTH = 1.6;

/**
 * The lean that stops it reading as a compass circle.
 *
 * `ring.ts` nudges its knots by a couple of percent, which is plenty at the
 * timer's 210pt but comes to about a sixth of a point here — invisible, so what
 * is left is a machine circle sitting next to a garden drawn by hand. Tilting
 * it and letting one axis run a little long is what a circle closed in one
 * movement actually does, and at this size it is the only part of the wobble
 * you can see.
 *
 * The uneven scale carries the nib with it, so the line thickens through the
 * turn the way a real one does — which is the other half of why the drawn
 * version reads as drawn.
 *
 * Fixed, like every other wobble in the app: one ring is on screen at a time,
 * so it wants one character rather than a family of them.
 */
const RING_LEAN = `rotate(-9 ${DOT_CENTRE} ${DOT_CENTRE}) translate(${DOT_CENTRE} ${DOT_CENTRE}) scale(1.07 0.93) translate(${-DOT_CENTRE} ${-DOT_CENTRE})`;

/**
 * A slot with nothing in it yet — the dot you touch to start a sitting there.
 *
 * It stays the faintest ink in the app: the dots ahead of you are a promise,
 * not an instruction. The ring is `inkSoft` rather than that faint, because a
 * ring drawn in the colour of the thing it circles is not a ring — and it is
 * not the accent, whose four places are spoken for, nor green, which means
 * something grew and nothing has grown here yet.
 */
export function EmptySlot({
  size = 24,
  next = false,
}: {
  size?: number;
  /** Whether this is the dot a sitting would fill next. */
  next?: boolean;
}) {
  const color = useColor();

  return (
    <Svg width={size} height={size} viewBox={DOT_CANVAS}>
      {next && (
        <Path
          d={ringPath(DOT_CENTRE, DOT_CENTRE, RING_RADIUS)}
          transform={RING_LEAN}
          stroke={color.inkSoft}
          strokeWidth={RING_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <Path d={DOT} fill={color.inkFaint} />
    </Svg>
  );
}

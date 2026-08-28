/**
 * Plant identity, and what a sitting is worth.
 *
 * Pure — no images, no React, so it stays testable. Rendering lives in
 * `src/ui/Plant.tsx`.
 */

import { Session } from '../store/types';
import { hash32, scramble } from './hash';
import { currentPlot } from './plots';
import { currentStreak } from './stats';

/**
 * The species registry. Adding to this list is safe at any time: a session
 * stores the key it resolved at completion, so existing plants never change
 * even though the same seed would now be offered something else.
 *
 * These names are placeholders until the real drawings arrive; each maps to one
 * PNG in assets/plants/.
 */
export const PLANT_KEYS = [
  'grass',
  'sprout',
  'clover',
  'fern',
  'tulip',
  'daisy',
  'mushroom',
  'thistle',
  'poppy',
  'reed',
  'berry',
  'sapling',
] as const;

export type PlantKey = (typeof PLANT_KEYS)[number];

/**
 * Picks a species deterministically from a seed.
 *
 * Superseded by `offersFor` for real sittings, and kept because the dev panel
 * and the benches seed gardens with it. Frozen for the same reason `hash32` is.
 */
export function plantFor(seed: string): PlantKey {
  return PLANT_KEYS[hash32(seed) % PLANT_KEYS.length];
}

/** True if a stored key is still one we have art for. */
export function isKnownPlant(key: string): key is PlantKey {
  return (PLANT_KEYS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// What a sitting is worth
// ---------------------------------------------------------------------------

/** How scarce a species is, and the only thing a tier means. */
export type Tier = 'common' | 'mid' | 'rare';

/**
 * Three tiers, and every species is in exactly one.
 *
 * A tier is scarcity and nothing else — a common is a real plant, not a
 * consolation. The short sitting that only ever earns commons has to come back
 * with something worth having, or the garden would start telling people their
 * ten minutes did not count.
 */
export const TIERS: Record<Tier, readonly PlantKey[]> = {
  common: ['grass', 'sprout', 'clover', 'reed'],
  mid: ['fern', 'mushroom', 'daisy', 'tulip'],
  rare: ['thistle', 'poppy', 'berry', 'sapling'],
};

/**
 * One of the three things a finished sitting may be exchanged for.
 *
 * A bundle is always one species. Two of the same plant is a patch of
 * something; two different plants is a shopping list, and the choice is meant
 * to be about what you want in the ground rather than about assembling a set.
 */
export type Offer = {
  plants: PlantKey[];
};

/** At or under this, a sitting earns commons. */
const SHORT_MS = 3 * 60_000;
/** At or under this, the mid tier is in the mix. Past it, rarity is on offer. */
const MEDIUM_MS = 10 * 60_000;

/** Every seventh day of an unbroken run puts a rare on the table. */
const MILESTONE_DAYS = 7;

/** How many offers a finished sitting is shown. Three is a choice; two is a coin. */
const OFFER_COUNT = 3;

/** A tier and a quantity — an offer before its species has been drawn. */
type Shape = { tier: Tier; count: number };

/**
 * The three shapes a sitting of this length is worth.
 *
 * The quantities are the whole argument for sitting longer, and they are set so
 * the arithmetic never rewards chopping a sitting up: three two-minute sits come
 * to three commons, which is exactly the most a twenty-minute sit can plant. You
 * cannot out-plant a long sitting by sitting badly more often — you can only
 * match it, and only in commons.
 */
function shapesFor(durationMs: number, milestone: boolean): Shape[] {
  const shapes: Shape[] =
    durationMs <= SHORT_MS
      ? // Three singles, one tier. The choice is which plant, and that is
        // enough of one — a short sitting that offered a bundle would make
        // every other length pointless.
        [
          { tier: 'common', count: 1 },
          { tier: 'common', count: 1 },
          { tier: 'common', count: 1 },
        ]
      : durationMs <= MEDIUM_MS
        ? // Still singles, because quantity is what the long sitting sells.
          // What a middling one buys is a better plant.
          [
            { tier: 'common', count: 1 },
            { tier: 'mid', count: 1 },
            { tier: 'mid', count: 1 },
          ]
        : // Rarity against quantity, with nothing to separate them but taste:
          // one rare, two mids, or three commons.
          [
            { tier: 'rare', count: 1 },
            { tier: 'mid', count: 2 },
            { tier: 'common', count: 3 },
          ];

  // A week of unbroken days is the one thing that puts a rare within reach of a
  // short sitting. It replaces an offer rather than becoming a fourth, because
  // three is already as much choosing as anyone wants to do after sitting still.
  if (milestone && !shapes.some((s) => s.tier === 'rare')) {
    shapes[shapes.length - 1] = { tier: 'rare', count: 1 };
  }

  return shapes;
}

/**
 * A short, deterministic stream of well-scrambled words from one seed.
 *
 * The counter is added *before* the avalanche rather than after, so successive
 * draws are as unrelated as two different seeds. Scrambling at all is the point:
 * session ids are timestamp-derived, so consecutive sittings differ in their
 * last character, and `hash32`'s raw bits are an arithmetic progression there —
 * see `scramble` in `hash.ts` for the two features this codebase has already
 * banded by forgetting it.
 */
function draws(seed: string): () => number {
  let h = hash32(seed);
  return () => {
    // The golden-ratio step, so the counter itself never lands on a small cycle.
    h = scramble((h + 0x9e3779b9) >>> 0);
    return h;
  };
}

/** Draws a species from a tier, avoiding any already spoken for in this trio. */
function speciesFrom(tier: Tier, taken: Set<string>, next: () => number): PlantKey {
  const pool = TIERS[tier].filter((key) => !taken.has(key));
  // Four species a tier against at most three offers, so the pool cannot empty;
  // falling back to the whole tier means a wider registry cannot make it.
  const from: readonly PlantKey[] = pool.length > 0 ? pool : TIERS[tier];

  const key = from[next() % from.length];
  taken.add(key);
  return key;
}

/**
 * The three offers a finished sitting is shown.
 *
 * Deterministic in every argument, and that is load-bearing: nothing about the
 * trio is stored. The completion screen re-derives it from the session and the
 * sessions before it, so the offers a user is looking at survive the app being
 * killed underneath them.
 *
 * `slotsLeft` is what the garden can still take. It caps every bundle rather
 * than hiding one, because an offer you cannot accept is worse than a smaller
 * one — at a single dot left, all three offers are singles and the choice is
 * back to being about species.
 */
export function offersFor(
  seed: string,
  durationMs: number,
  /**
   * The streak this sitting *completes*, counting the day it happened on.
   *
   * So the seventh day of a run arrives here as 7, and the milestone falls on
   * the sitting that makes that day rather than on the one the morning after.
   * Anything read as of before the sitting is one short of this.
   */
  streak: number,
  slotsLeft: number
): Offer[] {
  const milestone = streak > 0 && streak % MILESTONE_DAYS === 0;
  const shapes = shapesFor(durationMs, milestone);

  // A garden with nothing left in it cannot be planted into at all, and the
  // store opens a new one before it ever asks for offers. One is the floor here
  // so the trio is still a trio if that guard is ever bypassed.
  const room = Math.max(1, slotsLeft);

  const next = draws(seed);
  const taken = new Set<string>();

  return shapes.slice(0, OFFER_COUNT).map((shape) => {
    const key = speciesFrom(shape.tier, taken, next);
    const count = Math.min(shape.count, room);
    return { plants: Array.from({ length: count }, () => key) };
  });
}

/**
 * The same three offers, worked out from what is stored.
 *
 * Both the moment of choosing and any later re-derivation come through here, so
 * there is one answer to "what was this sitting worth" rather than two that
 * have to be kept in step. `session` need not be in `sessions` yet — that is how
 * the store asks before the sitting has been recorded.
 *
 * The two derived inputs are read from different moments, and each is read
 * from the only one that makes it mean anything.
 *
 * The streak counts this sitting: it is what the sitting *completes*, so the
 * weekly rare is on the table on the day it is earned. It is worked out from
 * the sittings before this one plus this one, rather than by adding a day to
 * the streak behind it — a second sitting on the same day adds nothing, and
 * arithmetic would have handed it the next milestone.
 *
 * The room is read as of before: the garden as it was when this sitting
 * started filling it. Counting itself would shrink the offer being made.
 */
export function offersForSession(
  sessions: readonly Session[],
  session: Session,
  gardenSize: number
): Offer[] {
  const at = sessions.findIndex((s) => s.id === session.id);
  const earlier = at === -1 ? sessions : sessions.slice(0, at);

  const plot = currentPlot(earlier, gardenSize);

  return offersFor(
    session.id,
    session.durationMs,
    currentStreak([...earlier, session], session.completedAt),
    plot.size - plot.plants.length
  );
}

import { Session } from '../../store/types';
import {
  isKnownPlant,
  Offer,
  offersFor,
  offersForSession,
  PLANT_KEYS,
  plantFor,
  Tier,
  TIERS,
} from '../plants';

describe('plantFor', () => {
  it('always returns a species we have art for', () => {
    for (let i = 0; i < 500; i++) {
      expect(isKnownPlant(plantFor(`session-${i}`))).toBe(true);
    }
  });

  it('is deterministic — the same seed always gives the same plant', () => {
    expect(plantFor('abc123')).toBe(plantFor('abc123'));
  });

  it('scatters across the whole registry rather than favouring a few', () => {
    const seen = new Set(
      Array.from({ length: 2000 }, (_, i) => plantFor(`s${i}`))
    );
    expect(seen.size).toBe(PLANT_KEYS.length);
  });

  it('gives neighbouring seeds different plants', () => {
    // Session ids are timestamp-derived, so consecutive sittings have similar
    // seeds. A weak hash would grow the same plant twice in a row.
    const run = Array.from({ length: 10 }, (_, i) => plantFor(`m3k2n1-${i}`));
    expect(new Set(run).size).toBeGreaterThan(5);
  });
});

describe('registry growth', () => {
  it('does not change plants that already grew', () => {
    // The guarantee is structural: a session stores the resolved key, so what
    // matters is that stored keys stay valid — not that plantFor is stable
    // across releases (it isn't, and doesn't need to be).
    const grown = { id: 's1', plant: plantFor('s1') };
    const laterRegistry = [...PLANT_KEYS, 'orchid', 'moss'];
    expect(laterRegistry).toContain(grown.plant);
  });
});

describe('isKnownPlant', () => {
  it('rejects a key we have no art for', () => {
    expect(isKnownPlant('dragonfruit')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// What a sitting is worth
// ---------------------------------------------------------------------------

const MIN = 60_000;
const ROOMY = 108;

/** Which tier a species belongs to. Every species is in exactly one. */
function tierOf(key: string): Tier {
  const found = (Object.keys(TIERS) as Tier[]).find((t) =>
    (TIERS[t] as readonly string[]).includes(key)
  );
  if (!found) throw new Error(`${key} is in no tier`);
  return found;
}

/** The tier each of the three offers is drawn from. */
function tiers(offers: Offer[]): Tier[] {
  return offers.map((o) => tierOf(o.plants[0]));
}

function counts(offers: Offer[]): number[] {
  return offers.map((o) => o.plants.length);
}

describe('the tier registry', () => {
  it('places every species exactly once', () => {
    const listed = [...TIERS.common, ...TIERS.mid, ...TIERS.rare];
    expect(listed.slice().sort()).toEqual([...PLANT_KEYS].sort());
    expect(new Set(listed).size).toBe(PLANT_KEYS.length);
  });
});

describe('offersFor', () => {
  it('always offers exactly three', () => {
    for (const ms of [1 * MIN, 5 * MIN, 20 * MIN, 45 * MIN]) {
      expect(offersFor('seed', ms, 0, ROOMY)).toHaveLength(3);
    }
  });

  it('gives the same seed the same trio, forever', () => {
    // Nothing about the offers is stored. The completion screen re-derives them
    // from the session, so a trio that drifted would be a different choice than
    // the one the user is looking at.
    expect(offersFor('abc123', 20 * MIN, 3, ROOMY)).toEqual(
      offersFor('abc123', 20 * MIN, 3, ROOMY)
    );
  });

  it('draws a different trio for a different sitting', () => {
    const a = offersFor('sess-a', 20 * MIN, 0, ROOMY);
    const b = offersFor('sess-b', 20 * MIN, 0, ROOMY);
    expect(a).not.toEqual(b);
  });

  it('never offers the same species twice in one trio', () => {
    for (let i = 0; i < 300; i++) {
      const offers = offersFor(`sess-${i}`, 20 * MIN, 0, ROOMY);
      const species = offers.map((o) => o.plants[0]);
      expect(new Set(species).size).toBe(3);
    }
  });

  it('keeps a bundle to one species', () => {
    for (let i = 0; i < 200; i++) {
      for (const offer of offersFor(`sess-${i}`, 30 * MIN, 0, ROOMY)) {
        expect(new Set(offer.plants).size).toBe(1);
      }
    }
  });
});

describe('what each length is worth', () => {
  it('pays a short sitting in three single commons', () => {
    for (const ms of [1 * MIN, 2 * MIN, 3 * MIN]) {
      const offers = offersFor('sess-1', ms, 0, ROOMY);
      expect(counts(offers)).toEqual([1, 1, 1]);
      expect(tiers(offers)).toEqual(['common', 'common', 'common']);
    }
  });

  it('puts the mid tier in a middling sitting, still as singles', () => {
    for (const ms of [4 * MIN, 10 * MIN]) {
      const offers = offersFor('sess-2', ms, 0, ROOMY);
      expect(counts(offers)).toEqual([1, 1, 1]);
      expect(tiers(offers).filter((t) => t === 'mid').length).toBeGreaterThan(0);
      expect(tiers(offers)).not.toContain('rare');
    }
  });

  it('sells a long sitting rarity against quantity', () => {
    const offers = offersFor('sess-3', 20 * MIN, 0, ROOMY);
    expect(tiers(offers)).toEqual(['rare', 'mid', 'common']);
    expect(counts(offers)).toEqual([1, 2, 3]);
  });

  it('never lets short sittings out-plant one long one', () => {
    // Three two-minute sits come to three commons, which is exactly the most a
    // twenty-minute sit can plant. Sitting badly more often may match a long
    // sitting; it must never beat it.
    const short = Math.max(...counts(offersFor('a', 2 * MIN, 0, ROOMY)));
    const long = Math.max(...counts(offersFor('a', 20 * MIN, 0, ROOMY)));
    expect(3 * short).toBeLessThanOrEqual(long);
  });
});

describe('the weekly rare', () => {
  it('puts a rare on the table every seventh day of a run', () => {
    for (const streak of [7, 14, 70]) {
      const offers = offersFor('sess-4', 2 * MIN, streak, ROOMY);
      expect(tiers(offers)).toContain('rare');
    }
  });

  it('leaves the other days alone', () => {
    for (const streak of [1, 3, 6, 8, 13]) {
      const offers = offersFor('sess-4', 2 * MIN, streak, ROOMY);
      expect(tiers(offers)).not.toContain('rare');
    }
  });

  it('is not triggered by having no streak at all', () => {
    // Zero is divisible by seven, and a garden nobody has sat in is not a
    // milestone.
    expect(tiers(offersFor('sess-4', 2 * MIN, 0, ROOMY))).not.toContain('rare');
  });

  it("leaves a long sitting's trio alone, since it already has one", () => {
    expect(offersFor('sess-5', 20 * MIN, 7, ROOMY)).toEqual(
      offersFor('sess-5', 20 * MIN, 0, ROOMY)
    );
  });

  it('does not turn the milestone into a bundle', () => {
    // The reward is the plant, not the pile.
    const offers = offersFor('sess-6', 2 * MIN, 7, ROOMY);
    expect(counts(offers)).toEqual([1, 1, 1]);
  });
});

describe('a garden running out of room', () => {
  it('never offers a bundle the garden cannot take', () => {
    for (let slotsLeft = 1; slotsLeft <= 5; slotsLeft++) {
      for (let i = 0; i < 50; i++) {
        for (const offer of offersFor(`sess-${i}`, 30 * MIN, 0, slotsLeft)) {
          expect(offer.plants.length).toBeLessThanOrEqual(slotsLeft);
        }
      }
    }
  });

  it('is back to a choice of species at the last dot', () => {
    const offers = offersFor('sess-7', 30 * MIN, 0, 1);
    expect(counts(offers)).toEqual([1, 1, 1]);
    expect(new Set(offers.map((o) => o.plants[0])).size).toBe(3);
  });

  it('trims only what does not fit', () => {
    expect(counts(offersFor('sess-7', 30 * MIN, 0, 2))).toEqual([1, 2, 2]);
  });

  it('still shows three offers when there is nowhere to plant at all', () => {
    // The store opens a garden before it ever asks, so this is the floor under
    // a state the app cannot reach rather than a case it relies on.
    const offers = offersFor('sess-8', 30 * MIN, 0, 0);
    expect(counts(offers)).toEqual([1, 1, 1]);
  });
});

describe('how the species scatter', () => {
  it('reaches every species in the registry', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      for (const offer of offersFor(`sess-${i}`, 30 * MIN, 0, ROOMY)) {
        seen.add(offer.plants[0]);
      }
      // Short sittings only ever reach the commons, so the milestone is what
      // makes a rare reachable from one.
      for (const offer of offersFor(`sess-${i}`, 2 * MIN, 7, ROOMY)) {
        seen.add(offer.plants[0]);
      }
    }
    expect(seen.size).toBe(PLANT_KEYS.length);
  });

  it('does not band across consecutive sittings', () => {
    /*
     * Session ids are timestamp-derived, so consecutive sittings differ in
     * their last character — exactly the case where `hash32`'s raw bits are an
     * arithmetic progression. Taken unscrambled, the rare on offer would walk
     * the tier in step and every user would meet the same four in the same
     * order forever. A uniformity histogram cannot catch that, because a ramp
     * is perfectly uniform; the stride can.
     */
    const rare = TIERS.rare as readonly string[];
    const picks = Array.from({ length: 400 }, (_, i) =>
      rare.indexOf(offersFor(`m3k2n1-${i}`, 30 * MIN, 0, ROOMY)[0].plants[0])
    );

    expect(new Set(picks).size).toBe(rare.length);

    const strides = new Map<number, number>();
    for (let i = 1; i < picks.length; i++) {
      const step = (picks[i] - picks[i - 1] + rare.length) % rare.length;
      strides.set(step, (strides.get(step) ?? 0) + 1);
    }
    // One fixed stride would take every step. A quarter each is what four
    // species scattering looks like; half of them is already suspicious.
    expect(Math.max(...strides.values())).toBeLessThan(picks.length * 0.5);
  });
});

describe('offersForSession', () => {
  const DAY = 86_400_000;
  const NOON = new Date(2026, 6, 28, 12, 0, 0).getTime();

  function sat(id: string, daysAgo: number, slot: number, durationMs = 20 * MIN): Session {
    const at = NOON - daysAgo * DAY;
    return {
      id,
      startedAt: at - durationMs,
      durationMs,
      completedAt: at,
      stage: 1,
      plants: [{ key: 'grass', slot }],
    };
  }

  it('counts this sitting, so the rare lands on the seventh day', () => {
    // Six days behind it and itself today makes seven. The milestone belongs to
    // the sitting that completes the week, not to the one the morning after.
    const earlier = Array.from({ length: 6 }, (_, i) => sat(`e${i}`, 6 - i, i, 2 * MIN));
    const seventh = sat('seventh', 0, 6, 2 * MIN);

    expect(tiers(offersForSession(earlier, seventh, [108]))).toContain('rare');
    // And the same answer once it is recorded: the store asks before the
    // session exists, the completion screen asks again after.
    expect(tiers(offersForSession([...earlier, seventh], seventh, [108]))).toContain(
      'rare'
    );

    // A day short of it, a short sitting is a short sitting.
    const five = Array.from({ length: 5 }, (_, i) => sat(`e${i}`, 5 - i, i, 2 * MIN));
    const sixth = sat('sixth', 0, 5, 2 * MIN);
    expect(tiers(offersForSession(five, sixth, [108]))).not.toContain('rare');
  });

  it('is a fact about the day, not about how often you sat in it', () => {
    // Five days behind and a second sitting today: today is the sixth day
    // whichever sitting asks, so neither of them has reached the week. Adding
    // one to the streak behind the sitting would have handed this one a rare.
    const earlier = Array.from({ length: 5 }, (_, i) => sat(`e${i}`, 5 - i, i, 2 * MIN));
    const first = sat('first', 0, 5, 2 * MIN);
    const again = sat('again', 0, 6, 2 * MIN);

    expect(tiers(offersForSession([...earlier, first], again, [108]))).not.toContain(
      'rare'
    );
  });

  it('reads the room from the garden as it was before this sitting', () => {
    // Two dots left in a garden of three: a bundle of three would not fit.
    const earlier = [sat('a', 2, 0)];
    const today = sat('b', 0, 1);
    const offers = offersForSession(earlier, today, [3]);
    for (const offer of offers) expect(offer.plants.length).toBeLessThanOrEqual(2);
  });

  it('answers the same before and after the sitting is recorded', () => {
    // Which is the whole point: the store asks before the session exists, and
    // the completion screen asks again once it does.
    const earlier = [sat('a', 3, 0), sat('b', 2, 1)];
    const today = sat('c', 0, 2);

    expect(offersForSession(earlier, today, [108])).toEqual(
      offersForSession([...earlier, today], today, [108])
    );
  });
});

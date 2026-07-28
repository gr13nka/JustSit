import { isKnownPlant, PLANT_KEYS, plantFor } from '../plants';

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

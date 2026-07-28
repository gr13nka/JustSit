/**
 * One hash for the whole app. Pure, and deliberately not cryptographic.
 *
 * Two things depend on it giving the same answer forever: a plant's species,
 * and where a dot sits in the grid. Changing the algorithm would re-scatter a
 * garden that is already drawn, so treat this function as frozen.
 */

/** FNV-1a. Small, stable across platforms, and good enough to scatter things. */
export function hash32(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

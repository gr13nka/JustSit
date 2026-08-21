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

/**
 * A final avalanche over `hash32`, for anything that slices bits out of it.
 *
 * FNV-1a's last act is `h = (h ^ c) * prime`, so two keys whose last character
 * differs by one come out differing by about `prime`. In the TOP bits that is a
 * near-monotone ramp; in the BOTTOM bits it is an arithmetic progression of
 * `prime mod 2^k` — for the low twelve bits, exactly 403/4096 per step. Neither
 * is random, and a uniformity histogram cannot tell you so, because a ramp is
 * perfectly uniform.
 *
 * It has bitten this codebase twice from keys whose last character varies. The
 * sway's phases came out 35° apart in reading order, which is a travelling wave
 * dressed up as a seed; the field demo's species swept along each row and laid
 * runs of tulips in stripes. Scramble before slicing, every time.
 *
 * This is murmur3's finalizer, whose whole job is that one flipped input bit
 * changes half the output bits. `hash32` itself stays frozen — the garden's
 * scatter and the burst's start times depend on it answering the same forever.
 */
export function scramble(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

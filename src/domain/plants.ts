/**
 * Plant identity and selection. Pure — no images, no React, so it stays testable.
 * Rendering lives in `src/ui/Plant.tsx`.
 */

import { hash32 } from './hash';

/**
 * The species registry. Adding to this list is safe at any time: a session
 * stores the key it resolved at completion, so existing plants never change
 * even though `plantFor` would now answer differently for the same seed.
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
 * Picks a species deterministically from a seed (the session id).
 * Called exactly once per session, at completion.
 */
export function plantFor(seed: string): PlantKey {
  return PLANT_KEYS[hash32(seed) % PLANT_KEYS.length];
}

/** True if a stored key is still one we have art for. */
export function isKnownPlant(key: string): key is PlantKey {
  return (PLANT_KEYS as readonly string[]).includes(key);
}

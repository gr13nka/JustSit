import { useId } from 'react';

import { hash32 } from '../domain/hash';
import { OrganicCorners, organicCorners } from '../theme/tokens';

/**
 * Uneven corners for one drawn box.
 *
 * What a seed really names is a box's identity among the boxes visible at once.
 * Two boxes that close identically stop reading as drawn — a repeated accident
 * is not an accident — so what every seed has to guarantee is simply that
 * co-visible boxes differ. React's per-instance id already guarantees exactly
 * that, which is why this hook asks for no seed: while callers supplied them,
 * the unevenness was something a screen could forget, and every button in the
 * app was quietly closing on one shared set of corners.
 *
 * Pass `cornerSeed` only where a particular set of corners is the point rather
 * than merely being distinct — the wobbly button's seed was chosen because it
 * scatters all four.
 */
export function useOrganicCorners(
  baseRadius: number,
  cornerSeed?: number
): OrganicCorners {
  // `useId` gives a string ("«r3»"), and mulberry32 wants a uint. Nothing rides
  // on which uint: the ids differ, and that is the whole requirement.
  const id = useId();
  return organicCorners(baseRadius, cornerSeed ?? hash32(id));
}

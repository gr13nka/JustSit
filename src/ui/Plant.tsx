import Svg, { Circle, Path } from 'react-native-svg';

import { isKnownPlant, PlantKey } from '../domain/plants';
import { color } from '../theme/tokens';

/**
 * Renders one plant.
 *
 * PLACEHOLDER ART. These are line drawings standing in until the real PNGs
 * land in assets/plants/. When they do, this component becomes an <Image> and
 * nothing else in the app changes — which is the whole reason plant *identity*
 * (src/domain/plants.ts) is kept separate from plant *rendering* (here).
 *
 * Note the real drawings will not be tintable the way these are: a PNG carries
 * whatever colours it was drawn in.
 */

type Stroke = { d: string; accent?: boolean };

const STEM = { strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const DRAWINGS: Record<PlantKey, Stroke[]> = {
  grass: [
    { d: 'M12 22C11 16 10 12 8 8' },
    { d: 'M12 22C12 15 12 11 12 6' },
    { d: 'M12 22C13 16 14 12 16 9' },
  ],
  sprout: [
    { d: 'M12 22V12' },
    { d: 'M12 15C9 15 7 13 7 10C10 10 12 12 12 15Z' },
    { d: 'M12 13C15 13 17 11 17 8C14 8 12 10 12 13Z' },
  ],
  clover: [
    { d: 'M12 22V13' },
    { d: 'M9.4 10.4m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0' },
    { d: 'M14.6 10.4m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0' },
    { d: 'M12 6.6m-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0' },
  ],
  fern: [
    { d: 'M12 22C12 14 12 8 12 3' },
    { d: 'M12 18C10 17.4 8.6 16 8 14' },
    { d: 'M12 18C14 17.4 15.4 16 16 14' },
    { d: 'M12 13.5C10.4 13 9.4 11.8 9 10.2' },
    { d: 'M12 13.5C13.6 13 14.6 11.8 15 10.2' },
    { d: 'M12 9C11 8.6 10.4 7.6 10 6.4' },
    { d: 'M12 9C13 8.6 13.6 7.6 14 6.4' },
  ],
  tulip: [
    { d: 'M12 22V13' },
    { d: 'M8.6 12.4C8.6 8.4 9.6 5 12 5C14.4 5 15.4 8.4 15.4 12.4Z', accent: true },
    { d: 'M12 17C10 17 8.4 15.6 8 13.6C10 13.6 11.6 15 12 17Z' },
  ],
  daisy: [
    { d: 'M12 22V13' },
    { d: 'M12 5.4V8.2' },
    { d: 'M12 12.6V9.8' },
    { d: 'M8.6 9V9' },
    { d: 'M15.4 9H12.6' },
    { d: 'M8.6 9H11.4' },
    { d: 'M9.6 6.6L11 8' },
    { d: 'M14.4 11.4L13 10' },
    { d: 'M14.4 6.6L13 8' },
    { d: 'M9.6 11.4L11 10' },
    { d: 'M12 9m-1.3 0a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0', accent: true },
  ],
  mushroom: [
    { d: 'M4.8 12C4.8 7.6 8 5 12 5C16 5 19.2 7.6 19.2 12Z' },
    { d: 'M10 12C10 17 9.6 20 9.4 22' },
    { d: 'M14 12C14 17 14.4 20 14.6 22' },
  ],
  thistle: [
    { d: 'M12 22V13' },
    {
      d: 'M12 13C9 13 8 10.2 8.6 7.6C10 9 11 9.6 12 9.6C13 9.6 14 9 15.4 7.6C16 10.2 15 13 12 13Z',
      accent: true,
    },
    { d: 'M12 17.4C10.2 17.4 9 16 8.6 14.4C10.4 14.6 11.6 15.8 12 17.4Z' },
  ],
  poppy: [
    { d: 'M12 22C12 17 11 14 12 12' },
    { d: 'M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', accent: true },
    { d: 'M12 8m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0' },
  ],
  reed: [
    { d: 'M12 22V8.4' },
    { d: 'M12 8.4C10 8.4 9.4 5 12 2.8C14.6 5 14 8.4 12 8.4Z' },
    { d: 'M12 16C10.4 15.4 9.4 14 9 12.4' },
  ],
  berry: [
    { d: 'M12 22V10' },
    { d: 'M9.2 8.4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', accent: true },
    { d: 'M14.8 8.4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', accent: true },
    { d: 'M12 4.8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', accent: true },
  ],
  sapling: [
    { d: 'M12 22V8' },
    { d: 'M12 14L8 10' },
    { d: 'M12 11.6L16 7.6' },
    { d: 'M8 10C7 8.6 7 7 7.6 5.8C9 6.4 9.6 7.8 9.4 9.2' },
    { d: 'M16 7.6C17 6.2 17 4.6 16.4 3.4C15 4 14.4 5.4 14.6 6.8' },
  ],
};

/** A session recorded before a species was renamed still has to draw something. */
const FALLBACK: PlantKey = 'grass';

export function Plant({ plant, size = 24 }: { plant: string; size?: number }) {
  const key = isKnownPlant(plant) ? plant : FALLBACK;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {DRAWINGS[key].map((stroke, i) => (
        <Path
          key={i}
          d={stroke.d}
          fill="none"
          stroke={stroke.accent ? color.terracotta : color.sage}
          {...STEM}
        />
      ))}
    </Svg>
  );
}

/** An unfilled slot in the garden. The dots ahead of you are the promise. */
export function EmptySlot({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="1.3" fill={color.line} />
    </Svg>
  );
}

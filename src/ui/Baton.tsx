import Svg, { G, Path } from 'react-native-svg';

import { color } from '../theme/tokens';
import { PEN_HERO } from './pen';

/** Everything that is Батон whatever he happens to be doing. */
const LOAF = [
  // one continuous outline: haunches, back, both ears, and round to the front
  'M28,165 C19,137 24,103 39,84 C45,75 51,69 59,65 C57,55 61,43 71,47 C79,50 79,61 75,69 C85,62 97,59 109,63 C107,53 111,41 121,45 C129,49 127,61 121,69 C136,67 151,75 159,91 C169,109 169,137 161,154 C156,163 149,169 139,171 C101,177 61,176 28,165 Z',
  'M55,168 C60,159 69,157 76,163',
  'M96,170 C101,160 111,158 119,164',
  'M68,100 C56,97 44,95 33,94 M68,107 C56,108 45,110 35,112 M67,114 C58,118 49,123 42,128',
  'M116,100 C128,96 140,93 151,91 M116,107 C128,109 139,112 149,116 M115,113 C125,119 133,125 141,131',
  'M160,140 C175,149 171,167 152,171 C138,174 128,167 132,157',
] as const;

export type BatonPose = 'sleep' | 'idle';

/** What changes between poses is the face — and, asleep, what is above his head. */
const POSE_MARKS: Record<BatonPose, readonly string[]> = {
  sleep: [
    'M74,98 C77,101 82,101 85,98',
    'M106,96 C109,99 114,99 117,96',
    'M84,112 C88,116 96,116 100,112',
    'M128,38 C137,36 144,36 147,38 C143,43 134,49 130,53 C134,51 143,50 149,52',
    'M149,20 C155,19 160,19 162,21 C158,25 152,30 148,32 C152,31 158,30 163,31',
  ],
  idle: [
    'M76,97 C77.3,97.5 78.7,98.4 80,99',
    'M108,95 C109.3,95.5 110.7,96.4 112,97',
    'M82,112 C87,117 97,117 102,112',
  ],
};

/**
 * Батон, the loaf cat. Ink, like everything else the app draws of itself.
 *
 * He holds the app's quiet places — the reminder step of onboarding, a garden
 * with nothing in it yet — and only those. He never congratulates, never reacts
 * to a sitting, and never turns up on the completion screen: the app's voice is
 * plain and faintly clinical, and a mascot that cheered would belong to a
 * different app entirely.
 */
export function Baton({
  pose = 'sleep',
  size = 120,
}: {
  pose?: BatonPose;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <G stroke={color.ink} {...PEN_HERO}>
        {[...LOAF, ...POSE_MARKS[pose]].map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
    </Svg>
  );
}

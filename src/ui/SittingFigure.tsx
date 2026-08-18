import Svg, { Path } from 'react-native-svg';

import { useColor } from '../theme/useColor';
import { PEN_HERO } from './pen';

/**
 * The welcome illustration: someone sitting, at night, among grass.
 *
 * The one place in the app that is allowed a second colour without a sitting
 * having happened — a first-run hero gets that licence, and the night sky is
 * where it goes. Everything the figure is made of stays ink; the horizon stays
 * the faintest mark on the page, because it is a place to sit and not a line to
 * read.
 */
export function SittingFigure({ size = 220 }: { size?: number }) {
  const color = useColor();

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* a crescent, drawn in one pass out and back */}
      <Path
        d="M168,38 C157,38 149,46 149,57 C149,68 157,76 168,76 C160,71 155,64 155,57 C155,49 160,42 168,38"
        stroke={color.penBlue}
        {...PEN_HERO}
      />

      {/* stars, each four strokes of the pen meeting at a point */}
      <Path
        d="M44,42 C45,48 47,50.5 54,52 C47,53.5 45,56 44,62 C43,56 41,53.5 34,52 C41,50.5 43,48 44,42"
        stroke={color.penBlue}
        {...PEN_HERO}
      />
      <Path
        d="M68,24 C68.8,28.6 70,30.6 76,32 C70,33.4 68.8,35.4 68,40 C67.2,35.4 66,33.4 60,32 C66,30.6 67.2,28.6 68,24"
        stroke={color.penBlue}
        {...PEN_HERO}
      />
      <Path
        d="M176,104 C176.8,108.6 178,110.6 184,112 C178,113.4 176.8,115.4 176,120 C175.4,115.4 174,113.4 168,112 C174,110.6 175.2,108.6 176,104"
        stroke={color.penBlue}
        {...PEN_HERO}
      />

      {/* head */}
      <Path
        d="M100,46 C114,46.6 126.6,56 126,72.6 C125.4,86 113,98.6 99,98 C85.6,97.4 73.4,86 74,71.4 C74.6,57 87,45.4 100,46"
        stroke={color.ink}
        {...PEN_HERO}
      />

      {/*
        Eyes, closed. Set wide, and wider than they look right at first: at this
        weight two lids any closer than a stroke and a half apart run together
        into one mark, and the figure grows a moustache.
      */}
      <Path d="M80,68 C83,72 88,72 91,68" stroke={color.ink} {...PEN_HERO} />
      <Path d="M107,68 C110,72 115,72 118,68" stroke={color.ink} {...PEN_HERO} />

      {/*
        Shoulders to knees in one stroke a side, kept close to straight. Bowed
        any further they close the silhouette into a bell, and the figure stops
        being someone sitting and becomes a chess piece.
      */}
      <Path d="M88,98 C80,112 70,130 58,148" stroke={color.ink} {...PEN_HERO} />
      <Path d="M112,98 C121,111 131,129 142,147" stroke={color.ink} {...PEN_HERO} />

      {/* crossed legs */}
      <Path
        d="M48,156 C64,144 136,146 152,154 C140,170 60,172 48,156"
        stroke={color.ink}
        {...PEN_HERO}
      />

      {/*
        Grass. The pen has one width, so a blade can only taper by curving —
        drawn upright it reads as a post holding something up.
      */}
      <Path d="M36,177 C30,168 24,161 14,156" stroke={color.ink} {...PEN_HERO} />
      <Path d="M42,177 C40,166 38,158 40,147" stroke={color.ink} {...PEN_HERO} />
      <Path d="M158,177 C160,166 162,158 160,147" stroke={color.ink} {...PEN_HERO} />
      <Path d="M164,177 C170,168 176,161 186,156" stroke={color.ink} {...PEN_HERO} />

      {/* the ground */}
      <Path
        d="M14,178 C50,173 88,181 126,175 C150,171 170,177 186,175"
        stroke={color.inkFaint}
        {...PEN_HERO}
      />
    </Svg>
  );
}

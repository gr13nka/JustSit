import processTransformOrigin from 'react-native/Libraries/StyleSheet/processTransformOrigin';

import { ROOT_ORIGIN, ROOT_SHARE } from '../field';

/**
 * The plant pivot, checked against React Native's own parser.
 *
 * This exists because the failure it guards is invisible in every way that
 * usually catches things: no error, no warning, no layout change — a transform
 * does not affect layout, so the cells, the scatter and the next-dot ring all
 * stay exactly where they belong and only the drawings vanish. It does not
 * reproduce in the browser either, because `react-native-web` hands the origin
 * to CSS, which reads decimals perfectly well.
 */
describe('the origin a plant pivots on', () => {
  it('survives React Native, which an equivalent string does not', () => {
    expect(processTransformOrigin(ROOT_ORIGIN)).toEqual(['50%', `${ROOT_SHARE * 100}%`, 0]);
  });

  /**
   * The trap itself, pinned. RN's string parser matches `\d+(?:%|px)` — integer
   * digits and no decimal point — so it does not reject `89.58333333333334%`,
   * it quietly takes `58333333333334%` out of the middle of it and pivots the
   * plant fifty-eight trillion percent down its own height.
   *
   * If a future RN fixes this, the assertion fails and the comment above
   * `ROOT_ORIGIN` can go. Until then it is the reason that constant is an array.
   */
  it('is why the string form is not used', () => {
    const asString = `50% ${ROOT_SHARE * 100}%`;
    const parsed = processTransformOrigin(asString);

    expect(parsed).not.toEqual(ROOT_ORIGIN);
    expect(Number.parseFloat(String(parsed[1]))).toBeGreaterThan(1000);
  });

  it('pivots on the root rather than the foot of the canvas', () => {
    // A nib's margin above the bottom, which is what `ROOT_Y` buys.
    expect(ROOT_SHARE).toBeGreaterThan(0.85);
    expect(ROOT_SHARE).toBeLessThan(1);
    expect(ROOT_ORIGIN[0]).toBe('50%');
    expect(ROOT_ORIGIN[2]).toBe(0);
  });
});
